#!/usr/bin/env node
// Build data/zips/zcta-<0-9>.json shards from the US Census ZCTA Gazetteer
// (public domain). Shards map zip -> [lat, lon] and are keyed by first digit
// so the client fetches exactly one (~35KB gz) on first zip lookup.
// Usage: node scripts/tools/build-zip-db.mjs <path-to-gazetteer-txt-or-zip>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let src = process.argv[2];
if (!src) { console.error('usage: build-zip-db.mjs <2024_Gaz_zcta_national.zip|.txt>'); process.exit(1); }
if (src.endsWith('.zip')) {
  const dir = src.replace(/\.zip$/, '-extracted');
  execFileSync('unzip', ['-o', '-q', src, '-d', dir]);
  src = dir + '/' + execFileSync('ls', [dir]).toString().trim().split('\n').find((f) => f.endsWith('.txt'));
}

const lines = readFileSync(src, 'utf8').trim().split('\n');
const header = lines[0].split('\t').map((h) => h.trim());
const iGeo = header.indexOf('GEOID');
const iLat = header.indexOf('INTPTLAT');
const iLon = header.indexOf('INTPTLONG');
if (iGeo < 0 || iLat < 0 || iLon < 0) { console.error('unexpected header: ' + header.join(',')); process.exit(1); }

const shards = Array.from({ length: 10 }, () => ({}));
let n = 0;
for (const line of lines.slice(1)) {
  const cols = line.split('\t');
  const zip = cols[iGeo].trim();
  const lat = Math.round(parseFloat(cols[iLat]) * 1e4) / 1e4;
  const lon = Math.round(parseFloat(cols[iLon]) * 1e4) / 1e4;
  if (!/^\d{5}$/.test(zip) || Number.isNaN(lat) || Number.isNaN(lon)) continue;
  shards[Number(zip[0])][zip] = [lat, lon];
  n++;
}
mkdirSync('data/zips', { recursive: true });
shards.forEach((s, d) => writeFileSync(`data/zips/zcta-${d}.json`, JSON.stringify(s)));
console.log(`${n} ZCTAs written across 10 shards`);
