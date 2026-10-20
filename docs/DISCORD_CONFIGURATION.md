# Discord configuration update

The requested panels are deployed:

| Purpose | Channel |
|---|---|
| Staff application entry | 1557893259840458792 |
| Private application review | 1529672366202814715 |
| CAD information and website | 1557887343472676916 |
| All session announcements and live status | 1529553843199807590 |
| Community rules | 1561876833065115790 |

Promotions and infractions allow High Rank (1529545769462272140) and Senior High Rank (1529545703024627754), subject to target hierarchy and protected-owner checks. Moderation and session commands require Senior High Rank. Other management roles do not bypass those two command restrictions. CAD panel deployment requires the actual Discord guild owner, including through the panel studio. White shield, check, and close icons are uploaded as application-owned custom emojis.

The four session actions are `/ssu`, `/ssd`, `/session vote votes:10 minutes:15`, and `/session boost`. Votes, boosts, and startup announcements mention only roles 1557914073889509486 and 1529610820588146700. A vote reaching its yes target mentions its creator once in the sessions channel. SSD uses a private confirmation and posts the shutdown publicly in the designated sessions channel. The live population/queue panel refreshes every minute; absent or stale API data is labeled unavailable.

There is no `/apply` command. Entry is through the application channel button; questions are answered in DMs, once and in order. There are no pause, previous-question, or edit controls. Answers and each application's question list are saved durably; a closed Discord client cannot be prevented, so reopening DMs retains the current question rather than offering an editable rewind. Stale answer modals are rejected. Reviews contain all final answers in one paginated Components V2 message with Accept and Deny buttons; decisions send DMs and record delivery failures. Recruitment remains closed until management explicitly uses `/applications open` (or Admin recruitment settings).

## Fix CAD Discord sign-in

The live diagnostic accepted the OAuth client secret, but Discord returned an empty `redirect_uris` list. In [the application's OAuth2 settings](https://discord.com/developers/applications/1561426484554506270/oauth2), add and save this exact redirect:

```
http://localhost:3000/auth/callback
```

Then open http://localhost:3000 and choose Continue with Discord using an account in the LASRP server. Use localhost consistently; the app normalizes the login hostname to WEB_BASE_URL. Login failures now show understandable explanations instead of a raw JSON error. No real browser authorization was completed during this update.

For public hosting, set WEB_BASE_URL to the public HTTPS origin and register `https://YOUR-DOMAIN/auth/callback` instead. Localhost only works on the computer running LASRP. The deployed CAD panel explains the current local hosting status. The bot-token API cannot edit OAuth redirect settings; use your developer account in the portal. [Discord OAuth documentation](https://docs.discord.com/developers/topics/oauth2).

## Start and stop on Windows

Double-click START_LASRP.cmd, or run `npm start` from the project directory. Keep the window open. There is no Discord command that starts an offline bot: the process must run on a computer or hosting service first.

Use STOP_LASRP.cmd or `npm run stop` to close the running service and save the database. The stop helper uses a random local-only control token saved under the ignored data folder. Never share that file. Avoid ending Node in Task Manager or powering off during writes.

Move **Los Angeles Operations** above every staff rank it must grant/remove or moderate in Server Settings > Roles. Its discovered position was 1, below the staff ranks. Administrator permission does not bypass Discord's role hierarchy. The code preserves these hierarchy checks.

## Preserved database incident

The original `data/local-postgres` database failed to open with an invalid WAL checkpoint. Removing its stale process marker did not repair the checkpoint. Its files remain preserved, and a full pre-repair copy is in `data/recovery-backups/before-startup-repair-20261019`.

Normal service now uses the separate `data/local-postgres-20261019` database, selected by LOCAL_DATABASE_PATH in .env. It contains the new panel publications. Existing records in the damaged original database have **not** been restored into this database. Do not delete or overwrite either preserved directory. Do not point multiple running processes at one embedded database. Public deployment should use PostgreSQL as documented in PRODUCTION_DEPLOYMENT.md.

Validation: 67 automated tests passed, including immutable answers, stale-modal rejection, exact session-role checks, four session actions, restricted ping allowlists, vote-author notification deduplication, and honest telemetry display. Discord REST confirmed the deployed Components V2 messages, absence of apply commands, CAD panel-only command, and four session actions. Live moderation, promotions, session pings, and applicant decision DMs were not exercised against real members during verification.

Automatic staff-team badges and the full discipline ladder now follow [STAFF_WORKFLOWS.md](STAFF_WORKFLOWS.md). All supplied staff/discipline role IDs were found; the bot role was verified above all configured ranks. Existing private log visibility for Ownership is allowed for logging checks without granting that role new global bot permissions.
