# WeatherPets SEO Playbook — Off-site & Monitoring

Companion to the July 2026 SEO overhaul (Phases A–D live in git history). These are the steps that happen **outside this repo** — most need Dom or Adam to do them once, then a light monthly cadence.

## 1. Google Search Console (do this first — 15 minutes)

1. Go to https://search.google.com/search-console → Add property → **Domain** property `myweatherpets.com`.
2. Verify via DNS TXT record at your registrar (Google shows the exact record; propagation is usually minutes).
3. Submit the sitemap: Sitemaps → `https://myweatherpets.com/sitemap.xml`.
4. **Request indexing** (URL Inspection → Request Indexing) for these consolidation survivors so Google folds the merged pages' signals quickly:
   - /blog/top-5-weather-apps-for-iphone.html
   - /blog/top-5-cute-weather-apps-ios.html
   - /blog/best-pet-apps-for-iphone-2026.html
   - /blog/weatherpets-widgets-guide.html
   - /blog/weatherpets-vs-weather-kitty.html
   - /blog/weatherpets-vs-weather-puppy.html
   - /blog/pixel-pets-for-weather.html
   - Plus: /, /about.html, and the 5 hub pages (/blog/pet-safety.html etc.)
5. Also request indexing on 2–3 of the redirect stubs (e.g. /blog/alternative-to-weather-puppy.html) so Google discovers the redirects fast.

## 2. Bing Webmaster Tools (5 minutes)

https://www.bing.com/webmasters → "Import from Google Search Console" → submit the same sitemap. Bing feeds DuckDuckGo and ChatGPT browsing.

## 3. Validate rich results (one-time, after deploy)

- https://search.google.com/test/rich-results on: the homepage (SoftwareApplication + rating), faq.html (FAQPage), one gear roundup (ItemList), one blog post (Article/Person author).
- The homepage `aggregateRating` (5.0, 8 ratings) is real App Store data as of 2026-07-05 — **refresh it in index.html when ratings change** (it's in the JSON-LD block).

## 4. Backlinks that actually work for an indie iOS app

Roughly in order of effort-to-value:

| Action | Why | Where |
|---|---|---|
| **AlternativeTo listing** | Captures "Weather Puppy/Kitty alternative" intent off-site; strong domain | https://alternativeto.net/manage-item/ |
| **Product Hunt launch** | One-day spike + permanent dofollow profile + press pickup chance | producthunt.com (prep: tagline, gallery, first-comment story from Dom) |
| **App directories** | Easy citations: There's An App For That, ToolFinder, AppRater, etc. | Search "submit iOS app directory 2026" — do the free ones |
| **The temperature chart as link bait** | /blog/safe-walking-temperature-dogs.html#chart is built to be cited — pitch it | Pet bloggers, local news "heat wave" reporters, vet clinic blogs |
| **Journalist request platforms** | Answer pet+weather queries citing the chart (Featured.com, Qwoted, Connectively) | Set alerts for "pet", "dog", "heat wave", "weather" |
| **App-roundup writers** | iMore, 9to5Mac, AppAdvice, MacStories, TechRadar do "best weather apps" refreshes constantly | Short pitch: the "your OWN pet" angle is the hook + press kit link |
| **Reddit, tastefully** | r/iosapps allows self-promo days; r/dogs & r/cats only as a genuinely helpful commenter linking guides when on-topic | Never drop bare app links in pet subs |
| **YouTube/@WeatherPets** | Already exists — put myweatherpets.com in every description; video SERPs are winnable for "cute weather app" | Existing channel |

## 5. Monthly cadence (30 minutes)

- **GSC → Performance**: which queries/pages are gaining? Write the next batch of posts into proven clusters (`/weatherpets-blog` skill handles the mechanics).
- **GSC → Page indexing**: confirm the 9 redirect stubs drop out of the index and survivors stay in.
- **Quarterly link rot check**: AKC restructures URLs often. `python3` one-liner or any link checker over `blog/*.html` external links; fix 404s (this caused 8 dead citations last time).
- **Keep dateModified honest**: only bump it on real content changes (Google detects fake freshness).

## 6. Content pipeline (repeatable)

- New posts: run `/weatherpets-blog N` — the skill now carries the overhaul conventions (bylines Dom/Adam → about.html, Person schema, ≤60-char titles, no brand suffix, minified assets, hub placement).
- Keep the ratio: heavier on informational safety/breed/seasonal content (what actually ranks) than app-marketing pages.
- Never re-create the retired pages (see redirect stubs in blog/) — their queries are owned by the survivor pages.

## What was fixed in the overhaul (summary, July 5, 2026)

- **A — Technical**: valid ItemList JSON-LD, homepage aggregateRating, 7 dead citations replaced, 27 titles ≤60 chars, self-hosted App Store badge, font preconnect (removed render-blocking @import), minified CSS/JS, honest sitemap lastmod, llms.txt, screenshot alt text.
- **B — Consolidation**: 9 cannibalizing thin posts merged into 7 survivors (59 → 50 posts), meta-refresh+canonical stubs, all internal links rewritten.
- **C — E-E-A-T & architecture**: about.html, human bylines (Dom/Adam) + Person schema on all posts, 5 category hub pages, homepage keyword H1 + crawlable section, dates on blog cards, expanded support/creators, About in nav/footers.
- **D — Content**: 13 thin posts expanded to 750–1,050 words with honest comparisons; 13 new posts in safety/seasonal/breed clusters; shareable dog-walk temperature chart.
