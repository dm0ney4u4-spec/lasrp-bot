# LASRP website update — departments and live ER:LC status

Work continues on `website-development` in the same repository. Existing uncommitted bot, website, and livery work was retained. No branch was merged, no host/domain was purchased, no services were deployed, and no database migrations were applied for this update.

## What works

- `apps/site/src/config/invites.ts` centrally owns the exact main, LAPD, LASD, LAFD, and LDOT invitations. Main Join Our Discord links are prominent on the homepage, navigation, community pages, and footer. Department cards, pages, and recruitment have their own join links. CHP has no fabricated link.
- Five department pages, including CHP preparation, reuse the current components and image placeholders. No department photography was downloaded/generated. Leadership/member directories and official rank structures remain unpublished until supplied by leadership. The old illustrative rank ladder is no longer presented as an official hierarchy.
- The homepage live dashboard and `/server-status` show real player count/capacity, population percentage, queue count, freshness, aggregate team populations, online staff when verifiable, and scheduled session timestamps when available. Unconfigured data, backend failures, stale data, absent queues, and incomplete team/staff data have distinct states.
- `/api/public/erlc-status` is a sanitized, read-only endpoint registered before the existing `/api` authentication gate. It returns aggregates, timestamps, an explicitly configured public join link, and safe scheduled-session metadata only. It never returns player names/IDs, queue identities, callsigns, locations, owner IDs, private API join keys, vehicles, emergency calls, private notes, or credentials.
- `/applications/dashboard` reads the signed-in user's existing application summaries. A reviewer queue is returned only when the existing server permissions authorize reviewers. Neither the endpoint nor frontend accepts a user ID to impersonate another applicant. Private notes, answers, questionnaire contents, and reviewer IDs are excluded from these summary views.
- `/departments/:slug/portal` checks the existing authenticated backend and agency permissions. Member access does not grant leadership privileges. Personnel, promotion, training, activity, discipline, and recruitment modules are visibly marked Coming Soon, with no enabled edits or fake saved records. CHP permissions have not been invented.
- The current Discord staff-application flow remains authoritative: immutable ordered DM answers, private reviews, and bot decision notifications. Website department questionnaires, saved drafts, reviewer scoring/notes, interviews, new acceptance/denial controls, and detailed audits remain planned interfaces, not implemented submissions.

## Shared adapter and freshness

The same `ErlcAdapter` instance constructed by the existing API is passed to the Discord bot, CAD/background jobs, and public endpoint. It uses the documented `GET https://api.erlc.gg/v2/server` with Players and Queue included, preserving the existing Vehicles and EmergencyCalls options required by CAD.

The adapter caches successful snapshots for 30 seconds and coalesces concurrent requests into one promise. Failed GETs back off for 30 seconds. Rate-limited calls honor the larger usable Retry-After header/body value with a conservative minimum wait; exhausted response buckets also defer requests until their reported reset. Invalid credentials stop further upstream calls until configuration/restart. No extra permanent website polling job was added to the server; existing bot jobs continue their operational polling.

Website viewers poll roughly every 45 seconds, respect longer backend retry intervals, pause when the tab is hidden, and stop outside the homepage/status route. Unknown queue is `null`, not zero. An actual empty API queue becomes zero/No players waiting. A complete player list is required for team counts; online staff uses each online player's documented Permission value, not the whole configured staff roster. Unknown team labels are grouped under Other rather than publishing arbitrary strings. A successful API response means API responding, not an invented offline/online game-state inference. Stale snapshots retain their timestamp and become visibly unverified.

