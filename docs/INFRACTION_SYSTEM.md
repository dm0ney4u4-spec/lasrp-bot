# NYCRP infraction system

Run the bot from the project folder in the VS Code terminal with `npm start`. Check Discord configuration without posting or modifying roles using `npm run infraction:check`.

## Commands

- `/infract issue user punishment reason`: Notice, Warning, Strike, Suspension, Under Investigation, Termination or Staff Blacklist. Suspension accepts a duration such as `7d`, or prompts privately for a duration/indefinite choice.
- `/infract logs user`: private paginated history and case details.
- `/infract view id`: private case lookup.
- `/infract void id reason`: retains the original record, recalculates counters and flags dependent consequences for leadership review.
- `/infract suspension-end user reason`: explicitly restores saved roles after a fresh authorization and hierarchy check.
- `/infract investigation-end user outcome reason`: closes the investigation with the selected outcome.

Infraction changes require an executor-bound private confirmation. Permissions, individual ranks, current roles and database version are checked again when confirmed. Old staff discipline commands are removed. Promotions remain direct commands with public reasons.

## Configuration and hierarchy

`config/infractions.js` contains channel IDs, disciplinary roles, authorized issuer roles, reviewer roles, artwork and investigation restrictions. The announcement and private audit channels reuse the existing configuration. New warning/strike third-level IDs are configured; obsolete third-level IDs remain import aliases. Notice has no role by default. Secrets stay in backend environment variables.

The individual rank hierarchy is shared with promotions. Actors must have exactly one recognized individual rank and must outrank the target. Promotions also require the destination rank to be below the actor's individual rank. Auxiliary access roles, configured owner authorization and rank-lock overrides do not bypass this chain rule. A Director cannot promote another member to Director through the bot; the Discord owner must handle that manually. Self-infraction, protected owners and bot targets are rejected.

## Enforcement and records

Three warnings become one strike. Warning roles accumulate up to two; strike roles are exclusive. Three strikes cause termination. Counters come from persistent records, with existing history and role baselines imported on first use. Voiding never deletes evidence/history or automatically reinstates terminated staff.

Suspension, termination and blacklist remove every removable member role and add the relevant restriction marker. Everyone and managed integration roles remain. An unmanageable role granting staff privileges blocks enforcement. No kick or ban is performed. Former Staff is not automatically granted. Suspension expiration sends a review notification; it never silently restores roles.

Investigation preserves roles by default and blocks promotions. Configure `investigationRestrictions` as `none`, `staff` or `all`. Ending a restriction uses saved roles, fresh manageability checks and explicit confirmation. Persistent blacklist status blocks promotions and staff application acceptance even if someone manually removes its Discord marker.

Role changes use individual additions/removals, saved operation progress, transactional claims, verified results and rollback/restart recovery. An uncertain operation blocks further staff changes and requires management to compare the saved snapshot with Discord before reconciling; no success is announced for unverified enforcement.

## Evidence and privacy

Each root case gets an evidence thread under a restricted text parent dedicated to its issuer. Only the issuer and currently authorized reviewers/configured owners receive explicit access. Automated consequences share their root evidence. The bot refreshes parent permissions after enforcement and during maintenance. Discord Administrators inherently bypass channel overwrites; Discord cannot hide a channel from them.

Messages, links and attachment metadata are saved privately. Mark Evidence Submitted requires actual saved evidence; it records submission, not proof of guilt or an assessment of sufficiency. Investigations redact public and DM explanations; authorized detail views and restricted evidence retain the full reason. Public role mentions do not ping roles; only the affected user is mentionable.

## Installation and validation

The additive migration `202611200002_infractions` preserves existing tables and records. Local portable startup applies pending migrations. External PostgreSQL installations must run `npm run db:migrate`, then `npm run db:generate`, before restarting. Never reset the database.

Validation: `npm run check`, `npm run build`, and `npm test`. Automated tests cover progression, hierarchy, restrictions and restoration, confidentiality, evidence capture, legacy import, stale confirmations, rollback and restart recovery. Live role-changing actions are intentionally not performed on real members during tests.
