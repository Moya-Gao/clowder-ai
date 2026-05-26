---
feature_ids: []
topics: [runbooks, redis, data]
doc_kind: note
created: 2026-02-26
---

# Redis Data Safety Runbook

## 1) Separate Redis profiles (do not mix user data and dev/test)

- Dev Redis (used by `scripts/start-dev.sh`):
  - Port: `6399` (default)
  - Data dir: `~/.cat-cafe/redis-dev`
  - Backup dir: `~/.cat-cafe/redis-backups/dev`
- Personal Redis (new):
  - Script: `scripts/user-redis.sh`
  - Port: `6401` (default)
  - Data dir: `~/.cat-cafe/redis-user`
  - Backup dir: `~/.cat-cafe/redis-backups/user`

Commands:

```bash
pnpm redis:user:start
pnpm redis:user:status
pnpm redis:user:backup
pnpm redis:user:stop
```

Use personal Redis for app runtime (instead of dev profile):

```bash
REDIS_PORT=6401 pnpm start --quick
```

## 2) Find old dump files (Time Machine / mounted backups)

```bash
pnpm redis:dumps:find
```

If a useful `dump.rdb` is found, inspect it first:

```bash
./scripts/redis-forensics.sh --dump /path/to/dump.rdb --ports "6399"
```

Then restore to target Redis port:

```bash
./scripts/redis-restore-from-rdb.sh --source /path/to/dump.rdb --target-port 6399
```

恢复脚本现在会自动做两件事（避免 AOF/RDB 脱节）：
- 启动前把旧 `appendonlydir` 迁移到 `cat-cafe-redis-backups/appendonlydir.*.bak`
- 重启 Redis 时显式启用 AOF（`appendonly yes` + `appendfsync everysec`）

For personal Redis:

```bash
./scripts/user-redis.sh restore --source /path/to/dump.rdb
```

If only markdown chat exports remain, rebuild messages/threads from docs:

```bash
# Dry run (统计可恢复条目)
REDIS_URL=redis://127.0.0.1:6399 pnpm redis:md:restore:dry-run

# Apply (先自动做 pre-apply 快照，再导回)
REDIS_URL=redis://127.0.0.1:6399 pnpm redis:md:restore:apply
```

## 3) Retention settings (for long-term / permanent storage)

Current behavior when using `pnpm start`:
- `MESSAGE_TTL_SECONDS=0`
- `THREAD_TTL_SECONDS=0`
- `TASK_TTL_SECONDS=0`
- `SUMMARY_TTL_SECONDS=0`

`0` means persistent (no expiration).

Recommended for durability:
- Keep `appendonly yes` (already enabled in `start-dev.sh` and `user-redis.sh`)
- Take periodic backups with `pnpm redis:user:backup`
- Keep backup files outside the repo and sync them to external storage

## 4) Offsite auto backup (already scripted)

Install user Redis auto backup (launchd, default every 60 minutes):

```bash
pnpm redis:user:autobackup:install
```

Check status:

```bash
pnpm redis:user:autobackup:status
```

Run once immediately:

```bash
pnpm redis:user:autobackup:run
```

Default offsite path:
- If iCloud exists: `~/Library/Mobile Documents/com~apple~CloudDocs/CatCafeRedisBackups/user`
- Otherwise: `~/.cat-cafe/redis-offsite-backups/user`

## 5) Thread markdown exports retention (new)

Local recovery location:
- `.cat-cafe/thread-exports/repo/`

Thread markdown exports are generated recovery artifacts. Keep them outside `docs/`
so the evidence scanner does not treat raw thread dumps as curated discussion docs.

Automatic backend export (no manual download required):

```bash
pnpm threads:export:redis
pnpm threads:export:redis:dry-run
```

Autosave now runs backend export first, then offsite sync.

Optional: if you manually download `thread-thread_*.md`, sync still supports inbox import.
Default inbox:
- `~/Downloads/`
- If automation cannot read Downloads (macOS permission), use:
  - `THREAD_EXPORT_SOURCE_ROOT=~/.cat-cafe/thread-export-inbox pnpm threads:sync`

```bash
pnpm threads:sync
pnpm threads:status
```

Enable periodic autosave (launchd):

```bash
pnpm threads:autosave:install
pnpm threads:autosave:status
```

Default offsite path:
- If iCloud exists: `~/Library/Mobile Documents/com~apple~CloudDocs/CatCafeThreadExports`
- Otherwise: `~/.cat-cafe/thread-exports`
