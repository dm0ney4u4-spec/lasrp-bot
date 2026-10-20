# MASTER BUILD PROMPT — LOS ANGELES STATE ROLEPLAY
## Complete Discord Bot + ER:LC CAD/MDT + Staff Security + Community Management

You are a senior full-stack engineer, Discord application developer, security engineer, product designer, and QA engineer. BUILD A WORKING, PRODUCTION-QUALITY PROJECT—not a mockup, slideshow, generic template, or collection of pseudocode. The product is for an Emergency Response: Liberty County (ER:LC) Roblox private-server community named **LOS ANGELES STATE ROLEPLAY** (short brand: **LASRP**). Name the bot **LASRP Operations** and the companion website **LASRP CAD | Nexus**. Use the assets provided with this project. Do not replace the community name with LibertyCAD, Liberty County Roleplay, or a generic server name.

## 0. NON-NEGOTIABLE INSTRUCTIONS

1. Actually create all source files, database schema, migrations, command registration, interaction handlers, web pages, reusable components, seed data, tests, setup scripts, and documentation. Never claim an unimplemented button, command, integration, or page works.
2. The Discord bot and CAD website must use ONE shared, consistent backend and database. Updates through Discord must appear in CAD, and authorized CAD changes must appear in Discord.
3. Make the default Discord presentation **Components V2**: Container, Section, Text Display, Separator, Thumbnail, Media Gallery, buttons, select menus and modals as appropriate. Set the official `IS_COMPONENTS_V2` message flag. **Do not put traditional `embeds` or `content` fields in the same message as Components V2**, because Discord disallows that. Use legacy embeds only for a specific compatibility case, in separate messages. When I say “embeds” in this specification, I mean premium-looking visual announcement panels, mainly built using Components V2.
4. The interface must be beautiful, restrained, modern and consistent. Navy/royal-blue backgrounds, ice-blue accents, white type, soft gray dividers, elegant spacing, and branded Los Angeles imagery. NOT excessive neon, random colors, excessive gradients, cartoonish decorations, walls of emojis, or oversized text.
5. **WHITE ICON RULE:** Do not use regular colorful Unicode emoji such as red sirens, yellow stars, blue police cars, green checks, etc. Prefer custom guild emojis made from WHITE transparent PNG/SVG graphics. Put their IDs in centralized configuration and use `<:icon_name:EMOJI_ID>` as appropriate. Provide graceful monochrome Unicode-symbol fallback such as `◆`, `◇`, `✦`, `▸`, `■`, `□`, or plain text until custom emojis are configured. Unicode emoji variation is client-dependent, so do not promise that normal emojis will render white. Provide a guide for uploading custom white emoji assets. Avoid hardcoding unconfigured fake emoji IDs.
6. Every critical button, select menu, form, slash command, and website action must actually work, including after a bot restart. Persist panel message IDs and durable interaction state. Make panels re-postable, editable, and idempotent.
7. Include a clearly labeled single area for me to paste my **Discord guild, channel, role, user and custom emoji IDs**, plus a separate `.env` file for **SECRET** credentials such as bot token, ER:LC API key and database URL. Never expose secrets in source control, logs, embeds, public browser bundles or error messages. Include `.env.example`, `config/ids.ts` or `config/ids.json` with descriptive placeholders, and `/setup validate` to check permissions and missing IDs. Do not make me search through 40 source files to configure IDs.
8. All sensitive actions require server-side role/permission checks and audit logs; Discord UI button visibility alone is NOT security. Never give staff full administrator access by default.
9. Use the actual documented ER:LC/PRC API available at implementation time. Verify supported API endpoints, data fields, rate limits and remote commands from official documentation. DO NOT invent endpoints, pretend to alter Roblox client UI, or fabricate live location/vehicle data. Features not supported by the API must use our own roleplay database and be labeled accordingly.
10. Use sensible working defaults. Build modules in a dependency-safe order, keep progress in `BUILD_PROGRESS.md`, and continue rather than asking trivial design questions. At the end, provide exact install and run steps, the URLs/paths, and the configuration values I still need to supply.

## 1. BRANDING AND ATTACHED IMAGES

The official community name is **Los Angeles State Roleplay**. Short form: **LASRP**. Bot name: **LASRP Operations**. CAD name: **LASRP CAD | Nexus**. Footer: `Los Angeles State Roleplay • Operations & Public Safety`.

Provided media files should be copied into `assets/branding/` (the enclosed ZIP already uses descriptive filenames):

- `la-logo.png` (original: `LA_logo (1)(1).png`) — the white stylized LA logo. Use as bot avatar if I set it in the Discord Developer Portal, CAD favicon/brand emblem, panel thumbnails, website sidebar brand, and optional watermarks. Preserve transparent background and aspect ratio.
- `sessions-banner.png` (original: `larp sessions.png`) — **Sessions** hero artwork; use for SSU, SSD, session voting, scheduled sessions, and session overview. Do not use it for staff applications or tickets.
- `applications-banner.png` (original: `applications_larp.png`) — **Applications** hero artwork; use for application announcements, DM application entry points, staff recruitment and application status.
- `blank-blue-banner.png` (original: `blank larrp.png`) — reusable matching blue branded background. Use as the design reference/template for specifically labeled **CAD**, **TICKETS**, **RULES**, **SECURITY**, **STAFF MANAGEMENT**, **INFRACTIONS**, **PROMOTIONS**, **ANNOUNCEMENTS** and **SUPPORT** visuals. Do not display an unrelated blank banner if a topic-specific version can be made. If editing/generating banners is supported, generate individual titles in the same restrained style while preserving the provided artwork. If not, use this as the decorative media and place clear matching titles in V2 Text Display above it.
- `server-header.png` (original: `Untitled design (44).png`) — thin horizontal Los Angeles State Roleplay header. Use for website headers and Discord where this unusually wide, shallow aspect ratio renders properly. Do not stretch it into a large image area.

