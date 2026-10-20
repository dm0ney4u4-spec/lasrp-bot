# Staff ranks and discipline

Rank order and all role IDs are in config/ids.ts: staffRankRoles, staffTeams, and disciplineRoles. Select an individual rank with `/staff promote` or `/staff demote`; team badges update automatically. A member without a staff rank can be appointed to their first rank through promotion.

- Every rank receives Staff Team.
- Trial, Junior, regular, and Senior Moderator receive Moderation Team.
- Junior, regular, and Senior Administrator receive Administrative Team.
- Internal Affairs Team and every higher rank receive High Rank.
- Junior Manager and every higher rank receive Management Team.
- Senior High Rank and every higher rank receive Senior High Rank.

Changing ranks removes obsolete staff ranks/team badges. Unrelated roles are preserved. The acting member and bot must be above the roles being changed. Own-account and owner-target protections still apply. Automatic grants never add Administrator permissions.

`/staff infraction issue` now offers warning, strike, suspended, investigation, terminated, and zero tolerance. A warning adds the next warning badge; the third warning clears warning badges and adds a strike. Three strikes clear warning/strike badges, remove staff authority/rank/team roles, and add Terminated. Unrelated community roles remain. Third-warning and third-strike roles are configured as supplied, but escalation immediately converts those thresholds rather than leaving those threshold badges active.

`/staff suspend` and `/staff investigate` save the original staff roles, remove staff authority/rank/team roles, and add Suspended or Under Investigation. `/staff reinstate`, or removing the corresponding active infraction, restores the saved roles and removes the restriction marker. Suspension-revocation was interpreted as restoration, matching the investigation behavior and surrounding request. Restriction records survive restart. Newly privileged, deleted, or unmanageable roles are rejected on restoration.

Warning/strike cases can be revoked with `/staff infraction remove`. Revoke newer warning/strike cases first so conversion history remains consistent. Termination requires a separate management rehiring decision and is not silently reversed by removing an earlier warning. Zero Tolerance adds its supplied badge; no extra automatic punishment is inferred from that label.

Role changes save their intended before/after roles before contacting Discord. If Discord returns an uncertain failure, management must inspect the saved role operation and pending case before continuing. A hierarchy failure before any change marks the attempted case failed and does not leave a pending discipline lock. The implementation does not guess whether an uncertain role request succeeded.

Application review answers now stay in one Components V2 message. Short applications show several answers together; long applications use Previous/Next in the same message without truncation. Accept/Deny remain available. Existing review cards are refreshed on startup, and older bot-owned per-answer messages for those same stored applications are removed. Accepted trainees receive the configured trainee rank and Staff Team, subject to safe role permissions and hierarchy.

Verified with 73 automated tests, including real Prisma/PostgreSQL-wire application and staff workflow tests with mocked Discord role transport. No real member was promoted, disciplined, or messaged during automated testing.
