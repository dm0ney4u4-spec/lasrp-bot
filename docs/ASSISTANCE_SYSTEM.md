# NYCRP Assistance System — November 19, 2026

This upgrades the existing New York Automation bot and SQLite ticket database. It reuses the current Discord client, PostgreSQL-backed Roblox verification, Express website and Discord OAuth/session security. Staff applications, CAD, global bans, moderation and session commands remain separate. The regulations panel stays disabled.

## Branding and reference

The supplied assistance banner and white skyline logo replace `assets/branding/nyc-assistance.png` and `nyc-logo.png` intact. The accent is **#D8C5A4**. `nyc-assistance-footer.svg` is the editable vector source for the matching decorative footer PNG. The 74-second reference video was inspected locally; the interface follows its banner, compact information panel, private button selection, simple claim announcements and dark transcript layout. The requested ten-second delay takes precedence over the different delay shown in the video. No North Carolina branding or Staff Application ticket option is included.

## Central configuration

Edit **`config/tickets.js`** for the current `ticketConfig` and `assistanceForms`. This contains routing, role IDs, channel IDs, emoji IDs, modal questions, branding and policy defaults. `legacyTicketConfig` and `legacyCategories` preserve compatibility with existing records; they are not new inquiry options.

| Inquiry | Category | Support role |
| --- | --- | --- |
| General Support | `1530304754045943808` | `1529545919907762397` |
| Staff Reports | `1573101012799987872` | `1529545769462272140` |
| Purchase Support | `1573101137442115594` | `1529545703024627754` |
| Punishment Appeals | `1573103713000886384` | `1529545769462272140` |
| Escalated Tickets | `1573101311145152625` | `1529542214336778322` |

The permanent panel is in `1569512860986380449`. All logs, rating results and transcript notifications use `1530312641728217189`. This shared channel must deny @everyone access and must not explicitly allow non-administrator roles or members to view it. The bot checks that condition before confidential creation/logging/closure. Only the bot and current Discord Administrators should have access. The deployment helper can apply those exact restrictions to this configured channel; it does not alter unrelated channels.

Emoji IDs are resolved against the guild at runtime. A missing emoji or unavailable emoji lookup results in plain-text controls. The configured IDs are Get Support `1530309174506950727`, Information `1557908396928409640`, Claim/Unclaim `1530309124682813552`, and Close `1530317213238562847`.

Defaults: **one active ticket per member across all types**, ten-second fallback delay, no creator closing, closure DMs on, closed-channel deletion on, support ratings on and transcript access restricted to actual Discord Administrator permission. Category roles, CAD groups and website administrator bindings do not automatically grant transcript access.

## User flow

Get Support opens a private selection with Staff Report, Claim Purchase and Appeal Punishment. A ten-second server timer adds the red Inquiry Isn't Listed button for General Support. Its availability time is also checked in SQLite, so forging the button ID cannot skip the delay. Real Discord editing/rate limits can affect delivery time. Selections are bound to the initiating user and expire after 14 minutes. If the bot restarts during this ephemeral timer, the existing three buttons still work until expiry; clicking Get Support again restores the delayed fallback flow. Discord interaction tokens are not saved to disk.

The dedicated modal collects the appropriate inquiry fields. Purchase forms never ask for credentials or card information. A private Creating message is edited into a channel link after successful creation. Concurrent submissions are serialized by SQLite transactions and cannot create a second new active ticket. Existing historical duplicates are preserved for staff review rather than deleted.

The opening card is pinned and contains only Close and Claim/Unclaim controls. Real linked Roblox identity comes from `LinkedRobloxAccount`. The public Roblox API supplies the linked account creation date when available. Submitted, unverified names are retained as inquiry answers; they are not presented as verified identity. Missing verification displays Not Linked/Unknown. Staff can read every submitted answer through Ticket Information → View Inquiry Answers, with private pagination.

Names are sanitized `🔴-username`, `🟢-username`, `🟡-username` or `🔵-username`. Assignment, waiting-for-response, routing and locks are persisted separately. Escalated routing has the blue indicator; a creator reply clears the yellow waiting state. Discord channel rename throttling can delay names; the saved state and pinned card remain authoritative and are retried.

## Commands and staff controls

The registered `/ticket` command replaces the separate `/ticket-panel` and `/ticket-admin` entries. It provides:

`panel`, `control`, `claim`, `unclaim`, `add`, `remove`, `transfer`, `escalate`, `priority`, `close`, `transcript`, `stats`, `config`, `repair`.

`/mytickets` shows only the caller's ticket statuses. `/ticket control` is private and exposes Add/Remove Member, Transfer, Escalate, Priority, Rename, Request Response, Lock/Unlock, Information, Generate Transcript and Close. Each action is independently checked against the ticket's **current** support role. Discord Administrators can perform administrative/supervisory tasks. The reported staff member cannot manage their own report. Only the handler or an authorized supervisor may unclaim another handler's assignment. Transfers require an eligible handler in the same current category.