**Naming consistency:** Some supplied session/application/header graphics visibly say “Los Angeles Roleplay” rather than the full official name “Los Angeles State Roleplay.” Keep the originals intact, but where practical create corrected variants that say “Los Angeles State Roleplay” or “LASRP” in the same style. Do not silently misname the community in panel headings, DM text or CAD. If image-editing tools are unavailable, use the original artwork accompanied by a clear official full-name header in Components V2.

Keep image quality high, don't crop away the LA logo, and don't use any unrelated police stock artwork. On Discord, make sure attached images display correctly using supported uploaded media/CDN URLs, with accessible descriptions and sensible sizing. Include a centralized `assets.ts` image map so each panel uses the correct graphic. Allow server administrators to replace these assets later. Make all assets available to the coding AI: if it cannot directly access them, explicitly say which `assets/branding/` paths need to be copied; don't pretend it has seen files it hasn't.

Visual design tokens: background `#07152D`; darker navy `#061126`; royal blue `#244A91`; muted blue `#6689BA`; frosted/silver `#DCE5F4`; white `#FFFFFF`; subdued dividers `#294263`. Use red/amber/green only when necessary for critical status clarity, preferably as small accents rather than big colorful decorations. Offer light/dark mode on the CAD website, with the blue-dark theme default.

## 2. ARCHITECTURE AND DELIVERABLES

Use a maintainable TypeScript monorepo. Recommended:

- `apps/bot/`: discord.js bot, slash commands, Components V2 panel rendering, persistent interaction handlers, background jobs.
- `apps/web/`: Next.js + TypeScript + Tailwind + accessible component system, responsive CAD/MDT/administration portal.
- `apps/api/` (or a well-structured shared server): Node.js/TypeScript API, auth, validation, RBAC, business logic, event publisher, ER:LC API adapter.
- `packages/shared/`: typed schemas, permission constants, audit types, UI panel types, validation.
- `prisma/`: PostgreSQL schema, indexes, migrations, seeders.
- `assets/branding/`: attached five branded images; optional generated monochrome icon pack.
- `config/ids.ts` or `config/ids.json`: all Discord IDs and nonsecret feature settings in one clearly marked place.
- `.env.example`: bot token, application secret, ER:LC API key, DB and Redis URLs, session secret, optional secrets.
- `docker-compose.yml` for local PostgreSQL and optional Redis, `README.md`, `SETUP_CHECKLIST.md`, `BUILD_PROGRESS.md`, `TEST_REPORT.md` and example screenshots.

Use PostgreSQL + Prisma, WebSockets for live updates, rate-limited jobs/queues where necessary, and a secure authorization layer. Use appropriate caching/retries for ER:LC. Where a rich live backend cannot run in a free static host, document that clearly rather than pretending Netlify static hosting alone runs a persistent Discord bot/database. Offer a local development path first, and a realistic always-on deployment path.

Create `/setup` and `/setup validate` commands to verify permissions, role hierarchy, required channels, bot intents, Discord OAuth redirect URLs, database connectivity, API authentication, and image accessibility. Missing optional IDs should disable only their optional modules, not crash the entire bot.

## 3. CONFIGURATION — MAKE THIS VERY EASY FOR THE OWNER

Create one clearly commented file resembling:

```ts
// config/ids.ts — ONLY NON-SECRET IDs and feature settings go here.
export const ids = {
  guildId: 'PASTE_DISCORD_GUILD_ID',
  clientId: 'PASTE_DISCORD_APPLICATION_CLIENT_ID',
  owners: ['PASTE_OWNER_DISCORD_USER_ID'],
  channels: {
    rules: '', announcements: '', serverInfo: '', cadPanel: '',
    applicationsPanel: '', applicationReviews: '', applicationLogs: '',
    ticketPanel: '', ticketCategory: '', ticketLogs: '',
    sessions: '', sessionVotes: '', sessionLogs: '',
    staffLogs: '', moderationLogs: '', securityAlerts: '',
    infractions: '', promotions: '', staffReports: '',
    erlcLogs: '', dispatch: '', generalSupport: '',
    appeals: '', training: '', suggestions: ''
  },
  roles: {
    owner: '', communityManagement: '', seniorAdmin: '', admin: '',
    seniorModerator: '', moderator: '', trialModerator: '',
    applicationReviewer: '', ticketSupport: '', securityTeam: '',
    sessionHost: '', staff: '', trainee: '', verified: '',
    police: '', sheriff: '', fire: '', ems: '', dot: '',
    dispatcher: '', supervisor: '', doj: '', civilian: ''
  },
  emojis: {
    shield: '', cad: '', police: '', radio: '', ticket: '',
    application: '', check: '', close: '', info: '',
    warning: '', clock: '', document: '', settings: ''
  },
  categories: { tickets: '', archivedTickets: '' },
  featureFlags: { cad: true, tickets: true, applications: true,
    security: true, sessions: true, automod: true, courts: false }
} as const;
```

Use a `.env.example` resembling:

