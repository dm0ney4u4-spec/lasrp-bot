# Actual command inventory

Generated from the command builders; commands absent here are not registered. “Implemented” means a handler exists, not that it was tested in a real Discord guild. See TEST_REPORT.md for automated coverage.

| Command | Implementation | Validation |
|---|---|---|
| /activity | Implemented | Builder validation; live guild test pending |
| /moderate | Implemented | Builder validation; live guild test pending |
| /case | Implemented | Builder validation; live guild test pending |
| /security automod | Implemented | Builder validation; live guild test pending |
| /security status | Implemented | Builder validation; live guild test pending |
| /security lockdown | Implemented | Builder validation; live guild test pending |
| /security unlock | Implemented | Builder validation; live guild test pending |
| /security mode | Implemented | Builder validation; live guild test pending |
| /security test | Implemented | Builder validation; live guild test pending |
| /applications status | Implemented | Builder validation; live guild test pending |
| /applications open | Implemented | Builder validation; live guild test pending |
| /applications close | Implemented | Builder validation; live guild test pending |
| /applications panel | Implemented | Builder validation; live guild test pending |
| /setup validate | Implemented | Builder validation; live guild test pending |
| /setup wizard | Implemented | Builder validation; live guild test pending |
| /setup roles | Implemented | Builder validation; live guild test pending |
| /panel read | Implemented | Builder validation; live guild test pending |
| /panel deploy | Implemented | Builder validation; live guild test pending |
| /help | Implemented | Builder validation; live guild test pending |
| /cad panel | Implemented | Builder validation; live guild test pending |
| /erlc status | Implemented | Builder validation; live guild test pending |
| /erlc players | Implemented | Builder validation; live guild test pending |
| /erlc queue | Implemented | Builder validation; live guild test pending |
| /erlc message | Implemented | Builder validation; live guild test pending |
| /ssu | Implemented | Builder validation; live guild test pending |
| /ssd | Implemented | Builder validation; live guild test pending |
| /session vote | Implemented | Builder validation; live guild test pending |
| /session boost | Implemented | Builder validation; live guild test pending |
| /staff promote | Implemented | Builder validation; live guild test pending |
| /staff demote | Implemented | Builder validation; live guild test pending |
| /staff suspend | Implemented | Builder validation; live guild test pending |
| /staff investigate | Implemented | Builder validation; live guild test pending |
| /staff reinstate | Implemented | Builder validation; live guild test pending |
| /staff profile | Implemented | Builder validation; live guild test pending |
| /staff roster | Implemented | Builder validation; live guild test pending |
| /staff note | Implemented | Builder validation; live guild test pending |
| /staff training | Implemented | Builder validation; live guild test pending |
| /staff activity | Implemented | Builder validation; live guild test pending |
| /staff infraction issue | Implemented | Builder validation; live guild test pending |
| /staff infraction history | Implemented | Builder validation; live guild test pending |
| /staff infraction remove | Implemented | Builder validation; live guild test pending |

## Master-catalog items not registered in this release

The large master catalog is not completely implemented. Public command aliases such as /about, /ping, /server, /verify, /profile, /report, /suggest, /mytickets and /appeal are accessed through the working panel buttons or CAD where available, rather than registered as separate aliases.

Dedicated /ticket subcommands, application exports/history/cooldown/question commands, advanced staff suspension/reinstatement/transfers/resignations/evaluations, /mod purge/slowmode/lock/unlock, granular /security trust/protect/recovery commands, /dispatch and extended /cad action subcommands, /erlc kick/ban/unban/logs/command, and backup/config/audit management command families are deferred. Some equivalent actions exist in private ticket buttons, Admin recruitment settings, report/dispatch web pages, configuration files, and backup scripts; this does not mean their slash command aliases exist.
