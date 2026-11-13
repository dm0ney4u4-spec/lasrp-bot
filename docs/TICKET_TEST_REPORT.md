# Ticket verification — November 13, 2026

## Automated checks

- `npm run build`: passed (TypeScript plus CAD esbuild bundle).
- `npm test`: **137 passed, 0 failed**. This includes 20 advanced-ticket tests and existing PostgreSQL CAD, Discord OAuth/session/CSRF, CAD admission/WebSocket, staff application, moderation, livery, ER adapter, public status and panel tests.
- Ticket coverage includes both staff prefix commands, required/optional reasons, creator-only request decisions, duplicate requests, expiry, revoked requester permissions, simultaneous approvals, restart recovery and safe failure when transcript logging fails.
- SQLite tests use temporary real on-disk WAL databases, including two concurrent database connections. Discord transport is mocked for deterministic permission, failure and recovery coverage.

## Live Discord checks

Connected to the existing bot and server using the configured private token. Verified all three category IDs, their support/viewer role IDs, three custom emojis, banner files and private transcript log. The log denies @everyone visibility.

A controlled live General Support ticket **#0001** completed successfully:

- Private channel created under the configured category: `1570785963129442526`.
- Creator and General Support role notification sent with an explicit mention allowlist.
- Claim saved; Discord accepted the green claimed channel name and refreshed V2 controls.
- Actor-bound close confirmation created and consumed by the authorized test operator.
- All three retrievable messages captured into one HTML transcript with a saved SHA-256 manifest.
- Final summary and HTML attachment delivered to private transcript channel `1530312641728217189`, message `1570785984608604301`.
- Creator DM delivery succeeded.
- Channel deleted only after successful transcript log delivery; final state is Closed. The persisted counter remains at 1, so the next new ticket starts at 0002.

Published the real public V2 panel, including both supplied images and the three custom-emoji options:

[Open the ticket panel](https://discord.com/channels/1529507818452029650/1569512860986380449/1570786219451744426)

Registered all **17** existing/new guild commands successfully, including `/ticket-panel` and `/ticket-admin`. Updated the existing bot account username and guild nickname to **New York Automation**. No additional bot was created.

## Remaining human/client checks

The live test exercised the service against real Discord REST/Gateway APIs; it did not impersonate a human clicking the dropdown/modal in the Discord client. Verify the public dropdown and modal visually on desktop/mobile, notification delivery under each member's mute settings, and the appearance of all banners. Automated interaction fixtures verify immediate modal acknowledgement, inquiry validation and persistent routing; they do not establish visual rendering on every Discord client.

Live escalation pings to the other two support roles were not sent during testing to avoid unnecessary notifications. Both escalation stages, no Department escalation, role access preservation, stale/repeated buttons, races, blocked DMs, log failures and restart recovery are covered by automated tests. Real blocked-DM delivery and deliberate production permission failures were not induced.

The later `-close` and `-closer` additions were verified through automated message/interaction fixtures and the same previously live-tested closure transport. They were not exercised by sending additional real-user messages or impersonating a member account. No user token is collected or used.

Node 22 emits an experimental SQLite API warning. SQLite is initialized and exercised successfully; this warning does not indicate a failed bot startup. The existing PostgreSQL data and migrations were preserved.
