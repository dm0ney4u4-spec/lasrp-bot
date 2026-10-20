# LASRP build progress

## Phase 1 — runnable foundation

Implemented: `apps/bot`, `apps/api`, `apps/web`, `packages/shared`, central `config/ids.ts`, secret `.env` generation, PostgreSQL/Prisma schemas and migrations, typed permission/schemas core, Discord command registration, OAuth sessions/CSRF, local assets, V2 renderer and editor. TypeScript builds cleanly. The web app uses a small TypeScript browser bundle rather than Next.js/Tailwind; the specification presented that framework as recommended, not mandatory.

The reusable renderer and some initial bot business helpers remain JavaScript modules imported by TypeScript orchestration. They are exercised by tests; this is not a claim that every source file is strictly typed.

## Phase 2 — applications and tickets

Implemented: one-question-at-a-time DM applications, durable drafts and active-application uniqueness, pause/resume/previous/cancel/review/submit, private paginated review cards, claim/accept/deny/interview/more-info/private notes/history, optimistic review decisions, safe trainee role grant, outcome DMs/failure recording, management-editable questions, authenticated web fallback. Private ticket creation, category intake, complaint conflict handling, claim, participant access, escalation, priorities, reason-required closure, private stored transcripts, retention and reopen.

Verified locally: application state through service recreation, contradictory-review rejection, DM-failure persistence, ticket state/permission calls and transcript content. Real Discord channel permission behavior and DM rendering still require the configured guild.

## Phase 3 — staff, moderation, security and sessions

Implemented: warning/kick/ban/tempban/timeout cases, appeals and revocation, staff profiles/roster/activity/training/notes, configured rank transitions with hierarchy checks and rollback, private staff infraction points/expiry/history/revocation, public privacy-safe rank notices and DMs. Owner-protected security settings; gateway/audit burst detection; trusted/protected IDs; owner-opted-in limited role containment; captured-permission lockdown/recovery. SSU/SSD confirmation, database-unique active session, attendance, history, votes, schedule/cancel/reminders, host transfer/extension, live original-message refresh. Verified v2 ER:LC adapter with rate-limit and invalid-key handling and allowlisted announcement command.

Added: staff suspension/reinstatement with persisted role-removal intent, safe restoration checks, per-member locks and DM outcomes; session RSVP and independent management scorecards; `/security automod` idempotently provisions bot-owned native mention protection and configured blocked-domain filters; unrelated rules are preserved. `/panic` and the CAD emergency form notify fresh on-duty responders with a cooldown and immutable audit.

Not complete: reputation-based suspicious-link feeds, full granular anti-nuke recovery console, remaining staff HR workflows beyond the implemented suspension/reinstatement, every requested ER:LC command/log viewer and all requested command aliases.

## Phase 4 — CAD/MDT

Implemented: secure dashboard, manual 911/calltaking, incidents/notes/status timestamps, agency/ownership checks, duty/status and heartbeats, dispatch assignment/release, incident merges/transfers, policy-checked self-dispatch, private notifications, civilian characters/vehicles/ownership transfers, lookups, structured traffic stops, management-editable fictional penal codes and snapshotted charges, private encrypted evidence uploads/downloads and custody events, dedicated Fire/EMS response/transport, DOT towing/impound/release requests, report versions/history, text radio, WebSocket refresh, CSV export, staff/application/session/admin views and dark/light styling. Dedicated workflows were added below; legacy records remain readable in Reports.

Added: dedicated investigation notes/relationships, independent warrant approvals, BOLO acknowledgment/expiry and match searches; optional court submission, scheduled hearings, independent verdicts, fictional fines and appeals; saved account themes, dashboard section order/visibility and notification filters with mandatory emergency alerts; Roblox OAuth verification with PKCE, single-use expiring state bound to the Discord session; station/apparatus rosters and assignments; minimal fictional multi-patient care/transport with closure checks. Structured cases cannot be edited through the generic record API. Migrations 0006 and 0007 are included.

