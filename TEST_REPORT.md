# Verification report

## Passing local checks

- `npm run build`: TypeScript `--noEmit` checks and browser bundle build passed.
- `npm test`: **73 tests passed, 0 failed**, including forty PostgreSQL-wire integration subtests and three map geometry/validation tests.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities at the last run.
- `npm audit`: zero known vulnerabilities at the last full audit.
- `npm run smoke`: passed against the running local application: database health, local demo login/session, CSRF, character/vehicle creation, incident, duty, assignment and closure. All created records were explicitly DEMO data.
- All default templates serialize using the installed **discord.js 14.27.0 builders**, including every rules page. V2 flags, 40-component budget, 4,000-character text budget, duplicate IDs, unknown actions and unsafe media origins are validated.
- Registered slash command builders serialize with unique names. The inventory is generated from actual builders.
- All five supplied image files are included and exist locally. Sessions and applications map to different supplied banners; default thumbnails use the supplied logo.

## Automated behavioral coverage

1. Validated ER:LC snapshots/cache, invalid authentication, HTTP 429 pause, timeout/missing fields, and announcement injection/uncertain-POST handling.
2. Civilian/agency/management permission boundaries and schema rejection of extra/private/injected fields.
3. Incident → duty → assignment → on-scene → report → close through real Express HTTP routes and Prisma transactions.
4. Stale incident versions rejected instead of overwriting newer data.
5. Character/vehicle ownership, direct-route agency denial and privacy-safe lookup fields.
6. Demo/production record separation.
7. Concurrent official-session reservation produces exactly one active session; attendance is deduplicated.
8. Application draft persists across service recreation; only one contradictory review succeeds; blocked DM is recorded without reverting the decision.
9. Ticket claim/close/reopen, permission-overwrite calls, retained private transcript content and DM summary, with mocked Discord transport and real transcript database persistence.
10. Accused staff complaint access denial, restricted support-category denial and security incident detection with no default automatic punishment.
11. Anonymous session denial, cross-origin demo-login denial, HTTP-only session issuance and CSRF rejection/acceptance.
12. Incident merging preserves source narratives, transfers assignments and linked records, and rejects stale changes. Agency transfer releases old units and notifies receivers.
13. Self-dispatch respects the configured enable flag, duty freshness and dispatcher presence. A revoked duty role cannot extend stale dispatcher presence.
14. Structured traffic stops create linked citation/arrest reports with immutable penal-code/fine snapshots and prevent repeated closure or unauthorized edits.
15. Private evidence validates filename/type/size, encrypts files, rejects stale uploads, enforces sealed/agency access, logs custody, and rejects tampered ciphertext.
16. Fire, EMS and towing stages reject skipped transitions. EMS validates configured fictional hospitals; towing requires inventory and authorized release while owners can request review.
17. DOM component tests navigate the real CAD bundle and submit traffic-stop and penal-code forms through actual Express/Prisma routes. These are DOM tests, not graphical browser rendering checks.
18. Notification reads are recipient-only; civilian call views omit private dispatch notes.
19. Roblox OAuth uses mocked official HTTP transport with real challenge/account persistence: PKCE, session binding, identity verification, single-use state, replay rejection and unlink auditing.
20. Court tests cover feature flag, authorization, independent decisions, hearing state, fictional fine and appeals. Generic API changes to structured cases are rejected.
21. Warrant tests cover submission, independent approval, version conflicts, controlled expiry and subject matches; agency denial is enforced.
22. Preferences are private, persisted and versioned; muted categories cannot suppress mandatory assignment alerts.
23. Native AutoMod synchronization updates bot-owned rules and leaves other creators' rules untouched, using mocked Discord transport.
24. Unit emergency tests cover fresh duty, notification persistence, cooldown and missing duty.
25. Station/apparatus tests enforce agency and management restrictions. Multi-patient tests enforce EMS privacy, stage order, configured hospitals and closure only after completed transports.
26. Staff suspension removes configured authority roles and persists recovery state; reinstatement rejects roles that gained Administrator and restores eligible roles.
27. Session reservations remain unique across repeated RSVP requests, cancelled schedules reject changes, and quality scorecards require independent management with version checks.
28. Map tests cover affine projection/inverse, axis direction, rotated artwork, degenerate calibration/boundaries, clipping, agency/private-location visibility, stale snapshots, persisted calibration, stale revisions, feature creation/archival and generic-record API bypass rejection. DOM tests zoom/reset and click the SVG map to submit a station into the real API. Official postal artwork was visually inspected; a graphical browser was unavailable.