Confidential Staff Report/Appeal/Escalated tickets require additional **Discord Administrator** authorization to add/remove participants. The creator, bot and reported staff member cannot be removed/added through those controls. Permission repair, configuration and transcript access require Discord Administrator permission. Creators cannot close their own tickets, even if they hold a staff role.

`-close required reason` remains a staff shortcut to safe closure. `-closer optional message` now requests a response and gives the ticket its yellow waiting state; it does **not** offer member-controlled closing, in accordance with the new policy.

`/ticket config` displays routing. An administrator can supply `type`, `support-role` and/or `category` to persist a routing update. Changes are audited and existing matching open tickets are repaired. File defaults stay in the centralized configuration; SQLite routing overrides survive restart. Transcript policy cannot be weakened through a category-role option.

## Confidential reports and escalation

Staff reports resolve a Discord mention/ID or an unambiguous staff username and explicitly deny the reported member access. Discord Administrator privileges bypass channel overwrites. Reports against an Administrator are therefore blocked **before confidential answers are stored or posted**, and management receives a metadata-only warning directing the applicant to contact the owner privately. The bot does not falsely claim that it can hide a guild channel from an Administrator.

Escalation requires a reason, moves the channel to `1573101311145152625`, removes previous support-role access and added participants, grants the escalation team, clears the claim and retains the creator's access. The routing intent is saved before Discord changes; interrupted escalation is completed safely after restart. Existing original inquiry/category history remains recorded.

## Closure, transcripts and ratings

The Close button opens a required-reason modal. Slash/prefix closes also require a reason. The workflow freezes normal writing, captures **all retrievable history**, saves numbered HTML files and SHA-256 manifests privately, sends an administrator-only View Transcript notification, attempts a branded closure DM and then deletes the channel. Failed generation, storage or transcript notification leaves the channel intact for retry. Repeating `/ticket close` as authorized staff resumes an interrupted closure using the stored original reason. Successful logs and DMs are not resent. Unknown interrupted DM outcomes are recorded rather than blindly duplicated.

Transcripts include author/avatar, timestamps, text, supported V2 layout/media, attachments, complete inquiry, closing reason and audit history. HTML is escaped, scripts cannot run, and image sources are limited to Discord's CDN. Attachment/image URLs are references to Discord-hosted files and can expire; binary attachments are not permanently archived. Deleted messages cannot be recovered. Large transcripts split into parts without an arbitrary message-page cap.

Transcript files are **not** uploaded to Discord or sent to creators. The Express routes `/tickets/transcripts/:id` and `/tickets/transcripts/:id/part/:part` use the existing Discord session, fetch current guild permissions on every request, and require actual Administrator permission for both inline views and downloads. Responses are private/no-store, enforce a restrictive CSP, verify hashes and constrain file paths to private storage. The older `/api/transcripts/:id` route now also requires Administrator permission.

Unauthenticated links use the existing Discord OAuth flow and return to the exact transcript page after login. The signed return target is restricted to local transcript paths; external redirects and traversal are rejected. Existing OAuth state, PKCE, secure cookies, session expiry and CSRF controls remain in place. This does not grant CAD admission.

Closure DMs contain the supplied banner, ticket/category, closer, reason and Rate Your Experience. They contain no transcript URL or HTML attachment. The creator may choose 1–5 and optionally provide feedback. A SQLite unique key enforces one rating per closed ticket. Score, feedback, creator, assigned handler, category and submission time are saved and logged privately. Disabled DMs never block closure.

## Windows setup and deployment

```powershell
cd "C:\Users\erlcl\Downloads\Los Angeles Bot"
npm run check
npm test
npm run build
npm run assistance:check
# Apply the requested Administrator-only policy to the shared log channel:
npm run assistance:setup
npm run register
npm start
```

The setup command validates live IDs/permissions, updates the tracked panel and installs the supplied logo as the existing bot avatar/application icon. Use `npm stop` before starting a second main bot process. No new token or bot is created. Required intents: Guilds, Guild Members, Guild Messages, Message Content and Direct Messages; enable privileged Members/Message Content in the Developer Portal. Required bot permissions include View Channel, Send Messages, Read Message History, Manage Channels, Manage Roles, Manage Messages (pinning), Attach Files and permission to mention non-mentionable support roles.

Keep `DISCORD_BOT_TOKEN`, database credentials, OAuth secret and session secret in environment variables. SQLite/HTML storage stays under ignored `data/`; back up the existing PostgreSQL data, SQLite database and transcript directory. Stop the bot before making simple filesystem backups. No database is reset. Existing open JSON-backed tickets migrate into SQLite while their source records and channels are preserved; existing SQLite records remain intact.

`WEB_BASE_URL` determines transcript links. With the current localhost configuration, pages can be opened only on the hosting computer. Remote administrators require an actual public HTTPS host and matching existing OAuth callback settings. This update does not invent a public URL, deploy a new website, or change production deployment settings.
