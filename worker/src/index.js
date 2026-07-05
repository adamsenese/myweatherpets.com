// WeatherPets weather proxy — Cloudflare Worker
// GET /v1/weather/{slug} → slim WeatherKit JSON for whitelisted cities.
// Auth: ES256 JWT signed with the WeatherKit .p8 (WebCrypto). Edge-cached 10 min.
import CITIES from './cities.gen.js';

const ALLOWED_ORIGINS = new Set([
  'https://myweatherpets.com',
  'http://localhost:8000', // local dev (python3 -m http.server)
  'http://127.0.0.1:8000',
]);
const CACHE_TTL = 600; // seconds

let jwtCache = { token: null, exp: 0 };

const enc = new TextEncoder();
const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlBytes = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache.token && now < jwtCache.exp - 120) return jwtCache.token;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer(env.WEATHERKIT_P8),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const exp = now + 3600;
  const header = b64url({ alg: 'ES256', kid: env.KEY_ID, id: `${env.TEAM_ID}.${env.SERVICE_ID}` });
  const payload = b64url({ iss: env.TEAM_ID, sub: env.SERVICE_ID, iat: now, exp });
  // WebCrypto ECDSA emits raw r||s (IEEE P1363) — exactly what JWS ES256 wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  jwtCache = { token: `${header}.${payload}.${b64urlBytes(sig)}`, exp };
  return jwtCache.token;
}

const cToF = (c) => c * 9 / 5 + 32;
const kmhToMph = (k) => k * 0.621371;
const r1 = (n) => Math.round(n * 10) / 10;

function slim(slug, wk) {
  const cur = wk.currentWeather || {};
  const hours = (wk.forecastHourly && wk.forecastHourly.hours) || [];
  const days = (wk.forecastDaily && wk.forecastDaily.days) || [];
  const nowMs = Date.now();
  return {
    slug,
    asOf: cur.asOf || new Date().toISOString(),
    current: {
      tempF: r1(cToF(cur.temperature)),
      feelsLikeF: r1(cToF(cur.temperatureApparent)),
      condition: cur.conditionCode || 'Cloudy',
      humidity: cur.humidity ?? null,
      windMph: cur.windSpeed != null ? Math.round(kmhToMph(cur.windSpeed)) : null,
      uvIndex: cur.uvIndex ?? null,
      isDaylight: cur.daylight !== false,
    },
    hourly: hours
      .filter((h) => new Date(h.forecastStart).getTime() >= nowMs - 30 * 60 * 1000)
      .slice(0, 12)
      .map((h) => ({
        time: h.forecastStart,
        tempF: Math.round(cToF(h.temperature)),
        condition: h.conditionCode,
        precipChance: h.precipitationChance ?? 0,
        isDaylight: h.daylight !== false,
      })),
    daily: days.slice(0, 10).map((d) => ({
      date: d.forecastStart,
      hiF: Math.round(cToF(d.temperatureMax)),
      loF: Math.round(cToF(d.temperatureMin)),
      condition: d.conditionCode,
      precipChance: d.precipitationChance ?? 0,
    })),
    attribution: {
      label: ' Weather',
      url: 'https://developer.apple.com/weatherkit/data-source-attribution/',
    },
  };
}

function corsHeaders(origin) {
  const h = { 'Content-Type': 'application/json' };
  if (ALLOWED_ORIGINS.has(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin';
  }
  return h;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin),
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const m = url.pathname.match(/^\/v1\/weather\/([a-z0-9-]+)$/);
    if (!m) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: corsHeaders(origin) });
    const slug = m[1];
    const city = CITIES[slug];
    if (!city) return new Response(JSON.stringify({ error: 'unknown city' }), { status: 404, headers: corsHeaders(origin) });

    // Edge cache (per-colo). Normalize the cache key to strip query strings.
    const cacheKey = new Request(`https://cache.weatherpets/v1/weather/${slug}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const resp = new Response(hit.body, hit);
      const acao = corsHeaders(origin);
      for (const [k, v] of Object.entries(acao)) resp.headers.set(k, v);
      return resp;
    }

    try {
      const jwt = await getJwt(env);
      const wkUrl =
        `https://weatherkit.apple.com/api/v1/weather/en/${city.lat}/${city.lon}` +
        `?dataSets=currentWeather,forecastDaily,forecastHourly&timezone=${encodeURIComponent(city.tz)}` +
        `&countryCode=${city.country}`;
      const upstream = await fetch(wkUrl, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: 'upstream', status: upstream.status }), {
          status: 502, headers: corsHeaders(origin),
        });
      }
      const body = JSON.stringify(slim(slug, await upstream.json()));
      const resp = new Response(body, {
        headers: { ...corsHeaders(origin), 'Cache-Control': `public, max-age=${CACHE_TTL}` },
      });
      ctx.waitUntil(cache.put(cacheKey, new Response(body, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL}` },
      })));
      return resp;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'internal' }), { status: 502, headers: corsHeaders(origin) });
    }
  },
};
