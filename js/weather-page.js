/* City weather page hydration. Element-guarded: no-op unless <body data-city-slug>.
   NOTE: HTML loads js/weather-page.min.js. After editing, re-minify:
   npx esbuild js/weather-page.js --minify --outfile=js/weather-page.min.js */
(function () {
  var body = document.body;
  var slug = body.dataset.citySlug;
  if (!slug) return;

  var tz = body.dataset.cityTz;
  var pet = body.dataset.pet;
  var petName = body.dataset.petName || 'Your anchor';
  var petStyle = body.dataset.petStyle || 'realistic';
  var workerBase = body.dataset.workerBase;
  var units = null;
  try { units = localStorage.getItem('wp-units'); } catch (e) {}
  units = units === 'F' || units === 'C' ? units : (body.dataset.unitsDefault || 'F');

  var lastData = null;

  // WeatherKit conditionCode → scene bucket
  var BUCKETS = {
    Clear: 'sunny', MostlyClear: 'sunny', Hot: 'sunny',
    PartlyCloudy: 'partlycloudy', MostlyCloudy: 'partlycloudy',
    Cloudy: 'cloudy', Foggy: 'cloudy', Haze: 'cloudy', Smoky: 'cloudy', Windy: 'cloudy', Breezy: 'cloudy',
    Drizzle: 'rain', Rain: 'rain', HeavyRain: 'rain', SunShowers: 'rain', IsolatedThunderstorms: 'thunderstorm',
    ScatteredThunderstorms: 'thunderstorm', StrongStorms: 'thunderstorm', Thunderstorms: 'thunderstorm',
    Frigid: 'snow', Flurries: 'snow', Snow: 'snow', HeavySnow: 'snow', SunFlurries: 'snow',
    Sleet: 'snow', FreezingDrizzle: 'snow', FreezingRain: 'snow', WintryMix: 'snow',
    Blizzard: 'snow', BlowingSnow: 'snow', Hail: 'snow', Hurricane: 'thunderstorm', TropicalStorm: 'thunderstorm',
    BlowingDust: 'cloudy'
  };
  var GLYPHS = { sunny: '☀️', partlycloudy: '⛅', cloudy: '☁️', rain: '🌧️', snow: '❄️', thunderstorm: '⛈️', night: '🌙' };
  var COMMENTARY = {
    sunny: ' says: blue skies over {city} today. Sunscreen for the pink noses, water bowls topped up, and someone please open the good window.',
    partlycloudy: ' says: sun with a side of clouds in {city}. Prime walk weather if you ask me, and you did.',
    cloudy: ' says: gray skies over {city}. Moody, dramatic, excellent for zoomies. No complaints from this desk.',
    rain: ' says: rain in {city}. Towel by the door, jacket if you have one, and the good blanket ready for after.',
    snow: ' says: snow in {city}! Booties on, salt off the paws afterward, and yes I will be rolling in it.',
    thunderstorm: ' says: storms over {city}. Safe den, white noise, and maybe skip the walk. This is a cuddle forecast.',
    night: ' says: {city} is off the clock. Night walks are cooler in summer, just add a light and stay visible.'
  };

  function labelCondition(code) {
    return String(code || '').replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  function fToC(f) { return (f - 32) * 5 / 9; }
  function fmtTemp(f, withUnit) {
    var v = units === 'C' ? Math.round(fToC(f)) : Math.round(f);
    return v + '°' + (withUnit ? units : '');
  }
  function el(id) { return document.getElementById(id); }
  function set(id, text) { var n = el(id); if (n) { n.textContent = text; n.classList.remove('cw-skel'); } }

  // Walk verdict: same bands as the blog guides.
  function verdict(cur) {
    var heatT = Math.max(cur.tempF, cur.feelsLikeF);
    var coldT = Math.min(cur.tempF, cur.feelsLikeF);
    var levels = ['safe', 'fine', 'caution', 'risky', 'danger'];
    var idx, label, reason, link = null;
    if (coldT <= 45) {
      if (coldT < 20) { idx = 4; label = 'Dangerous cold'; reason = 'Around ' + fmtTemp(coldT, true) + ' — potty breaks only, and coats for everyone.'; }
      else if (coldT < 32) { idx = 2; label = 'Caution'; reason = 'Around ' + fmtTemp(coldT, true) + ' — shorter walks; coats for small, thin, and senior dogs.'; }
      else { idx = 1; label = 'Fine with a note'; reason = 'Around ' + fmtTemp(coldT, true) + ' — fine for most dogs; small or senior dogs may want a coat.'; }
      link = '/blog/cold-weather-safe-temperature-dogs.html';
    } else {
      if (heatT >= 90) { idx = 4; label = 'Dangerous heat'; }
      else if (heatT >= 82) { idx = 3; label = 'Risky'; }
      else if (heatT >= 77) { idx = 2; label = 'Caution'; }
      else if (heatT >= 68) { idx = 1; label = 'Fine — watch high-risk dogs'; }
      else { idx = 0; label = 'Safe'; }
      if (cur.humidity != null && cur.humidity >= 0.65 && heatT >= 75 && idx < 4) {
        idx += 1;
        label = ['Safe', 'Fine — watch high-risk dogs', 'Caution', 'Risky', 'Dangerous heat'][idx] + ' (humidity bump)';
      }
      var msgs = [
        'Feels like ' + fmtTemp(cur.feelsLikeF, true) + ' — great walk weather.',
        'Feels like ' + fmtTemp(cur.feelsLikeF, true) + ' — fine for most dogs; keep an eye on flat-faced, senior, and thick-coated pups.',
        'Feels like ' + fmtTemp(cur.feelsLikeF, true) + ' — keep it shorter, stick to shade, bring water.',
        'Feels like ' + fmtTemp(cur.feelsLikeF, true) + ' — short potty breaks only for most dogs; go early or late.',
        'Feels like ' + fmtTemp(cur.feelsLikeF, true) + ' — skip the walk and exercise indoors.'
      ];
      reason = msgs[idx];
      if (heatT >= 68) link = '/blog/safe-walking-temperature-dogs.html';
    }
    return { level: levels[idx], label: label, reason: reason, link: link };
  }

  function render(data) {
    lastData = data;
    var cur = data.current;
    var bucket = BUCKETS[cur.condition] || 'cloudy';
    if (cur.isDaylight === false) bucket = 'night';

    // scene swap with preload + graceful fallback to cloudy
    var scene = el('cwScene');
    if (scene) {
      var src = '/images/pets/' + pet + '/' + bucket + '-' + petStyle + '.jpg';
      var probe = new Image();
      probe.onload = function () { scene.src = src; };
      probe.onerror = function () { /* keep cloudy default */ };
      probe.src = src;
    }
    var cond = el('cwCond');
    if (cond) cond.textContent = labelCondition(cur.condition);

    set('cwTemp', fmtTemp(cur.tempF, true));
    set('cwFeels', 'Feels like ' + fmtTemp(cur.feelsLikeF, true));
    set('cwCondText', (GLYPHS[bucket] || '') + ' ' + labelCondition(cur.condition));
    set('cwHumidity', cur.humidity != null ? Math.round(cur.humidity * 100) + '%' : '—');
    set('cwWind', cur.windMph != null ? (units === 'C' ? Math.round(cur.windMph * 1.609) + ' km/h' : cur.windMph + ' mph') : '—');
    set('cwUv', cur.uvIndex != null ? String(cur.uvIndex) : '—');

    // verdict
    var v = verdict(cur);
    var pill = el('cwVerdictPill');
    if (pill) {
      pill.textContent = v.label;
      pill.className = 'cw-verdict-pill cw-v-' + v.level;
    }
    var reason = el('cwVerdictReason');
    if (reason) {
      reason.textContent = v.reason + ' ';
      if (v.link) {
        var a = document.createElement('a');
        a.href = v.link;
        a.textContent = 'See the full guide.';
        reason.appendChild(a);
      }
    }

    // commentary
    var comm = el('cwCommentary');
    if (comm) comm.textContent = petName + (COMMENTARY[bucket] || COMMENTARY.cloudy).replace('{city}', cityNameFromTitle());

    // hourly
    var hourly = el('cwHourly');
    if (hourly) {
      var hfmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: tz });
      hourly.innerHTML = data.hourly.map(function (h) {
        var hb = BUCKETS[h.condition] || 'cloudy';
        if (h.isDaylight === false) hb = 'night';
        return '<div class="cw-hour"><span class="cw-hour-t">' + hfmt.format(new Date(h.time)) + '</span>' +
          '<span class="cw-hour-g">' + (GLYPHS[hb] || '') + '</span>' +
          '<span class="cw-hour-temp">' + fmtTemp(h.tempF) + '</span>' +
          '<span class="cw-hour-p">' + (h.precipChance >= 0.15 ? Math.round(h.precipChance * 100) + '%' : '&nbsp;') + '</span></div>';
      }).join('');
      hourly.removeAttribute('aria-busy');
    }

    // daily
    var daily = el('cwDaily');
    if (daily) {
      var dfmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz });
      daily.innerHTML = data.daily.map(function (d, i) {
        var db = BUCKETS[d.condition] || 'cloudy';
        return '<div class="cw-day"><span class="cw-day-name">' + (i === 0 ? 'Today' : dfmt.format(new Date(d.date))) + '</span>' +
          '<span class="cw-day-g">' + (GLYPHS[db] || '') + '</span>' +
          '<span class="cw-day-hi">' + fmtTemp(d.hiF) + '</span>' +
          '<span class="cw-day-lo">' + fmtTemp(d.loF) + '</span>' +
          '<span class="cw-day-p">' + (d.precipChance >= 0.15 ? Math.round(d.precipChance * 100) + '%' : '&nbsp;') + '</span></div>';
      }).join('');
      daily.removeAttribute('aria-busy');
    }
  }

  function cityNameFromTitle() {
    var h1 = document.querySelector('.cw-hero-copy h1');
    return h1 ? h1.textContent.split(' weather')[0] : '';
  }

  function failMode() {
    var current = el('cwCurrent');
    if (current) {
      current.innerHTML = '<p class="cw-fallback">The live forecast is off the air for a moment. Meanwhile, the climate table below shows what ' +
        cityNameFromTitle() + ' usually looks like this time of year.</p>';
    }
    ['cwHourlyBlock', 'cwDailyBlock'].forEach(function (id) { var n = el(id); if (n) n.style.display = 'none'; });
    var pill = el('cwVerdictPill');
    if (pill) { pill.textContent = 'Live check unavailable'; pill.classList.remove('cw-skel'); }
    var reason = el('cwVerdictReason');
    if (reason) reason.textContent = 'Use the month-by-month table below and our walking guides to judge today.';
    var comm = el('cwCommentary');
    if (comm) comm.textContent = petName + ' says: my teleprompter froze. Scroll down for the usual ' + cityNameFromTitle() + ' weather.';
  }

  function load() {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 6000);
    fetch(workerBase + '/v1/weather/' + slug, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { if (timer) clearTimeout(timer); render(data); })
      .catch(function () { if (timer) clearTimeout(timer); failMode(); });
  }

  var toggle = el('cwUnitToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      units = units === 'F' ? 'C' : 'F';
      try { localStorage.setItem('wp-units', units); } catch (e) {}
      if (lastData) render(lastData);
    });
  }

  load();
})();
