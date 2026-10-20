# Implementation references

Checked while implementing on 2026-10-18:

- Discord Components V2 reference: https://docs.discord.com/developers/components/reference
- discord.js display components and limits: https://discordjs.guide/legacy/popular-topics/display-components
- Installed discord.js 14.27.0 package and generated builder typings are the implementation contract.
- Discord OAuth2: https://docs.discord.com/developers/topics/oauth2
- Discord bot installation: https://docs.discord.com/developers/quick-start/getting-started
- ER:LC current API documentation: https://apidocs.erlc.gg/
- ER:LC v2 status/query fields: https://apidocs.erlc.gg/api-reference/fetch-server-information
- ER:LC remote command route: https://apidocs.erlc.gg/api-reference/run-a-command-in-game-as-virtual-server-management
- ER:LC rate limits and Retry-After: https://apidocs.erlc.gg/rate-limits
- ER:LC location coordinate semantics: https://apidocs.erlc.gg/how-do-i-interpret-the-xyz

The adapter uses `https://api.erlc.gg/v2/server` with documented query options, and the documented `/v2/server/command` endpoint for an allowlisted `:m` announcement only. It does not expose arbitrary commands or advertise unimplemented kick/ban/unban operations. HTTP 429 pauses calls; invalid key/request responses disable the adapter until configuration review and restart. POST commands are never blindly retried after timeouts.
# Additional verified references

- Roblox OAuth reference: https://create.roblox.com/docs/cloud/auth/oauth2-reference — authorization code exchange, S256 PKCE and the authenticated userinfo endpoint. The integration tests mock this transport; real credentials are still required for live verification.
- Discord API types: https://discordjs.dev/docs/packages/discord-api-types/main/APIAutoModerationRuleTriggerMetadata:Interface — native keyword and mention-spam rule metadata. Guild rule provisioning still needs live verification.

- ClamAV INSTREAM framing: https://docs.clamav.net/manual/Usage/ClamdProtocol.html
- Official ClamAV containers: https://docs.clamav.net/manual/Installing/Docker.html
- PDF-LIB document/page APIs: https://pdf-lib.js.org/docs/api/classes/pdfdocument
