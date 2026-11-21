# Promotion replacement verification — November 20, 2026

- TypeScript checks and the project build passed.
- Full regression suite: **205 passed, 0 failed**. The promotion file contains 20 tests/subtests, including table-driven checks of every individual rank and permission alternative, plus actual PostgreSQL migration/transaction coverage with mocked Discord role operations.
- Existing ticket, session, application, infraction, authentication and CAD tests passed. The former legacy promotion regression now verifies that `/staff promote` is retired and that existing demotion retains unrelated roles using the new rank bundles.
- Additive PostgreSQL migration `202611200001_promotions` applied successfully to the existing local database; Prisma Client generation succeeded. No existing tables or staff records were reset.
- Discord registration verified: **`/promote user: rank: reason:`**, all three parameters required, with autocomplete enabled for rank. `/staff promote` is absent.
- Actual Discord diagnostics found **23 individual ranks / 39 managed roles**, with no missing configured roles and no required role above the bot. Manage Roles is available.
- Promotion announcement and log channels are available with the required permissions; the actual configured log channel is private. Custom icon `1530309174506950727` exists. The supplied banner, footer and NYC logo are present.
- The existing bot restarted successfully. Local health reports **database connected / Discord connected**.
- No real member was promoted, role changed or fake public promotion announcement sent during deployment verification. The new promotion table was empty at initial live verification; actual use begins through the confirmed `/promote` workflow.
- Source remains on `website-development`; no main merge or website production deployment was performed.

See [PROMOTION_SYSTEM.md](PROMOTION_SYSTEM.md) for exact behavior, configuration, permissions, recovery, setup and the handling of an uncertain operation requiring administrator review.

## Direct execution update

`/promote` now executes immediately after validation, without displaying confirmation controls. The public announcement and private success response include the mandatory reason. The existing promotion announcement was repaired in place using its saved reason, without pinging any user or role again; banner, logo and footer each returned HTTP 200 afterwards. The full 205-test suite passed with the direct execution behavior.
