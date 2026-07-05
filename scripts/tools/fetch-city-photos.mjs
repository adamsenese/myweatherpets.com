#!/usr/bin/env node
// Download each city's chosen Wikimedia photo (photo.candidateUrl in
// data/cities.json) and produce images/cities/<slug>.jpg (1200w hero) and
// <slug>-og.jpg (1200x630 cover-crop) via sips. Idempotent: skips cities
// whose hero already exists. Run from repo root:
//   node scripts/tools/fetch-city-photos.mjs
import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const UA = 'WeatherPetsSiteBot/1.0 (myweatherpets.com; dom@relative.dev)';
const data = JSON.parse(readFileSync('data/cities.json', 'utf8'));

const dims = (p) => {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', p]).toString();
  return [Number(out.match(/pixelWidth: (\d+)/)[1]), Number(out.match(/pixelHeight: (\d+)/)[1])];
};

let ok = 0, failed = [];
for (const c of data.cities) {
  const hero = `images/cities/${c.photo.file}`;
  const og = `images/cities/${c.photo.ogFile}`;
  if (existsSync(hero) && existsSync(og)) { console.log(`skip: ${c.slug}`); continue; }
  if (!c.photo.candidateUrl) { failed.push(`${c.slug}: no candidateUrl`); continue; }
  const tmp = `images/cities/.tmp-${c.slug}`;
  try {
    execFileSync('curl', ['-sfL', '--max-time', '60', '-A', UA, '-o', tmp, c.photo.candidateUrl]);
    // hero: 1200 wide jpeg
    execFileSync('cp', [tmp, hero]);
    execFileSync('sips', ['-Z', '1200', hero], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', hero, '--out', hero], { stdio: 'ignore' });
    // og: cover-crop 1200x630
    execFileSync('cp', [tmp, og]);
    const [w, h] = dims(og);
    const target = 1200 / 630;
    if (w / h >= target) {
      execFileSync('sips', ['--resampleHeight', '630', og], { stdio: 'ignore' });
    } else {
      execFileSync('sips', ['--resampleWidth', '1200', og], { stdio: 'ignore' });
    }
    execFileSync('sips', ['-c', '630', '1200', og], { stdio: 'ignore' });
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', og, '--out', og], { stdio: 'ignore' });
    const heroKB = Math.round(Number(execFileSync('stat', ['-f%z', hero]).toString()) / 1024);
    console.log(`ok: ${c.slug} (hero ${heroKB}KB)`);
    ok++;
  } catch (e) {
    failed.push(`${c.slug}: ${e.message.split('\n')[0]}`);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}
console.log(`done: ${ok} downloaded, ${failed.length} failed`);
if (failed.length) { console.log(failed.join('\n')); process.exitCode = 2; }
