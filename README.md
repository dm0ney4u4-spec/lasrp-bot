# LASRP Operations · LASRP CAD

A runnable TypeScript bot/API and browser CAD for **Los Angeles State Roleplay**. Discord and CAD share one backend and PostgreSQL database. The supplied five branding files are included intact. All custom Discord messages use real Components V2, with uploaded local media, restrained blue styling, custom white-icon configuration, and monochrome fallbacks.

**Release status:** working implementation with automated database integration tests. This is **not the complete master-spec feature catalog**. Read [BUILD_PROGRESS.md](BUILD_PROGRESS.md), [COMMAND_INVENTORY.md](COMMAND_INVENTORY.md), and [TEST_REPORT.md](TEST_REPORT.md) for exact scope. The real bot token/server were verified and a live Discord gateway connection succeeded. Real browser OAuth completion, external ER:LC behavior and graphical Discord rendering still need live validation.

## Windows quick start

Install Node.js **22.12 or newer**, npm, and either Docker Desktop or PostgreSQL 16. A project-local Node 22 runtime is also included as a development dependency. Commands below use PowerShell in this project directory:

```powershell
cd "C:\Users\erlcl\Downloads\Los Angeles Bot"
npm ci
npm run setup:env
npm run db:generate
npm run build
npm test
```

`npm run setup:env` creates `.env` when needed and fills missing session, editor, and evidence-storage secrets. Existing nonempty credentials are preserved. It never prints generated secrets. An equivalent helper is `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1`.

### See the actual web application without credentials

```powershell
npm run demo
```

Open **http://localhost:3000**, choose **Local demo sign-in**, and create fictional characters, vehicle registrations, incidents, duty records, assignments, and reports. This uses a real persistent PGlite PostgreSQL-compatible engine under `data/demo-postgres`, with the same Prisma schema and API. It does not simulate Discord DMs, guild membership, or API telemetry. Demo mode is prohibited in production and demo records are excluded from production queries. The demo database protocol socket binds only to `127.0.0.1:54329`; it is a development facility, not a production database service. Stop the demo with Ctrl+C before generating Prisma clients on Windows.

### Connect the real bot and PostgreSQL

For local use without a separate PostgreSQL installation, set `DATABASE_MODE=local`, `DEMO_MODE=false` and `BOT_ENABLED=true` in `.env`, configure your Discord IDs/token, then run **`npm start`**. This starts the real bot with a separate persistent database at `data/local-postgres` and automatically applies its migrations. It uses normal Discord sign-in, not demo owner access. `npm run doctor` checks configuration without printing secrets. Stop this process before starting another copy or copying the local database for a backup. This single-process local database mode is prohibited with `NODE_ENV=production`.

For public hosting, set `DATABASE_MODE=postgres` and use PostgreSQL with the instructions below. Existing local records are not automatically copied into a hosted PostgreSQL database; plan migration before collecting important live records locally. See [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md).

1. Edit **[config/ids.ts](config/ids.ts)**. Paste your guild ID, application/client ID, owner user IDs, and the channel/role IDs you will use. All Discord IDs belong here. Empty optional IDs leave modules unconfigured.
2. Edit your private **`.env`**, using [.env.example](.env.example) as the reference. Supply the Discord bot token, OAuth client secret, PostgreSQL URL, and optional ER:LC API key. Never put these in `ids.ts` or Discord messages.
3. Start your database:

```powershell
docker compose up -d postgres
npm run db:migrate
npm run register
npm start
```

If using an existing PostgreSQL server, skip Docker and set its connection string in `DATABASE_URL`. The Docker password and URL password must match. `POSTGRES_PASSWORD` can be supplied in `.env` to replace the local example password.

The bot, API, and CAD run together at **http://localhost:3000**. The private owner panel editor is **http://localhost:3000/admin/**. `npm run register` registers only implemented commands. Startup also refreshes guild commands. Use `/setup validate` in the configured guild before deploying panels.

`npm run dev` watches the backend. `npm run build` checks TypeScript and builds the browser bundle. After web TypeScript edits, run `npm run web:build` or `npm run build`. `npm run bot` is an alias for the same shared backend, not a second independent bot process.

## Configuration values

Optional additions: `sessionAlerts` controls sustained low-population notices to session hosts; `courtsPolicy.specialistRolesEnabled` separates judge, prosecutor, defense and clerk authority using their configured role IDs. Civilian Portal submissions for fictional properties/businesses/permits are reviewed in Admin. Investigations has assigned tasks; unfinished tasks block case closure.