Map update: official ER:LC fall/snow base and postal images installed from the documented PRC endpoints, preserving source attribution. Implemented pan/zoom, remembered layers/view, measured three-anchor calibration, authorized API player projection, independent manual unit-location freshness, incident placement, station/postal/roadblock pins, patrol polygons and audited archival. Calibration/feature state persists in PostgreSQL with version checks. No actual measured live calibration has been supplied yet; the live server must provide ground-truth anchors. See docs/MAP_SETUP.md. Graphical browser verification remains unavailable; image inspection and DOM/API tests pass.

Implemented the remaining tracked CAD feature modules: draggable/resizable persisted dashboard widgets; agency-scoped mutual aid with linked response calls; acknowledged physical evidence custody; ClamAV streaming integration with production fail-closed enforcement; branded PDF and bounded ZIP exports with evidence, histories and integrity manifests. Added structured crash/force/witness/search-seizure/highway-assistance reports, sealed-court party access, related-record lookups and durable radio acknowledgment. See docs/CAD_GUIDE.md for controls and precise limits. Pending CAD readiness checks are live configuration, measured calibration, an actual scanner engine, graphical browser QA and public deployment; these are not claimed complete.

## Phase 5 — verification/handoff

Build and automated tests pass; production and full dependency audits report zero known vulnerabilities at last check. PostgreSQL-wire tests use PGlite for repeatable local integration tests, not a separately provisioned PostgreSQL 16 daemon. An actual credential-free local web demo is supported. Windows instructions, owner configuration checklist, command inventory, source references and icon guide are included.

DOM component tests now exercise navigation and submit traffic-stop/penal-code forms against real Express/Prisma routes. Database integration tests cover the added dispatch, evidence and agency workflows. Live Discord token/server discovery, gateway connection and startup command registration succeeded. Pending external validation: user command workflows and message rendering, real browser OAuth completion, real ER:LC behavior, graphical desktop/mobile browser QA and public production deployment. Browser surfaces were unavailable in this session. The entire master document is not yet complete.

## Current continuation

Added sustained low-population session alerts, investigation task assignment/progress/closure checks, optional specialist court-role authority, fictional property/business/permit submissions with independent management review, and a separate non-demo persistent local startup mode. Live health checks show Discord and the database connected; demo login is disabled. DATABASE_MODE=local is local development, while hosted production uses PostgreSQL. See README and docs/PRODUCTION_DEPLOYMENT.md. The public website has not been deployed.

## Discord configuration update (2026-10-19)

Requested application/CAD/rules/session V2 panels deployed; role and channel routing applied, application answers immutable, session menu reduced and live status added. 67 automated tests pass. OAuth secret accepted, but redirect URI list is empty; developer portal configuration remains necessary. Original embedded database has an invalid checkpoint and is preserved with a full backup; service uses a separate database and old records are not restored. See docs/DISCORD_CONFIGURATION.md.

## Staff hierarchy and discipline update

73 automated tests pass. Full supplied rank ladder, automatic team badges, warning/strike escalation, restriction snapshots/restoration, and one-message application reviews are implemented. See docs/STAFF_WORKFLOWS.md for command usage, hierarchy constraints, and treatment of suspension revocation.

## Startup repair

The current embedded database was recovered into durable local PostgreSQL; verified 28 tables / 33 recovered rows, connected bot/database health, clean stop/restart, and safe duplicate-start handling. See [startup recovery instructions](docs/STARTUP_RECOVERY.md). The original files and recovery exports remain preserved.

## Interaction timeout fix

76 tests pass. Slash commands, modal submissions, and non-modal buttons now defer immediately before database/network permission checks. Existing reply/defer calls safely complete the deferred response; form-opening buttons remain eligible for showModal. Application-review modal buttons use the interaction role snapshot for opening the form, with fresh authorization still enforced at submission. Added sanitized persistent interaction error codes in data/interaction-errors.ndjson. Verified Discord has no external interactions endpoint configured. Stop now waits for completion, and background refreshes have a 15-second shutdown grace period. A real Discord /help invocation still requires the user to try the command.
