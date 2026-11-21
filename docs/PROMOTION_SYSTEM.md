# NYCRP promotion system

Use **`/promote user: rank: reason:`** in the main NYC guild. Rank is a required autocomplete string restricted to the 23 configured individual ranks. Team badges, separators, High Rank, Senior High Rank, Rank Lock and unrelated roles cannot be selected as ranks. A reason of 3–1000 characters is required and appears in the public promotion announcement.

The old `/staff promote` is no longer registered and cached invocations are rejected. Other `/staff` commands, including demotion, notes, training and staff history; discipline now uses /infract, remain available. The existing demotion command now recognizes the same individual rank list and destination bundles, so newly promoted Lead/IA ranks remain demotable without removing unrelated roles. Existing staff and promotion records were preserved.

## Direct execution and permissions

The command applies the promotion directly after permission and safety checks. There is no confirmation or cancel prompt. The actor, destination, current roles, lock status, restrictions and hierarchy are validated before any mutation. Internally, the existing durable operation reservation/claim still prevents concurrent promotions and preserves recovery; it is not a user confirmation step. Legacy confirmation buttons cannot execute a promotion.

| Destination | Any one of these acting-member roles |
| --- | --- |
| Trainee / Moderation / Administration | `1529545769462272140`, `1529545703024627754` |
| Internal Affairs | `1567679203275575467`, `1529545703024627754` |
| Management | `1529545703024627754` |
| Senior High Rank / Directive | `1529541363547504781` |

The existing explicitly configured bot-owner authorization remains supported, including user `1425577335637413961`. It bypasses acting-member permission-role requirements, but the actor must have one recognized individual rank and must outrank both the target and destination. It cannot promote itself, bots, protected owners or targets beyond the bot's manageable hierarchy. An owner rank-lock bypass is explicitly recorded as **Configured owner**.

Other actors require Rank Lock Override `1569461995869184010` when the target has Rank Lock `1529546002116116580`. This override bypasses only the lock and does not satisfy destination permissions or hierarchy. Roles granting dangerous permissions the actor lacks are rejected. Active suspensions, investigations, terminations and pending/uncertain staff role operations must be resolved first. The existing owner emergency command lockdown also blocks non-owner promotions.

The bot needs Manage Roles and must rank above the target and every required role. Announcement/log channels require View Channel, Send Messages, Read Message History and Attach Files. The configured log channel must remain private. Missing artwork, invalid members, missing roles and managed/inaccessible roles fail before mutation.

## Configuration and role bundles

All promotion role IDs, destination permissions, channels, icon, confirmation duration and branding are centralized in **`config/promotions.js`**. The file is operator-managed source configuration; there is no member-facing configuration editor or arbitrary role-binding input. The existing configured owners remain in `config/ids.ts`.

Individual ranks are ordered lowest to highest in `promotionConfig.groups`. Rank skipping is allowed when the actor can authorize and manage the destination. Equal/lower ranks are rejected as promotions.

Every bundle includes Staff Team and Staff Roles Separator. Trainee adds its individual rank and trainee separator. Moderation/Administration add only their own team badge and separator. Internal Affairs/Management additionally receive High Rank. Senior High Rank positions receive the Senior High Rank badge/separator and High Rank. Directive positions receive the Directive badge/separator, Senior High Rank and High Rank. No lower-team badges are implicitly retained. Support Team is never automatically granted.

Promotion removes only roles in the explicit managed set: the configured individual ranks, team badges, separators and shared staff badges. Rank Lock, warnings/strikes, department roles, verification, booster, support, Currently Moderating, On-break, LOA and other unrelated roles are excluded. Individual Discord role PUT/DELETE operations are used, never whole-member role replacement. Unrelated changes made by another system during execution remain untouched.

`staffRoleIds` also recognizes the new managed roles so existing suspension/investigation/termination workflows continue recognizing promoted staff and retain their previous restore/history behavior. Existing discipline cases, application handling and sessions were not replaced.

## Announcement, DM and audit

Public announcements go to **`1529565497438372000`**, with the supplied Promotions banner, custom icon `1530309174506950727`, NYC logo, a simple user/new-rank role mention, promoter credit and matching footer. They use Components V2 and cream accent `#D8C5A4`.

The actual destination role is mentioned using its ID. Explicit `allowedMentions` permits only the promoted member's user mention; role, staff, everyone/here and promoter notifications are disabled. The mandatory reason is shown under the new rank in the public announcement and remains included in the DM and audit record.