| Setting | Required for | Where |
|---|---|---|
| `guildId`, `clientId`, `owners` | Real Discord operation, OAuth and setup | `config/ids.ts` |
| management/staff/support/reviewer/host roles | Their permission groups and private workflows | `config/ids.ts` |
| `applicationReviews` | Submitting DM/web applications | `config/ids.ts` |
| `applicationLogs` | Optional restricted application outcome log | `config/ids.ts` |
| `ticketCategory` or `categories.tickets` | Optional ticket placement; privacy is explicit on every channel | `config/ids.ts` |
| `sessions`, optional `sessionVotes` | SSU/SSD/voting/reminders | `config/ids.ts` |
| `moderationLogs` | Discord moderation cases | `config/ids.ts` |
| `staffLogs`, `infractions`, `promotions` | Staff rank/discipline logs and optional public rank notices | `config/ids.ts` |
| `securityAlerts`, `securityTeam` | Restricted security notifications | `config/ids.ts` |
| `dispatch` and agency roles | CAD Discord notifications and department access | `config/ids.ts` |
| `verified`, `trainee` | Optional verification and accepted-applicant role grants; use roles without permissions | `config/ids.ts` |
| custom emoji IDs | Optional white custom icons | `config/ids.ts` |
| `DISCORD_BOT_TOKEN` | Real Discord connection | `.env` |
| `DATABASE_URL` | Production persistence | `.env` |
| `DISCORD_OAUTH_CLIENT_SECRET`, `APP_SESSION_SECRET`, `WEB_BASE_URL` | Secure browser login | `.env` |
| `ERLC_SERVER_API_KEY` | Optional real ER:LC telemetry/announcements | `.env` |
| `DASHBOARD_TOKEN` | Optional local owner-only panel studio | `.env` |
| `FILE_STORAGE_SECRET` | AES-256-GCM private evidence storage; generated as 64 hexadecimal characters | `.env` |

Change `settings.applicationOpen` only after configuring requirements and the private review channel. Recruitment settings and questions are editable in **Admin → Recruitment settings** and persisted in the database. `/applications open` and `/applications close` change availability. No age minimum or promised response time is invented.

`/setup wizard` binds bot channel/access settings through selectors; `/setup roles` binds specific permission groups shared by bot and CAD. Hardcoded owner IDs and the owner role remain outside the web wizard. `config/ids.ts` provides initial values; saved database bindings take precedence for the settings they explicitly override. Reviewers still require management for acceptance; reviewer access alone permits other review actions.

## Discord Developer Portal

Create your application and bot at the official Discord Developer Portal. Enable **Server Members Intent**. Enable **Message Content Intent** only because private ticket transcript capture is implemented; remove it if you disable that feature. The bot also requests guild audit/moderation events, guild messages, and direct-message interaction support.

Configure the exact Discord OAuth redirect **`http://localhost:3000/auth/callback`** for local use, or the corresponding HTTPS URL after deployment. OAuth uses `identify`, authorization state, PKCE, an HTTP-only session cookie, CSRF tokens, and fresh guild membership/role checks. Tokens are not put in the browser bundle. Optional **verified Roblox OAuth linking** is available in Civilian Portal: set `ROBLOX_OAUTH_CLIENT_ID` and `ROBLOX_OAUTH_CLIENT_SECRET`, register the exact redirect `http://localhost:3000/api/roblox/callback` (your HTTPS origin in production), and enable `openid profile` scopes in your Roblox OAuth application. Challenges expire after ten minutes, are bound to the current Discord session and consumed once; Roblox tokens are not persisted. Management-verified evidence linking remains available. Never collect Roblox passwords.

Invite with scopes **`bot`** and **`applications.commands`** using Discord's OAuth2 URL generator. Choose least-privilege permissions: View Channels, Send Messages, Attach Files, Read Message History, Manage Channels (tickets/lockdown), Manage Roles (verification/ranks), Moderate Members, Kick Members, Ban Members, and View Audit Log. Do not grant Administrator by default. Place the bot's role above roles it must manage. The documented official bot installation and OAuth references are linked in [docs/SOURCES.md](docs/SOURCES.md).

## First panels and workflows

```text
/setup validate
/panel deploy name:community_rules
/panel deploy name:server_rules
/panel deploy name:support
/panel deploy name:applications
/panel deploy name:cad
/applications open
Start staff applications from the button in channel 1557893259840458792.
/ssu
/ssd reason:Scheduled session conclusion
```

