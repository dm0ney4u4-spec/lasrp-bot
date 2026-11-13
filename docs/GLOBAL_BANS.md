# Global ban command

Use `-gb @user required reason` or `-gb 123456789012345678 required reason` in **Main NYC** (`1529507818452029650`). The target must be a Discord user mention or ID, not an ambiguous username. Reasons are required and limited to 1,000 characters.

Only a member who **currently holds role `1569461995869184010` in Main NYC** can execute it. The role is fetched fresh; guild ownership, Administrator, CAD roles and other moderation roles do not bypass this check. The command is rejected in every department server and in DMs. Bot/webhook messages are ignored.

`config/global-bans.js` contains the supplied nonsecret configuration:

| Server | ID |
| --- | --- |
| Main NYC | `1529507818452029650` |
| Sheriff's Office | `1562236350470815745` |
| Fire Department | `1558856160998727780` |
| DOT | `1562240887378022459` |
| NYPD | `1562236602963468298` |

The same existing bot attempts a ban by user ID in **each** server. This also supports banning users who are not currently members, preventing them from joining. No message history is deleted. The full reason is retained in the application log; each Discord audit-log reason includes the moderator's ID and a shortened reason to fit Discord's limit.

Before enforcement, the bot attempts a plain-text DM matching the supplied reference:

> You have been **Globally Banned** from **New York City Roleplay**
>
> Reason: `the supplied reason`

It sends the notification before bans remove shared-server DM eligibility. Backticks/newlines in reasons are neutralized for safe inline-code formatting; mention parsing is disabled. Blocked DMs do not cancel bans. Discord may still prevent DM delivery.

An initial V2 log is posted to channel **`1529567428143485100`** before any bans. It is updated with the target, moderator, reason, per-server outcomes and DM status. If the initial log cannot be sent, enforcement does not start. A server failure does not cancel the others. The command reports partial success explicitly, including missing access, missing Ban Members permission or hierarchy failures. If the final Discord log update fails, the complete outcome remains stored in the existing PostgreSQL-backed guild state and the moderator is informed.

The bot must remain installed in all five servers, have **Ban Members**, and have a role above the target's highest role. Discord prevents banning server owners. A user cannot target themselves or this bot. The command never grants new permissions to itself and never automatically reverses successful bans when another server fails.

Operations are saved under `global-ban:<command-message-id>` in the existing guild records. Duplicate delivery of the same command message does not repeat its DM or bans, and concurrent operations for the same target are blocked. Interrupted operations remain recorded; the bot does not silently resume mass moderation after restart. An authorized staff member can inspect the log and explicitly issue a new command to retry. This is a one-time five-server ban, not an automatic future re-ban or global unban system.

The current gateway already requests Message Content and Guild Members intents. No slash registration or additional bot token is required. Restart using `npm stop`, then `npm start` after installing an update. Use `npm run global-ban:diagnose` for read-only checks of the configured role, log destination and bot ban permissions. This diagnostic never bans or DMs anyone.

Live configuration verification on November 13, 2026 confirmed the role/log and **Ban Members permission in all five servers**. Enforcement, authorization, DMs, partial failures, persistence and duplicate handling are tested using mocked Discord transport; no real user was banned during development.

Validation: `npm run build` passed; `npm test` passed **146 tests**, including nine global-ban tests. No production website deployment or main-branch merge is part of this update.