```env
DISCORD_BOT_TOKEN=PASTE_IN_LOCAL_ENV_ONLY
ERLC_SERVER_API_KEY=PASTE_IN_LOCAL_ENV_ONLY
DATABASE_URL=postgresql://user:password@localhost:5432/lasrp
REDIS_URL=redis://localhost:6379
WEB_BASE_URL=http://localhost:3000
DISCORD_OAUTH_CLIENT_SECRET=PASTE_IN_LOCAL_ENV_ONLY
APP_SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
FILE_STORAGE_SECRET=OPTIONAL
AI_PROVIDER_API_KEY=OPTIONAL
```

Additional IDs may be added as needed but they MUST stay centralized and documented. Slash command access and website access must use permission groups, not fragile channel-only checks. Include a `/setup wizard` that can bind roles/channels via select menus and save those settings to the database, while respecting hardcoded owner/admin constraints. Bot tokens and ER:LC API keys are not Discord IDs, must remain secret, and must not be posted in Discord modals unless using a secure admin-only encrypted setup flow.

## 4. DISCORD SERVER VISUAL PANELS — COMPONENTS V2

Build a reusable panel renderer. Every main panel must have a navy/blue accented Container, clear white title, short concise description, sensible Separator spacing, LA logo Thumbnail, relevant banner as a media attachment, relevant live status where appropriate, a few purposeful buttons/menus, and footer text. Add alt descriptions to media. Panels should be re-creatable using slash commands without creating duplicates each time. Persist channel/message IDs and update the existing post where possible.

Required polished panels:

A. **WELCOME / SERVER INFORMATION:** community intro, join information, website/CAD link, rules button, verification button, support button; use LA logo and server header or matching generic banner.
B. **DISCORD RULES:** complete Discord rules, `Acknowledge Rules` verification button, `Open Support Ticket` button; use matching RULES visual.
C. **IN-GAME ER:LC RULES:** separate detailed game rules with link to reporting; matching RULES visual.
D. **STAFF CODE OF CONDUCT:** confidential staff standards, policy acknowledgment; staff-only.
E. **SESSIONS:** the supplied `sessions-banner.png`, status, current host, player count, SSU/SSD actions as permitted, `Join Server`, `Vote`, `View Schedule` buttons.
F. **STAFF APPLICATIONS:** the supplied `applications-banner.png`; open/closed indicator; `Apply via DM`, `Requirements`, `Application Status` buttons.
G. **APPLICATION REVIEW:** private review card with application ID, applicant, full answers/continuation link, reviewer and buttons `Accept`, `Deny`, `Request Interview`, `Claim`, `Request More Info`; role-restricted.
H. **SUPPORT TICKETS:** tickets-themed banner based on blank template; dropdown/buttons for General Support, Player Report, Staff Report, Ban Appeal, Bug Report, Partnership, Other.
I. **CAD/MDT:** CAD-themed banner based on blank template; `Launch CAD`, `Create Civilian Profile`, `View Status`, `Request Dispatcher`, and `Help`; state CAD URL in the message.
J. **STAFF SECURITY:** staff-only alerts, security posture, recent events, protected resources and review actions; security-themed banner.
K. **STAFF MANAGEMENT:** staff dashboard with promotions, infractions, LOA, roster, applications and relevant role-gated actions; staff-themed banner.
L. **ANNOUNCEMENTS / UPDATES:** reusable LASRP announcements with topic-specific imagery.
M. **SUGGESTIONS / FEEDBACK:** submit suggestion, upvote/downvote if appropriate, staff evaluation.
N. **APPEALS:** guide to appeal banned status, DM or web link, private staff workflow.

Require buttons to be functional and gracefully recover from expired interactions/restarts. When a component cannot legally be placed inside a specific V2 layout, choose a supported arrangement instead of sending invalid API payloads.

## 5. DEFAULT RULES — WRITE THESE INTO THE PANELS

**Discord community rules:**
1. Be respectful; no harassment, bullying, hate speech or discriminatory slurs.
2. No threats, doxxing, disclosure of private information or encouragement of harm.
3. No spam, flooding, excessive mentions, scams, phishing or malicious links.
4. No NSFW or otherwise inappropriate content; keep usernames and media appropriate.
5. Follow Discord Terms and applicable Roblox community rules.
6. Stay on topic and use each channel for its designated purpose.
7. Do not impersonate staff, emergency personnel or other members.
8. No unsolicited advertising, mass DMs or recruiting without approval.
9. Do not evade moderation through alts or repeatedly disrupt reviews.
10. Report problems privately through a ticket; don't start public arguments.
11. Do not abuse bot commands, staff pings, applications or tickets.
12. Staff directions must be reasonable and consistent with published rules; use appeals for disputes.

**In-game ER:LC roleplay rules:**
1. No RDM (random deathmatching) or VDM (vehicle deathmatching).
2. No FRP (fail roleplay), unrealistic actions, or deliberate refusal to roleplay realistically.
3. Respect New Life Rule (NLR) when defined by the server's scenario rules.
4. No metagaming (using information the character did not obtain in roleplay).
5. No powergaming (forcing outcomes or actions with no fair opportunity to respond).
6. No exploiting, glitch abuse, unauthorized scripts or bypassing server controls.
7. No emergency service impersonation when it violates the server's department rules.
8. No random shooting, unrealistic pursuits, mass trolling or deliberate scene disruption.
9. Observe posted pursuit, traffic stop, robbery and emergency response guidelines.
10. Respect staff moderation and request review through the correct channel.
11. No inappropriate vehicle liveries, offensive character names or abusive radio usage.
12. Use realistic callouts; do not spam fake 911 calls, emergency requests or staff calls.
13. Keep combat and roleplay reasonable; the server's published combat policies take precedence.
14. Do not abuse map glitches, spawn areas or safe zones.
15. Keep roleplay welcoming for inexperienced players; avoid targeting or bullying.

