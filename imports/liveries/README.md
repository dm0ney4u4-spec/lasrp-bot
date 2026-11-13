# Existing NYCRP livery data

The repository search did not find either requested file:

- `ERLC_Los_Angeles_Livery_Codes.txt`
- `LAFD_ERLC_Livery_Codes_2026.txt`

Place your original files here, retain a backup, and preserve creator credits, source URLs, exact official vehicle names, positions, and colors. Nothing watches or silently imports this folder. Files in this folder are eligible for Git tracking: do not put tokens or confidential data here.

`official-vehicle-catalog.json` is a snapshot of vehicle folder names from the official ER:LC templates link at https://erlc.gg/. It contains 86 documented template entries across Law Enforcement, Fire, and DOT, not 86 independently verified current-game vehicles. Some models have separate team-specific templates. Every entry is `TEMPLATE_DOCUMENTED`; none is asserted to be supported in the current game. It contains no Roblox decal IDs.

`input-template.json` is an incomplete form with null decal IDs. It is not a usable livery or an asset pack. Replace the vehicle, slot labels, name, colors, credit, and source information with your actual source material. Do not invent unavailable information. Use `null` for missing IDs.

## Import through the bot

Only Discord user `1425577335637413961` can import, browse, or export. After database setup and explicit bot startup:

1. Convert valid source records to the documented JSON shape, or use the CSV exported by `/livery export format:CSV` as a column template. Free-form prose is not guessed into asset/position mappings.
2. Upload the file as the `file` attachment for `/livery import kind:Liveries`. JSON arrays, `{ "schemaVersion": 1, "liveries": [...] }`, and exported CSV are supported. TXT attachments may contain structured JSON; for CSV use a `.csv` extension.
3. Review the private result. Invalid input aborts the entire batch. Duplicate department/vehicle/name/rank/division combinations are skipped. Incomplete records are retained as MISSING.
4. Use `/livery view` or `/livery edit` to inspect the exact positions and credits.
5. Verify actual Roblox asset availability, ER:LC review, and compatibility manually. Imported approval/test claims are reset to UNVERIFIED. No asset is downloaded, uploaded, or installed by import.

Imports are capped at 1 MiB and 500 records per batch. Use multiple files for larger libraries. All numeric-looking decal IDs must be JSON strings; numeric JSON IDs are rejected to prevent precision loss.

For an additional vehicle catalog, attach a JSON array with `name`, `category`, `departments`, `sourceUrl`, and ISO `observedAt` fields to `/livery import kind:catalog`. Imported support claims are reset. Prefer `/livery vehicle action:sync` to refresh names from the official directory.
