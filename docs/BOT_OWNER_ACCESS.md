# Bot owner access

`1425577335637413961` is a Discord **user ID**, verified as a current member of the main NYC guild. No guild role has that ID. It is already in the explicit `owners` list in `config/ids.ts`.

The exact configured owner accounts receive bot authorization without needing session staff, moderation, support, global-ban executor, or Discord Administrator roles. `apps/bot/src/owner-access.js` centralizes this check. Existing owner-aware staff/application/security authorization remains in use, and livery management already authorizes this exact account.

The remaining separate checks now honor the owner list: current session commands, legacy member-access checks, moderation role and actor-hierarchy checks, global bans, ticket administration, CAD panel deployment and the acting user's Manage Channels check for lockdown. Owner identity comes from the authenticated Discord actor, never a supplied target user, display name or role mention. Other members retain their existing role requirements.

This changes bot authorization. It does not grant the Discord bot permissions it lacks, bypass Discord's role hierarchy for bot actions, remove required reasons/confirmations, ignore missing records, or change website authentication and CAD admission. Global bans and session management retain their main-guild scope. Protected-account and workflow integrity checks remain enforced.

Only `/session` is registered for sessions, with `vote`, `start`, `low`, `shutdown`, `cancel-vote`, `status`, and `panel`. `/ssu`, `/ssd`, and `/session boost` are removed. Cached legacy invocations cannot perform their old action.

Validation: TypeScript check and **185 automated tests passed**, including exact owner identity, no-role/no-Administrator ticket access, session authorization, global-ban authorization, ordinary member denial, wrong-guild denial and the new command registry.
