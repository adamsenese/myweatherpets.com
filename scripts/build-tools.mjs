#!/usr/bin/env node
// Generate /tools/ pages: hub + per-category landers + per-city listing pages.
// Reads data/cities.json + data/places/*. Skips city×category combos below
// minResults (thin-page defense). Splices sitemap between tools markers.
// Run: node scripts/build-tools.mjs   (after scripts/tools/fetch-places.mjs)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIES } from './tools/categories.mjs';

const ROOT = process.cwd();
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function fail(msg) { console.error(`ERROR: ${msg}`); process.exitCode = 1; }

const data = JSON.parse(readFileSync(join(ROOT,'data/cities.json'),'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT,'data/places/manifest.json'),'utf8'));
const cityBySlug = Object.fromEntries(data.cities.map((c) => [c.slug, c]));
const today = new Date().toISOString().slice(0,10);

// Same bands as js/weather-page.js verdict() and build-cities.mjs bandForHigh()
// KEEP IN SYNC.
function bandForHigh(hiF) {
  if (hiF >= 90) return ['tc-danger', 'dangerous heat for park time'];
  if (hiF >= 82) return ['tc-risky', 'park trips are early/late only'];
  if (hiF >= 77) return ['tc-caution', 'shade and water required'];
  if (hiF >= 68) return ['tc-safe', 'good park weather for most dogs'];
  if (hiF > 45) return ['tc-safe', 'great park weather'];
  if (hiF > 32) return ['tc-caution', 'coat weather for small dogs'];
  if (hiF > 20) return ['tc-caution', 'short visits, coats on'];
  return ['tc-danger', 'dangerously cold for park time'];
}
const kmToMi = (km) => Math.round(km * 0.621371 * 10) / 10;

function placesFor(cat, slug) {
  const f = join(ROOT, `data/places/${cat}/${slug}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f,'utf8')) : null;
}

const CHIP_LABELS = {
  barrier: () => 'Fenced', fence_type: () => 'Fenced',
  drinking_water: (v) => v === 'yes' ? 'Water' : null,
  lit: (v) => v === 'yes' ? 'Lit at night' : null,
  surface: (v) => v[0].toUpperCase() + v.slice(1),
  small_dog: (v) => v === 'yes' ? 'Small-dog area' : null,
  emergency: (v) => v === 'yes' ? '24/7 emergency' : null,
};
function chips(tags) {
  const out = [];
  for (const [k, fn] of Object.entries(CHIP_LABELS)) {
    if (tags[k] != null) { const l = fn(tags[k]); if (l && !out.includes(l)) out.push(l); }
  }
  return out;
}

function listingsHtml(pl, city) {
  const mi = city.units === 'F';
  return pl.places.slice(0, 25).map((p) => {
    const dist = mi ? `${kmToMi(p.distKm)} mi` : `${p.distKm} km`;
    const chipHtml = chips(p.tags).map((c) => `<span class="tp-chip">${esc(c)}</span>`).join('');
    const site = p.tags.website ? ` <a href="${esc(p.tags.website)}" target="_blank" rel="nofollow noopener" class="tp-site">Website</a>` : '';
    const phone = p.tags.phone ? ` <span class="tp-phone">${esc(p.tags.phone)}</span>` : '';
    const addr = p.address ? esc(p.address) : 'Location on the map (address not in OpenStreetMap yet)';
    return `          <li class="tp-place-card" data-lat="${p.lat}" data-lon="${p.lon}">
            <div class="tp-place-head"><strong>${esc(p.name)}</strong><span class="tp-dist">${dist}</span></div>
            <div class="tp-place-addr">${addr}</div>
            <div class="tp-chips">${chipHtml}${site}${phone}</div>
          </li>`;
  }).join('\n');
}

function prepHtml(cat, city) {
  const cl = city.climate;
  const hotIdx = cl.avgHighByMonthF.indexOf(Math.max(...cl.avgHighByMonthF));
  const coldIdx = cl.avgLowByMonthF.indexOf(Math.min(...cl.avgLowByMonthF));
  const hotHi = cl.avgHighByMonthF[hotIdx];
  const items = [];
  if (cat === 'dog-parks') {
    items.push(`<strong>Pavement check first.</strong> Getting to the park often means sidewalks: on warm days do the <a href="/blog/hot-pavement-paw-safety.html">7-second pavement test</a> before you set out. Asphalt can run 40 to 60 degrees hotter than the air.`);
    items.push(`<strong>${MONTHS[hotIdx]} is ${city.name}'s hottest month</strong> (average high ${hotHi}&deg;F), which means ${bandForHigh(hotHi)[1]}. Bring water for the park; shared bowls are a gamble.`);
    if (cl.avgAnnualSnowIn) items.push(`<strong>Winter park trips need paw care.</strong> ${city.name} averages ${cl.avgAnnualSnowIn}&Prime; of snow, and the ice-melt salt that follows burns pads. Rinse paws after winter visits, or use <a href="/blog/best-dog-booties-winter.html">booties</a>.`);
    items.push(`<strong>After rain, expect mud</strong> and check the live verdict above before you drive over: a storm cell can close your window fast. Post-rain zoomies are real; towel accordingly.`);
    items.push(`<strong>Coldest stretch:</strong> ${MONTHS[coldIdx]} lows average ${cl.avgLowByMonthF[coldIdx]}&deg;F in ${city.name}. Below about 45&deg;F, small and thin-coated dogs want a <a href="/blog/best-dog-winter-coats.html">coat</a> even for park time.`);
  } else {
    items.push(`<strong>Never leave your dog in the car.</strong> On an 80&deg;F day a parked car passes 100&deg;F inside in about 10 minutes, even with windows cracked.`);
    items.push(`<strong>${MONTHS[hotIdx]} averages ${hotHi}&deg;F highs in ${city.name}</strong>: plan trips for morning, and check the live verdict above before loading up.`);
    items.push(`<strong>Call ahead.</strong> Hours on the map come from community data and change often.`);
  }
  return items.map((i) => `          <li>${i}</li>`).join('\n');
}

function faqData(cat, city, pl) {
  const conf = CATEGORIES[cat];
  const n = pl.places.length;
  const nearest = pl.places[0];
  const cl = city.climate;
  const hotIdx = cl.avgHighByMonthF.indexOf(Math.max(...cl.avgHighByMonthF));
  const hotHi = cl.avgHighByMonthF[hotIdx];
  const fenced = pl.places.filter((p) => p.tags.barrier || p.tags.fence_type).length;
  const dist = city.units === 'F' ? `${kmToMi(nearest.distKm)} miles` : `${nearest.distKm} km`;
  const faqs = [
    { q: `How many ${conf.plural} are in ${city.name}?`,
      a: `OpenStreetMap currently maps ${n} ${conf.plural} within about ${city.units === 'F' ? Math.round(kmToMi(pl.radiusKm)) + ' miles' : pl.radiusKm + ' km'} of central ${city.name}. The closest to the city center is ${nearest.name}, about ${dist} out. Community data grows all the time, so a missing spot just means nobody has mapped it yet.` },
    { q: `When is it too hot for the ${conf.singular === 'dog park' ? 'dog park' : 'trip'} in ${city.name}?`,
      a: `${city.name}'s hottest month is ${MONTHS[hotIdx]} with average highs of ${hotHi} degrees. Above 82 degrees most dogs should keep outdoor time short and shaded, and above 90 degrees skip it entirely. The live verdict on this page applies those same bands to right-now conditions.` },
  ];
  if (cat === 'dog-parks') {
    faqs.push({ q: `Are there fenced dog parks in ${city.name}?`,
      a: fenced > 0
        ? `Yes. At least ${fenced} of the mapped ${city.name} dog parks record fencing in OpenStreetMap, and more may be fenced without the data recorded. The listing chips above mark the confirmed ones.`
        : `Fencing details are not recorded for ${city.name}'s mapped parks yet, which does not mean they are unfenced. Check the park's official page or visit at a quiet hour first.` });
    faqs.push({ q: `What should I bring to a ${city.name} dog park?`,
      a: `Water and a bowl, waste bags, and a towel in the wetter months. In summer go early or late and test the pavement with the back of your hand for 7 seconds first. In winter${cl.avgAnnualSnowIn ? `, with ${city.name} averaging ${cl.avgAnnualSnowIn} inches of snow,` : ''} rinse paws after to clear ice-melt salt.` });
  } else {
    faqs.push({ q: `How do I choose among ${city.name} ${conf.plural}?`,
      a: `Start with the closest options above, then call ahead: hours, walk-in policies, and services vary and community-mapped data can lag. For veterinary emergencies, call while you are on the way so the team can prepare.` });
  }
  return faqs;
}

function verdictPanel(cat, city, isUS) {
  const q = cat === 'dog-parks' ? `Is it dog park weather in ${city.name} right now?` : `Is today a good day for the trip in ${city.name}?`;
  if (isUS) {
    return `<div class="cw-verdict" id="tpVerdictPanel">
        <h2>${esc(q)}</h2>
        <div class="cw-verdict-body">
          <span class="cw-verdict-pill cw-skel" id="tpVerdictPill">Checking&hellip;</span>
          <p class="cw-verdict-reason" id="tpVerdictReason">Waiting on live National Weather Service conditions.</p>
        </div>
        <p class="tp-window" id="tpWindow"></p>
        <p class="cw-verdict-note">Live verdicts use the same vet-sourced temperature bands as our <a href="/blog/safe-walking-temperature-dogs.html">walking guide</a>, plus rain and storm-alert checks.</p>
      </div>`;
  }
  const m = new Date().getMonth();
  const hi = city.climate.avgHighByMonthF[m];
  const [cls, label] = bandForHigh(hi);
  return `<div class="cw-verdict">
        <h2>${esc(q)}</h2>
        <div class="cw-verdict-body">
          <span class="cw-verdict-pill ${cls}">Typical for ${MONTHS[m]}</span>
          <p class="cw-verdict-reason">${city.name} averages ${hi}&deg;F highs in ${MONTHS[m]}: ${label}. Live conditions for ${city.name} are coming soon; meanwhile see the <a href="/weather/${city.slug}/">${city.name} weather page</a>.</p>
        </div>
      </div>`;
}

function cityJsonld(cat, city, pl, faqs) {
  const conf = CATEGORIES[cat];
  const url = `https://myweatherpets.com/tools/${cat}/${city.slug}/`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: conf.cityTitle(city.name),
        description: conf.cityDesc(pl.places.length, city.name),
        isPartOf: { '@id': 'https://myweatherpets.com/#website' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://myweatherpets.com/' },
        { '@type': 'ListItem', position: 2, name: 'Pet Place Finder', item: 'https://myweatherpets.com/tools/' },
        { '@type': 'ListItem', position: 3, name: conf.label, item: `https://myweatherpets.com/tools/${cat}/` },
        { '@type': 'ListItem', position: 4, name: city.displayName, item: url } ] },
      { '@type': 'Place', name: city.displayName,
        geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lon },
        address: { '@type': 'PostalAddress', addressRegion: city.region, addressCountry: city.country } },
      { '@type': 'ItemList', name: `${conf.label} in ${city.name}`,
        itemListElement: pl.places.slice(0, 25).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name })) },
      { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/&deg;/g, ' degrees').replace(/&Prime;/g, ' inches') } })) },
    ],
  }, null, 2);
}