**Staff code of conduct:** professionalism, evidence-based moderation, impartial decisions, confidentiality, least privilege, no role/permission abuse, clear documentation, escalation of conflicts of interest, respectful communications, no unauthorized mass moderation, and honest appeal handling. Publish full readable prose, not just these keywords. All rules and policies must be editable by authorized administrators with version history and acknowledgment tracking.

## 6. DM-BASED STAFF APPLICATION SYSTEM (TOP PRIORITY)

This system must be COMPLETE, not a Google Forms link. Only eligible guild members can apply. A server member presses **Apply via DM** on the Applications panel or uses `/apply staff`. The bot checks application open status, existing applications, cooldown and minimum requirements, then sends the person a branded DM introduction. They confirm they want to begin. Store progress in the database.

Ask questions **one at a time in DMs**, using buttons and messages/modals when applicable. Support `Continue`, `Previous`, `Cancel`, `Save and Exit`, and `Resume`. Allow longer answers; do not lose them if the bot restarts or the user pauses. Handle DMs disabled with a polite ephemeral error and alternative web application form. Set a configurable timeout (default 48 hours of inactivity), anti-spam cooldown and maximum one active application.

Default questions (editable by leadership):
1. Discord username and Roblox username / verified Roblox account.
2. Age bracket or confirmation of the community's minimum eligibility requirement; avoid demanding exact birthdate.
3. Time zone and usual weekly availability.
4. Previous moderation/ER:LC roleplay experience; where and what responsibilities.
5. Why do you want to join the LASRP staff team?
6. What makes you a suitable moderator? Describe strengths and areas for growth.
7. How would you handle a user insulting another member in chat?
8. How would you handle a suspected exploiter when evidence is incomplete?
9. How would you respond if a friend broke a server rule?
10. How would you react to an accusation of staff abuse against a senior staff member?
11. Are you willing to follow all staff policies, document moderation decisions, and keep reports confidential?
12. Any additional information you want the review team to know?

Show the applicant their answers for review, then require explicit **Submit Application** confirmation. Create an application number (e.g. `LASRP-APP-000123`). DM acknowledgment and status. Publish the application to the EXACT channel configured as `applicationReviews`, formatted as one or multiple private Components V2 cards (pagination/thread/web detail page if longer than limits). Include application timestamp, unique ID, verified account identifiers, full answers, applicant link and status.

Reviewers can **Claim**, **Accept**, **Deny**, **Request Interview**, **Request More Information**, **Add Private Notes** and **View History**. Every action enforces a reviewer/management permission check and writes an audit log. Ensure two reviewers cannot simultaneously contradict one another; use atomic DB transitions.

On **Accept**: require optional/mandatory review reason depending on config; set accepted status; DM the applicant a beautiful branded acceptance notice with their name, application ID, next steps, training requirements, and trainee role information. Optionally grant configured `trainee` Discord role if the bot has permission and the user remains in the server. Never grant Admin role automatically. Post outcome to application log and edit review panel to display APPROVED.

On **Deny**: require a professional reason or standard selectable reason; set denied status; DM the applicant a polite decline with reason if public-to-applicant, appeal/reapply information, and cooldown. Do not reveal private staff notes. Post outcome in logs and update review panel to DENIED.

On **Interview** or **More Info**: send the applicant a DM with interview instructions or requested clarification and record the state. Add `/applications open`, `/applications close`, `/applications status`, `/applications review`, `/applications history`, `/applications cooldown`, `/applications panel`, `/applications export`. If the DM fails, record delivery failure without rolling back the application decision. The bot must never send application answers to public channels.

## 7. PRIVATE TICKET SYSTEM (TOP PRIORITY)

Create a polished tickets-themed V2 panel with a category selector: General Support, Player Report, Staff Complaint, Ban Appeal, Bug/Technical Issue, Partnership, Department Request, and Other. On selection, ask category-specific details using a modal or DM conversation, then create a private ticket channel or thread under the configured category. Configure viewer permissions so only ticket requester, assigned staff and permitted leaders see the ticket; for staff complaints, exclude the accused staff member from access even if they normally handle support.

Each ticket gets a unique number and stores opener ID, assigned staff, reason, evidence links, timestamps, SLA status and message history (within platform rules/permissions). Post a professional opening card with `Claim`, `Add Member` (authorized), `Remove Member`, `Escalate`, `Priority`, `Close` and `Resolve`; optionally `Reopen` after closing. When claiming, prevent contradictory claims. Closing requires reason, transcript creation, optional user rating, staff logs, and a DM summary to the opener when possible. Securely store transcript in private storage, enforce retention and log access; offer readable HTML/text exports. Prevent duplicate spam tickets, configurable max-open tickets and cooldowns.

Build `/ticket panel`, `/ticket create`, `/ticket claim`, `/ticket add`, `/ticket remove`, `/ticket priority`, `/ticket escalate`, `/ticket close`, `/ticket reopen`, `/ticket transcript`, `/ticket blacklist`, `/ticket stats`. Include a user-facing `/mytickets` command. Ticket panels and private tickets must survive restarts.

