# Startup recovery and durable local PostgreSQL

The startup failure was reproduced: the embedded local database had an invalid WAL checkpoint after an interrupted shutdown. The original data/local-postgres-20261019 directory was preserved. Recovery was performed only on data/recovery-backups/current-recovery-work using PostgreSQL's recovery tool, then the readable records were exported and restored into a freshly initialized database.

Current operation uses DATABASE_MODE=portable and the official PostgreSQL 18.6 Windows binaries under data/portable-postgres/pgsql. Data is stored in data/postgres-durable. This server listens only on 127.0.0.1:54328, uses SCRAM password authentication, and runs with fsync, synchronous_commit, and full_page_writes enabled. Its password and connection URL are in .env; never share that file. The server log is outside the database directory at data/postgres-server.log, avoiding a Windows file-sharing conflict during crash recovery.

Recovery verified 28 public tables and 33 rows immediately after restore, including one application, one transcript, the guild configuration and 23 audit records. Normal database constraints accepted the restored rows. This validates the records recovered from the copy; it does not prove that every write immediately before the crash survived. The original damaged files, repaired copy, recovered-records.json export, and restore-validation.json are retained under the ignored data folder. The older data/local-postgres directory from the earlier incident remains preserved separately and has not been merged.

## Run on Windows

Open PowerShell in the Los Angeles Bot project directory and run:

```
npm start
```

Keep the window open. START_LASRP.cmd does the same thing from the correct folder. Normal startup launches the portable PostgreSQL process, applies missing migrations, starts CAD, and connects the Discord bot. There is no separate database installer or Windows service to configure.

If it reports **LASRP is already running**, the existing instance is healthy; open http://localhost:3000. To restart:

```
npm run stop
npm start
```

STOP_LASRP.cmd also safely closes the bot and database. Avoid Task Manager force termination. If an interruption does happen, native PostgreSQL can replay its WAL on the next startup. A process lock also prevents two startups from opening the same database concurrently.

A clean stop/start, duplicate-start check, recovered-record counts, Discord/database health, and PostgreSQL durability settings were verified. The TypeScript check and automated tests also pass. The hosting Docker configuration continues to use DATABASE_MODE=postgres with its separately hosted PostgreSQL server.

For backup or moving this project to another Windows computer, preserve .env, data/postgres-durable, data/portable-postgres, and data/evidence; take database backups with the server stopped or use PostgreSQL's logical backup tool. Do not copy live database files as a verified backup. Recovery exports and transcripts can contain private application/staff information; do not publish the data directory.

Sources: [PostgreSQL pg_resetwal recovery guidance](https://www.postgresql.org/docs/18/app-pgresetwal.html), [official Windows binary distribution](https://www.enterprisedb.com/download-postgresql-binaries).
