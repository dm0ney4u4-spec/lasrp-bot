# CAD admission, reviews and website administration

## Functional scope

Discord sign-in is identity verification only. Operational CAD access now requires the existing authenticated session **and** an approved PostgreSQL admission record tied to its approved application. Existing Discord agency checks run after admission: acceptance grants no Discord role, department membership, dispatcher power, moderation permission, or website administration.

The website provides `/cad` (application/status), `/cad/review` (authorized review), and `/management` (global administration). Applicants can submit configurable questions, read original answers and audit history, answer a more-information request, and reapply when policy allows. Discord identity is filled by the server, Roblox username is validated, requested department/civilian role is recorded, and agreement to a versioned rules snapshot is mandatory. Passwords are never requested. Submitted original answers remain recorded; follow-up information is appended to history.

Statuses: not_applied, pending, more_info, approved, denied, revoked. Pending/more-information/approved applications cannot be duplicated. A database partial unique index, serializable transactions, and version checks protect submissions and decisions against races. Denial/revocation reapplication is configurable with a cooldown. Revoked reapplication defaults off. Admission is updated atomically with each decision, audit entry, website notification, and Discord outbox record.

## Roles and owner bootstrap

Configure nonsecret IDs in `config/cad-access.ts`:

- `websiteAdminRoleIds`: explicitly trusted Community Management roles with global website administration, review, revocation, settings and audit access. Empty by default.
- `reviewerRoleIds`: CAD application review only. Does not grant website administration, revocation, department roles, or CAD admission.
- `revokerRoleIds`: separately authorized revocation. Allows reading the application/audit context needed to revoke; does not grant approval or global administration.
- `reviewChannelId`: the real private review channel in the existing LASRP guild. Currently empty. No channel ID was invented or reused from staff recruitment.
- `ownerEmergencyBypass`: false by default. If deliberately enabled, only exact owner IDs in existing `config/ids.ts` can bypass admission. Discord owner/management role flags are insufficient. This does not manufacture an approval record.

The existing configured LASRP owner has full website administration automatically. The owner can sign in, submit a CAD request, open the review queue before admission, and explicitly approve their own request with a recorded reason. Other reviewers/administrators cannot decide their own applications. This permits initial setup without an automatic admission bypass or a fabricated approval.

Ordinary members, moderators, staff application reviewers, and department command roles do not automatically receive these new global permissions. Existing staff DM applications/reviews and moderation keep their original permissions and are not gated behind CAD acceptance. The existing local `/admin` editor retains its own token protection unchanged; `/management` does not replace or bypass it.

Department command management remains scoped through verified membership and `config/website.ts` command-role lists. Global website administration is checked with the new explicit policy, rather than inferred from general moderation/CAD management groups. No new personnel-management mutation tools were added in this update.

## Administrator settings

At `/management`, authorized administrators can open/close CAD applications, configure denial/revocation reapplication and cooldown, edit versioned rules, and add/edit/remove application questions. Changes are persisted in `CadAccessSettings` with optimistic concurrency and a global audit event. Application submissions include the settings version; stale rules/questions require refresh. Existing applications preserve their original question/rules snapshots. Security-sensitive role/channel IDs and owner bypass remain explicit server configuration, not browser-editable permissions.

Reviewers use `/cad/review` to filter/paginate applications, view full answers and audit history, approve, deny with a reason, or request more information. Revocation controls appear only for separately authorized actors and an approved application. Every action is checked again on the server using fresh Discord roles and application version/state; navigation visibility is not authorization.

## Backend admission boundary

All operational route registrations in `configureCad` receive the admission guard, including calls, units, records, maps/images, agency workflows, evidence, exports, linked operational modules and registration/lookup routes. The separately registered `/api/telemetry` is also guarded. Missing/unapproved admission returns 403 `CAD_APPROVAL_REQUIRED`; an unavailable admission store returns 503 and fails closed. An unknown/unmatched route does not force staff application routes mounted later into the CAD gate.

Identity/logout, profile preferences, member/department website workspaces, CAD applications/review/admin settings, staff applications, and public pages remain outside the operational CAD gate while retaining their existing authentication and permissions. User notifications remain owner-scoped; unapproved/revoked users can read only CAD application/decision notifications, so old operational notification text cannot leak after revocation. Public sanitized ER telemetry remains registered before authentication. No wildcard private CORS, query-token login, or alternate session store was introduced.

