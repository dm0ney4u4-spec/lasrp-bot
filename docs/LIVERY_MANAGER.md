# NYCRP Livery Manager

Implemented on `feature/livery-manager`, branched without resetting the existing uncommitted website/bot work. This addition does not redesign the website, change CAD routes/authentication, publish Discord commands, or apply a production migration. The bot presence is also configured to show the exact requested custom state **🎃Happy Halloween🎃** when the updated bot connects.

## Authorization

Only the exact Discord user ID string `1425577335637413961` is allowed. No guild owner, Administrator, developer, role, management group, or alternative configured owner overrides this check.

- `LiveryManager.interaction` runs before the bot’s generic acknowledgement and dispatch. It checks every slash command, autocomplete, `lv:` control, select, and modal before storage/options/network access. Alternate `livery:` and `ls:livery:` controls are intercepted and guarded too.
- Every service entry point also checks the same identity before reading or writing records. Future web adapters must derive this identity from a **verified existing OAuth session**, never a request body, header, query parameter, or client-supplied ID.
- Unauthorized repliable interactions receive exactly `Access Denied: You are not authorized to use the Livery Management System.` privately. Autocomplete interactions can only return choices under Discord’s protocol, so unauthorized autocomplete returns an empty list and logs the denial.
- Denial logs are local `data/livery/security.ndjson` entries containing only timestamp, actor ID, and interaction kind. They contain no input fields, attachment URLs, asset inventories, credentials, or tokens. Failed operations log error type only.
- All authorized command outputs are ephemeral. Read-only catalog commands are restricted too. Autocomplete offers at most 25 matching choices. Sessions expire after ten minutes, deletion confirmations after two minutes; mutations recheck current record versions.
- No HTTP endpoints were added. Existing management/config APIs cannot read this separate table. There is no unauthenticated livery website integration or public asset browser.

## Storage and explicit setup

The modular service uses the existing PostgreSQL connection through Prisma’s parameterized SQL methods. The `LiveryLibrary` table is isolated from guild state and CAD tables; JSONB documents are versioned and updated with compare-and-swap checks. The document schema validates records, catalog entries, customizable department ranks, and the latest 500 operation audit entries. Concurrent stale edits/deletes are rejected. Imports are validated before any write and apply atomically.

The additive, idempotent SQL lives at `packages/livery/sql/001_library.sql`, **outside the automatic Prisma startup migration directory**. No existing Prisma model/migration was edited. This table is managed by this explicit module setup; include its schema in any future reviewed schema consolidation before running development drift/reset workflows. Backups should include all PostgreSQL tables, including `LiveryLibrary`.

When you choose to activate the feature, with Node 22.12+ and the existing `.env` configured:

```powershell
cd "C:\Users\erlcl\Downloads\nyc main bot"
npm ci
# Ensure the existing PostgreSQL server from your current setup is running first.
npm run livery:setup
npm start
```

For the existing Windows portable PostgreSQL installation, if it is stopped, start it using the existing setup/recovery instructions or the supplied native tool:

```powershell
& ".\data\portable-postgres\pgsql\bin\pg_ctl.exe" start -D ".\data\postgres-durable" -l ".\data\postgres-server.log" -o "-h 127.0.0.1 -p 54328" -w
```

Do not create or reset an existing database. `DATABASE_URL` must point to that same PostgreSQL server. The setup command creates only the new table and loads the reviewed official template catalog snapshot; it imports no livery code records and touches no existing records. It has **not** been run against the configured user database during implementation. If the table is missing, livery commands show a setup error while unrelated bot functions remain usable.

`npm start` is your explicit activation step: the existing bot startup registers the full guild command set, including `/livery`, and applies the Halloween presence. Do not run a second live bot process concurrently. Follow the existing `npm stop` workflow before a planned restart. No live startup, command registration, or deployment was performed for this feature build.

## Commands

| Command | Function |
|---|---|
| `/livery list [department]` | Paginated inventory and private record dropdown. |
| `/livery search query` | Search vehicle, name, unit, attribution, and notes. |
| `/livery view id` | Paginated exact decal slots, colors, labels, credit, source, installation, and verification. |
| `/livery add department vehicle name [rank] [division]` | Create an initially incomplete/unverified record. No IDs are invented. |
| `/livery edit id [file]` | Display an Edit button for a private full-JSON modal; attach a single JSON record for larger replacements. |
| `/livery delete id` | Show a revision-bound private confirmation; no immediate deletion. |
| `/livery import file [kind]` | Import JSON/CSV liveries or a documented JSON vehicle catalog. |
| `/livery export format [department]` | Private JSON/CSV attachment; export size capped at 8 MiB. |
| `/livery verify id assets approval tested evidence` | Record owner-observed availability/review and manual test evidence. |
| `/livery missing [department] [catalog]` | Find missing required slots, or catalog entries without livery records. |
| `/livery stats` | Counts of records, incomplete designs, documented templates, and owner-attested tests. |
| `/livery department department` | Department inventory. |
| `/livery vehicle action [vehicle] [department]` | Browse names or refresh the official public template directory. |
| `/livery rank department [rank] [configure]` | Filter ranked records, list ranks, or configure comma-separated department labels. |
| `/livery preview id` | Show a supplied reference where allowed; report missing artwork honestly. |

