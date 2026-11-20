# New York City Roleplay session system

The existing bot now uses `apps/bot/src/session-hub/`. It does not create a new Discord application. Its main session channel is `1529553843199807590`; action logs go to `1573179359957876826`.

## Starting in VS Code on Windows

Open the existing project folder and choose **Terminal → New Terminal**. Run:

```powershell
cd "C:\Users\erlcl\Downloads\Los Angeles Bot"
npm start
```

This uses the existing launcher, starts the configured portable PostgreSQL database, applies outstanding migrations without resetting data, starts Express/CAD and connects the Discord bot. It synchronizes guild commands unless `DISCORD_SYNC_ON_START=false`. If it reports that the bot is already running, use `npm run stop` followed by `npm start` to restart safely. Keep the terminal/computer running for local hosting. Starting from VS Code does not provide continuous cloud hosting.

For a fresh checkout: install Node.js 22.12 or newer, run `npm ci`, configure the existing `.env`, then run `npm run db:generate`. External PostgreSQL hosts also require `npm run db:migrate` before starting. The Windows portable runtime is local private data, not a GitHub download; see `STARTUP_RECOVERY.md` when moving computers. Never delete an existing database to fix startup.

## Commands and permissions

| Command | Behavior |
| --- | --- |
| `/session vote [votes]` | Opens one vote; default two votes |
| `/session start` | Starts the session; closes its vote |
| `/session low` | Low activity announcement; five-minute cooldown |
| `/session shutdown [reason]` | Actor-bound confirmation, valid two minutes |
| `/session cancel-vote` | Cancels the current vote |
| `/session status` | Private current status; available to members |
| `/session panel` | Repairs/updates the tracked permanent panel |
| `/ssu` | Compatibility alias for start |
| `/ssd [reason]` | Compatibility alias for shutdown |
| `/session boost` | Compatibility alias for low activity |

Every management action requires role **1529541555726057615**, freshly fetched from the main guild. Discord Administrator, moderator and website administrator permissions do not independently grant session management. Regular members can view status/voters, vote/unvote, join and toggle notifications. No verified role is required. Staff cancel votes through `/session cancel-vote`; the public vote has only Vote and View Voters buttons. Old session buttons are retired with a clear private response.

Notifications toggles role **1529610820588146700**. The bot needs Manage Roles, must rank above this role, and rejects managed or dangerous notification roles. It does not change role permissions. The bot needs View Channel, Send Messages, Read Message History and Attach Files in the three configured channel entries. For non-mentionable ping roles it also needs Mention Everyone. Vote/start/low announcements mention the subscriber role once; vote counter edits retain the visible mention without sending another ping. Vote clicks receive a short private text confirmation, not another branded panel; threshold notices mention the vote host and configured session staff. Merely reaching two votes never starts a session.

## Configuration and artwork

Edit **`config/sessions.js`** for the confirmed IDs, vote threshold, low cooldown, ping policy and image paths. Automatic session start is never performed. Automatic low alerts default to `false` with no threshold. To explicitly enable optional low alerts, set `enableAutomaticLowAlerts: true` and a nonnegative integer `lowPlayerThreshold`; only a real fresh observation during an active session can trigger them, and the same cooldown applies. Low activity never ends a session.

Optional public display values belong in backend `.env`:

```dotenv
ERLC_SERVER_NAME=New York City Roleplay
ERLC_SERVER_OWNER=Dm0ney_4u
ERLC_JOIN_CODE=
ERLC_JOIN_URL=
```

Existing `PUBLIC_ERLC_JOIN_CODE` and `PUBLIC_ERLC_JOIN_URL` remain supported. Join URLs must be HTTPS `erlc.gg/join/CODE` destinations; a configured code produces that destination automatically. Without a valid URL, Quick Join privately displays the configured code and private-server instructions. The configured public defaults are New York City Roleplay and Dm0ney_4u; environment values can override them. A missing join code is clearly marked **Not configured**. The API server key remains only in the existing private backend `ERLC_SERVER_API_KEY`; never paste it into a public display field.

