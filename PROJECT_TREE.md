# Actual project structure

```text
Los Angeles Bot/
  config/
    ids.ts                 # nonsecret IDs, permissions, policies, emoji IDs
    assets.ts              # supplied image mapping
    icons.ts               # custom white icon formatter + monochrome fallback
  assets/branding/
    la-logo.png
    sessions-banner.png
    applications-banner.png
    blank-blue-banner.png
    server-header.png
  apps/
    bot/src/
      main.ts              # TypeScript bot entry, registration and interactions
      applications.ts      # durable DM/web application workflows
      tickets.ts           # private ticket lifecycle and transcripts
      sessions.ts          # SSU/SSD, scheduling, votes, history
      staff.ts             # ranks, profiles, internal infractions
      protection.ts        # audit/security event detection and owner opt-in
      panels.js            # shared real Components V2 renderer/validation
      seeds.js, rules.json # default editable content
      service.js           # template, acknowledgment and utility workflows
      commands.js          # moderation/case/activity helpers
      access.js, replies.js, security.js, store.js, dashboard.js
    api/src/
      main.ts              # shared HTTP/WebSocket server and application routes
      auth.ts              # Discord OAuth, sessions and CSRF
      cad.ts               # CAD/MDT routes, RBAC and transactions
      cad-workflows.ts     # merge/transfer/self-dispatch, stops, charges and inbox
      evidence.ts          # encrypted private file uploads, integrity and custody
      agencies.ts          # Fire/EMS response, towing/impound/release
      erlc.ts              # documented v2 API adapter
      jobs.ts              # maintenance, API sync, attendance and reminders
    web/
      src/app.ts           # TypeScript CAD browser application
      public/
        index.html, cad.css, cad.js
        admin/             # private V2 panel editor
  packages/shared/src/
    database.ts, store.ts, permissions.ts, schemas.ts, errors.ts
    cad-workflow-schemas.ts, agency-schemas.ts
  prisma/
    schema.prisma
    seed.ts
    migrations/0001_initial/migration.sql
    migrations/0002_sessions/migration.sql
    migrations/0003_cad_workflows/migration.sql
    migrations/0004_private_evidence/migration.sql
    migrations/0005_agency_workflows/migration.sql
  scripts/
    setup.ps1, setup-env.ts, register.ts, demo.ts
    backup.ts, inventory.ts, smoke.ts
  tests/
    panels.test.ts, permissions.test.ts, erlc.test.ts, evidence.test.ts, integration.test.ts
  docs/
    MASTER_BUILD_PROMPT.md, WHITE_ICONS.md, SOURCES.md
  .env.example             # secret names and local DB example
  .env                     # local generated secrets; ignored; fill credentials here
  docker-compose.yml
  package.json, package-lock.json, tsconfig.json, .gitignore
  README.md, SETUP_CHECKLIST.md, BUILD_PROGRESS.md
  COMMAND_INVENTORY.md, TEST_REPORT.md, PROJECT_TREE.md
```

Generated `node_modules/`, local demo `data/`, and private backup files are excluded from source control. `apps/web/public/cad.js` is the actual browser bundle generated from the TypeScript source.
