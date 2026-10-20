# Always-on deployment

Use a Windows/Linux machine with Docker Compose and an HTTPS reverse proxy. A static website host cannot run the Discord gateway, WebSockets and database.

The complete system needs an always-on host: one process maintains the Discord gateway and serves the CAD/API/WebSockets, while PostgreSQL and encrypted evidence storage persist data. Your PC can run local testing, but members cannot reach `localhost` on your computer. For public use, deploy on an always-on server, assign a domain or hosted HTTPS address, and point it at that deployment. Stopping or sleeping the host takes the bot and CAD offline.

Local `DATABASE_MODE=local` is for development and is isolated from the credential-free demo. For hosting use `DATABASE_MODE=postgres`; the production Compose file enforces this and supplies PostgreSQL. Moving to a hosted database does not automatically transfer the local database's records.

1. Configure `config/ids.ts` and `.env` as described in README. Add a strong `POSTGRES_PASSWORD`; use URL-safe random characters because Compose constructs the database URL. Set `WEB_BASE_URL` to your public HTTPS origin, without a trailing slash. Set `BOT_ENABLED=true`, `DEMO_MODE=false`.
2. Register the exact Discord callback `https://YOUR-HOST/auth/callback`. For optional Roblox verification register `https://YOUR-HOST/api/roblox/callback` in your Roblox OAuth app with `openid profile` scopes; set `ROBLOX_OAUTH_CLIENT_ID` and `ROBLOX_OAUTH_CLIENT_SECRET` in `.env`.
3. Run `docker compose -f docker-compose.production.yml up --build -d`. The migration service waits for PostgreSQL and applies migrations before the app starts. This container recipe has not been executed in this environment; validate it on the deployment machine.
4. Forward your HTTPS reverse proxy to `127.0.0.1:3000`, supporting WebSocket upgrades on `/live`. Keep PostgreSQL private. Do not cache `/api` or authentication responses. TLS terminates at the proxy; the configured HTTPS origin makes session cookies Secure.
5. Run `/setup validate`, then `/security automod` if native AutoMod is desired, and deploy your panels. The bot needs Manage Server for AutoMod.
6. Test Discord login, role restrictions, a DM application, a private ticket, ER:LC API status, and a CAD incident with a second account before launch.

Back up the PostgreSQL volume, encrypted evidence volume and `.env` encryption keys separately. A database-only backup cannot recover evidence. Do not replace `FILE_STORAGE_SECRET` after uploading evidence. Check container logs with `docker compose -f docker-compose.production.yml logs --tail=100 app`; do not publish logs containing environment values.

For a local Windows run, use the README commands without Docker deployment. The default bind address remains loopback; `HOST=0.0.0.0` is intended for container networking behind the reverse proxy.

The production Compose file now includes official `clamav/clamav:stable` and configures required evidence scanning. Keep its daemon port internal. Allow signature initialization before testing uploads; scanner failures reject uploads before storage. The local development scanner remains off unless configured. See [ClamAV Docker documentation](https://docs.clamav.net/manual/Installing/Docker.html) for RAM/signature requirements, and `CAD_GUIDE.md` for export and custody behavior. The container recipe and live scanner still require verification on the deployment machine.
