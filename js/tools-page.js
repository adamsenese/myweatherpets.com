/* Pet place finder pages. Element-guarded: no-op unless <body data-tool-category>.
   NOTE: HTML loads js/tools-page.min.js. After editing, re-minify:
   npx esbuild js/tools-page.js --minify --outfile=js/tools-page.min.js */
(function () {
  var body = document.body;
  var category = body.dataset.toolCategory;
  if (!category) return;

  var UNITS = body.dataset.unitsDefault || 'F';
  try { UNITS = localStorage.getItem('wp-units') || UNITS; } catch (e) {}
  var PAW_SVG = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#1800ED" stroke="#fff" stroke-width="1.2" d="M12 12.5c-2.6 0-5.4 2.2-5.4 4.8 0 1.6 1.1 2.7 2.7 2.7 1 0 1.8-.4 2.7-.4s1.7.4 2.7.4c1.6 0 2.7-1.1 2.7-2.7 0-2.6-2.8-4.8-5.4-4.8zM6.2 8.1c-1.1.3-1.7 1.7-1.3 3s1.6 2.2 2.7 1.9 1.7-1.7 1.3-3-1.6-2.2-2.7-1.9zm11.6 0c-1.1-.3-2.3.6-2.7 1.9s.2 2.7 1.3 3 2.3-.6 2.7-1.9-.2-2.7-1.3-3zM9.6 3.6c-1.2.2-1.9 1.6-1.6 3.1s1.4 2.5 2.6 2.3 1.9-1.6 1.6-3.1-1.4-2.5-2.6-2.3zm4.8 0c-1.2-.2-2.3.8-2.6 2.3s.4 2.9 1.6 3.1 2.3-.8 2.6-2.3-.4-2.9-1.6-3.1z"/></svg>';
  var el = function (id) { return document.getElementById(id); };
  var hav = function (la1, lo1, la2, lo2) {
    var R = 6371, d = Math.PI / 180;
    var a = Math.sin((la2 - la1) * d / 2) * Math.sin((la2 - la1) * d / 2) +
      Math.cos(la1 * d) * Math.cos(la2 * d) * Math.sin((lo2 - lo1) * d / 2) * Math.sin((lo2 - lo1) * d / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  var fmtDist = function (km) { return UNITS === 'F' ? (Math.round(km * 6.21371) / 10) + ' mi' : km + ' km'; };

  // KEEP IN SYNC with js/weather-page.js verdict() bands.
  function bandIndex(tempF, humidity) {
    var idx;
    if (tempF <= 45) {
      if (tempF < 20) idx = 4; else if (tempF < 32) idx = 2; else idx = 1;
    } else if (tempF >= 90) idx = 4;
    else if (tempF >= 82) idx = 3;
    else if (tempF >= 77) idx = 2;
    else if (tempF >= 68) idx = 1;
    else idx = 0;
    if (humidity != null && humidity >= 65 && tempF >= 75 && idx < 4 && tempF > 45) idx += 1;
    return idx;
  }
  var BAND_LABEL = ['Great', 'Fine for most dogs', 'Caution', 'Risky', 'Skip it'];
  var BAND_CLASS = ['cw-v-safe', 'cw-v-fine', 'cw-v-caution', 'cw-v-risky', 'cw-v-danger'];

  function fetchJson(url, timeoutMs, opts) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000);
    var o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ---------- weather (NWS) ----------
  function loadWeather(lat, lon, hourlyUrl, tz) {
    var hourlyP = hourlyUrl
      ? fetchJson(hourlyUrl, 8000).catch(function () { return resolveHourly(lat, lon); })
      : resolveHourly(lat, lon);
    var alertsP = fetchJson('https://api.weather.gov/alerts/active?point=' + lat + ',' + lon, 8000).catch(function () { return null; });
    return Promise.all([hourlyP, alertsP]).then(function (res) {
      var periods = res[0] && res[0].properties && res[0].properties.periods || [];
      return { periods: periods, alerts: res[1] && res[1].features || [], tz: tz };
    });
  }
  function resolveHourly(lat, lon) {
    return fetchJson('https://api.weather.gov/points/' + lat + ',' + lon, 8000).then(function (p) {
      return fetchJson(p.properties.forecastHourly, 8000);
    });
  }

  function renderWeather(w, cityName) {
    var now = w.periods[0];
    if (!now) return failWeather();
    var t = now.temperature, rh = now.relativeHumidity && now.relativeHumidity.value;
    var idx = bandIndex(t, rh);
    var severe = w.alerts.some(function (a) {
      var s = a.properties && a.properties.severity;
      return s === 'Severe' || s === 'Extreme';
    });
    if (severe) idx = 4;
    var pill = el('tpVerdictPill');
    if (pill) { pill.textContent = BAND_LABEL[idx]; pill.className = 'cw-verdict-pill ' + BAND_CLASS[idx]; }
    var reason = el('tpVerdictReason');
    if (reason) {
      reason.textContent = t + '°F' + (rh != null ? ', ' + Math.round(rh) + '% humidity' : '') +
        (now.probabilityOfPrecipitation && now.probabilityOfPrecipitation.value >= 30
          ? ', ' + now.probabilityOfPrecipitation.value + '% chance of rain' : '') +
        '. ' + reasonText(idx) + (severe ? ' An active severe weather alert is in effect.' : '');
    }
    // best 2-hour window (today, 6am-10pm local)
    var win = el('tpWindow');
    if (win) {
      var best = bestWindow(w.periods, w.tz);
      win.textContent = best ? 'Best park window today: ' + best :
        'No great window today. Early morning potty breaks and indoor play instead.';
    }
    // alert strip
    var strip = el('tpAlert');
    if (strip && severe) {
      var ev = w.alerts[0].properties.event;
      strip.textContent = '⚠ ' + ev + ' in effect for this area. Skip the trip and keep pets inside.';
      strip.hidden = false;
    }
    // commentary
    var comm = el('tpCommentary');
    if (comm) {
      var petName = body.dataset.petName || 'The scout';
      var lines = [
        ' says: conditions are perfect. If you need me, I will be at the park.',
        ' says: good to go for most of the crew. Watch the flat-faced and fluffy ones.',
        ' says: doable, but keep it short, shaded, and watered.',
        ' says: early birds only today. Midday is a no from me.',
        ' says: park is cancelled. Couch remains open.',
      ];
      comm.textContent = petName + lines[idx];
    }
  }
  function reasonText(idx) {
    return [
      'Great conditions for park time.',
      'Fine for most dogs. High-risk pups (flat-faced, senior, thick-coated) still want shade breaks.',
      'Keep it shorter, stick to shade, and bring water.',
      'Short visits at the cool edges of the day only.',
      'Skip outdoor time. Indoor games win today.',
    ][idx];
  }
  function bestWindow(periods, tz) {
    var fmtH = new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: tz || undefined });
    var fmtDay = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: tz || undefined });
    var today = fmtDay.format(new Date());
    var hours = [];
    for (var i = 0; i < periods.length && hours.length < 18; i++) {
      var p = periods[i];
      var dt = new Date(p.startTime);
      if (fmtDay.format(dt) !== today) break;
      var hr = parseInt(fmtH.format(dt), 10);
      var pm = /PM/i.test(fmtH.format(dt));
      var h24 = (hr % 12) + (pm ? 12 : 0);
      if (h24 < 6 || h24 > 22) continue;
      var precip = p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value || 0;
      var score = bandIndex(p.temperature, p.relativeHumidity && p.relativeHumidity.value) +
        (precip >= 50 ? 2 : precip >= 30 ? 1 : 0);
      hours.push({ label: fmtH.format(dt), temp: p.temperature, precip: precip, score: score });
    }
    if (hours.length < 2) return null;
    var bi = 0, bs = Infinity;
    for (var j = 0; j < hours.length - 1; j++) {
      var s = hours[j].score + hours[j + 1].score;
      if (s < bs) { bs = s; bi = j; }
    }
    if (bs / 2 >= 3) return null; // both hours risky+
    var a = hours[bi], b = hours[bi + 1];
    return a.label + ' to ' + b.label.replace(' ', ' ') + ' (' + a.temp + '°F' +
      (a.precip >= 15 ? ', ' + a.precip + '% rain' : '') + ')';
  }
  function failWeather() {
    var pill = el('tpVerdictPill');
    if (pill) { pill.textContent = 'Live check unavailable'; pill.classList.remove('cw-skel'); }
    var reason = el('tpVerdictReason');
    if (reason) reason.textContent = 'The National Weather Service feed is not answering right now. The seasonal guidance below still applies.';
  }

  // ---------- map ----------
  var map, markerLayer;
  function initMap(center, places, userPoint) {
    if (typeof L === 'undefined') return;
    var node = el('tpMap');
    if (!node) return;
    if (!map) {
      map = L.map(node, { scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);
    }
    markerLayer.clearLayers();
    var pts = [];
    places.forEach(function (p) {
      var icon = L.divIcon({ className: 'tp-paw', html: PAW_SVG, iconSize: [28, 28], iconAnchor: [14, 14] });
      var m = L.marker([p.lat, p.lon], { icon: icon }).addTo(markerLayer);
      m.bindPopup('<strong>' + escHtml(p.name) + '</strong><br>' + (p.address ? escHtml(p.address) + '<br>' : '') + fmtDist(p.distKm) +
        (p.tags && p.tags.website ? ' · <a href="' + escAttr(p.tags.website) + '" target="_blank" rel="nofollow noopener">Website</a>' : ''));
      pts.push([p.lat, p.lon]);
    });
    if (userPoint) {
      L.circleMarker(userPoint, { radius: 8, color: '#1800ED', fillColor: '#4433FF', fillOpacity: 0.9 })
        .bindPopup('You are here').addTo(markerLayer);
      pts.push(userPoint);
    }
    if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
    else map.setView(center, 12);
  }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

  // ================= CITY-PAGE MODE =================
  var citySlug = body.dataset.citySlug;
  if (citySlug) {
    var lat = parseFloat(body.dataset.cityLat), lon = parseFloat(body.dataset.cityLon);
    var places = [];
    try { places = JSON.parse(el('tpPlaces').textContent); } catch (e) {}
    var mapNode = el('tpMap');
    if (mapNode && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); initMap([lat, lon], places); }
      }, { rootMargin: '200px' });
      io.observe(mapNode);
    } else if (mapNode) {
      initMap([lat, lon], places);
    }
    var hourlyUrl = body.dataset.nwsHourly;
    if (hourlyUrl) {
      loadWeather(lat, lon, hourlyUrl, body.dataset.cityTz)
        .then(function (w) { renderWeather(w, body.dataset.cityName); })
        .catch(failWeather);
    }
    return;
  }

  // ================= LANDER MODE =================
  var form = el('tpZipForm');
  if (!form) return;
  var cityIndex = [];
  try { cityIndex = JSON.parse(el('tpCityIndex').textContent); } catch (e) {}
  var zipShards = {};

  function note(msg) { var n = el('tpFinderNote'); if (n) n.textContent = msg; }

  function lookupZip(zip) {
    var d = zip[0];
    var p = zipShards[d] ? Promise.resolve(zipShards[d]) : fetchJson('/data/zips/zcta-' + d + '.json', 10000)
      .then(function (s) { zipShards[d] = s; return s; });
    return p.then(function (s) { return s[zip] || null; });
  }

  // Live Overpass around the user's point; mirrors + timeout; cached-city fallback.
  var OSM_SELECTORS = {
    'dog-parks': '["leisure"="dog_park"]',
    'veterinarians': '["amenity"="veterinary"]',
    'pet-stores': '["shop"="pet"]',
    'dog-daycare': '["amenity"~"animal_boarding|animal_daycare"]',
  };
  function liveOverpass(lat, lon) {
    var sel = OSM_SELECTORS[category];
    var q = '[out:json][timeout:20];nwr' + sel + '(around:15000,' + lat + ',' + lon + ');out center tags 60;';
    var mirrors = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
    var attempt = function (i) {
      if (i >= mirrors.length) return Promise.reject(new Error('overpass unavailable'));
      return fetchJson(mirrors[i], 9000, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        .catch(function () { return attempt(i + 1); });
    };
    return attempt(0).then(function (j) {
      return (j.elements || []).map(function (e) {
        var t = e.tags || {};
        var la = e.lat != null ? e.lat : e.center && e.center.lat;
        var lo = e.lon != null ? e.lon : e.center && e.center.lon;
        if (la == null) return null;
        return {
          name: t.name || (category === 'dog-parks' ? 'Dog park (unnamed on OpenStreetMap)' : null),
          lat: la, lon: lo,
          distKm: Math.round(hav(lat, lon, la, lo) * 10) / 10,
          address: [t['addr:housenumber'] && (t['addr:housenumber'] + ' ' + (t['addr:street'] || '')), t['addr:city']].filter(Boolean).join(', ') || null,
          tags: { website: t.website, phone: t.phone, barrier: t.barrier, drinking_water: t.drinking_water, surface: t.surface, lit: t.lit, emergency: t.emergency },
        };
      }).filter(function (p) { return p && p.name; })
        .sort(function (a, b) { return a.distKm - b.distKm; }).slice(0, 40);
    });
  }

  function cachedFallback(lat, lon) {
    var best = null, bd = Infinity;
    cityIndex.forEach(function (c) {
      var d = hav(lat, lon, c.lat, c.lon);
      if (d < bd) { bd = d; best = c; }
    });
    if (!best || bd > 60) return Promise.resolve(null);
    return fetchJson('/data/places/' + category + '/' + best.slug + '.json', 10000).then(function (j) {
      var pl = j.places.map(function (p) {
        p = Object.assign({}, p);
        p.distKm = Math.round(hav(lat, lon, p.lat, p.lon) * 10) / 10;
        return p;
      }).sort(function (a, b) { return a.distKm - b.distKm; });
      return { places: pl, source: 'cached data for ' + best.name };
    }).catch(function () { return null; });
  }

  function renderResults(lat, lon, result) {
    var wrap = el('tpResults');
    if (wrap) wrap.hidden = false;
    var list = el('tpList');
    if (list) {
      list.innerHTML = result.places.slice(0, 20).map(function (p) {
        var cs = [];
        if (p.tags && (p.tags.barrier || p.tags.fence_type)) cs.push('Fenced');
        if (p.tags && p.tags.drinking_water === 'yes') cs.push('Water');
        if (p.tags && p.tags.emergency === 'yes') cs.push('24/7 emergency');
        return '<li class="tp-place-card"><div class="tp-place-head"><strong>' + escHtml(p.name) + '</strong>' +
          '<span class="tp-dist">' + fmtDist(p.distKm) + '</span></div>' +
          (p.address ? '<div class="tp-place-addr">' + escHtml(p.address) + '</div>' : '') +
          '<div class="tp-chips">' + cs.map(function (c) { return '<span class="tp-chip">' + c + '</span>'; }).join('') +
          (p.tags && p.tags.website ? ' <a class="tp-site" target="_blank" rel="nofollow noopener" href="' + escAttr(p.tags.website) + '">Website</a>' : '') +
          '</div></li>';
      }).join('');
    }
    var src = el('tpSourceNote');
    if (src) src.textContent = result.source ? 'Showing ' + result.source + ', re-sorted by distance from you.' :
      'Live OpenStreetMap results around your location.';
    initMap([lat, lon], result.places.slice(0, 40), [lat, lon]);
    loadWeather(lat, lon, null, undefined).then(renderWeather).catch(failWeather);
    var wrap2 = el('tpResults');
    if (wrap2) wrap2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function search(lat, lon) {
    note('Searching near you…');
    liveOverpass(lat, lon).then(function (places) {
      if (places.length) return { places: places, source: null };
      return cachedFallback(lat, lon);
    }, function () {
      return cachedFallback(lat, lon);
    }).then(function (result) {
      if (result && result.places && result.places.length) {
        note('');
        renderResults(lat, lon, result);
      } else {
        note('No mapped ' + category.replace('-', ' ') + ' near that spot yet. Community map data grows all the time; meanwhile, browse the covered cities below.');
      }
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var zip = (el('tpZip').value || '').trim();
    if (!/^\d{5}$/.test(zip)) { note('Enter a 5-digit US zip code.'); return; }
    note('Looking up ' + zip + '…');
    lookupZip(zip).then(function (pt) {
      if (!pt) { note('That zip is not in the Census centroid list (PO-box-only zips are not mapped). Try a nearby residential zip.'); return; }
      search(pt[0], pt[1]);
    }).catch(function () { note('Zip lookup failed. Check your connection and try again.'); });
  });

  var locate = el('tpLocate');
  if (locate) {
    locate.addEventListener('click', function () {
      if (!navigator.geolocation) { note('Geolocation is not available in this browser. Use a zip code instead.'); return; }
      note('Locating…');
      navigator.geolocation.getCurrentPosition(function (pos) {
        search(pos.coords.latitude, pos.coords.longitude);
      }, function () {
        note('Location permission was declined. A zip code works just as well.');
      }, { timeout: 10000 });
    });
  }
})();
