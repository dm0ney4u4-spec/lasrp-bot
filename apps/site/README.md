# LASRP public website

A React / TypeScript / Vite member website alongside the existing Discord bot and CAD. Discord login, member profiles, department access, existing preferences, and logout reuse the shared backend. See `docs/MEMBER_PLATFORM.md` for current authentication setup and limitations, and `docs/WEBSITE_UPDATE.md` for live ER tracking. No deployment or database migration was performed.

## Run on Windows

Install Node.js 22.12 or newer. From a VS Code terminal in the repository:

```powershell
cd "C:\Users\erlcl\Downloads\Los Angeles Bot"
npm ci
npm ci --prefix apps/site
npm run site:dev
```

Open **http://localhost:5173** in Edge, Chrome, or VS Code's **Simple Browser: Show** command. Use Ctrl+Shift+P to find that command, then enter the URL. Vite updates the preview when source files change. Public pages can preview without the backend; live status and member features require the existing bot/API and database. Start them with `npm start` in a separate terminal. Register `http://localhost:3000/auth/callback` in the existing Discord application and set root `WEBSITE_BASE_URL=http://localhost:5173`.

Production build and local production preview:

```powershell
npm run site:build
npm run site:preview
```

Open **http://127.0.0.1:4173**. Stop either preview with Ctrl+C. These commands do not start, stop, deploy, or reconfigure the existing bot/CAD server.

Browser checks:

```powershell
npm exec --prefix apps/site -- playwright install chromium
npm run site:test
```

Tests start the local production preview and cover desktop, tablet, mobile, direct page routes, keyboard menus, history, image loading/fallback, gallery controls, rank disclosures, and honest recruitment/account states. Build first. Screenshots and failure traces are in ignored `test-results/`. Browser authentication fixtures and backend HTTP/session tests cover the member flow; actual Discord consent requires the callback registration and an actual member. Staff decisions remain in Discord.

## Public configuration

- `src/config/invites.ts`: all supplied website Discord invitations, including the main server. CHP is null and renders Coming Soon.
- `src/config/site.ts`: public channel links and CAD origin validation. The main invitation is `https://discord.gg/6gUz277jFg`.
- `src/config/departments.ts`: reusable public department content, responsibilities, illustrative rank progression, proposed service areas, academy topics, and department invites. No fabricated leadership names, real roster, or asserted official rank structure.
- `src/config/images.ts`: all hero/gallery slots, alt text, focal point, and optional WebP alternatives. See `public/images/README.md`.
- `src/integration/contracts.ts`: type-only reuse of the existing `Principal` and `Group` contracts; future service interfaces have no fake implementation.
- `src/pages.tsx`: public pages; rules import the current bot's public server-rules JSON directly. Private staff rules are not displayed.

To point to a real CAD origin, copy `.env.example` to `.env.local` **inside apps/site**, then set `VITE_CAD_URL=https://your-real-cad-host`. Rebuild. HTTP loopback is allowed in development only. No placeholder hostname is shipped. Until configured, the CAD landing page explains that the public address is pending. The existing backend still needs a matching `WEB_BASE_URL` and registered OAuth callback; this phase does not change them.

Every `VITE_` variable is public browser configuration. Never paste database URLs, Discord tokens, OAuth client secrets, or session keys into this frontend. The backend now exposes `/api/public/erlc-status` with explicit aggregate-only fields. Website workspaces use the existing backend session gate. No new OAuth exchange, password store, application submission form, or management mutation is created here.

Supplied branding is copied into this app; original assets stay untouched. Optimized WebP banner variants are included. Run `npm --prefix apps/site run media:optimize` after updating copied branded PNGs. Preparation of original placeholder artwork is a separate opt-in command, so ordinary builds never overwrite replacement photos.

## Cloudflare Pages preparation (do not deploy yet)

This is a static SPA. For a future Pages Git integration against **the same repository**, choose:

- Branch: `website-development` when reviewed and pushed.
- Root directory: `apps/site`.
- Build command: `npm ci && npm run build`.
- Output directory: `dist`.
- Build environment: `NODE_VERSION=22`.
- Optional public build variable: `VITE_CAD_URL` once an actual backend origin exists.

No top-level `404.html` is generated: Cloudflare Pages serves SPA routes using the index fallback. The client renders its own unknown-route page. `public/_headers` adds browser security headers and immutable caching only for hashed `/assets/` bundles. Verify these and direct route refreshes on Pages before publication. No Pages project, custom domain, DNS, or production service has been changed. Static Pages hosting will not host the bot, PostgreSQL, or current Express backend.

## Current vs. planned

Working: public page routing, responsive navigation, exact Discord invites, department galleries/placeholders, approved-public rules, configured CAD link, missing-image fallback, and static production output. Homepage and `/server-status` fetch the sanitized live backend with real unavailable/stale states. `/applications/dashboard` reads existing application summaries and the permitted reviewer queue after server authentication; department portals verify existing agency access and display preparation modules.

Still requires configuration or implementation: public hosting/gateway, registered Discord callbacks, verified department membership/rank/command role IDs, CHP permission bindings, department application forms/drafts, scoring/review actions, management mutations, leadership rosters, and certifications. No fake records or counters are used. Existing immutable staff DM applications and decision notifications continue in Discord.

## Phase 2

See `docs/WEBSITE_PHASE_1.md` at the repository root for the architecture, file manifest, verification, and next implementation work. Existing staff applications remain immutable Discord DM flows. Website drafts must not silently change that workflow.

## Member platform

`/login`, `/member`, `/profile`, and `/profile/settings` now use the existing backend session. Community roles and department capabilities are server verified; own application statuses, notifications, and profile settings use existing APIs. See `docs/MEMBER_PLATFORM.md` for canonical localhost setup, production HTTPS requirements, department configuration, and the external Discord callback registration that remains required.