`/live` WebSocket upgrades require the exact configured CAD origin, a valid current database session, fresh guild membership and CAD admission. Connected sockets recheck authorization every five seconds and before refresh broadcasts; revocation/session removal closes them. REST requests recheck admission without an approval cache. The CAD browser checks admission before connecting or displaying its workspace and clears the workspace when admission is lost. Direct URLs and modified frontend flags cannot bypass backend checks. Static CAD HTML/JavaScript remains public, but it exposes no operational records without authorization.

## Discord notifications

The existing bot processes a durable `CadAccessDelivery` outbox once per minute when connected. Review notices use Components V2 and are sent only to a configured guild text channel whose everyone access is private and explicit view grants are limited to trusted review/admin roles, owner members, and the bot's managed role/member. Fix channel permissions if delivery reports `private_channel_required`; the bot does not silently widen permissions or create another channel.

Website notifications are committed with decisions, including more-information requests and revocation. Applicant Discord DMs are best effort with bounded retries/backoff and generic failure codes; blocked DMs never undo approval or hide the website notification. An absent review-channel configuration does not prevent decision DMs. Failed delivery statuses appear in the authorized application detail. Stable message nonces reduce duplicate delivery after transient retries, though an interrupted send can still produce an at-least-once notification. Review messages contain references/status, not all private application answers.

## Database and Windows setup

Additive migration: `prisma/migrations/202610230001_cad_admission/migration.sql`. It adds five CAD admission/application/audit/settings/outbox tables and indexes without replacing or deleting existing records. No existing member was automatically approved.

1. Back up the existing database and encrypted evidence. The Windows backup utility now passes PostgreSQL host/port/user/database correctly without putting passwords in command arguments. Private backup artifacts remain ignored by Git.
2. Stop the backend before `npm run db:generate` on Windows if Prisma's engine DLL is locked.
3. Run `npm run db:generate`. For an existing managed PostgreSQL deployment, apply the approved migration using `npm run db:migrate`. The current portable/local launcher applies additive migrations on `npm start` through its existing migration tracker; do not reset the database or mix migration histories.
4. Run `npm start` and `npm run site:dev` in separate terminals. Open http://localhost:5173/cad after Discord login. The owner review/admin pages are http://localhost:5173/cad/review and http://localhost:5173/management.

Existing Discord login setup still applies: register `http://localhost:3000/auth/callback` in the existing Discord application's OAuth2 redirects and preserve root `WEB_BASE_URL=http://localhost:3000`, `WEBSITE_BASE_URL=http://localhost:5173`. The application previously reported an empty redirect list; real member consent still requires that external registration. Keep all tokens, the ER key and session secrets in the root backend environment only.

## Verification and remaining setup

Real PostgreSQL tests cover shared authenticated sessions/CSRF, unauthenticated and unapproved direct requests, duplicate/racing applications, pending/more-information/approval/denial/revocation transitions, reviewer/admin/moderator/department separation, immutable original answers/audit, settings conflicts and cooldown, admission-store fail-closed behavior, private review delivery, blocked-DM retry, and closing an already-open WebSocket after revocation. Existing CAD regression fixtures now explicitly obtain test-only approval records; there is no production/test-mode admission bypass. UI tests cover applicant/reviewer/status/denial screens on desktop, tablet and mobile. Existing bot/staff application/CAD tests and sanitized live ER checks remain part of verification.

Remaining configuration: register the existing OAuth callback; supply verified reviewer/admin/revoker role IDs as needed; set a real private CAD review channel; supply existing department membership/rank/command role IDs for agency access. Only the configured owner has global review/admin powers until additional roles are explicitly supplied. Department command management tools beyond the existing preparation screens remain future work. Public hosting and production routing still need a separate approved deployment. This update does not deploy publicly or merge into main.

Final validation: bot/CAD and website builds passed; public bundle secret audit passed; 114 backend tests and 57 responsive browser tests passed. The exact staged snapshot separately passed its isolated build and all 96 backend tests included in that commit (additional local bot/livery regressions account for the broader 114-test run). Final focused authentication/admission/public-status checks also passed. Desktop administration and mobile applicant layouts were visually inspected. The existing PostgreSQL migration preserved the before/after counts of users, staff applications, incidents, CAD records and transcripts. Real local health reported Discord and PostgreSQL connected; the unchanged public ER endpoint returned live 0/50 players, queue 0 and a configured join link. Anonymous CAD/application/admin requests returned 401. No real user was automatically admitted or test application inserted into the existing database.
