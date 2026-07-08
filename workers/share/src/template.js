// HTML rendering for the shared-pet pages. Every user-controlled string
// (pet name, breed, traits, style names — all typed by app users) MUST go
// through escapeHtml()/escapeAttr() in markup positions and JSON.stringify
// in script/JSON-LD positions. Asset URLs come from our own Storage bucket
// but are attribute-escaped anyway.

const COND_ORDER = ["sunny", "partlyCloudy", "cloudy", "rain", "thunderstorm", "snow", "night"];
const COND_LABEL = {
  sunny: "☀️ Sunny",
  partlyCloudy: "⛅ Partly Cloudy",
  cloudy: "☁️ Cloudy",
  rain: "🌧️ Rain",
  thunderstorm: "⛈️ Thunderstorm",
  snow: "❄️ Snow",
  night: "🌙 Night",
};

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
const escapeAttr = escapeHtml;

/** JSON safe to inline inside a <script> block: escapes `<` so user-typed
 *  strings (pet names!) can't smuggle a `</script>` terminator. */
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Pick a looping frame set for the hero pixel avatar out of the snapshot
 *  sprite library: legacy flat animations first, then south-facing skeleton
 *  animations, then any direction. Returns [] when the pet has none. */
function pickAvatarFrames(share) {
  const lib = share.spriteLibrary;
  if (!lib || typeof lib !== "object") return [];
  const anims = lib.animations || {};
  for (const key of Object.keys(anims).sort()) {
    const urls = anims[key] && anims[key].frameURLs;
    if (Array.isArray(urls) && urls.length > 1) return urls;
  }
  const skel = lib.skeletonAnimations || {};
  for (const poseId of Object.keys(skel).sort()) {
    const perDir = skel[poseId] || {};
    const dirs = ["south", ...Object.keys(perDir).sort().filter((d) => d !== "south")];
    for (const dir of dirs) {
      const urls = perDir[dir] && perDir[dir].frameURLs;
      if (Array.isArray(urls) && urls.length > 1) return urls;
    }
  }
  return [];
}

function orderedScenes(style) {
  const scenes = style.scenes || {};
  return COND_ORDER.filter((c) => scenes[c]).map((c) => ({
    condition: c,
    label: COND_LABEL[c] || c,
    url: scenes[c],
  }));
}

const SHARED_HEAD_ASSETS = `
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/images/favicon-192x192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="/images/favicon-512x512.png">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&amp;family=Rubik:wght@700&amp;display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&amp;family=Rubik:wght@700&amp;display=swap" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&amp;family=Rubik:wght@700&amp;display=swap"></noscript>
  <link rel="stylesheet" href="/css/style.min.css">
  <script defer data-website-id="dfid_PXPPYXsnF2dcVHr4Xpu0t" data-domain="myweatherpets.com" src="https://datafa.st/js/script.js"></script>`;

