# Website foundation and integration plan

## Repository inspection

Work is on `website-development`. The branch was created from main without resetting, stashing, or overwriting pre-existing uncommitted changes. All website work stays in this repository under `apps/site`; it is not a replacement CAD or a new bot.

Existing communication paths:

1. `apps/api/src/main.ts` runs Express and the Discord client in the same Node process. It constructs `DatabaseStore`, `ErlcAdapter`, and the bot services, mounts the existing authentication and CAD routes, and serves `apps/web/public`.
2. `packages/shared/src/database.ts` owns the Prisma client. `prisma/schema.prisma` and the existing migration history own records. `DatabaseStore` persists guild state used by bot workflows and publishes change events.
3. `apps/api/src/auth.ts` owns Discord OAuth (state/PKCE), server-side session records, guild membership checks, and CSRF validation. `packages/shared/src/permissions.ts` computes authorization from trusted Discord roles/configuration and checks agency access.
4. `apps/web/src/app.ts` and its map/widget modules use the existing authenticated HTTP API and authorized WebSocket updates. Existing CAD capability and layouts remain unchanged by the public website.
5. The new `apps/site` bundles public editorial content only. It reuses the public bot rules JSON and imports existing identity/group **types only**. No Prisma client, bot token, private application data, or runtime role authority is copied into it.

## Phase 1 scope

Public routes: `/`, `/departments`, `/departments/lapd`, `/departments/lasd`, `/departments/lafd`, `/departments/dot`, `/applications`, `/applications/status`, `/cad`, `/staff`, `/sessions`, `/community`, `/community/rules`, `/community/news`, `/community/guides`, `/community/contact`, `/profile`, and a client-side 404.

Blue/navy/silver design, original branded blueprint illustrations, supplied logos/banners, reusable page sections, configurable department details, manual galleries, interactive illustrative rank disclosures, mobile menus, keyboard navigation, route focus management, reduced-motion support, image errors and optional WebP sources are included. No stock photography or generated game screenshots are used.

Rank ladders, service areas, and academy subjects are explicitly illustrative/proposed until department leadership approves them. Command profiles remain unpublished. Recruitment status, sessions, and announcements point to their existing Discord authority; no invented live status or sample private data appears.

The site is prepared for static Cloudflare Pages hosting. It has not been deployed, and the current bot/CAD runtime or production settings have not been changed in this phase. The root TypeScript configuration excludes this independently compiled Vite application; existing root build/check/test commands still apply to bot and CAD.

## Phase 2 architecture

Implement these changes only after this foundation is reviewed:

- **Shared identity:** extend the existing API session authority, reusing `User`, `WebSession`, `Principal`, `groupsFor`, and department authorization. Prefer a reviewed same-origin gateway for `/api` and `/auth`; if separate origins remain necessary, explicitly design OAuth return URLs, cookie scope/SameSite, exact CORS origins, credential handling, and CSRF. Do not store tokens or roles in localStorage.
- **Public read model:** add explicitly sanitized public endpoints for published announcements, recruitment settings, sessions, and opt-in aggregate counts. Never expose `GuildState.data` wholesale or raw player/Discord/member records. Include freshness and unavailable states; cache public summaries with defined TTLs.
- **Department services:** introduce server modules under the existing API for membership/rank hierarchy, rosters, training/certifications, activity, evaluations, leave, attendance, and internal messaging. Share service methods with bot adapters. Enforce department scope and leadership capabilities for every mutation/read, verify target hierarchy and conflicts, and write audit records. Existing staff promotion/discipline role semantics remain authoritative.
- **Data design:** add reviewed Prisma migrations only when features are implemented: department membership/rank bindings, training records, roster visibility, published content, and department application definitions. Retain existing `User` IDs and application history. Do not create parallel user/application stores or migrate production data during UI development.
- **Applications:** staff applications currently start in Discord and answers are immutable once sent, with private review/DM decisions. Keep that behavior unless explicitly changed. Website drafts and configurable questionnaires may be added for separate department applications; distinguish draft editing from submitted immutable answers. Extend the existing application/review/audit/notification services rather than duplicate them. Gate eligibility, prevent duplicate submissions, handle revision conflicts and reviewer conflicts, and enforce applicant ownership.
- **Leadership access:** configure verified department leadership bindings in the existing permissions layer, distinct from plain department membership. Nobody gets management powers from the public directory or an unverified client flag. Promotions, infractions, private notes, staff records, and internal communication require server authorization and audit trails.
- **Deployment:** establish a real backend host/database/files/scanner and approved main-server invite, register exact Discord OAuth callbacks, then validate sign-in and authorization end-to-end. Publishing static frontend files alone cannot make the current CAD backend live. Deployment remains outside Phase 1.

## Validation and file handoff

Verified locally: root TypeScript/CAD production build passed; all 79 existing bot/CAD regression tests passed; the public website TypeScript and production build passed; 15 Chromium tests passed across desktop, tablet, and phone. Direct refresh/navigation of all 18 route cases, missing images, keyboard controls, gallery/rank interactions, and honest unfinished states passed. Website dependency audit reports zero known vulnerabilities. Desktop and phone screenshots were inspected. Supplied website banners now have approximately 18–33KB WebP variants while the source PNGs remain unchanged. Actual Safari/Firefox and hosted OAuth behavior are not covered by these Chromium tests.

The website build additionally audits output against configured local secret values and server-only markers without printing secret values. Staff policy content must not enter the public JavaScript; only the public server rules are included.

Commands and VS Code preview instructions are in `apps/site/README.md`. The website has its own lockfile and tests. Root regression tests use fixtures; they do not promote, discipline, message, or change members of the live guild. Actual OAuth and hosted Pages behavior must still be verified when those services are configured in a later phase.

The file list is `docs/WEBSITE_PHASE_1_FILES.txt`, generated from all source/media files under `apps/site` plus the root files changed for this phase. Dependency folders, build output, screenshots, logs, and secrets are excluded. Pre-existing modified bot/API/configuration files are not website edits and have been preserved.