Reference: [official v2 OpenAPI specification](https://api.erlc.gg/internal/docs/apispec.v2.json) and [official rate-limit documentation](https://apidocs.erlc.gg/rate-limits).

## Local preview and connecting your private server

Use Node 22.12+ and the existing root `.env`/database setup. The currently configured ER:LC key was present and successfully verified by a one-time read-only request. No key was printed. At verification on October 23, 2026, the API reported 0 players, capacity 50, and an empty queue. That was an observation, not a static website default.

```powershell
cd "C:\Users\erlcl\Downloads\Los Angeles Bot"
npm run site:dev
```

Open `http://127.0.0.1:5173/server-status` or `http://127.0.0.1:5173/`. The frontend dev/preview servers proxy `/api` and `/auth` to the existing backend at `http://127.0.0.1:3000`. If the backend is stopped, the frontend remains usable and shows Live Data Unavailable. Starting the existing backend with `npm start` remains an explicit operator action; this update did not restart it or register commands. Do not run two bot instances.

For a new private-server connection, enable the ER:LC API Pack, obtain your server key in the game's server settings, and set **root backend only** `ERLC_SERVER_API_KEY`. Keep the existing key if it already works. See `config/website.env.example` for additional names; merge needed values into the existing `.env`, do not overwrite it with blank placeholders.

Optional backend settings:

```dotenv
# Real, approved public game code, OR an approved https://erlc.gg/join/<code> URL.
PUBLIC_ERLC_JOIN_CODE=
PUBLIC_ERLC_JOIN_URL=
# Exact frontend origin when public status is fetched from a different host.
PUBLIC_SITE_ORIGIN=
```

Join Game is configured in the local backend environment from the official server join code. The public endpoint exposes only the intentional join URL; it never exposes the API credential or raw upstream response. Restart the backend after changing backend environment values.

To configure a new installation explicitly from the official server response, run `npm exec -- tsx scripts/configure-public-join.ts`. Existing valid public join settings are preserved.

Check the key directly without starting Discord or changing database rows:

```powershell
npm exec -- tsx scripts/check-public-status.ts
```

This performs one upstream read and prints only aggregate availability/counts. Do not run it continuously alongside the bot.

## Public hosting preparation, not deployment

The frontend remains a static Vite build prepared for Cloudflare Pages: root `apps/site`, Node 22, build `npm ci && npm run build`, output `dist`. Static hosting does not run the existing Express/PostgreSQL/Discord backend.

For a separately hosted public status API, configure `VITE_PUBLIC_API_ORIGIN=https://your-real-backend-origin` in the frontend build environment and `PUBLIC_SITE_ORIGIN=https://your-real-website-origin` on the backend. These are public origins, never secrets. The build writes a narrow connect-src rule into `dist/_headers` for exactly that HTTPS origin, and backend CORS allows exactly the configured frontend origin for this public read endpoint. Requests omit cookies. If both are served under a reviewed same-origin gateway, leave the frontend origin setting empty and route `/api/public/erlc-status` to Express.

Private workspaces deliberately use same-origin authenticated requests. A public cross-origin status setting does not grant private API access. Production private access requires a reviewed gateway for `/api` and `/auth`, valid registered Discord OAuth callbacks, the existing secure cookies/session checks, and existing backend permissions. Those live OAuth/gateway steps were not deployed or verified in this update. No competing login/session authority was created and existing CAD authentication was not changed.

## Verification

Website TypeScript and production build passed, including output audit for configured secrets and staff-only content. The root bot/CAD build passed. All **102 root regression tests** and **33 website Chromium browser tests** passed. Browser tests cover desktop/tablet/phone routes, invites, CHP's absent link, stale/error/empty queue states, hidden-tab polling pause, private history/department denial, reduced motion, gallery controls, and missing images. Desktop and mobile status screenshots were visually inspected; their sample numbers are isolated test fixtures, never production defaults. Backend tests prove concurrency coalescing, failure/rate-limit backoff, sanitized DTOs, applicant ownership, reviewer checks, and department denial. Existing Discord/livery regression tests still pass.

No claim is made that website submissions, draft saving, scoring, department management, full profile editing, or new review decisions work. They remain future features. Existing Discord bot workflows continue to provide actual staff application decisions and notifications.

## Files changed for this update

Existing files modified:

- `apps/api/src/erlc.ts`, `apps/api/src/main.ts`
- `apps/site/src/components.tsx`, `apps/site/src/pages.tsx`, `apps/site/src/main.tsx`
- `apps/site/src/config/site.ts`, `apps/site/src/config/departments.ts`, `apps/site/src/config/images.ts`
- `apps/site/package.json`, `apps/site/vite.config.ts`, `apps/site/.env.example`, `apps/site/README.md`, `apps/site/tests/site.spec.ts`

New files:

- `apps/api/src/public-erlc.ts`, `apps/api/src/website-workspace.ts`
- `packages/shared/src/public-status.ts`
- `apps/site/src/config/invites.ts`, `apps/site/src/integration/api.ts`
- `apps/site/src/live-status.tsx`, `apps/site/src/workspaces.tsx`, `apps/site/src/update.css`
- `apps/site/scripts/security-headers.mjs`, `apps/site/tests/status.spec.ts`
- `config/website.env.example`, `scripts/check-public-status.ts`, `tests/public-status.test.ts`
- `docs/WEBSITE_UPDATE.md`

Pre-existing livery/bot changes, CAD frontend, current Prisma models/tables, existing authentication, and source branding files were preserved. No credentials were written to frontend source or committed.

## Live activation and preview (October 23, 2026)

The real local API and Discord connection were checked, and the public status endpoint returned a live observation. The local Join Game configuration is now enabled. No public deployment or merge was performed. Department invitations match the requested central configuration; CHP remains Coming Soon. All department photo placeholders remain intact.

Run `npm start` in one PowerShell window and `npm run site:dev` in another. Open http://127.0.0.1:5173/ or http://127.0.0.1:5173/server-status. The API/CAD remains at http://localhost:3000. To start locally without re-registering Discord commands or bootstrapping panels, set `$env:DISCORD_SYNC_ON_START='false'` before `npm start`; normal startup defaults are unchanged.

With both services running, execute `node apps/site/scripts/check-live.mjs`. This uses real Chromium network requests without fixtures and checks the live page, homepage, configured game link, and a newer successful automatic observation. It fails if the upstream is unavailable; fixture tests separately cover outages and stale data. A production public hostname still requires a separately approved deployment, backend hosting, and routing/CORS configuration described above.

Live Chromium verification passed against the real backend at 2026-10-23T20:52:48.319Z: 0/50 players, queue 0, valid Join Game link, homepage and detailed dashboard, and a newer automatic observation. The current bot/CAD build, website build/security audit, 102 backend regression tests and 33 responsive browser tests all passed after activation. The bot health endpoint also reported Discord connected. Counts change with the actual server; these are verification observations, not defaults.