## 8. STAFF SECURITY / ANTI-NUKE / MODERATION PROTECTION (TOP PRIORITY)

Build an actual security subsystem using authorized Discord gateway events, audit logs and configurable protection rules. Monitor channel deletion/creation floods, role deletion/creation, dangerous permission changes, mass bans/kicks, bot additions, webhook abuse, suspicious mass mentions, server setting changes and repeated unauthorized command attempts. Record executor when reliably determined; account for audit log delays, missing permissions and uncertain attribution. Include thresholds and trusted-user/service allowlists.

Provide graduated response modes: `Monitor Only`, `Alert and Require Review`, and carefully gated `Auto-Contain` for high-confidence emergencies when technically possible. Do NOT recklessly remove everyone's roles or mass-ban people. Never attempt to modify roles above the bot, punish the guild owner, or execute actions outside bot permissions. All auto-containment actions require explicit owner opt-in and generate an audit trail. Protect critical channels and roles, webhooks, owner IDs and staff security settings. Add emergency lockdown of dangerous bot commands, which can only be reversed by verified owners.

Staff audit logs must record warnings, kicks, bans, role changes, security events, application decisions, promotions, infractions, API command dispatches, access changes and ticket access. Add a false-positive appeal/review workflow. Example commands: `/security dashboard`, `/security status`, `/security protect`, `/security unprotect`, `/security lockdown`, `/security unlock`, `/security trust`, `/security untrust`, `/security incidents`, `/security mode`, `/security audit`, `/security test`.

Also implement basic spam/raid controls, join-rate alerts, suspicious-link controls and configurable automod filters with safe defaults. Use Discord's built-in AutoMod where suitable rather than duplicating everything.

## 9. STAFF MANAGEMENT, PROMOTIONS, DEMOTIONS, INFRACTIONS

Maintain separate **roleplay/civilian records**, **Discord moderation records**, and **internal staff disciplinary records**. Do not mix in-game traffic tickets with staff infractions.

Staff profile: Discord ID, linked Roblox ID, current rank, department, joins/date, supervisor, training, status, LOA, promotions, demotions, internal infractions, warnings, notes, shift time and activity. Build a management website page and V2 staff panel.

**Promotions:** `/staff promote user rank reason`; role hierarchy/eligibility validation; optional approval chain; Discord role synchronization; private DM notification; formatted promotion announcement in configured promotions channel (privacy-dependent), previous and new rank, issuing manager and timestamp; immutable promotion history. Use actual configured Discord role IDs, not role-name guesses.

**Demotions:** equivalent workflow with reason, approval and notifications; do not allow someone to demote themselves or equal/higher-ranked managers unless specifically authorized by the server owner.

**Staff infractions:** `/staff infraction issue user type reason evidence`; categories verbal warning, written warning, strike, suspension, removal recommendation; configurable point values and expiration. Show infraction history, appeals and outstanding points. DM staff member a professional notice identifying rule, reason, date, issuer and appeal route. Keep evidence and management-only notes confidential. Serious punishments require authorized human confirmation, not solely an automated point threshold.

**LOA and resignation:** users submit leave requests, specify date range/reason, supervisor approves/denies, optional roster status updates and reminders. Members can request resignation, which needs proper review before role removal.

**Other tools:** roster, active staff, duty logs, activity stats, supervisor evaluations, staff notes, certifications, training progress, department transfer, reinstatement, suspension and staff incident reports. Commands: `/staff profile`, `/staff roster`, `/staff promote`, `/staff demote`, `/staff infraction issue`, `/staff infractions`, `/staff infraction remove`, `/staff suspend`, `/staff reinstate`, `/staff note`, `/staff evaluate`, `/staff transfer`, `/staff loa`, `/staff resignation`, `/staff activity`, `/staff history`, `/staff announce`.

## 10. ER:LC SERVER CONTROLS, SESSION START-UP AND SHUTDOWN

Connect to ER:LC private-server API only using documented supported endpoints; handle invalid API keys, API Pack unavailable, offline servers and rate limits safely. Sync allowed live player information, available server status, supported vehicle/emergency-call data, join/kill/command/mod logs and authorized remote commands. Show clear “Last updated” timestamps and distinguish manually entered roleplay data from real game telemetry.

**SSU workflow:** staff host schedules or initiates a server start-up; optional session vote and configurable minimum votes; send matching branded `sessions-banner.png` V2 card to session channel; show host/co-host, scheduled time with Discord timestamps, server code if configured and allowed, rules, player count, status and Join button. `Start Session` updates status and sends approved announcements only. Show host checklist and roster/attendance. Optional ping of pre-configured role with controlled allowed mentions. Record start timestamp and status.

**SSD workflow:** confirm with host, announce closing, mark session ending, close session state, save final attendance/population snapshots, active call counts, staff activity and incident summary, and announce final shutdown notice. Don't kick all Roblox players or execute destructive commands unless explicit owner-approved functionality exists and host confirms.

Support session votes, event calendars, scheduled reminders, low-population alerts, session extension, queue summaries, patrol reservations, attendance tracking, host history, session scorecards and logs. Allow one active primary session per ER:LC server, avoid duplicate starts under concurrent button clicks.