The supplied Sessions banner is copied unchanged to `assets/sessions/main-banner.png`. The supplied matching footer is `divider.png`, and the existing supplied NYC emblem is `logo.png`. Optional `vote-banner.png`, `started-banner.png`, `low-banner.png`, and `shutdown-banner.png` override the main banner. Missing stage banners use the supplied main image. Configured HTTPS image URLs are also supported. Replace artwork and restart to refresh it. Routine panel/button edits reuse Discord media references to avoid uploading artwork every minute.

All session panels/announcements use Components V2, cream `#D8C5A4`, the supplied header/footer and white logo. No ordinary emoji icons are introduced.

## Persistence, recovery and integration

Migration `202611190001_session_hub` adds `SessionHub` and `SessionHubEvent`, without replacing existing tables. PostgreSQL row locks serialize state transitions; the existing unique `Session.activeKey` also prevents duplicate active sessions. Host/start/end/ended-by/final observations, vote memberships, configuration, message IDs, last low timestamp, confirmations and history survive restarts. Existing `Session`/attendance records remain in use, and the compatibility guild session records remain available to CAD integrations. A previously active session and usable pending legacy vote are imported on first initialization.

States: Offline, Voting, Online, Low Activity, Shutting Down. Shutdown saves the end record, queues its announcement/log, then becomes Offline when delivery is confirmed. If Discord delivery fails, pending events retry on maintenance/restart; state is preserved. Check `/session status` before repeating an action after a delivery error. Stable event markers, Discord nonces and saved receipts recover sends whose receipt was interrupted. Deleted permanent panels and active votes are repaired; completed voting controls are disabled and backend validation always rejects stale controls.

This is a **single active bot runtime** architecture using the existing startup lock. Do not run independent bot replicas against the same database/token. Exactly-once delivery cannot be guaranteed if another administrator deletes both an unreceipted Discord message and its recovery evidence during a crash. Database state changes remain transactional.

The existing ER adapter supplies counts and keeps its shared cache, request coalescing, timeout and rate-limit/backoff handling. Session maintenance refreshes once per minute. Player count/capacity/queue/staff are shown only when genuinely available; staff requires a complete permission-bearing player list. Failures and stale data show **Unavailable**, never invented zeroes. Session state is staff-controlled and independent of live population. With no active session (including voting), the bot presence is Idle with **💤Sleeping**. Online and Low Activity sessions switch it to Online with the actual player count/capacity, refreshed every minute. Failed or stale telemetry shows **In-game player count unavailable**. Presence is also updated immediately on lifecycle actions, with unchanged broadcasts skipped.

The shared ER response validator now accepts an omitted emergency-call caller. Incomplete calls are excluded from CAD incident import rather than inventing an identity or rejecting all live telemetry. Existing complete call handling is unchanged. No remote game command is issued by session start/low/shutdown.

Logs record lifecycle actions, threshold notifications, repairs and errors, including actor, session, time and state changes. Routine statistics refreshes do not create log messages. Full lifecycle delivery requires the configured session log channel to remain accessible.

## Files and verification

New session modules: `config/sessions.js`, `apps/bot/src/session-hub/{model,repository,views,commands,presence,index}.js`, the session migration/models, supplied `assets/sessions/`, `scripts/session-check.ts`, and `tests/session-hub.test.ts`.

Integration edits: `apps/bot/src/main.ts` routes new session interactions before generic acknowledgment and registers the new command set; `service.js` holds its coordinator; `community.ts` delegates its existing live-panel entry point; `apps/api/src/jobs.ts` stops legacy session rendering/recovery/vote timers from competing while preserving attendance and unrelated jobs; `apps/api/src/main.ts` gracefully drains it on shutdown. `erlc.ts` contains the optional-caller compatibility fix. `.env.example` and `package.json` document public display settings and diagnostics.

The old `apps/bot/src/sessions.ts` exports remain for compatibility and legacy regression tests but are not registered or invoked by the live bot. Assistance, moderation, department and dispatch handlers remain in place.

Run `npm run session:check` to validate the actual configured Discord channels/roles/artwork and private ER connection without posting a session announcement. Run `npm run check`, `npm run build` and `npm test` for validation. The session suite uses real PostgreSQL migrations and transactions via PGlite, mocked Discord HTTP delivery, send-before-receipt recovery, role checks, confirmations, concurrency, persistent voting, deleted messages, unavailable telemetry and notification role safety. Automated tests do not start a real community session or send test subscriber pings.