// ---------------------------------------------------------------- city pages
const cityTpl = readFileSync(join(ROOT,'templates/tool-city.template.html'),'utf8');
const shippingCats = Object.entries(CATEGORIES).filter(([,c]) => c.ship).map(([k]) => k);
const shippedBy = {}; // cat -> [city]

for (const cat of shippingCats) {
  const conf = CATEGORIES[cat];
  shippedBy[cat] = [];
  for (const city of data.cities) {
    const m = manifest.cities[city.slug];
    if (!m || (m.counts?.[cat] ?? 0) < conf.minResults) continue;
    const pl = placesFor(cat, city.slug);
    if (!pl || pl.places.length < conf.minResults) continue;
    shippedBy[cat].push(city);

    const isUS = city.country === 'US' && m.nws?.hourlyUrl;
    const faqs = faqData(cat, city, pl);
    const nearby = shippedByNearby(cat, city);
    const title = conf.cityTitle(city.name);
    if (title.length > 60) console.warn(`WARN title >60: ${title}`);

    const map = {
      CATEGORY: cat,
      CATEGORY_LABEL: conf.label,
      CATEGORY_SINGULAR: conf.singular,
      CATEGORY_PLURAL: conf.plural,
      SLUG: city.slug, NAME: esc(city.name), LAT: city.lat, LON: city.lon,
      TZ: city.timezone, UNITS: city.units,
      PET: city.pet, PET_NAME: esc(city.petName),
      SCOUT_BEAT: esc(conf.scoutBeat(city.name)),
      NWS_HOURLY: isUS ? m.nws.hourlyUrl : '',
      TITLE: esc(title),
      META_DESCRIPTION: esc(conf.cityDesc(pl.places.length, city.name)),
      H1: esc(conf.cityH1(city.name, city.petName)),
      HERO_SUB: esc(`Every ${conf.singular} OpenStreetMap knows about near central ${city.displayName}, with distances, amenity details, and an honest weather read on whether today is the day.`),
      COMMENTARY_DEFAULT: esc(`${city.petName} is checking the ${city.name} conditions...`),
      PHOTO_OG: city.photo.ogFile, PHOTO_ALT: esc(city.photo.alt),
      VERDICT_PANEL_HTML: verdictPanel(cat, city, isUS),
      LISTINGS_HEADING: `The ${pl.places.length} mapped ${conf.plural} in ${city.name}`,
      LISTINGS_INTRO: esc(`Sorted by distance from central ${city.name}. Amenity chips come from OpenStreetMap tags; unchipped parks may still have those features.`),
      LISTINGS_HTML: listingsHtml(pl, city),
      LISTINGS_CAP_NOTE: pl.places.length > 25 ? `<p class="tp-source-note">Showing the 25 closest of ${pl.places.length}; the map has all of them.</p>` : '',
      PREP_HEADING: cat === 'dog-parks' ? `Park prep for ${city.name} weather` : `Trip prep for ${city.name} weather`,
      PREP_HTML: prepHtml(cat, city),
      FAQ_HTML: faqs.map((f) => `          <div class="faq-item">
            <button class="faq-question"><span>${esc(f.q)}</span><span class="faq-icon">+</span></button>
            <div class="faq-answer"><div class="faq-answer-inner">${f.a}</div></div>
          </div>`).join('\n'),
      EXTRA_DISCLAIMER: cat === 'veterinarians' ? 'In an emergency, call the clinic while you are on the way.' : '',
      CTA_HEADLINE: esc(`${city.petName} scouts ${city.name}. Your pet covers home.`),
      CTA_SUB: esc(`Get ${cat === 'dog-parks' ? 'park-day' : 'trip-day'} forecasts starring your own dog or cat: AI weather scenes, morning reports, and widgets.`),
      CROSS_LINKS_HTML: crossLinks(cat, city),
      NEARBY_CITIES_HTML: nearby,
      PLACES_JSON: JSON.stringify(pl.places),
      JSONLD: cityJsonld(cat, city, pl, faqs),
    };
    let html = cityTpl;
    for (const [k, v] of Object.entries(map)) html = html.split(`{{${k}}}`).join(v);
    const left = html.match(/\{\{[A-Z_]+\}\}/);
    if (left) fail(`${cat}/${city.slug}: unreplaced ${left[0]}`);
    mkdirSync(join(ROOT, 'tools', cat, city.slug), { recursive: true });
    writeFileSync(join(ROOT, 'tools', cat, city.slug, 'index.html'), html);
  }
  console.log(`${cat}: ${shippedBy[cat].length} city pages`);
}