Commands: `/ssu`, `/ssd`, `/session schedule`, `/session vote`, `/session cancel`, `/session extend`, `/session status`, `/session roster`, `/session players`, `/session host`, `/session announce`, `/session history`, `/session stats`, `/erlc status`, `/erlc players`, `/erlc queue`, `/erlc logs`, `/erlc command` (strict approved-command allowlist), `/erlc kick`, `/erlc ban`, `/erlc unban` (only where supported), `/erlc warn`, `/erlc message`. Every remote command must validate permissions and arguments, prevent command injection, log outcome, and never claim success without the ER:LC API confirming it.

## 11. LARGE WEB-BASED CAD/MDT SYSTEM (TOP PRIORITY)

Build an attractive, functioning, responsive CAD website linked from Discord; not just a single “Open CAD” button. It must have authentication, secure sessions, role-linked access, PostgreSQL persistence, search, live updates, audit logs and configurable agencies. Include Discord OAuth2 login and an appropriate verified Roblox-account-linking method. Do not assume unsupported access to Roblox user credentials. Create seeded fictional roleplay records solely for local demos, clearly marked `DEMO`, and prevent demo records leaking into production.

**Home dashboard:** server population and API health, active calls, priority alerts, recent activity, duty roster, unit status, time, notification center and compact quick-actions; draggable/resizable widgets where practical and saved preferences. Sidebar: Dashboard, Dispatch, Live Map, Police MDT, Fire/EMS, Civilian Portal, DOJ/Courts, DOT/Towing, Staff Center, Sessions, Reports, Admin.

**911 calltaking and dispatch:** callers may submit in-game synchronized calls or browser-created fictional 911 calls. Generate unique CAD incident ID. Capture source, caller, location, narrative, type, priority P1-P5, assigned dispatcher, status, response timestamps, units and reports. Dispatchers can create, edit, triage, assign/reassign, merge duplicates, transfer, close/reopen incidents, create notes and alert multiple agencies. Show pending, dispatched, responding, on-scene and closed states. When no dispatcher is online, allow self-dispatch as configured, but log it. Provide map incident markers and unit notifications. The CAD's assignment status is its own record unless the official ER:LC API supports updating an in-game responder list.

**Live ER:LC map:** use properly licensed/authorized ER:LC map imagery or an original accurate schematic, not random stock maps. Display last known units/players by agency where supported API location data is available, with freshness indicator, color-coded unit categories, dispatch markers, postal overlays, patrol boundaries, stations and roadblocks. Refresh responsibly within API rate limits, avoid inventing smooth live movement or exact routes, and explain stale data.

**Police and sheriff MDT:** configurable departments such as LAPD-inspired Police, LASD-inspired Sheriff and Highway Patrol where desired, while remaining clear this is fictional ER:LC roleplay. Callsign, unit assignment, status buttons (Available, Busy, En Route, On Scene, Traffic Stop, Transport, Out of Service), plate lookup, person lookup, BOLOs, warrants, dispatch call stack, traffic-stop workflow, citation, warning, arrest, incident reports, search/seizure logs and officer panic button.

**Civilian portal / DMV:** multiple fictional characters per account; character names, non-sensitive fictional demographics, licenses, vehicle registration, custom plates, reported stolen status, ownership transfer, permits and roleplay properties/businesses. Character privacy and ownership checks. Distinguish real in-game plate data (when provided by API) from fictional DMV registration details stored in our DB. Do not expose a user's private Discord details in citizen searches.

**Vehicle/person lookups:** fast search by plate, character ID/name or case ID, with appropriate access controls. Vehicle records show owner, make/model/color, registration, related stops and BOLOs. Person records show fictional character profile, documented citations/arrests, open warrants and linked cases. Clearly distinguish accusations, arrests and convictions.

**Traffic stop system:** create stop from plate, assigned officer/callsign, postal/location, driver, passengers, violation, backup request, warning/citation/arrest disposition, impound/tow request, notes and automatically linked report.

**Reports and investigations:** incidents, arrest reports, traffic citations, citations with configurable penal codes/fines, crashes, use-of-force reports, witness statements, evidence files/links, detective case files, suspect/vehicle relationships, report approval workflow, immutable edit history and controlled evidence access/chain of custody.

**Warrants and BOLO:** create/review/issue/cancel/expire warrants with supervisor/judge approval as configured; BOLO person/vehicle categories, acknowledgment, expiry and notification on matching lookup. Cases connect to reported incidents and warrant requests.

**Fire & EMS MDT:** fire response calls, apparatus rosters, station assignments, incident command, staging, patient-care roleplay reports, transport logs, simulated hospitals, multi-patient incidents and mutual aid. Sensitive medical-themed roleplay data should remain fictional/minimal, with access restrictions.

**DOT and towing:** tow requests, road closures, highway assistance, impound inventory, stored vehicle records, tow release workflow and dispatch coordination.

**DOJ/courts (optional module):** prosecutors, defense, judges, clerk, case submission, hearing calendar, fictional verdicts, fines, appeals, sealed records and approvals. Disabled by default unless management turns it on.

**Dispatch communications:** text-radio channels by agency, timestamps, call signs, priority broadcasts, supervisor announcements, unit acknowledgments and officer emergency button. Voice integration only if explicitly implemented through a supported service; do not pretend the bot can tap Roblox voice chat or any user's camera.

**Staff and admin in CAD:** staff roster, security alerts, applications queue, support tickets, infractions, promotions, duty logs, sessions, rules/policies, full audit history and user management. Same exact data as bot.

**System quality:** authoritative RBAC, ownership protection, pagination, input validation, optimistic concurrency/transactions, uploads limits, search indexes, filtering, CSV/PDF export where actually implemented, mobile-friendly interface, proper loading/empty/error states and keyboard shortcuts. All modules must be usable without fake buttons.

