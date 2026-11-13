# New York City Roleplay rebrand

Updated the existing bot, website and CAD in place. The configured Discord guild was verified from the supplied CAD and regulations channel IDs; it is the same guild (`1529507818452029650`), now named New York City Roleplay. No replacement bot, database, or authentication system was created.

## Published panels

- Regulations: https://discord.com/channels/1529507818452029650/1561876833065115790/1570610429942693970
- Departments: https://discord.com/channels/1529507818452029650/1529556540414234784/1562260446445051954
- New CAD channel: https://discord.com/channels/1529507818452029650/1570599969071562812/1570610443183980634
- Existing staff application panel updated: https://discord.com/channels/1529507818452029650/1557893259840458792/1561879867149258853

Regulations use a single Components V2 container with a dropdown for Discord and in-game regulations, the exact supplied custom emoji IDs, private category responses, acknowledgments, and both Discord/Roblox terms links. The existing conduct and roleplay rules were retained. Website regulations use an explicitly public-only JSON source; private staff policies never enter the public bundle.

Department dropdown selections use the supplied NYPD, NYCSO, NYFD and NYDOT emoji IDs and exact invite links. Each private department response uses the corresponding artwork. The supplied NYCSO file visibly says “DOT Department”; its pixels were preserved rather than silently altered. No NYFD banner was attached; the existing `Downloads/nyfd.png` fire emblem was found and used. General fill panels use the plain New York City Roleplay artwork. Assistance, regulations, logo and footer artwork have their own mappings. Original old filenames are retained as compatibility aliases containing the new images.

The bot username and guild nickname are New York City Operations; bot avatar and application icon were updated. Its presence now says New York City Roleplay. The separate developer application name is still **Galveston Operations**. Discord's documented bot application-edit API does not expose a name field. A safe authenticated Developer Portal tab is needed to change that label. The existing personal Edge window was blocked by automatic review because it could expose unrelated Google Docs; the isolated browser host was unavailable. No unrelated browser contents were read or changed.

The PRC API still reports the actual ER server name **Los Angeles Roleplay I No VC**. The website's community heading uses NYC branding, while the API preserves truthful upstream metadata. Rename that server inside ER:LC private-server settings; this update did not fabricate upstream data or change the existing API key/join code.

Canonical website department URLs are `/departments/nypd`, `/departments/nycso`, `/departments/nyfd`, `/departments/nydot`. Legacy LA department URLs redirect; old backend department aliases remain accepted. NYSP is the renamed, inactive former highway-patrol placeholder, with no invented invitation or permissions. Verified membership/command role bindings remain required as before.

Existing database IDs, session-cookie names, custom interaction IDs, CAD approval records and historical applications/audits were preserved. A private PostgreSQL backup was made before saved-template updates. Livery display departments normalize legacy LA labels on read; the original `LASRP_LIVERIES` database key is deliberately retained so existing liveries remain accessible. No decal IDs, verification evidence or asset availability were invented. The GitHub repository/workspace names remain compatible with existing local paths and source links.

## Tickets — next configuration step

The existing private ticket implementation has been rebranded, including V2 cards, categories, claiming, participant controls, escalation, priority, closure/reopening, transcript storage and decision DMs. It uses the NYC Assistance banner. It is not deployed to a guessed channel.

Still needed: ticket panel channel ID, ticket category ID, ticket log/transcript channel ID, and support-team role ID(s). Existing configured management roles remain available for restricted complaints/escalation. Once those bindings are supplied, wire/publish the assistance panel and verify live creation/closure/logging in the chosen channels. Do not ask the user for already-known management IDs unless they want different escalation roles.

## Verification

Bot/CAD and website production builds and public-output secret audit passed. All 117 backend tests and 60 responsive browser tests passed, including NYC banner mapping, dropdown IDs, legal links, regulations category switching, legacy-route redirects, private-policy exclusion, CAD admission/revocation, authentication, and existing bot/livery regressions. Published messages were fetched back from Discord: V2 flags, exact emoji IDs, absence of old LA text, and resolved logo/banner/footer media were confirmed. The existing bot and PostgreSQL are online. No public website deployment or merge into main was performed.
