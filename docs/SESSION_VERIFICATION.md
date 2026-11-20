# Session replacement verification — November 19, 2026

- `npm run check`: passed.
- `npm run build`: passed (TypeScript and CAD bundle).
- `npm test`: **181 passed, 0 failed**, including session presence/lifecycle coverage and the existing Assistance, applications, moderation, CAD admission, authentication and ER adapter regression tests.
- `npm run db:generate`: passed; existing local PostgreSQL started and applied the additive session migration without a reset.
- `npm run session:check`: actual main guild, announcement/panel/log channels and both configured roles found; bot channel permissions and notification-role hierarchy ready.
- Actual existing bot restarted successfully. Local `/health` reports PostgreSQL and Discord connected.
- Permanent message **1561912909947469904** was reused in **1529553843199807590**, with Components V2 flag 32768 and the supplied session banner/footer. A second restart retained the same panel ID, Offline state, and no pending deliveries.
- Actual shared ER adapter reports **0/50 players, 0 queued** at verification time. The panel displayed these genuine values and 0 online staff from the complete empty player list. Counts change with the live server.
- The previous emergency-call caller validation failure is fixed; incomplete call records do not enter CAD as invented identities.
- Existing public join code and HTTPS Quick Join destination are configured. The public server name is **New York City Roleplay** and owner is **Dm0ney_4u**, set in local backend environment and nonsecret configuration defaults.
- Presence is **Idle / 💤Sleeping** without an active session, and **Online / current players in-game** during Online or Low Activity sessions. Actual counts refresh with the shared telemetry; unavailable observations are explicitly marked unavailable.
- Specific vote/start/low/shutdown images were not supplied; all four use the new main Sessions banner until those optional files are added.
- Automatic starts and automatic low alerts remain disabled. No real session was started, vote opened, subscriber ping sent or notification role toggled during live verification. Those workflows were exercised using real PostgreSQL storage and mocked Discord delivery in automated tests.
- This remains local hosting. No main-branch merge, public website deployment or production-host setting changes were performed.

Panel: https://discord.com/channels/1529507818452029650/1529553843199807590/1561912909947469904

See [SESSION_SYSTEM.md](SESSION_SYSTEM.md) for commands, exact changed-file groups, configuration, Windows startup, recovery behavior and limitations.