After fresh Discord verification of the complete destination bundle, the executor receives an ephemeral Components V2 success confirmation with previous/new rank and announcement link. If announcement delivery is temporarily unavailable, success refers to verified role changes and clearly states that announcement delivery is pending.

The member receives a branded congratulations DM containing the actual guild rank's plain-text name, promoter display name and private reason. A blocked DM is recorded without reversing the promotion. Ambiguous delivery after a timeout/restart is recorded as uncertain rather than blindly sending duplicate DMs.

Detailed private logs go to **`1529614627619475608`**, including promotion ID, member, previous/new rank, actor, reason, roles added/removed, date/time, lock override, DM status and announcement link. Role-application failures and uncertain outcomes have private log records. Attempts rejected before a promotion record is created are recorded in the existing `AuditEvent` database without public failure announcements.

## Persistence, rollback and recovery

Additive migration **`202611200001_promotions`** creates `PromotionOperation` in the existing PostgreSQL database. UTC-aware timestamps avoid confirmation-expiry errors when the database uses a different local timezone. Existing tables/migrations are preserved. Promotion records hold the validated role-change snapshot, per-role progress, pending step, result, delivery receipts and history. Successful changes also write compatible `RANK-...` staff records and preserve existing profile fields.

A unique active member key, transactional operation claim and shared staff-operation lock prevent simultaneous promotions or conflicting discipline changes. Discord mutation intent is saved before each individual role request. Final roles are freshly fetched and verified before success.

On partial failure, only touched managed roles are restored and the original managed snapshot is checked again. If an ambiguous final request actually completed the full destination bundle, fresh verification records success. Failed restoration or unexpected external changes to managed staff roles produce an **uncertain** record and retain the member lock for review. The bot does not guess which external rank decision to overwrite.

Recovery runs on startup and once per minute. Interrupted partial changes are safely reconciled/restored; complete destination bundles are verified and finalized. Recovery re-reads a record after acquiring the member lock so an old scan cannot overwrite newer receipts. Missing announcement/log receipts recover messages by their saved promotion ID/media marker and stable Discord nonce. Announcement/log delivery retries do not redo role mutations. Existing records are never reset to resolve a failure.

For an uncertain record, an owner must inspect its saved before/desired roles, completed steps, pending step and current Discord managed roles, then resolve the actual role discrepancy and recorded operation deliberately. There is no automatic permission bypass or destructive “reset all roles” action. This architecture uses the project's existing single bot runtime; do not launch independent replicas with the same token/database.

## Assets and Windows setup

The supplied banner was copied unchanged from `Screenshot 2026-11-20 182415.png` to `assets/promotions/banner.png`. The supplied matching decorative footer is `footer.png`; the supplied white NYC skyline emblem is `logo.png`. Local reference-video frames were inspected for hierarchy/layout; another community's branding was not copied.

Run:

```powershell
npm run promotion:check
npm start
```

The existing Windows portable launcher applies the additive migration automatically. External PostgreSQL hosting requires `npm run db:generate` and `npm run db:migrate` during setup before starting. Secrets stay in the existing backend `.env`; no new bot, tokens or database are required.

Validation covers every rank/bundle and every permission alternative, auxiliary-role rejection, self/bot/owner protection, lock overrides, hierarchy/privilege failures, expired/stale/foreign operation claims, legacy reservation cancellation, concurrency, unrelated role changes, blocked DMs, partial/ambiguous failures, rollback failure, restart recovery and receipt recovery. Live diagnostics verify configured Discord resources without promoting a real member or sending a fake promotion announcement.

Main files: `config/promotions.js`, `apps/bot/src/promotions/{model,repository,views,index}.js`, `staff-locks.js`, the additive Prisma model/migration, supplied assets, `scripts/promotion-check.ts`, `tests/promotions.test.ts`. Integration changes are limited to bot command routing/registration, graceful shutdown, retiring the old promotion subcommand, keeping demotion compatible with the new rank bundles, recognizing the new staff roles, and adapting the former promotion regression test to validate retirement while retaining demotion coverage.

The shared individual-rank chain now applies to every actor, including configured owners and rank-lock overrides. Unknown or conflicting individual ranks block execution. Director is the highest rank; granting Director requires a manual Discord owner action. Persistent staff blacklist records also block promotion even when their Discord marker is absent. See INFRACTION_SYSTEM.md.