## 12. COMMAND CATALOG — BUILD THESE AS REAL COMMANDS

Use sensible grouped slash commands with short descriptions, typed options, autocomplete where helpful, ephemeral responses for private operations, useful errors, permission boundaries and cooldowns.

**Public/member:** `/help`, `/about`, `/ping`, `/server info`, `/server rules`, `/server status`, `/server join`, `/verify`, `/profile`, `/report`, `/suggest`, `/apply staff`, `/applications status`, `/ticket create`, `/mytickets`, `/appeal`, `/cad`, `/cad help`, `/session status`, `/session schedule`.

**CAD/dispatch:** `/cad link`, `/cad duty`, `/cad calls`, `/cad lookup`, `/cad unit`, `/cad bolo`, `/cad warrant`, `/dispatch create`, `/dispatch assign`, `/dispatch unassign`, `/dispatch priority`, `/dispatch broadcast`, `/dispatch close`, `/dispatch reopen`, `/dispatch status`, `/panic` (authorized responders only).

**Tickets:** `/ticket panel`, `/ticket create`, `/ticket claim`, `/ticket add`, `/ticket remove`, `/ticket priority`, `/ticket escalate`, `/ticket close`, `/ticket reopen`, `/ticket transcript`, `/ticket blacklist`, `/ticket stats`.

**Applications:** `/applications panel`, `/applications open`, `/applications close`, `/applications status`, `/applications review`, `/applications history`, `/applications cooldown`, `/applications export`, `/applications questions`.

**Staff management:** `/staff profile`, `/staff roster`, `/staff promote`, `/staff demote`, `/staff suspend`, `/staff reinstate`, `/staff infraction issue`, `/staff infractions`, `/staff infraction remove`, `/staff note`, `/staff evaluate`, `/staff transfer`, `/staff loa`, `/staff resignation`, `/staff activity`, `/staff history`, `/staff announce`, `/staff training`.

**Moderation:** `/mod warn`, `/mod warnings`, `/mod timeout`, `/mod kick`, `/mod ban`, `/mod unban`, `/mod case`, `/mod cases`, `/mod note`, `/mod purge` (bounded/safe), `/mod slowmode`, `/mod lock`, `/mod unlock`, `/mod report`, `/mod appeal`, `/mod stats`.

**Security:** `/security dashboard`, `/security status`, `/security protect`, `/security unprotect`, `/security lockdown`, `/security unlock`, `/security trust`, `/security untrust`, `/security incidents`, `/security mode`, `/security audit`, `/security test`.

**Sessions and ER:LC:** `/ssu`, `/ssd`, `/session schedule`, `/session vote`, `/session cancel`, `/session extend`, `/session status`, `/session roster`, `/session players`, `/session host`, `/session announce`, `/session history`, `/session stats`, `/erlc status`, `/erlc players`, `/erlc queue`, `/erlc logs`, `/erlc command`, `/erlc kick`, `/erlc ban`, `/erlc unban`, `/erlc warn`, `/erlc message`.

**Management/setup:** `/setup wizard`, `/setup validate`, `/setup channels`, `/setup roles`, `/setup emojis`, `/setup permissions`, `/panel deploy`, `/panel refresh`, `/panel remove`, `/rules publish`, `/rules edit`, `/announce`, `/config view`, `/config set`, `/audit search`, `/backup status`, `/health`.

**Convenience suggestions:** `/loa request`, `/loa status`, `/shift start`, `/shift end`, `/shift leaderboard`, `/unit status`, `/unit callsign`, `/training enroll`, `/training results`, `/poll create`, `/event create`, `/event RSVP` if implemented. Only register commands actually built. The `/help` interface should show only commands the caller can use.

## 13. PERMISSIONS AND AUTHORIZATION MATRIX

Create a role-based permission model independent of simplistic Discord position checks, mapped through config. Default groups:

- **Owner / Community Management:** all management functions, security ownership, explicit emergency approvals.
- **Senior Administrator / Administrator:** high-level session and moderation tools but not automatic owner/security-secret access.
- **Senior Moderator / Moderator / Trial Moderator:** progressively limited player moderation, tickets, logs and staff-calls handling.
- **Application Reviewer:** private applications and application statuses; acceptance only if authorized.
- **Ticket Support:** tickets assigned to that team; no automatic access to staff complaints targeting them.
- **Security Team:** incident alerts and investigation; any containment requires separate authorization.
- **Session Host:** start/extend/end sessions as granted.
- **Dispatcher:** manage CAD calls and live units; cannot change staff ranks or ban Discord users.
- **Police / Sheriff / Fire / EMS / DOT:** agency-specific CAD tools.
- **Supervisor:** reports and agency personnel approvals within their hierarchy.
- **DOJ:** court records when enabled.
- **Civilian / Verified:** own fictional characters, ticket, application and permitted public tools.

Provide a permission matrix in the README and a management UI to customize permissions. Every command, button, route and DB query must enforce server-side authorization. Log privilege changes. Sensitive staff cases require need-to-know access and cannot be searched by unauthorized members.

## 14. NOTIFICATIONS AND POLISH

Make all successful/failed actions readable, aesthetically consistent and contextual. Avoid useless notifications like “interaction failed” or “success” without details. Give persistent notifications in DMs for staff application outcomes, tickets, promotions, infractions and important role changes when relevant. Respect DM opt-outs and handle blocked DMs. Use Discord timestamps for local time rendering. Add a quiet-hours preference for noncritical DMs where possible.

