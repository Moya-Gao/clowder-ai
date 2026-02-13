# Hindsight P0 Health Check Runbook

> 目标：用统一脚本检查 P0 治理三件套（`stats` / `tags` / `version`），避免无声退化。

---

## 1) 入口

脚本路径：

`scripts/hindsight/p0-health-check.sh`

---

## 2) 本地自测（不依赖 Hindsight 服务）

```bash
bash scripts/hindsight/p0-health-check.sh --self-test
```

预期：脚本退出码 `0`，并显示 `[PASS] self-test passed`。

---

## 3) 真实健康检查（依赖 Hindsight）

```bash
bash scripts/hindsight/p0-health-check.sh
```

默认配置：
- `HINDSIGHT_URL=http://localhost:8888`
- `HINDSIGHT_SHARED_BANK=cat-cafe-shared`
- `HINDSIGHT_HEALTH_TIMEOUT_SECONDS=5`

也可显式指定：

```bash
bash scripts/hindsight/p0-health-check.sh \
  --base-url http://localhost:8888 \
  --bank cat-cafe-shared \
  --timeout 5
```

---

## 4) 判定标准

脚本会检查：
- `GET /v1/default/banks/<bank>/stats`
- `GET /v1/default/banks/<bank>/tags`
- `GET /version`

失败门槛（返回非 0）：
- `stats.total_nodes == 0`
- `tags.total == 0`
- stats/tags 端点不可达

告警门槛（返回 0，但输出 WARN）：
- `/version` 不可达
- version payload 缺少 `api_version/version`

---

## 5) 故障处理

1. `stats.total_nodes == 0`
   - 先确认导入是否执行：`pnpm --filter @cat-cafe/api hindsight:import:p0 -- --all --dry-run`
   - 再执行真实导入并复查健康脚本。

2. `tags.total == 0`
   - 检查导入标签契约是否满足（`project/kind/status/author/origin/sourcePath/sourceCommit/anchor`）。
   - 抽样验证已导入文档的 tags，再重新导入。

3. `version` 告警
   - 记录当前输出并跑 smoke（stats/tags/recall）。
   - 若 API 字段变化，先更新脚本解析规则再恢复 gate。

---

## 6) 推荐接入点

- P0 验收前强制运行一次。
- 日常可在 `start-dev` 后手动跑一次，作为最小可观测基线。