function shippedByNearby(cat, city) {
  const conf = CATEGORIES[cat];
  const others = data.cities
    .filter((o) => o.slug !== city.slug && (manifest.cities[o.slug]?.counts?.[cat] ?? 0) >= conf.minResults)
    .map((o) => ({ o, d: (o.lat - city.lat) ** 2 + (o.lon - city.lon) ** 2 }))
    .sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.o);
  if (!others.length) return '';
  const cards = others.map((o) => `          <a href="/tools/${cat}/${o.slug}/" class="blog-card cw-city-card">
            <span class="blog-tag">${esc(o.region)}</span>
            <h2>${esc(conf.label)} in ${esc(o.name)}</h2>
            <p>${manifest.cities[o.slug].counts[cat]} mapped, with weather-prep guidance.</p>
          </a>`).join('\n');
  return `<div class="cw-block">
        <h2>Nearby cities</h2>
        <div class="blog-grid">
${cards}
        </div>
      </div>`;
}

function crossLinks(cat, city) {
  const links = [];
  for (const [k, c] of Object.entries(CATEGORIES)) {
    if (k === cat || !c.ship) continue;
    if ((manifest.cities[city.slug]?.counts?.[k] ?? 0) >= c.minResults)
      links.push(`          <li><a href="/tools/${k}/${city.slug}/">${esc(c.label)} in ${esc(city.name)}</a></li>`);
  }
  if (cat === 'dog-parks') {
    links.push('          <li><a href="/blog/safe-walking-temperature-dogs.html">What Temperature Is Safe to Walk Your Dog?</a></li>');
    links.push('          <li><a href="/blog/hot-pavement-paw-safety.html">Hot Pavement and Dog Paws: The 7-Second Test</a></li>');
  } else if (cat === 'veterinarians') {
    links.push('          <li><a href="/blog/dog-heatstroke-warning-signs.html">Dog Heatstroke Warning Signs</a></li>');
  }
  return links.join('\n');
}