`/panel deploy` updates a previously deployed panel with the same key/channel, rather than creating a duplicate. `/panel read` opens an ephemeral authorized view. Restricted staff/case templates cannot be published through the public editor. Rule acknowledgments store template versions; verification requires acknowledgment of both current rule sets.

Applications ask one question per DM step. Buttons support begin, answer/edit, continue, previous, pause, resume, cancel, answer review, and explicit submission. Draft progress, decisions, review ownership, internal notes and delivery failures persist. Review cards expose full answers through private pagination. A database version check prevents two contradictory decisions. Decisions remain saved if the applicant blocks DMs. A blocked-DM applicant can use the authenticated web application page.

Tickets support category-specific intake, private creation, claim, add/remove participant, escalation, priority, reason-required close/resolve, reopen, and private retained text transcripts. Claims and updates are serialized in the single bot process. Staff complaints exclude the accused user. Discord administrators bypass channel overwrites: a complaint against an Administrator is rejected with instructions to contact an owner privately. Transcripts capture up to 5,000 accessible messages and retain content for the configured period. V2 system cards are represented by a system-panel marker; the ticket request/closure text is included explicitly. File contents are not downloaded.

Staff commands implement configured rank-role replacement, rollback on role-transition failure, owner/equal-rank protection, confidential rank logs, public notices without private reasons, DM notifications, staff infractions, points/expiry policy, revocation history, training/supervisor updates, private notes and activity. Points never automatically suspend or remove a person.

## CAD and MDT

Working pages include dashboard, calltaking/dispatch, duty and unit emergencies, civilian characters, vehicle registration/stolen flags/transfers, verified Roblox linking, person/plate/case search, structured traffic stops, fictional penal codes, dedicated investigations/warrants/BOLOs, agency reports, private evidence files, Fire/EMS response and multi-patient transport, station/apparatus rosters, DOT towing and impound/release, private notifications, optional court hearings/verdicts/appeals, agency text radio, staff activity, applications, sessions, audit view and administration. Preferences saves account theme, dashboard section order/visibility and muted notification kinds; emergency, security and assignment alerts cannot be muted.

Dispatch supports assignment/release, duplicate-incident merging, and agency transfer with persisted notifications. Merges retain original narratives and audit history while moving assignments and report/traffic-stop links. Transfers release previous units and notify the receiving agency. Self-dispatch is disabled by default; enable `settings.selfDispatchEnabled` only if wanted. It requires a fresh matching duty unit and no fresh on-duty dispatcher. The browser sends a duty heartbeat each minute; `unitFreshnessMinutes` controls the presence window.

**Traffic Stops** has officer/callsign, fictional driver/passenger references, backup/tow requests and reasoned disposition. Management creates community-defined fictional offenses in **Penal Codes**. Closing a citation/arrest snapshots each code's title, fine and count into the linked report; later catalog changes cannot rewrite those amounts. Arrests require a linked fictional driver and do not create convictions. Warnings/no-action stops cannot contain charges. Reports retain version and audit history.

**Evidence files** is available from a report. PNG/JPEG/PDF/UTF-8 TXT uploads are limited to 8 MiB, checked for filename/type/signature, encrypted on disk with AES-256-GCM, and fingerprinted with SHA-256. Downloads recheck agency/sealed-record access and integrity and write custody events. Originals cannot be overwritten through the API. Uploaded bytes stay outside public assets. Malware scanning, bulk evidence export and physical-custody transfer workflows are not implemented.

**Fire / EMS** has distinct response stages, fire command/staging/apparatus fields, minimal fictional patient aliases, and configured fictional-hospital transport. **DOT / Towing** supports claim, en-route/on-scene, impound inventory, and reason-required release. Owners of linked fictional vehicles can request release review from the Civilian Portal; DOT still authorizes release. Closed agency cases produce linked reports. These are roleplay workflows, not clinical guidance or commands that physically move in-game vehicles.

Version checks reject stale edits. Structured warrant approval requires another supervisor/manager; court decisions require a different DOJ member from the submitter. Warrants/BOLOs have expiry and linked fictional subjects/vehicles/reports. The court module remains disabled by default (`featureFlags.courts`). WebSocket messages invalidate authorized views; clients reload through the RBAC API rather than receiving private data in broadcasts. CSV report export is implemented at `/api/export?agency=police` for authorized supervisors. Branded PDF and bounded bulk ZIP exports, physical evidence handoffs, mutual aid, dashboard drag/resize and specialist court roles are implemented. Advanced clinical features and some bot catalog commands remain outside this CAD feature pass. See docs/CAD_GUIDE.md for operations and validation limits.

