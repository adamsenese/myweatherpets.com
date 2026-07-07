#!/usr/bin/env node
// Fetch pet places from Overpass (one combined query per city, all 4
// categories), post-process, and cache to data/places/<category>/<city>.json.
// Also resolves NWS forecastHourly URLs for US cities. Writes manifest.json
// and prints a thin-page report. Serial + throttled per Overpass etiquette.
// Usage: node scripts/tools/fetch-places.mjs [--city slug] [--force]
//        [--max-age-days 120] [--dry-run]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { CATEGORIES } from './categories.mjs';

const UA = 'WeatherPetsBuild/1.0 (myweatherpets.com; dom@relative.dev)';
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const RADIUS_M = 20000;
const CAP = 60;

const args = process.argv.slice(2);
const getArg = (k, dflt) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : dflt; };
const onlyCity = getArg('--city', null);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const maxAgeDays = Number(getArg('--max-age-days', 120));

const data = JSON.parse(readFileSync('data/cities.json', 'utf8'));
const cities = data.cities.filter((c) => !onlyCity || c.slug === onlyCity);
const catKeys = Object.keys(CATEGORIES);
for (const k of catKeys) mkdirSync(`data/places/${k}`, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hav = (la1, lo1, la2, lo2) => {
  const R = 6371, d = Math.PI / 180;
  const a = Math.sin((la2 - la1) * d / 2) ** 2 + Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin((lo2 - lo1) * d / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

function bucket(tags) {
  if (tags['leisure'] === 'dog_park') return 'dog-parks';
  if (tags['amenity'] === 'veterinary') return 'veterinarians';
  if (tags['shop'] === 'pet' && !tags['craft'] && tags['shop'] !== 'pet_grooming') return 'pet-stores';
  if (tags['amenity'] === 'animal_boarding' || tags['amenity'] === 'animal_daycare') return 'dog-daycare';
  return null;
}

function address(t) {
  const line1 = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const parts = [line1, t['addr:city'], [t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ')].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

const normName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function overpass(city) {
  const q = `[out:json][timeout:90];
(
  nwr["leisure"="dog_park"](around:${RADIUS_M},${city.lat},${city.lon});
  nwr["amenity"="veterinary"](around:${RADIUS_M},${city.lat},${city.lon});
  nwr["shop"="pet"](around:${RADIUS_M},${city.lat},${city.lon});
  nwr["amenity"="animal_boarding"](around:${RADIUS_M},${city.lat},${city.lon});
  nwr["amenity"="animal_daycare"](around:${RADIUS_M},${city.lat},${city.lon});
);
out center tags;`;
  const backoffs = [5000, 15000, 45000];
  for (let attempt = 0; attempt < 3; attempt++) {
    const mirror = MIRRORS[attempt % MIRRORS.length];
    try {
      const resp = await fetch(mirror, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      return { elements: json.elements || [], endpoint: mirror };
    } catch (e) {
      console.warn(`  ${city.slug}: ${e.message} on ${mirror}${attempt < 2 ? `, retrying in ${backoffs[attempt] / 1000}s` : ''}`);
      if (attempt < 2) await sleep(backoffs[attempt]);
    }
  }
  return null;
}

async function nwsHourly(city) {
  try {
    const resp = await fetch(`https://api.weather.gov/points/${city.lat},${city.lon}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/geo+json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const j = await resp.json();
    return j.properties?.forecastHourly || null;
  } catch (e) {
    console.warn(`  ${city.slug}: NWS points failed (${e.message})`);
    return null;
  }
}

function process_(city, elements) {
  const byCat = Object.fromEntries(catKeys.map((k) => [k, []]));
  for (const el of elements) {
    const t = el.tags || {};
    const cat = bucket(t);
    if (!cat) continue;
    const conf = CATEGORIES[cat];
    if (t['access'] === 'private') continue;
    let name = t['name'] || null;
    if (!name) {
      if (!conf.keepUnnamed) continue;
      name = conf.unnamedLabel;
    }
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = {};
    for (const k of conf.tagWhitelist) if (t[k] != null) tags[k] = t[k];
    byCat[cat].push({
      id: `${el.type}/${el.id}`, name, lat, lon,
      distKm: Math.round(hav(city.lat, city.lon, lat, lon) * 10) / 10,
      address: address(t), tags,
      _named: !!t['name'],
    });
  }
  // dedup fuzzy: same normalized name within 150m -> keep the one with address
  for (const cat of catKeys) {
    const seen = [];
    byCat[cat] = byCat[cat].filter((p) => {
      const nn = normName(p.name);
      for (const s of seen) {
        if (s.nn === nn && hav(s.lat, s.lon, p.lat, p.lon) < 0.15) {
          if (!s.ref.address && p.address) { Object.assign(s.ref, p); s.lat = p.lat; s.lon = p.lon; }
          return false;
        }
      }
      seen.push({ nn, lat: p.lat, lon: p.lon, ref: p });
      return true;
    });
    byCat[cat].sort((a, b) => a.distKm - b.distKm);
    byCat[cat] = byCat[cat].slice(0, CAP);
  }
  return byCat;
}

const manifest = existsSync('data/places/manifest.json')
  ? JSON.parse(readFileSync('data/places/manifest.json', 'utf8'))
  : { $schemaVersion: 1, cities: {} };

let fetched = 0, skipped = 0, failed = [];
for (const city of cities) {
  const files = catKeys.map((k) => `data/places/${k}/${city.slug}.json`);
  const fresh = !force && files.every((f) => {
    if (!existsSync(f)) return false;
    const age = (Date.now() - new Date(JSON.parse(readFileSync(f, 'utf8')).fetchedAt).getTime()) / 86400000;
    return age < maxAgeDays;
  });
  if (fresh) { skipped++; continue; }
  if (dryRun) { console.log(`would fetch: ${city.slug}`); continue; }

  process.stdout.write(`${city.slug} ... `);
  const res = await overpass(city);
  if (!res) { failed.push(city.slug); console.log('FAILED'); await sleep(2500); continue; }
  const byCat = process_(city, res.elements);
  const now = new Date().toISOString();
  const counts = {};
  for (const cat of catKeys) {
    const places = byCat[cat].map(({ _named, ...p }) => p);
    // minResults counts named-first: unnamed only pad if named alone < min
    const named = byCat[cat].filter((p) => p._named).length;
    counts[cat] = named >= CATEGORIES[cat].minResults ? places.length
      : (CATEGORIES[cat].keepUnnamed ? places.length : named);
    writeFileSync(`data/places/${cat}/${city.slug}.json`, JSON.stringify({
      $schemaVersion: 1, city: city.slug, category: cat, fetchedAt: now,
      endpoint: res.endpoint, radiusKm: RADIUS_M / 1000, rawCount: byCat[cat].length,
      places,
    }, null, 1));
  }
  const nws = city.country === 'US' ? await nwsHourly(city) : null;
  manifest.cities[city.slug] = { nws: nws ? { hourlyUrl: nws } : null, counts };
  manifest.generatedAt = now.slice(0, 10);
  writeFileSync('data/places/manifest.json', JSON.stringify(manifest, null, 1));
  console.log(catKeys.map((k) => `${k}:${manifest.cities[city.slug].counts[k]}`).join(' '));
  fetched++;
  await sleep(2500);
}

console.log(`\nfetched ${fetched}, cache-skipped ${skipped}, failed: ${failed.join(', ') || 'none'}`);
// thin-page report
console.log('\n=== thin (below minResults) ===');
for (const [slug, m] of Object.entries(manifest.cities)) {
  const thin = catKeys.filter((k) => (m.counts?.[k] ?? 0) < CATEGORIES[k].minResults);
  if (thin.length) console.log(`  ${slug}: ${thin.join(', ')}`);
}