// ---------------------------------------------------------------- landers
const landerTpl = readFileSync(join(ROOT,'templates/tool-lander.template.html'),'utf8');
const GROUP_ORDER = ['United States','Canada','Europe','Asia & Middle East','Latin America','Oceania'];

const LANDER_COPY = {
  'dog-parks': `      <div class="cw-block">
        <h2>Finding a great dog park (not just a close one)</h2>
        <p>A good dog park is more than a patch of grass. The features that matter most, and the ones our listings flag when OpenStreetMap has the data: <strong>fencing</strong> (a fully fenced park is non-negotiable for dogs without bulletproof recall), <strong>water</strong> (a fountain or spigot beats a shared communal bowl), <strong>surface</strong> (grass and wood chips are kind to paws; pea gravel drains well after rain; bare dirt turns to mud), and <strong>separate small-dog areas</strong>, which prevent the most common park conflicts.</p>
        <p>Then there is the part most park finders ignore: <strong>the weather changes the answer</strong>. The perfect park at 8 AM in July is a paw-burn risk by noon. A fenced park with no shade is a different place at 90 degrees than at 70. Rain yesterday means mud today. That is why every search here comes with a live verdict built on the same vet-sourced temperature bands as our <a href="/blog/safe-walking-temperature-dogs.html">walking guide</a>, a best-window recommendation for the day, and storm alerts straight from the National Weather Service.</p>
        <h2>Dog park etiquette, the short version</h2>
        <p>Watch your dog, not your phone. Pick up every time. Skip the park if your dog is unwell, unvaccinated, or in heat. Leave the prong collars and harnesses off inside the fence (they snag in play). If your dog is the one making others miserable, be the owner who leaves early. And on hot days, the kindest etiquette of all: go at dawn or after dinner, when the <a href="/blog/hot-pavement-paw-safety.html">pavement has cooled</a> and the park is at its best.</p>
      </div>`,
};
const LANDER_FAQS = {
  'dog-parks': [
    { q: 'How do I find a fenced dog park near me?', a: 'Enter your zip code above: listings show a "Fenced" chip when OpenStreetMap records fencing for that park. No chip does not always mean no fence, since community data can lag, so verify with the park\'s official page for dogs who need containment.' },
    { q: 'When is it too hot for the dog park?', a: 'Above about 82 degrees Fahrenheit most dogs should keep park time short and shaded, and at 90 degrees or higher skip it. Humidity makes everything worse. The live verdict after you search applies those bands to your local right-now conditions, and suggests the best two-hour window today.' },
    { q: 'Is the dog park safe after rain?', a: 'Usually, but expect mud and check for storm alerts first. Wet parks also concentrate dogs into the dry corners, which raises the tension level. Our verdict flags recent and incoming rain when it builds your day\'s park window.' },
    { q: 'Where does the park data come from?', a: 'OpenStreetMap, the community-built map of the world, under the ODbL license. Coverage is excellent in most US metros and improves constantly. If your local park is missing, anyone can add it to OpenStreetMap and it will appear here at the next data refresh.' },
    { q: 'Does this work outside the United States?', a: 'The city pages cover 100 world cities with mapped parks and climate guidance. Live weather verdicts currently use the US National Weather Service, so they are US-only for now, with international live weather coming with our next data upgrade.' },
  ],
};

