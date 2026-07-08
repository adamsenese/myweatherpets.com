// weatherpets-share — SSR for the shared-pet pages (myweatherpets.com/p/*).
//
// GET /p/{shareId} → fetch the public sharedPets/{shareId} Firestore doc →
// render the full share page with per-share <title>/OG tags (the reason this
// worker exists: rich iMessage/WhatsApp previews at share time). Missing or
// revoked shares get a friendly 404. Everything else under /p/ 404s too.
//
// Caching: edge-cached 5 minutes, keyed by pathname only (utm/query variants
// share one entry; the client JS still sees location.href). Republishing a
// pet rotates every asset URL (fresh Storage download tokens), so a 5-minute
// stale HTML window is the worst case for text-only changes.

import { fetchSharedPet } from "./firestore.js";
import { renderSharePage, renderUnavailablePage } from "./template.js";

const SHARE_ID_RE = /^[a-z0-9-]{3,40}$/;
const CACHE_TTL_SECONDS = 300;
const NOT_FOUND_TTL_SECONDS = 60;

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean); // "/p/x" -> ["p","x"]
    const shareId = segments[0] === "p" && segments[1] ? segments[1].toLowerCase() : "";

    if (!SHARE_ID_RE.test(shareId)) {
      return htmlResponse(renderUnavailablePage(env), 404, NOT_FOUND_TTL_SECONDS);
    }

    // Query-stripped cache key so ?utm_* variants hit one cached entry.
    const cacheKey = new Request(`${url.origin}/p/${shareId}`);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const share = await fetchSharedPet(shareId, env);
    const response = share
      ? htmlResponse(renderSharePage(share, shareId, env), 200, CACHE_TTL_SECONDS)
      : htmlResponse(renderUnavailablePage(env), 404, NOT_FOUND_TTL_SECONDS);

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

function htmlResponse(html, status, sMaxAge) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Browsers revalidate after 60s; the edge holds it for sMaxAge.
      "Cache-Control": `public, max-age=60, s-maxage=${sMaxAge}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
