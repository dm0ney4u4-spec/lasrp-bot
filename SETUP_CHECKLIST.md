# Owner setup checklist

- [ ] Install Node 22.12+, npm, PostgreSQL 16 or Docker Desktop.
- [ ] Run `npm ci`, `npm run setup:env`, `npm run db:generate`, `npm run build`, `npm test`.
- [ ] Paste guild/client/owner IDs in `config/ids.ts`.
- [ ] Map management, staff ranks, application reviewer, ticket support, host and agency roles.
- [ ] Configure private application review and logs, moderation logs, staff logs, infractions and security alerts. Deny View Channel to @everyone and unrelated roles.
- [ ] Configure session, dispatch, promotions, ticket category and initial panel channels.
- [ ] Set real credentials in `.env`; keep `DEMO_MODE=false` for production.
- [ ] Configure matching Discord OAuth callback and `WEB_BASE_URL`.
- [ ] Start PostgreSQL and run `npm run db:migrate`.
- [ ] Enable required intents; invite bot with least privilege and correct hierarchy.
- [ ] Run `npm run register`, `npm start`, `/setup validate`.
- [ ] Deploy rules/support/applications/CAD panels. Acknowledge both current rule sets and test verification.
- [ ] Configure recruitment questions/eligibility; then `/applications open`.
- [ ] With a test applicant, complete DM answers, pause/restart/resume, submit, claim/review, accept/deny and verify DMs or logged failure.
- [ ] With test accounts, verify ticket complaint exclusion, claim/access changes, reason-required close, private transcript and reopen.
- [ ] Test staff rank change using low-permission test ranks, private reason logging and DM notification.
- [ ] Test infraction privacy, self/owner protection and revocation history.
- [ ] Test `/ssu`, overlapping start rejection, live panel update, `/ssd` confirmation and next-session start.
- [ ] Test civilian/agency accounts cannot access other users' characters or unauthorized medical/staff data by direct URL.
- [ ] Configure fictional penal codes; test traffic-stop citation/arrest reports and preserved fine snapshots.
- [ ] Review `selfDispatchEnabled` and duty freshness policy; test dispatcher-presence restrictions.
- [ ] Test incident merge/transfer, released assignments and private notifications.
- [ ] Generate and securely back up `FILE_STORAGE_SECRET`; test evidence upload, authorized download, sealed access and custody logs.
- [ ] Test Fire/EMS response stages and configured fictional hospitals; enter no real patient information.
- [ ] Test DOT impound inventory and civilian release request followed by DOT authorization.
- [ ] Enable the ER:LC API Pack and paste its key only in `.env`; verify real telemetry and rate-limit handling.
- [ ] Keep automatic containment disabled until owners have reviewed thresholds/trusted/protected IDs and tested monitor mode.
- [ ] Configure HTTPS, database backups, one application instance and restart/service management.
- [ ] Perform desktop/mobile browser QA and live Discord visual/API checks. These require your configured environment and were not performed by the local test suite.
# New workflow setup

- Apply migrations through `0007_resources_patients` with `npm run db:migrate`, then run `npm run db:generate` and `npm run build`. Stop the Windows demo before generating Prisma clients. `npm run demo` automatically applies missing demo migrations.
- Configure `automod` in `config/ids.ts`; `/security automod` synchronizes native mention/domain protection. The bot needs Manage Server. Empty blocked domains means no custom link filter is installed.
- Configure Roblox OAuth credentials in `.env`, `openid profile` scopes and the exact `/api/roblox/callback` redirect. Verify from Civilian Portal after Discord login.
- Enable optional courts with `featureFlags.courts`; assign DOJ roles. Cases need eligible submitted/approved reports and a different person to record the decision.
- Fire/EMS supervisors manage station/apparatus rosters. EMS cases expose fictional patient intake/transport; unfinished transports prevent closure.
- Use Preferences for account theme, ordered dashboard sections and muted notification kinds. Mandatory emergency/assignment alerts remain active.
- Session RSVPs and scorecards are on Sessions. Staff suspension/reinstatement is available through `/staff suspend` and `/staff reinstate`.
- For public HTTPS hosting, see `docs/PRODUCTION_DEPLOYMENT.md`. The container recipe still needs validation on the deployment host.

- Open Live Map and follow `docs/MAP_SETUP.md`: official map imagery is installed; three measured world/image anchor points are required to align live player locations. Configure the real API key and validate against a fourth location. Manual map features work without calibration.
- For this PC, `DATABASE_MODE=local` and `npm start` run the real bot with a separate persistent local database; `npm run doctor` diagnoses configuration. For hosting use `DATABASE_MODE=postgres` and the production deployment instructions. Local data is not automatically migrated into hosted PostgreSQL.
- Low-population alerts use `sessionAlerts` in `config/ids.ts`; they require healthy, continuous API observations during an active session.
- For specialized court permissions, configure `judge`, `prosecutor`, `defense`, and `clerk` role IDs and enable `courtsPolicy.specialistRolesEnabled`. These role groups inherit DOJ access. Courts remain separately disabled until `featureFlags.courts=true`.
- Civilian Portal includes fictional properties/businesses/permits; management reviews submissions in Admin. Investigations includes assigned task boards.