for (const cat of shippingCats) {
  const conf = CATEGORIES[cat];
  const cities = shippedBy[cat];
  const byGroup = new Map();
  for (const c of cities) {
    const g = c.hubGroup || 'Other';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(c);
  }
  let index = '';
  for (const g of GROUP_ORDER) {
    if (!byGroup.has(g)) continue;
    const cards = byGroup.get(g).sort((a,b) => a.name.localeCompare(b.name)).map((c) => `        <a href="/tools/${cat}/${c.slug}/" class="blog-card cw-city-card" data-search="${esc((c.name+' '+c.displayName+' '+c.region).toLowerCase())}">
          <span class="blog-tag">${esc(c.region)}</span>
          <h2>${esc(c.name)}</h2>
          <p>${manifest.cities[c.slug].counts[cat]} mapped ${conf.plural}</p>
        </a>`).join('\n');
    index += `      <section class="cw-hub-group">\n      <h3 class="cw-hub-region">${esc(g)}</h3>\n      <div class="blog-grid">\n${cards}\n      </div>\n      </section>\n`;
  }
  const faqs = LANDER_FAQS[cat] || [];
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `https://myweatherpets.com/tools/${cat}/`, url: `https://myweatherpets.com/tools/${cat}/`,
        name: conf.landerTitle, isPartOf: { '@id': 'https://myweatherpets.com/#website' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://myweatherpets.com/' },
        { '@type': 'ListItem', position: 2, name: 'Pet Place Finder', item: 'https://myweatherpets.com/tools/' },
        { '@type': 'ListItem', position: 3, name: conf.label, item: `https://myweatherpets.com/tools/${cat}/` } ] },
      { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  }, null, 2);
  const cityIndexJson = JSON.stringify(cities.map((c) => ({ slug: c.slug, name: c.name, lat: c.lat, lon: c.lon, count: manifest.cities[c.slug].counts[cat], us: c.country === 'US' })));
  const map = {
    CATEGORY: cat, CATEGORY_LABEL: conf.label, CATEGORY_SINGULAR: conf.singular, CATEGORY_PLURAL: conf.plural,
    TITLE: esc(conf.landerTitle),
    META_DESCRIPTION: esc(`Free ${conf.singular} finder: enter a US zip code for a map of nearby ${conf.plural} with live weather and prep guidance, or browse ${cities.length} city guides.`),
    H1: esc(conf.landerTitle.replace(/:.*/, '') + (cat === 'dog-parks' ? ': map, distances, and today\'s park weather' : '')),
    HERO_SUB: esc(`Enter a zip code for nearby ${conf.plural} on a map, live National Weather Service conditions, and an honest verdict on whether today is the day. Built by the WeatherPets news team.`),
    VERDICT_QUESTION: cat === 'dog-parks' ? 'Is it dog park weather right now?' : 'Good day for the trip?',
    LANDER_COPY_HTML: LANDER_COPY[cat] || '',
    CITY_INDEX_HTML: index,
    CITY_INDEX_JSON: cityIndexJson,
    FAQ_HTML: faqs.map((f) => `          <div class="faq-item">
            <button class="faq-question"><span>${esc(f.q)}</span><span class="faq-icon">+</span></button>
            <div class="faq-answer"><div class="faq-answer-inner">${esc(f.a)}</div></div>
          </div>`).join('\n'),
    CTA_HEADLINE: 'The park report, starring your own pet.',
    CTA_SUB: esc('WeatherPets turns your dog or cat into your personal weather reporter: AI scenes, morning briefings, and home screen widgets with real forecasts.'),
    SIBLING_TOOLS_HTML: '',
    JSONLD: ld,
  };
  let html = landerTpl;
  for (const [k, v] of Object.entries(map)) html = html.split(`{{${k}}}`).join(v);
  const left = html.match(/\{\{[A-Z_]+\}\}/);
  if (left) fail(`lander ${cat}: unreplaced ${left[0]}`);
  mkdirSync(join(ROOT, 'tools', cat), { recursive: true });
  writeFileSync(join(ROOT, 'tools', cat, 'index.html'), html);
  console.log(`lander: tools/${cat}/`);
}