**Live Map** now uses the official ER:LC fall/snow images, including postal variants. It supports pan/zoom, saved layer filters, manually placed incident/unit/station/postal/roadblock pins, patrol polygons, search and stale-snapshot indicators. Three measured anchor points calibrate real API X/Z positions; no guessed scale is installed. Legacy planning-grid positions are not assumed geographic. See [docs/MAP_SETUP.md](docs/MAP_SETUP.md) for exact controls and calibration. Use `npm run map:fetch` to refresh the official images. No smooth movement, route calculation or unsupported vehicle locations are fabricated.

## Permission matrix

| Group | Default authority |
|---|---|
| Configured owners | All functions; emergency mode/command lockdown controls; cannot be punished by bot |
| Community management | Staff/private records, application acceptance, configuration, agency oversight |
| Moderation/staff | Configured moderation and staff tools; actual Discord moderation permissions and hierarchy also required |
| Application reviewer | Submitted applications, claim, deny/interview/more-info/notes; acceptance requires management |
| Ticket support | Unrestricted support categories and assigned tickets; not staff complaints/ban appeals |
| Security | Security incidents and audit access; containment changes remain owner-only |
| Session host | SSU, own session shutdown confirmation, votes, scheduling/extension |
| Dispatcher | Dispatch, units, authorized operational agencies; no staff-rank or Discord-ban powers |
| Police/sheriff/fire/EMS/DOT | Their agency records and operational tools |
| Supervisor | Agency report review; management/owner retain oversight |
| DOJ | Court records only when `featureFlags.courts` is enabled |
| Civilian/member | Own fictional characters/vehicles, own applications/tickets, roleplay calls, public panels |

Security modes are monitor, alert/review (default), and explicitly owner-opted-in containment. Containment can remove manageable dangerous roles from a high-confidence audit-event executor; never owner/trusted accounts, protected roles, or roles above the bot. It does not mass-ban members. Protected-resource monitoring cannot undo an already-deleted Discord resource. `/security lockdown` restricts dangerous commands and attempts @everyone send-message restrictions on text channels; role-specific allows and Administrator bypass those restrictions. Unlock restores captured @everyone permissions.

## Branding

| Local file | Used for |
|---|---|
| `la-logo.png` | Every default panel thumbnail, CAD sidebar/favicon |
| `sessions-banner.png` | SSU/SSD/votes/session reminders and web sessions |
| `applications-banner.png` | Applications/DM steps/review and web recruitment |
| `blank-blue-banner.png` | Clearly titled CAD/rules/tickets/staff/security/support panels |
| `server-header.png` | Welcome/server-information panels; supplied shallow aspect ratio preserved |

The originals are intact. Some artwork visibly says “Los Angeles Roleplay”; text headings always use the full official name. No corrected raster variants or unrelated stock images were invented. See [docs/WHITE_ICONS.md](docs/WHITE_ICONS.md).

## Deployment and backups

Run **one** always-on Node process and PostgreSQL, behind an HTTPS reverse proxy to `127.0.0.1:3000`. Update `WEB_BASE_URL` and the Discord redirect URL together. Static hosting alone cannot run the bot/API/database. The bot's compatibility document store is single-process; do not run multiple replicas against the same guild state. Dedicated relational application/session/CAD tables enforce uniqueness and version checks.

Use a restricted production DB user and managed encrypted disk/backups. `npm run backup` invokes PostgreSQL `pg_dump`, copies encrypted evidence files to an adjacent directory, and writes a manifest. Restore the database with `pg_restore` and the encrypted files into `data/evidence`; preserve the original `FILE_STORAGE_SECRET` separately in secure storage. Changing or losing that key makes existing encrypted evidence unreadable. The backup command deliberately does not copy the secret key. Test restores into a separate database first. Do not publish `data/`, `backups/`, `.env`, or database dumps. There is no Redis dependency or queue deployment in this version. Background work requires the shared process to remain running. See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md).

## Updated Discord configuration

See [channel routing, command restrictions, OAuth fix, and Windows launch instructions](docs/DISCORD_CONFIGURATION.md). Double-click START_LASRP.cmd to run the bot and CAD; use STOP_LASRP.cmd to stop safely.

Staff ranks, automatic team badges, and warning/strike workflows: [Staff workflow guide](docs/STAFF_WORKFLOWS.md).

## Startup repair

The current embedded database was recovered into durable local PostgreSQL; verified 28 tables / 33 recovered rows, connected bot/database health, clean stop/restart, and safe duplicate-start handling. See [startup recovery instructions](docs/STARTUP_RECOVERY.md). The original files and recovery exports remain preserved.