const PAGE_CSS = `
  <style>
    .sp-page { min-height: 100vh; padding: 32px 20px 56px; position: relative; overflow: hidden; background: var(--bg); }
    .sp-accent { position: absolute; pointer-events: none; z-index: 0; opacity: 0.9; }
    .sp-accent-sun { width: 160px; top: 3%; left: 4%; }
    .sp-accent-cloud { width: 180px; top: 12%; right: 3%; }
    .sp-wrap { max-width: 1000px; margin: 0 auto; position: relative; z-index: 1; }
    .sp-hero { text-align: center; background: var(--white); border-radius: var(--radius); padding: 46px 36px 42px; box-shadow: var(--shadow-lg); margin-bottom: 36px; animation: springIn 0.8s var(--spring) both; }
    .sp-logo { width: 60px; height: 60px; margin: 0 auto 16px; display: block; border-radius: 15px; }
    .sp-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--indigo); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 14px; }
    .sp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--indigo); animation: spPulse 1.2s ease-in-out infinite; }
    @keyframes spPulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
    .sp-avatar { margin: 2px auto 14px; }
    .sp-avatar img { width: 108px; height: 108px; image-rendering: pixelated; display: block; margin: 0 auto; }
    .sp-headline { font-size: clamp(30px, 5.4vw, 42px); line-height: 1.08; margin-bottom: 10px; }
    .sp-breed { font-size: 15px; color: var(--text-secondary); margin: 0 0 16px; }
    .sp-traits { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 0 0 20px; }
    .sp-trait { background: var(--indigo-soft); color: var(--indigo); font-size: 13px; font-weight: 600; padding: 6px 13px; border-radius: 999px; }
    .sp-sub { font-size: 16px; color: var(--text-secondary); margin: 0 auto 26px; max-width: 460px; }
    .sp-actions { display: flex; flex-direction: column; align-items: center; gap: 14px; }
    button.sp-cta { border: none; cursor: pointer; font-family: inherit; font-size: 1.05rem; padding: 16px 34px; }
    .sp-badge { display: inline-block; }
    .sp-badge img { height: 44px; width: auto; }
    .sp-note { margin-top: 2px; font-size: 13px; color: var(--text-tertiary); max-width: 380px; }
    .sp-style { margin: 0 0 38px; }
    .sp-style h2 { font-size: clamp(21px, 3.4vw, 27px); margin: 0 0 14px; }
    .sp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
    .sp-grid figure { margin: 0; background: var(--white); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); cursor: zoom-in; transition: transform 0.25s var(--spring); }
    .sp-grid figure:hover { transform: translateY(-3px); }
    .sp-grid img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }
    .sp-grid figcaption { padding: 10px 14px 12px; font-size: 14px; font-weight: 600; color: var(--text-secondary); }
    .sp-band { text-align: center; background: var(--white); border-radius: var(--radius); padding: 40px 32px; box-shadow: var(--shadow-lg); margin: 6px 0 30px; }
    .sp-band h2 { font-size: clamp(22px, 3.8vw, 30px); margin-bottom: 12px; }
    .sp-band-features { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 15px; color: var(--text-secondary); font-weight: 500; }
    .sp-footer { text-align: center; font-size: 14px; color: var(--text-tertiary); }
    .sp-footer a { color: var(--indigo); font-weight: 600; }
    dialog.sp-lightbox { border: none; border-radius: var(--radius); padding: 0; max-width: min(92vw, 900px); background: transparent; }
    dialog.sp-lightbox::backdrop { background: rgba(10, 10, 15, 0.82); }
    dialog.sp-lightbox img { width: 100%; display: block; border-radius: var(--radius); }
    @media (max-width: 600px) {
      .sp-hero { padding: 38px 22px 34px; }
      .sp-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .sp-accent-sun { width: 110px; left: -20px; }
      .sp-accent-cloud { width: 130px; right: -30px; }
    }
  </style>`;

