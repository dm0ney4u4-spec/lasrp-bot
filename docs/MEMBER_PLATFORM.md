# LASRP member platform — Discord authentication

This update extends the existing Express Discord OAuth implementation and existing PostgreSQL `User` / `WebSession` records. It does not create another bot, session system, database, or password store. No Prisma migration is needed. The public live server endpoint remains before the authenticated API gate.

## Local setup

Keep secrets in the root `.env` only:

```dotenv
WEB_BASE_URL=http://localhost:3000
WEBSITE_BASE_URL=http://localhost:5173
DISCORD_OAUTH_CLIENT_SECRET=your_existing_application_secret
APP_SESSION_SECRET=your_existing_random_secret_of_at_least_32_characters
DEMO_MODE=false
```

Preserve your existing bot token, ER key, database settings, and session secret. Do not copy environment secrets into `VITE_` variables, source files, or GitHub.

In the **existing** Discord application `1561426484554506270`, open Developer Portal → OAuth2 → Redirects and register this exact URL:

```text
http://localhost:3000/auth/callback
```

The application inspection performed during development reported an empty callback list. The application owner must register the callback in Discord and complete the normal consent screen. This external registration was not changed or bypassed. A missing registration can produce Discord's invalid redirect URI / invalid grant message. Bot membership in the main LASRP guild and valid existing OAuth credentials are also required.

Run `npm start` and, in another PowerShell window, `npm run site:dev`. Open **http://localhost:5173/login**. Login starts on the configured backend, stores the signed state cookie on localhost, and returns to **http://localhost:5173/member**. If you originally open 127.0.0.1:5173, the login link deliberately uses localhost, and the completed login returns to localhost. Do not switch hostnames after signing in: cookies are host-only. CAD at http://localhost:3000 shares that same session cookie. Ports do not create separate cookie domains.

For the production-build preview on port 4173, set `WEBSITE_BASE_URL=http://localhost:4173` and restart the backend, then run `npm run site:preview`. Do not allow arbitrary localhost ports or wildcard request origins. `DISCORD_SYNC_ON_START=false` optionally skips command registration/panel bootstrap during local backend restarts.

## What works

- Prominent login entry, dedicated login/error screen, profile menu, Discord username/avatar, member dashboard, and CSRF-protected logout.
- Existing 12-hour database sessions survive reloads and backend restarts. Only SHA-256 session-token hashes are stored in the database. Session cookies are HttpOnly, SameSite=Lax, host-only, and Secure on HTTPS; bearer/OAuth tokens are not returned to the browser or persisted in browser storage.
- Existing signed OAuth state and PKCE remain authoritative. Return destinations are fixed configured origins; query parameters cannot supply arbitrary return URLs. Discord OAuth cancellation, invalid state, offline verification, and missing configuration have clear states.
- Fresh main-guild member/role checks on authenticated requests. Removed guild membership or revoked roles immediately remove backend access, rather than trusting a previous browser profile.
- Real community roles, own application summaries, existing user-scoped notifications, and an operational CAD link only when backend permissions permit it.
- Profile settings read and update the existing versioned CAD preferences endpoint, preserving unrelated settings and CSRF/optimistic concurrency. Discord username/avatar/ranks remain managed in Discord. The website retains its navy design; the editable theme preference affects CAD.
- Private LAPD, LASD, LAFD, and LDOT entry checks reuse existing `agencyAccess`. CHP remains Coming Soon with no active portal or invented permissions. Existing public department invites and all photo placeholders are unchanged.

## Department configuration and limits

Existing membership role IDs belong in `config/ids.ts` (`police`, `sheriff`, `fire`, `dot`) or the existing database `rbacRoles` settings. These default IDs are currently empty; do not guess them from role names or automatically interpret unrelated staff roles as department membership. Roles must exist in the main LASRP guild. Membership of a separate department Discord is not queried or inferred.

`config/website.ts` adds explicit, nonsecret `rankRoleIds` (highest first) and `commandRoleIds` per department. They remain empty until leadership supplies verified IDs. A rank is displayed only when the user has both department membership and the configured rank role. Command roles additionally require authorized department access. Existing global management/owner and CAD dispatcher/supervisor access rules remain intact; operational access is labeled separately from actual department membership.

The department portal returns its backend management capability. Personnel edits, promotion tools, department recruitment/scoring, and discipline management remain planned; no permissive mutation endpoints were added. Staff applications and decisions continue through the existing Discord workflows. No notifications or profile records are fabricated when the database has none.

## Production preparation — no deployment performed

Use the same HTTPS public origin for `WEB_BASE_URL` and `WEBSITE_BASE_URL`, e.g. `https://members.your-domain.xyz`. Route `/auth/*` and `/api/*` to the existing backend and serve the site for other member/public routes. Keep the existing CAD available through its own reviewed route/origin configuration; the member CAD link currently targets the configured backend origin. Register the production origin's exact `/auth/callback` in the same Discord application before switching. Configure a real CAD destination in the existing public site/CAD routing before deploying the two frontends under one hostname. Do not let the website catch-all replace backend API/auth routes.

Backend startup rejects HTTP production origins, credentials/paths in authentication origins, mismatched cookie hostnames, and different production member/backend origins. Mutations require an exact trusted Origin plus the existing per-session CSRF token; private APIs are not enabled with wildcard CORS or cross-site cookies. The public ER API's optional CORS setting does not grant private member access. Only Discord's CDN was added to the static site's image CSP for avatars.

## Verification

`npm run build`, `npm run site:build`, `npm test`, and `npm run site:test` cover TypeScript, production bundles, output secret audit, existing bot/CAD/application regressions, HTTP OAuth/session/CSRF lifecycle, fresh department authorization, expiry/revocation, canonical local origins, secure production rejection, mobile layouts, profile preference persistence, and logout. HTTP OAuth tests substitute only the Discord responses and test database adapter; a separate existing PostgreSQL integration exercises real database session/CSRF behavior. Browser fixtures are isolated tests, never default member data.

A real Discord consent/sign-in cannot be claimed as verified until the application callback is registered and an actual member completes consent. No credentials, private environment files, production deployment changes, or merges into main are part of this update.

Final verification: 104 backend tests and 42 Chromium browser tests passed. Desktop and mobile member layouts were visually inspected. The local health endpoint reported PostgreSQL and Discord connected; the untouched public ER endpoint returned live 0/50 players and an empty queue during verification. Real Discord consent remains unverified until the callback is registered.

Official protocol reference: https://docs.discord.com/developers/topics/oauth2 . This integration keeps the existing identify-only authorization-code flow and never requests the member?s password or email.

The exact staged commit also passed its isolated build and all 86 tests present in that commit; the 104-test working-tree run additionally includes preserved local bot/livery regressions. An unmocked Chromium check confirmed the actual localhost login page, redirect to Discord with identify scope, the exact localhost callback, and a signed HttpOnly SameSite=Lax state cookie. Discord's application API explicitly returned redirect_uris as an empty array.