## Verification limits

Discord transports in tests are mocked. No live bot token, guild IDs/roles/channels, OAuth client credentials or ER:LC key were supplied. Thus live delivery, role hierarchy effects, real external API responses, Discord image rendering and OAuth provider callbacks are **not verified**. Local builder validation cannot guarantee a successful network API response.

The browser-control inventory was empty. DOM component tests and HTTP route tests pass, but desktop/mobile graphical rendering and real-browser automation were **not performed**. No purported screenshots are included.

PGlite runs actual PostgreSQL-compatible SQL over its socket adapter for these integration tests. Run the same migration and workflow checks against PostgreSQL 16 before deployment. Automatic role containment and live staff-role transitions need a separate test guild exercise. `SETUP_CHECKLIST.md` lists those steps explicitly.

Continuation coverage: low-population timing/recovery/gaps; specialist court role boundaries; private fictional registration ownership and independent approval; investigation task assignees, stale edits, stage order and closure gates. Real local startup/restart was checked with the configured Discord bot: /health reports database connected and Discord connected, and /auth/options reports demo false. Full browser OAuth was not completed. The new local startup uses a separate durable data/local-postgres directory.

CAD completion pass: mutual aid privacy and response-call closure, acknowledged evidence handoffs, readable PDF bytes and ZIP originals/manifests, dashboard move/resize persistence, specialized report fields, sealed court party restrictions across list/history/PDF, and idempotent radio acknowledgments are covered. ClamAV INSTREAM clean/infected/error paths are tested with a local TCP protocol fixture, not an installed antivirus engine. Local scan mode is explicitly off; production enforces required. Dependency audit is clean after using patched fflate 0.8.3. See docs/CAD_GUIDE.md for export/font limits and external validation remaining.

## Discord channel and command update

Six additional policy tests verify the simplified menu, exact session role, limited role pings, one-way application UI, threshold notifications and unavailable/stale counts. Integration coverage also rejects answer replacement and stale answer modals. Deployed message and command verification succeeded through Discord REST. See docs/DISCORD_CONFIGURATION.md for the unresolved OAuth portal setting, Discord role hierarchy, and preserved old database incident.

## Staff hierarchy and discipline update

73 automated tests pass. Full supplied rank ladder, automatic team badges, warning/strike escalation, restriction snapshots/restoration, and one-message application reviews are implemented. See docs/STAFF_WORKFLOWS.md for command usage, hierarchy constraints, and treatment of suspension revocation.

Live deployment confirmed one existing application review consolidated and twelve separate bot-owned answer messages removed. The bot connected successfully with all supplied role IDs present and its highest role above the configured staff roles.

## Startup repair

The current embedded database was recovered into durable local PostgreSQL; verified 28 tables / 33 recovered rows, connected bot/database health, clean stop/restart, and safe duplicate-start handling. See [startup recovery instructions](docs/STARTUP_RECOVERY.md). The original files and recovery exports remain preserved.

## Interaction timeout fix

76 tests pass. Slash commands, modal submissions, and non-modal buttons now defer immediately before database/network permission checks. Existing reply/defer calls safely complete the deferred response; form-opening buttons remain eligible for showModal. Application-review modal buttons use the interaction role snapshot for opening the form, with fresh authorization still enforced at submission. Added sanitized persistent interaction error codes in data/interaction-errors.ndjson. Verified Discord has no external interactions endpoint configured. Stop now waits for completion, and background refreshes have a 15-second shutdown grace period. A real Discord /help invocation still requires the user to try the command.
