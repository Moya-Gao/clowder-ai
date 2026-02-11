# Worktree 开发环境配置

## ⚠️ 数据安全红线

**铲屎官的 Redis 6399 是圣域，绝对不能碰！**

本 worktree 已配置使用**开发 Redis 6398**（猫猫沙盒），请严格遵守。

## 快速启动

### 1. 复制环境配置

```bash
cp .env.local.example .env.local
cp packages/api/.env.local.example packages/api/.env.local
cp packages/web/.env.local.example packages/web/.env.local
```

### 2. 启动开发 Redis 6398（如果还没启动）

```bash
redis-server \
  --port 6398 \
  --dir ~/.cat-cafe/redis-dev-sandbox \
  --dbfilename dump-dev.rdb \
  --appendonly yes \
  --daemonize yes
```

### 3. 验证隔离生效

```bash
# 检查开发 Redis 连接
redis-cli -p 6398 ping  # 应返回 PONG

# 启动服务
cd packages/api && pnpm dev  # API 在 3102 端口
cd packages/web && pnpm dev  # Web 在 3000 端口

# 验证 API 连接的是 6398
curl http://localhost:3102/api/threads | jq
# 应该是空或测试数据，不是生产数据
```

### 4. 检查用户 Redis 未被碰

```bash
# 用户 Redis 应该保持不变
redis-cli -p 6399 dbsize  # 应该是原来的数量（如 307）
```

## 🚨 禁止行为

- ❌ 不设置 REDIS_URL 就启动服务
- ❌ 设置 `REDIS_URL=redis://localhost:6399`
- ❌ 运行可能写入 6399 的脚本

## 📋 相关文档

- CLAUDE.md 第 10 条：Worktree Redis 隔离铁律
- docs/bug-report/2026-02-10-redis-data-loss-incident/incident-report.md

---

*遵守规则，保护铲屎官的数据！🐾*
