#!/usr/bin/env node
// Generate /weather/ city pages, the hub, sitemap entries, and the Worker's
// city whitelist from data/cities.json. Zero dependencies. Run from repo root:
//   node scripts/build-cities.mjs
// After changing js/weather-page.js or css/style.css, also re-minify:
//   npx esbuild js/weather-page.js --minify --outfile=js/weather-page.min.js
//   npx esbuild css/style.css --minify --outfile=css/style.min.css
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ANIMATED_PETS = new Set(['jeter','maple','tonka','hugh','frenchy','jumper','guinness','milo']);

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function fail(msg) { console.error(`ERROR: ${msg}`); process.exitCode = 1; }

// ---- load + validate --------------------------------------------------------
const data = JSON.parse(readFileSync(join(ROOT, 'data/cities.json'), 'utf8'));
const cities = data.cities;
const REQUIRED = ['slug','name','displayName','country','region','lat','lon','timezone','units','pet','petName','petStyle','petBeat','photo','funFacts','climate','faq'];

const seenFaq = new Map();
for (const c of cities) {
  for (const k of REQUIRED) if (c[k] === undefined) fail(`${c.slug || '?'}: missing key "${k}"`);
  if (!ANIMATED_PETS.has(c.pet)) fail(`${c.slug}: pet "${c.pet}" has no pixel animation frames`);
  if (!existsSync(join(ROOT, 'images/cities', c.photo.file))) fail(`${c.slug}: photo images/cities/${c.photo.file} missing`);
  if (!existsSync(join(ROOT, 'images/cities', c.photo.ogFile))) fail(`${c.slug}: og photo missing`);
  if (!existsSync(join(ROOT, `images/pets/${c.pet}/cloudy-${c.petStyle}.jpg`))) fail(`${c.slug}: fallback scene images/pets/${c.pet}/cloudy-${c.petStyle}.jpg missing`);
  if (!Array.isArray(c.funFacts) || c.funFacts.length < 3) fail(`${c.slug}: needs >=3 funFacts`);
  if (!Array.isArray(c.faq) || c.faq.length < 3) fail(`${c.slug}: needs >=3 faq entries`);
  if (c.climate.avgHighByMonthF.length !== 12 || c.climate.avgLowByMonthF.length !== 12) fail(`${c.slug}: climate months != 12`);
  for (const f of c.faq) {
    if (seenFaq.has(f.a)) console.warn(`WARN duplicate FAQ answer shared by ${seenFaq.get(f.a)} and ${c.slug}`);
    seenFaq.set(f.a, c.slug);
  }
}
if (process.exitCode) process.exit();

// ---- helpers ----------------------------------------------------------------
// Walkability band for a month's average high (build-time coloring; same bands
// as the live verdict / blog guides).
function bandForHigh(hiF) {
  if (hiF >= 90) return ['tc-danger', 'Dangerous — skip midday'];
  if (hiF >= 82) return ['tc-risky', 'Risky — early/late only'];
  if (hiF >= 77) return ['tc-caution', 'Caution — shade & water'];
  if (hiF >= 68) return ['tc-safe', 'Fine for most dogs'];
  if (hiF > 45) return ['tc-safe', 'Safe — great walk weather'];
  if (hiF > 32) return ['tc-caution', 'Coat weather for small dogs'];
  if (hiF > 20) return ['tc-caution', 'Caution — coats & short walks'];
  return ['tc-danger', 'Dangerous cold — potty breaks'];
}
const fToC = (f) => Math.round((f - 32) * 5 / 9);

function climateRows(c) {
  return c.climate.avgHighByMonthF.map((hi, i) => {
    const lo = c.climate.avgLowByMonthF[i];
    const [cls, label] = bandForHigh(hi);
    return `              <tr><td>${MONTHS[i]}</td><td>${hi}&deg;F / ${fToC(hi)}&deg;C</td><td>${lo}&deg;F / ${fToC(lo)}&deg;C</td><td class="${cls}">${label}</td></tr>`;
  }).join('\n');
}

