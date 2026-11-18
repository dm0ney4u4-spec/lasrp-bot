# nyc main bot — ticket system

This module runs inside the existing Discord bot. It adds no second bot, web login, or PostgreSQL replacement. The CAD, staff applications and ER tracking keep their existing database and permissions. New tickets use a separate SQLite WAL database; existing legacy ticket records and controls remain available. Old ticket creation menus direct members to the new three-category panel.

## Windows setup

Use Node 22.20+ (the repository includes a local Node 22 runtime) and run these commands from the project folder in PowerShell:

```powershell
npm ci
npm run setup:env
npm run check
npm run ticket:test
npm run register
npm start
```

The existing PostgreSQL configuration is still required for the combined bot/CAD process. Keep the working database and `.env`; do not recreate them. SQLite initializes and migrates automatically on first use. `npm stop` gracefully stops the process; `npm start` starts it again. Keep the terminal or hosting service running for Discord buttons to respond.

In the Discord Developer Portal, open this existing application's **Bot** settings. Enable **Server Members Intent** and **Message Content Intent**. The client requests Guilds, Guild Members, Guild Messages, Message Content and Direct Messages. Message Content is needed to retrieve members' message content, attachments and embeds in transcripts. No Presence Intent is required for tickets.

Invite the existing bot with `bot` and `applications.commands` scopes. Ticket permissions: View Channels, Send Messages, Read Message History, Attach Files, Embed Links, Manage Channels, Manage Roles (for channel permission overwrites), and Mention Everyone (to notify non-mentionable support roles). Manage Messages is useful for maintenance. The other existing moderation features have their own requirements. Grant these permissions in the support categories, ticket panel and private transcript log. Discord Administrators retain their inherent access to every channel.

## Configuration and supplied assets

Edit **`config/tickets.js`** for all ticket options and IDs. Secrets belong in `.env` only. The defaults use the exact supplied values:

| Setting | ID |
| --- | --- |
| Public panel | `1569512860986380449` |
| General Support category | `1530304754045943808` |
| General Support manager role | `1529544817712037939` |
| General custom emoji | `1530309174506950727` |
| High Rank category | `1530304783637025009` |
| High Rank manager role | `1529545769462272140` |
| High Rank custom emoji | `1529841131939041300` |
| Department category | `1569530969327927366` |
| Department manager role | `1529545703024627754` |
| Department custom emoji | `1529664985238867998` |
| Private transcript log | `1530312641728217189` |

General viewers are `1529545769462272140` and `1529545703024627754`; High Rank viewers are those same two roles; Department viewers are `1529545703024627754`. A viewer role alone does not grant management of another team's ticket. The primary role and roles added through escalation can manage it. The guild owner and Discord Administrators may administer tickets by default. Extra explicit ticket administrators and category supervisors can be configured separately; none are invented or assigned automatically.

The supplied images are stored at `assets/branding/nyc-assistance.png` and `assets/branding/nyc-footer.png`. Panels upload them as Discord attachments; no external image hosting or secret URL is required. Replacing those two files updates artwork on the next panel refresh. Keep the supplied files in Git.

Optional environment overrides:

```dotenv
DISCORD_GUILD_ID=1529507818452029650
TICKET_PANEL_CHANNEL_ID=1569512860986380449
TICKET_DATABASE_PATH=data/nyc-tickets.sqlite
TICKET_TRANSCRIPT_DIRECTORY=data/ticket-transcripts
```

## Publishing and administration

`npm run ticket:diagnose` connects to Discord and validates the configured categories, roles, emojis, private log and assets. `npm run ticket:publish` creates the panel in the configured channel or refreshes its tracked message. It does not register commands or start the long-running bot.

Inside Discord, an administrator can use:

- `/ticket-panel` — publish/update in the current channel; optionally choose another text channel. `replace:true` posts the replacement before removing the old tracked panel.
- `/ticket-admin details number:...` — private state, delivery status and recent audit events.
- `/ticket-admin repair number:...` — restore configured overwrites and controls for an open ticket.
- `/ticket-admin reassign number:... member:...` — private, actor-bound confirmation before assigning an already claimed ticket to an authorized support member.
- `/ticket-admin retry-close number:...` — resume a previously confirmed, interrupted closure.
- `/ticket-admin refresh-panel` — refresh the tracked panel in this channel.
- `/ticket-admin diagnose` — private configuration diagnostics.

Command defaults and backend checks both require administrator access. Users create tickets through the public dropdown, not an opening slash command. The dropdown opens the 10–1,000 character inquiry modal immediately. One active ticket per user per category is enforced by a database unique index. Numbers start at `0001`, never reset during restart, and can exceed four digits. Failed reservations are not recycled.

Staff can also type these two **message commands inside a ticket**:

