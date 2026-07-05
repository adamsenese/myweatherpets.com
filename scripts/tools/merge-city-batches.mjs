#!/usr/bin/env node
// Merge researched city batch files into data/cities.json, assigning pet
// anchors (round-robin over the 10 pet+style combos), beats, units, and
// photo file names. Chicago (existing) is preserved as-is.
// Usage: node scripts/tools/merge-city-batches.mjs <batch-dir>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const batchDir = process.argv[2];
if (!batchDir) { console.error('usage: merge-city-batches.mjs <batch-dir>'); process.exit(1); }

const COMBOS = [
  ['jeter', 'Jeter', 'realistic'],
  ['maple', 'Maple', 'realistic'],
  ['tonka', 'Tonka', 'realistic'],
  ['hugh', 'Hugh', 'realistic'],
  ['frenchy', 'Frenchy', 'realistic'],
  ['jumper', 'Jumper', 'realistic'],
  ['guinness', 'Guinness', 'cinematic'],
  ['milo', 'Milo', 'cinematic'],
  ['jeter', 'Jeter', 'lofi-room'],
  ['jeter', 'Jeter', 'polaroid-adventure'],
];
const BEATS = [
  '{} Bureau Chief',
  'Senior Anchor, {} Bureau',
  'Chief Walk Meteorologist',
  'Morning Report Anchor',
  'Field Correspondent, {} Bureau',
  'Evening Report Anchor',
];

const data = JSON.parse(readFileSync('data/cities.json', 'utf8'));
const existing = new Set(data.cities.map((c) => c.slug));

const incoming = [];
for (const f of readdirSync(batchDir).filter((f) => /^batch-\d+\.json$/.test(f)).sort()) {
  const arr = JSON.parse(readFileSync(join(batchDir, f), 'utf8'));
  if (!Array.isArray(arr)) { console.error(`${f}: not an array`); process.exit(1); }
  incoming.push(...arr);
  console.log(`${f}: ${arr.length} cities`);
}

let errors = 0;
const err = (m) => { console.error('ERROR: ' + m); errors++; };
let comboIdx = 1; // chicago took combo 0 (jeter/realistic)
let added = 0;

for (const c of incoming) {
  if (existing.has(c.slug)) { console.log(`skip existing: ${c.slug}`); continue; }
  // validation
  for (const k of ['slug','name','displayName','country','region','hubGroup','lat','lon','timezone','photo','funFacts','climate','faq'])
    if (c[k] === undefined) err(`${c.slug || '?'}: missing ${k}`);
  if (!c.photo?.candidateUrl || !c.photo?.attribution?.author || !c.photo?.attribution?.license) err(`${c.slug}: incomplete photo`);
  if (c.climate?.avgHighByMonthF?.length !== 12 || c.climate?.avgLowByMonthF?.length !== 12) err(`${c.slug}: bad climate months`);
  if (!Array.isArray(c.funFacts) || c.funFacts.length < 3) err(`${c.slug}: <3 funFacts`);
  if (!Array.isArray(c.faq) || c.faq.length < 3) err(`${c.slug}: <3 faq`);
  const allStrings = JSON.stringify(c);
  if (allStrings.includes('—')) err(`${c.slug}: contains em dash`);
  // sanity: monthly temps plausible and hi > lo
  if (c.climate?.avgHighByMonthF) {
    c.climate.avgHighByMonthF.forEach((hi, i) => {
      const lo = c.climate.avgLowByMonthF[i];
      if (typeof hi !== 'number' || typeof lo !== 'number' || hi <= lo || hi > 130 || lo < -60)
        err(`${c.slug}: implausible temps month ${i + 1}: hi=${hi} lo=${lo}`);
    });
  }
  if (errors) continue;

  const [pet, petName, petStyle] = COMBOS[comboIdx % COMBOS.length];
  const beat = BEATS[comboIdx % BEATS.length].replace('{}', c.name);
  comboIdx++;

  data.cities.push({
    slug: c.slug, name: c.name, displayName: c.displayName,
    country: c.country, region: c.region, hubGroup: c.hubGroup,
    lat: c.lat, lon: c.lon, timezone: c.timezone,
    units: c.country === 'US' ? 'F' : 'C',
    pet, petName, petStyle, petBeat: beat,
    photo: {
      file: `${c.slug}.jpg`, ogFile: `${c.slug}-og.jpg`,
      alt: c.photo.alt,
      candidateUrl: c.photo.candidateUrl,
      attribution: c.photo.attribution,
    },
    funFacts: c.funFacts,
    climate: c.climate,
    faq: c.faq,
  });
  existing.add(c.slug);
  added++;
}

if (errors) { console.error(`${errors} validation errors — nothing written`); process.exit(1); }
writeFileSync('data/cities.json', JSON.stringify(data, null, 2) + '\n');
console.log(`merged: +${added} cities, total ${data.cities.length}`);