Department categories: LAPD, LASD, CHP, LAFD, LADOT, CALTRANS, SPECIAL_OPERATIONS. Default rank examples match the requested ladders and are customizable. A rank currently used by a record cannot be removed. These labels **do not enforce Roblox vehicle spawning**. Department permission roles do not grant livery access.

## Record editing and import

`imports/liveries/README.md` and `input-template.json` document importing your files. Both requested original TXT files are missing from the repository, so no real livery code pack has been imported. Free-form prose is not guessed into positions or credits. Structured TXT/JSON or exported CSV should be used instead.

The required input fields are `department`, `vehicleName`, and `name`. The service retains vehicle category, multiple `position`/`assetId` slots under `front`, `rear`, `left`, `right`, `top`, required-side definitions, colors, rank, division, creator, source, instructions, notes, and optional preview. IDs are strings up to 30 digits; `null` marks missing assets. Front/rear/left/right/top slot lists default empty. Only remove a side from `requiredSides` after checking the official template. The bot does not infer nonexistent roof or trailer slots.

Source and preview URLs must use HTTPS without embedded credentials. Preview images are rendered only for allowlisted Discord/Roblox image hosts; other HTTPS references are preserved in the record/export without server-side fetching. Imports download only bounded Discord attachments, reject redirects and arbitrary URL hosts, limit input to 1 MiB/500 records, and never fetch creator sites or bypass restrictions.

CSV supports RFC 4180 quotes, commas, multiline fields, BOM, and JSON slot arrays. Spreadsheet formula-like cells are escaped on export and unescaped on re-import; use JSON backups if exact raw text and types are needed outside this tool. Decal IDs remain quoted exact strings. Duplicates use normalized department/vehicle/name/rank/division; invalid batches roll back, duplicate entries are skipped, incomplete entries remain MISSING. Imported approval/test claims are not trusted. Editing a verified design clears its verification and increments its revision.

For manual `/verify tested:true`, every required decal must exist, assets must be owner-observed AVAILABLE, review APPROVED, and a documented vehicle must exist for that department. Evidence is mandatory. The result is explicitly **owner-attested**, not an automated Roblox/PRC approval check. Vehicle confirmation is scoped to the tested department; testing LAPD does not prove LASD or CHP compatibility. Recheck after game changes; timestamps are historical observations, not a guarantee of future support.

## Catalog sources and limitations

The source snapshot contains **86 template entries** from the Law Enforcement, Fire Department, and DOT branches of the public [official template directory](https://drive.google.com/drive/folders/189nYv-AOsjcROfpRF_Chx9ls0_-LsRG5), linked directly by [ER:LC](https://erlc.gg/). The discovery tool distinguishes category folders from vehicle names, retains their official names, associates the requested organizational departments with the relevant source team, and records source URLs/timestamps. It does not invent a separate vehicle for each rank, K-9 marking, slicktop, or command assignment. Compatibility of motorcycles, ATVs, trailers, and all other variants cannot be guaranteed merely because a template exists or a user requests them.

Refresh the source snapshot locally, without database writes or deployment:

```powershell
npm run livery:catalog
```

The parser reads public folder data as JSON without evaluating remote scripts, uses HTTPS/timeouts, and fails closed if the source structure changes. It cannot guarantee that Google’s listing or the published templates enumerate every current in-game compatible model. Catalog refreshes do not delete existing entries. Use manual documented catalog imports to extend coverage when supported additions are confirmed. No current-game compatibility testing was performed in Roblox during this implementation.

No upload/install endpoint was found in the reviewed official [API documentation index](https://apidocs.erlc.gg/llms.txt). The manager contains **no automatic upload/install or ER:LC command call**. Installation remains manual through the current game editor and review process. Asset ownership, creator licensing, paywalls, and reuse permissions remain with their creators; the bot makes no rights assertion. See the official [livery guidelines](https://erlc.gg/policies/livery-ad-guidelines).

## Verification and changed files

Final local verification: TypeScript check and root build passed; all **93 regression tests** passed, including **14 livery tests**. SHA-256 comparison of **83 existing protected source files** found no changes to website, CAD/API, configuration, or the existing Prisma schema during this feature. Live Discord delivery and actual Roblox/ER:LC artwork compatibility still require activation and manual testing.

Run locally:

```powershell
npm run check
npm exec -- tsx --test tests/livery.test.ts
npm test
```

Tests use in-memory repositories and an isolated PostgreSQL-compatible PGlite instance; they never change live guild members, upload assets, register commands, or connect to the user database. Coverage includes every slash action, exact-ID denial before storage, direct-service denials, Administrator/owner non-bypass, buttons/selects/modals/autocomplete, pagination, exact precision strings, CSV/JSON, duplicate handling, incomplete data, revision conflicts, manual verification, real SQL persistence, and unchanged existing test fixtures. `tests/integration.test.ts` now uses an OS-assigned temporary port because the old fixed port was reserved by Windows; production ports were not changed.

See `docs/LIVERY_MANAGER_FILES.txt` for every file added/modified for this feature. Pre-existing website and bot edits remain separate uncommitted work. A hash comparison verifies that `apps/site`, `apps/web`, `apps/api`, `config`, and `prisma/schema.prisma` have not changed during the livery feature work. The SQL/table is deliberately opt-in; no website management integration is claimed.