function climateRecords(c) {
  const cl = c.climate;
  const bits = [];
  if (cl.recordHighF != null) bits.push(`<strong>Record high:</strong> ${cl.recordHighF}&deg;F / ${fToC(cl.recordHighF)}&deg;C (${esc(cl.recordHighNote || '')})`);
  if (cl.recordLowF != null) bits.push(`<strong>Record low:</strong> ${cl.recordLowF}&deg;F / ${fToC(cl.recordLowF)}&deg;C (${esc(cl.recordLowNote || '')})`);
  if (cl.avgAnnualSnowIn != null) bits.push(`<strong>Average snowfall:</strong> ${cl.avgAnnualSnowIn}&Prime; a year${cl.snowiestMonth ? `, peaking in ${esc(cl.snowiestMonth)}` : ''}`);
  return bits.length ? `<p class="cw-records">${bits.join(' &middot; ')}</p>` : '';
}

function faqHtml(c) {
  return c.faq.map((f) => `          <div class="faq-item">
            <button class="faq-question"><span>${esc(f.q)}</span><span class="faq-icon">+</span></button>
            <div class="faq-answer"><div class="faq-answer-inner">${esc(f.a)}</div></div>
          </div>`).join('\n');
}

function jsonld(c) {
  const url = `https://myweatherpets.com/weather/${c.slug}/`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': url, url,
        name: `${c.name} Weather for Pet Owners`,
        description: `Live ${c.name} weather for dog and cat owners with walk-safety verdicts, hourly and 10-day forecasts, and ${c.name} climate history.`,
        isPartOf: { '@id': 'https://myweatherpets.com/#website' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://myweatherpets.com/' },
          { '@type': 'ListItem', position: 2, name: 'City Weather', item: 'https://myweatherpets.com/weather/' },
          { '@type': 'ListItem', position: 3, name: c.displayName, item: url },
        ],
      },
      {
        '@type': 'Place',
        name: c.displayName,
        geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lon },
        address: { '@type': 'PostalAddress', addressRegion: c.region, addressCountry: c.country },
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }, null, 2).split('\n').map((l) => '  ' + l).join('\n').trim();
}

function moreCities(c) {
  const others = cities.filter((o) => o.slug !== c.slug).slice(0, 3);
  if (!others.length) return '';
  const cards = others.map((o) => `          <a href="/weather/${o.slug}/" class="blog-card cw-city-card" data-fast-goal="city-hub-click">
            <span class="blog-tag">${esc(o.region)}</span>
            <h2>${esc(o.displayName)}</h2>
            <p>Live weather and walk verdicts, anchored by ${esc(o.petName)}.</p>
          </a>`).join('\n');
  return `<div class="cw-block">
        <h2>More cities</h2>
        <div class="blog-grid">
${cards}
        </div>
      </div>`;
}

// ---- render city pages ------------------------------------------------------
const cityTpl = readFileSync(join(ROOT, 'templates/city.template.html'), 'utf8');
const today = new Date().toISOString().slice(0, 10);

for (const c of cities) {
  const attrib = c.photo.attribution;
  const map = {
    SLUG: c.slug,
    NAME: esc(c.name),
    DISPLAY_NAME: esc(c.displayName),
    REGION: esc(c.region),
    TZ: c.timezone,
    UNITS: c.units,
    PET: c.pet,
    PET_NAME: esc(c.petName),
    PET_STYLE: c.petStyle,
    PET_BEAT: esc(c.petBeat),
    WORKER_BASE: data.workerBase,
    TITLE: `${c.name} Weather for Pet Owners — Dog Walking Forecast`,
    META_DESCRIPTION: `Live ${c.name} weather for dog and cat owners: can you walk your dog right now, hourly and 10-day forecasts, plus ${c.name} climate records and paw-safety tips.`,
    PHOTO_FILE: c.photo.file,
    PHOTO_OG: c.photo.ogFile,
    PHOTO_ALT: esc(c.photo.alt),
    PHOTO_DIMS: c.photo.width ? `width="${c.photo.width}" height="${c.photo.height}"` : '',
    PHOTO_CAPTION: esc(c.photo.caption || c.photo.alt + '.'),
    PHOTO_ATTRIB_HTML: `<a href="${attrib.sourceUrl}" target="_blank" rel="noopener">${esc(attrib.author)}</a>, <a href="${attrib.licenseUrl}" target="_blank" rel="noopener">${esc(attrib.license)}</a>, via Wikimedia Commons`,
    CLIMATE_ROWS_HTML: climateRows(c),
    CLIMATE_RECORDS_HTML: climateRecords(c),
    CLIMATE_SOURCE_NAME: esc(c.climate.source.name),
    CLIMATE_SOURCE_URL: c.climate.source.url,
    FUN_FACTS_HTML: c.funFacts.map((f) => `          <li>${esc(f)}</li>`).join('\n'),
    FAQ_HTML: faqHtml(c),
    JSONLD: jsonld(c),
    MORE_CITIES_HTML: moreCities(c),
    DATE_ISO: today,
  };
  let html = cityTpl;
  for (const [k, v] of Object.entries(map)) html = html.split(`{{${k}}}`).join(v);
  const leftover = html.match(/\{\{[A-Z_]+\}\}/);
  if (leftover) fail(`${c.slug}: unreplaced token ${leftover[0]}`);
  mkdirSync(join(ROOT, 'weather', c.slug), { recursive: true });
  writeFileSync(join(ROOT, 'weather', c.slug, 'index.html'), html);
  console.log(`page: weather/${c.slug}/index.html`);
}