// ---------------------------------------------------------------- hub
const hubTpl = readFileSync(join(ROOT,'templates/tools-hub.template.html'),'utf8');
const totalPlaces = (cat) => shippedBy[cat].reduce((s, c) => s + (manifest.cities[c.slug].counts[cat] || 0), 0);
const cards = shippingCats.map((cat) => {
  const conf = CATEGORIES[cat];
  return `        <a href="/tools/${cat}/" class="blog-card" data-fast-goal="tools-hub-click">
          <span class="blog-tag">Live weather built in</span>
          <h2>${esc(conf.label)}</h2>
          <p>${totalPlaces(cat).toLocaleString('en-US')} mapped across ${shippedBy[cat].length} cities, plus any US zip code. Verdicts, best park windows, and storm alerts included.</p>
        </a>`;
}).join('\n');
const hubLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'CollectionPage', '@id': 'https://myweatherpets.com/tools/', url: 'https://myweatherpets.com/tools/',
      name: 'Pet Place Finder', isPartOf: { '@id': 'https://myweatherpets.com/#website' },
      mainEntity: { '@type': 'ItemList', itemListElement: shippingCats.map((cat, i) => ({
        '@type': 'ListItem', position: i + 1, name: CATEGORIES[cat].label, url: `https://myweatherpets.com/tools/${cat}/` })) } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://myweatherpets.com/' },
      { '@type': 'ListItem', position: 2, name: 'Pet Place Finder', item: 'https://myweatherpets.com/tools/' } ] },
  ],
}, null, 2);
let hub = hubTpl.split('{{TOOL_CARDS_HTML}}').join(cards).split('{{JSONLD}}').join(hubLd);
mkdirSync(join(ROOT, 'tools'), { recursive: true });
writeFileSync(join(ROOT, 'tools/index.html'), hub);
console.log('hub: tools/');

// ---------------------------------------------------------------- sitemap
let sm = readFileSync(join(ROOT,'sitemap.xml'),'utf8');
const START = '  <!-- tools-pages:start -->', END = '  <!-- tools-pages:end -->';
if (!sm.includes(START)) sm = sm.replace('</urlset>', `${START}\n${END}\n</urlset>`);
const urls = ['https://myweatherpets.com/tools/']
  .concat(shippingCats.map((cat) => `https://myweatherpets.com/tools/${cat}/`))
  .concat(shippingCats.flatMap((cat) => shippedBy[cat].map((c) => `https://myweatherpets.com/tools/${cat}/${c.slug}/`)));
const entries = urls.map((u) => `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`);
const rx = new RegExp(`${START.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\s\\S]*?${END.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`);
sm = sm.replace(rx, `${START.trim()}\n${entries.join('\n')}\n${END.trim()}`);
writeFileSync(join(ROOT,'sitemap.xml'), sm);
console.log(`sitemap: ${urls.length} tools entries`);
if (process.exitCode) process.exit();
console.log('build-tools complete.');