/** The full SSR share page for an active share doc. */
export function renderSharePage(share, shareId, env) {
  const name = String(share.petName || "This pet");
  const nameH = escapeHtml(name);
  const breedBits = [share.breed, share.species].filter(Boolean).map(String);
  const traits = Array.isArray(share.personalityTraits) ? share.personalityTraits.slice(0, 6).map(String) : [];
  const styles = Array.isArray(share.styles) ? share.styles : [];
  const canonical = `${env.SITE_ORIGIN}/p/${encodeURIComponent(shareId)}`;
  const ogImage = share.ogImageUrl || `${env.SITE_ORIGIN}/images/social-share.png`;
  const heroScene = share.heroSceneUrl || "";
  const frames = pickAvatarFrames(share);
  const baseSprite = (share.spriteLibrary && share.spriteLibrary.base) || "";

  const styleNames = styles.map((s) => String(s.displayName || s.stylePackId || "")).filter(Boolean);
  const sceneCount = styles.reduce((n, s) => n + Object.keys(s.scenes || {}).length, 0);
  const title = `${name} — Your pet reports the forecast | WeatherPets`;
  const description =
    `Meet ${name}${breedBits.length ? ` the ${breedBits[0]}` : ""}! ` +
    `${sceneCount} AI weather scenes${styleNames.length ? ` in ${styleNames.join(", ")}` : ""} ` +
    `plus an animated pixel avatar — made with WeatherPets, the app that turns your pet into your personal weather reporter.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${name}'s WeatherPets weather scenes`,
    description,
    url: canonical,
    image: styles.flatMap((s) => orderedScenes(s).map((sc) => sc.url)).slice(0, 24),
    isPartOf: { "@type": "WebSite", "@id": "https://myweatherpets.com/#website", url: "https://myweatherpets.com/" },
    publisher: { "@type": "Organization", "@id": "https://myweatherpets.com/#organization", name: "WeatherPets" },
  };

  const traitChips = traits.length
    ? `<div class="sp-traits">${traits.map((t) => `<span class="sp-trait">${escapeHtml(t)}</span>`).join("")}</div>`
    : "";

  const avatarBlock = (frames.length || baseSprite)
    ? `<div class="sp-avatar" aria-hidden="true"><img id="sp-avatar-img" src="${escapeAttr(frames[0] || baseSprite)}" alt="" width="128" height="128"></div>`
    : "";

  const gallerySections = styles.map((style) => {
    const scenes = orderedScenes(style);
    if (!scenes.length) return "";
    const styleName = escapeHtml(String(style.displayName || style.stylePackId || ""));
    return `
      <section class="sp-style">
        <h2>${nameH} in ${styleName}</h2>
        <div class="sp-grid">
          ${scenes.map((sc) => `
          <figure onclick="lightbox('${escapeAttr(sc.url)}')">
            <img src="${escapeAttr(sc.url)}" alt="${nameH} — ${escapeAttr(sc.label)} (${styleName})" loading="lazy" width="800" height="800">
            <figcaption>${escapeHtml(sc.label)}</figcaption>
          </figure>`).join("")}
        </div>
      </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeAttr(canonical)}">
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="WeatherPets">
  <meta property="og:title" content="${escapeAttr(`Meet ${name} — your friend's WeatherPets reporter`)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(canonical)}">
  <meta property="og:image" content="${escapeAttr(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeAttr(`${name}'s WeatherPets weather scenes`)}">
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(`Meet ${name} — your friend's WeatherPets reporter`)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${escapeAttr(ogImage)}">
  ${heroScene ? `<link rel="preload" as="image" href="${escapeAttr(heroScene)}">` : ""}
${SHARED_HEAD_ASSETS}
${PAGE_CSS}
  <script type="application/ld+json">${jsonForScript(jsonLd)}</script>
</head>
<body>
  <main class="sp-page">
    <img src="/images/accent-sun.png" alt="" class="sp-accent sp-accent-sun" width="400" height="400">
    <img src="/images/accent-cloud.png" alt="" class="sp-accent sp-accent-cloud" width="400" height="400">

    <div class="sp-wrap">
      <header class="sp-hero">
        <img src="/images/logo.png" alt="WeatherPets" class="sp-logo" width="128" height="128">
        <div class="sp-eyebrow"><span class="sp-dot"></span><span>On Air · WeatherPets</span></div>
        ${avatarBlock}
        <h1 class="sp-headline">${nameH} reports <span class="text-gradient">every forecast.</span></h1>
        ${breedBits.length ? `<p class="sp-breed">${escapeHtml(breedBits.join(" · "))}</p>` : ""}
        ${traitChips}
        <p class="sp-sub">A friend made ${nameH} their personal weather reporter. Every scene below is really ${nameH} — generated by WeatherPets from one photo.</p>
        <div class="sp-actions">
          <button type="button" class="btn-primary sp-cta" onclick="go()">Make Your Pet the Reporter</button>
          <a href="${escapeAttr(env.APP_STORE_URL)}" class="sp-badge" onclick="go(); return false;">
            <img src="/images/app-store-badge.svg" alt="Download on the App Store" width="120" height="40">
          </a>
          <p class="sp-note">Free to start. Tap to save your invite, then grab the app — your friend's referral counts.</p>
        </div>
      </header>

      ${gallerySections}

      <section class="sp-band">
        <h2>Your pet could do this <span class="text-gradient">by tonight.</span></h2>
        <ul class="sp-band-features">
          <li>📸 One photo → AI scenes in every weather</li>
          <li>🕹️ An animated pixel avatar of your pet</li>
          <li>📱 Real forecasts + home screen widgets</li>
        </ul>
        <div class="sp-actions">
          <button type="button" class="btn-primary sp-cta" onclick="go()">Get WeatherPets</button>
        </div>
      </section>

      <p class="sp-footer">Made with <a href="/">WeatherPets</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
    </div>
  </main>

  <dialog class="sp-lightbox" id="sp-lightbox" onclick="this.close()">
    <img id="sp-lightbox-img" src="" alt="">
  </dialog>

  <script>
    var SHARE_ID = ${jsonForScript(shareId)};
    var APP_STORE = ${jsonForScript(env.APP_STORE_URL)};
    var FRAMES = ${jsonForScript(frames)};
    var PH_HOST = ${jsonForScript(env.POSTHOG_HOST)};
    var PH_TOKEN = ${jsonForScript(env.POSTHOG_TOKEN)};

    function phDid() {
      try {
        var k = 'wp_share_did';
        var v = localStorage.getItem(k);
        if (!v) { v = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
        return v;
      } catch (e) { return 'web-anon'; }
    }
    function phCapture(event, props) {
      try {
        fetch(PH_HOST + '/i/v0/e/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: PH_TOKEN, event: event, distinct_id: phDid(), properties: props }),
          keepalive: true
        });
      } catch (e) { /* analytics must never break the page */ }
    }

    // Same deferred-deep-link flow as the creator links: copy this page's
    // URL (the app parses it on first launch to credit the referrer), then
    // head to the App Store. The copy needs this user gesture on iOS Safari.
    window.go = async function () {
      phCapture('share_cta_tapped', { share_id: SHARE_ID, renderer: 'worker' });
      try {
        await navigator.clipboard.writeText('https://myweatherpets.com/p/' + SHARE_ID);
      } catch (e) {
        // Clipboard denied — Universal Link (installed users) still covers attribution.
      }
      window.location.href = APP_STORE;
    };

    window.lightbox = function (url) {
      var dlg = document.getElementById('sp-lightbox');
      document.getElementById('sp-lightbox-img').src = url;
      if (dlg.showModal) dlg.showModal();
    };

    // Hero pixel avatar frame loop (respects prefers-reduced-motion).
    (function () {
      var img = document.getElementById('sp-avatar-img');
      if (!img || FRAMES.length < 2) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      FRAMES.slice(1).forEach(function (u) { new Image().src = u; });
      var idx = 0;
      setInterval(function () { idx = (idx + 1) % FRAMES.length; img.src = FRAMES[idx]; }, 320);
    })();

    phCapture('share_page_viewed', {
      share_id: SHARE_ID,
      renderer: 'worker',
      $current_url: location.href,
      $referrer: document.referrer || null
    });
  </script>
</body>
</html>`;
}

/** Friendly page for missing/revoked shares (served with 404). */
export function renderUnavailablePage(env) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>This pet went off the air — WeatherPets</title>
  <meta name="description" content="This shared pet page is no longer available — but your pet's weather report is still waiting.">
  <meta name="robots" content="noindex, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="WeatherPets">
  <meta property="og:title" content="WeatherPets — your pet reports the forecast">
  <meta property="og:description" content="Turn your pet into your personal weather reporter. Real forecasts. Real pet. Unreal scenes.">
  <meta property="og:image" content="${escapeAttr(env.SITE_ORIGIN)}/images/social-share.png">
  <meta name="twitter:card" content="summary_large_image">
${SHARED_HEAD_ASSETS}
${PAGE_CSS}
</head>
<body>
  <main class="sp-page" style="display:flex;align-items:center;justify-content:center;">
    <img src="/images/accent-sun.png" alt="" class="sp-accent sp-accent-sun" width="400" height="400">
    <img src="/images/accent-cloud.png" alt="" class="sp-accent sp-accent-cloud" width="400" height="400">
    <div class="sp-hero" style="max-width:560px;width:100%;">
      <img src="/images/logo.png" alt="WeatherPets" class="sp-logo" width="128" height="128">
      <div class="sp-eyebrow"><span class="sp-dot"></span><span>Off Air · WeatherPets</span></div>
      <h1 class="sp-headline">This pet went <span class="text-gradient">off the air.</span></h1>
      <p class="sp-sub">The page you're looking for isn't available anymore — its owner may have unshared it. Your pet's weather report is still waiting, though.</p>
      <div class="sp-actions">
        <a href="${escapeAttr(env.APP_STORE_URL)}" class="btn-primary sp-cta" style="text-decoration:none;">Get WeatherPets</a>
        <a href="/" class="sp-note" style="text-decoration:underline;">Back to myweatherpets.com</a>
      </div>
    </div>
  </main>
</body>
</html>`;
}
