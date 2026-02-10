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

For personal Redis:

```bash
./scripts/user-redis.sh restore --source /path/to/dump.rdb
```

## 3) Retention settings (for long-term / permanent storage)

Default behavior:
- `MESSAGE_TTL_SECONDS` = 7 days (default)
- `THREAD_TTL_SECONDS` = 30 days (default)
- `TASK_TTL_SECONDS` = 30 days (default)
- `SUMMARY_TTL_SECONDS` = 30 days (default)

Set TTL to `0` or a negative number to disable expiration:

```bash
export MESSAGE_TTL_SECONDS=0
export THREAD_TTL_SECONDS=0
export TASK_TTL_SECONDS=0
export SUMMARY_TTL_SECONDS=0
```

Recommended for durability:
- Keep `appendonly yes` (already enabled in `start-dev.sh` and `user-redis.sh`)
- Take periodic backups with `pnpm redis:user:backup`
- Keep backup files outside the repo and sync them to external storage