Include thoughtfully designed templates for:
- Staff application opened, paused, submitted, accepted, denied, interview requested.
- Ticket opened, claimed, escalated, closed, reopened.
- Session vote, SSU, active session update, SSD, schedule change.
- Staff promotion, demotion, infraction, LOA approval/denial.
- CAD unit panic, high priority incident, BOLO bulletin.
- Security alert, lockdown, recovery and case review.
- General rules, in-game rules, staff rules, CAD access, server information.

For all panels, use the corresponding banner mapped in Section 1, not the same Sessions artwork everywhere.

## 15. DATABASE, TESTING, SECURITY AND RELIABILITY

Design related tables/models for GuildConfig, User, LinkedRobloxAccount, StaffProfile, RankChange, StaffInfraction, StaffNote, Application, ApplicationAnswer, ApplicationReview, Ticket, TicketMessageReference, TicketTranscript, Session, SessionAttendance, Incident, CallAssignment, RadioMessage, Unit, CivilianCharacter, VehicleRegistration, TrafficStop, Citation, Arrest, Charge, PenalCode, Warrant, Bolo, Investigation, Evidence, FireIncident, EMSReport, TowRequest, CourtCase, Notification, MediaAsset, PanelMessage, SecurityIncident, AuditEvent, and role/permission relationships. Add indexes and constraints for uniqueness/concurrent changes.

Implement strong input validation, parameterized DB access, Discord interaction signature handling where relevant, minimal gateway intents, rate limits, CSRF/session protections for web forms, file upload validation, HTML escaping/anti-XSS protections, encrypted secrets in deployment, private evidence storage, action audits and backups. Don't use mass-mention defaults. Don't scrape Roblox or Discord accounts, collect passwords, or require unnecessary personal data.

Test at minimum:
1. Bot boots with demo environment, slash commands register, panels deploy and work after reboot.
2. Staff applicant applies in DMs, saves/resumes, submits, reviewer accepts/denies, applicant receives correct DM or failure is logged.
3. Ticket creates with correct private permissions, claim/close/reopen works, transcript saved and not public.
4. Moderation/staff promotions/infractions correctly enforce rank privileges, update roles and log actions.
5. Unauthorized users cannot press security/admin buttons or access restricted CAD pages via direct URLs.
6. SSU -> active -> SSD handles concurrent clicks and persists attendance/logs.
7. ER:LC API mock scenarios: success, bad key, rate limit, timeout, missing fields, stale data.
8. CAD incident -> assigned units -> officer update -> report -> close persists and updates real-time clients.
9. Person/vehicle lookup respects fictional ownership and department permissions.
10. Brand graphics load, white icon fallback works, Components V2 payloads are valid and responsive layouts work on mobile.
11. Owner protection, ticket complaint conflict restrictions, double review prevention and audit entries work.
12. No secret keys or tokens appear in browser source, screenshots or logs.

Build a command inventory and mark each `implemented`, `tested` or `deferred` truthfully. Never state “everything is complete” unless tests and actual behavior support it. Include a demo-data mode; production defaults should not populate fake warrants, bans or staff histories.

## 16. HOW TO WORK AND FINAL HANDOFF

Work in a practical sequence:
**Phase 1:** runnable monorepo, database, configuration, Discord login, slash-command loader, Components V2 renderer, branding, auth, permission core.
**Phase 2:** DM staff applications, tickets, their review panels, notifications and audit logs.
**Phase 3:** staff management, infractions, promotions, moderation, security, rules, SSU/SSD and real ER:LC adapter.
**Phase 4:** large CAD/MDT portal, real-time dispatch, map, roleplay databases, civilian portal, fire/EMS/DOT/courts and cross-platform sync.
**Phase 5:** integration tests, deployment, visual QA, documentation, owner setup and final bug fixes.

Start writing runnable project files immediately. Do not respond with only a high-level plan. Keep the build functioning at every checkpoint. If coding environment or tool budget is limited, prioritize a working complete vertical slice and state exactly what remains; do NOT invent completion. Never silently omit the DM application system, staff-security system, ticket system, sessions or CAD core—these are mandatory.

On handoff, show:
- Actual project tree and files created.
- Exact commands for Windows PowerShell to install, configure, register slash commands, migrate database, run bot, run web and run tests.
- `config/ids.ts` and `.env.example` highlighted, with a table of required vs optional IDs.
- Which attached banner is used for which panel.
- Instructions to create/upload custom **white** Discord guild emojis and paste their IDs.
- Discord developer portal permissions/intents and invite link generation (without inventing credentials).
- ER:LC API Pack/key instructions and what the integration can/cannot do.
- A verified working-features checklist and test results.
- Local CAD URL and deployment instructions.

**FINAL GOAL:** An exceptionally polished, secure, feature-rich, actually functional **Los Angeles State Roleplay** operations Discord bot and companion ER:LC CAD website. Staff applications happen privately in DMs and are reviewed in a configured Discord channel; acceptance/denial notifications go back by DM; staff security and role protections work; staff infractions and promotions are auditable; tickets are private and complete; sessions are branded; rules/CAD/security/applications/tickets have topic-appropriate Los Angeles State Roleplay visuals; everything is configurable by pasting IDs into one obvious file, with secrets in environment variables. Prioritize usability, realism, branding and reliability over flashy but broken features.