- `-close Issue resolved` — closes immediately, with a required reason (maximum 1,000 characters). It uses the same transcript, logging, creator DM and safe channel deletion workflow. No additional confirmation is needed for this explicit staff command.
- `-closer Are you all set?` — sends a V2 request that pings only the ticket creator. The reason is optional. Only the creator can choose **Close Ticket** or **Keep Open**. Approval closes with the staff member's reason and records who approved it. Declining or ignoring it leaves the ticket open. Requests expire after 24 hours by default (`closeRequestSeconds`), and only one pending request is allowed per ticket. Request controls and decisions persist across bot restarts.

Only the ticket's primary/escalated management roles and configured ticket administrators can invoke these commands. The ticket creator and viewer-only staff cannot invoke them merely because they can see the ticket. The original requester must still have ticket management permission when the creator approves. Bots, webhooks, DMs and other servers are ignored. Message Content Intent must be enabled; these are prefix commands, not `/close` or `/closer` slash commands.

## Workflow and recovery

New channels are private, with a separate creator/support-role notification and a V2 opening card. Claim/unclaim/reassign announcements use the requested short ordinary messages. Assignments remain in SQLite if Discord delays or rate-limits channel renaming; the card is authoritative, and the recovery worker retries the name. If Discord rejects the Unicode name specifically, a readable `claimed-ticket-0001` or `unclaimed-ticket-0001` fallback is used.

General escalates to High Rank, then Department; High Rank escalates to Department. Escalation adds role access, records an audit event, and pings the destination role without moving the channel or removing the original team's access. Department tickets cannot escalate, including stale button or direct-handler requests. Claims and escalations remain separate state.

The Close button asks for a private, actor-bound confirmation lasting two minutes. The creator may close their own ticket by default; viewers cannot close as staff. Authorization is freshly checked when confirming. The explicit staff `-close` command closes immediately; `-closer` waits for the creator's approval instead. Closure freezes normal writing, captures all retrievable history in chronological order, and saves safe HTML plus SHA-256 manifests to private disk. It does not silently truncate after a fixed number of messages. Large transcripts split into numbered files. Attachment links are included; binary attachments are not downloaded, and Discord links can expire. Deleted messages cannot be reconstructed. Administrators can still bypass channel write restrictions due to Discord's permission model.

All transcript parts must reach the configured **private** log before deletion. Exactly one final summary is sent per ticket, with continuation attachment messages when required. Successful receipts are persisted, and recovery searches for delivery markers if Discord accepted a send before the process stopped. A failed log upload leaves the channel in Closing for retry. Creator DMs are best effort: blocked DMs do not prevent closure; successful DMs are not resent. An interrupted DM with an unknown result is marked uncertain rather than blindly repeated. The channel is deleted only after confirmed log delivery.

The 30-second recovery worker resumes pending creation/closure, adopts channels created immediately before a crash using their unique topic marker, repairs pending controls/names, and records externally deleted channels without inventing their lost history. Active operations renew durable leases so concurrent claims and restart recovery cannot process the same ticket simultaneously. Interaction handling uses persistent custom IDs, not temporary collectors.

If a creator leaves, their stored identity remains in the transcript. Missing roles, permissions, categories, storage, or public transcript logs fail safely with an ephemeral error and structured error code. Fix the underlying configuration, then repair or retry. Do not delete the database to fix an error.

## Backups and privacy

Tickets and inquiries are private data. Restrict access to `data/nyc-tickets.sqlite`, its `-wal`/`-shm` files, and the entire transcript directory. These paths and `.env` are ignored by Git. For a simple consistent filesystem backup, stop the bot first and copy the SQLite database plus transcript directory to private backup storage; restart afterward. The existing PostgreSQL backup script covers the CAD database, not these new SQLite/filesystem records. Keep both backups. No automatic transcript retention/deletion is imposed; configure your community's retention policy before removing records or files.

## Verification

`npm run ticket:test` tests the actual SQLite implementation with mocked Discord transport: configuration/UI builders, numbering, unique active tickets, claims and races, viewer permissions, creator close permissions, escalation, confirmation ownership, transcript pagination/splitting/XSS protection/hash checks, failed logging, disabled DMs, duplicate-free closure recovery, orphan adoption, external deletion and panel updates. `npm test` also exercises existing CAD/authentication, applications, moderation, livery and ER integration behavior. `npm run build` checks TypeScript and builds the CAD bundle.

Live checks and remaining human UI verification are recorded in `docs/TICKET_TEST_REPORT.md`. A successful automated test does not establish how Discord renders a panel on every client, whether a member has muted a role, or whether an individual member allows DMs.

Official references: [Discord message permissions and nonce delivery](https://docs.discord.com/developers/resources/message), [Node 22 SQLite API](https://nodejs.org/download/release/v22.20.0/docs/api/sqlite.html).