// ---- render hub --------------------------------------------------------------
const hubTpl = readFileSync(join(ROOT, 'templates/hub.template.html'), 'utf8');
const byRegion = new Map();
for (const c of cities) {
  const key = c.country === 'US' ? 'United States' : c.region;
  if (!byRegion.has(key)) byRegion.set(key, []);
  byRegion.get(key).push(c);
}
let sections = '';
for (const [region, list] of byRegion) {
  const cards = list.map((c) => `        <a href="/weather/${c.slug}/" class="blog-card cw-city-card" data-fast-goal="city-hub-click">
          <span class="blog-tag">${esc(c.region)}</span>
          <h2>${esc(c.displayName)}</h2>
          <p>Live conditions, walk verdicts, and a 10-day forecast, anchored by ${esc(c.petName)}.</p>
          <span class="blog-card-date">Anchor: ${esc(c.petName)}</span>
        </a>`).join('\n');
  sections += `      <h2 class="cw-hub-region">${esc(region)}</h2>\n      <div class="blog-grid">\n${cards}\n      </div>\n`;
}
const hubLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage', '@id': 'https://myweatherpets.com/weather/',
      url: 'https://myweatherpets.com/weather/',
      name: 'Pet Weather by City',
      isPartOf: { '@id': 'https://myweatherpets.com/#website' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: cities.map((c, i) => ({
          '@type': 'ListItem', position: i + 1, name: `${c.displayName} weather for pet owners`,
          url: `https://myweatherpets.com/weather/${c.slug}/`,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://myweatherpets.com/' },
        { '@type': 'ListItem', position: 2, name: 'City Weather', item: 'https://myweatherpets.com/weather/' },
      ],
    },
  ],
}, null, 2);
let hub = hubTpl.split('{{CITY_SECTIONS_HTML}}').join(sections).split('{{JSONLD}}').join(hubLd);
writeFileSync(join(ROOT, 'weather/index.html'), hub);
console.log('page: weather/index.html (hub)');

// ---- sitemap splice -----------------------------------------------------------
const smPath = join(ROOT, 'sitemap.xml');
let sm = readFileSync(smPath, 'utf8');
const START = '  <!-- weather-pages:start -->';
const END = '  <!-- weather-pages:end -->';
if (!sm.includes(START)) {
  sm = sm.replace('</urlset>', `${START}\n${END}\n</urlset>`);
}
const entries = [`  <url>\n    <loc>https://myweatherpets.com/weather/</loc>\n    <lastmod>${today}</lastmod>\n  </url>`]
  .concat(cities.map((c) => `  <url>\n    <loc>https://myweatherpets.com/weather/${c.slug}/</loc>\n    <lastmod>${today}</lastmod>\n  </url>`));
sm = sm.replace(new RegExp(`${START.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  `${START.trim()}\n${entries.join('\n')}\n${END.trim()}`);
writeFileSync(smPath, sm);
console.log(`sitemap: ${entries.length} weather entries`);

// ---- worker whitelist ----------------------------------------------------------
const gen = 'export default {\n' + cities.map((c) =>
  `  ${JSON.stringify(c.slug)}: { "lat": ${c.lat}, "lon": ${c.lon}, "tz": ${JSON.stringify(c.timezone)}, "country": ${JSON.stringify(c.country)} }`
).join(',\n') + '\n};\n';
writeFileSync(join(ROOT, 'worker/src/cities.gen.js'), '// GENERATED by scripts/build-cities.mjs — do not edit by hand.\n' + gen);
console.log(`worker: ${cities.length} cities in whitelist`);
console.log('build complete.');
