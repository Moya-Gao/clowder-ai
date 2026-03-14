# Review Request: F118 Phase B — ProcessLivenessProbe + cli-spawn Integration

## What

Phase B 为 cli-spawn 增加了进程活性探针，替代原有的纯 stdout 超时检测。核心变更：

1. **ProcessLivenessProbe 类**（新建）— CPU 采样 + 状态分类 + 预警生成
2. **cli-spawn.ts 集成** — Promise.race 合并 NDJSON 事件流和探针轮询，bounded extension for busy-silent
3. **rawArchivePath 诊断增强**（Codex only）— CliRawArchive.getPath() 注入 __cliTimeout
4. **测试** — 11 个 probe 单元测试 + 2 个 cli-spawn 集成测试 + 1 个 rawArchivePath 测试

## Why

cli-spawn.ts 原有 watchdog 只看 stdout/stderr，30 分钟静默才发现问题，无法区分"死了/假死/忙着"。Phase B 用 CPU 采样（`ps -o cputime=`）做进程活性检测，分级预警让前端实时可见。

## Original Requirements（必填）
> "本质是我们的 CLI 都没有心跳！！我们只是看人家有没有吐东西！不过哦万一有进程但是假死咋办？"
> "跑着跑着@它没反应……我们这里的问题可观测性不足，不知道到底是我们的问题还是 Codex CLI 的问题"
- 来源：`docs/features/F118-cli-liveness-watchdog.md`（铲屎官原话区段）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Promise.race 替代 for-await**：增加了 ~30 行复杂度，但必须在 NDJSON 流之间插入探针轮询。保留了 `pendingNext` 复用模式避免重复调用 `.next()`
- **CPU burn 测试模式**：busy-silent 测试需要真实 CPU 增长（ps cputime 有 ~10ms 分辨率），用 `while (Date.now() < burnUntil)` 确保稳定性
- **cli-spawn.ts 346 行**（350 硬上限）：压缩了 JSDoc 腾出空间

## Open Questions

1. **OQ: 探针轮询间隔（sampleIntervalMs）和 Promise.race 超时用同一个值**——两个用途对间隔的需求可能不同。当前简化处理。
2. **OQ: bounded extension 是递归 resetTimeout()** — busy-silent 状态下每次超时触发都重新 resetTimeout()，直到 hard cap。这意味着最多延长到 2x 原超时。是否需要更精细的控制？
3. **Platform**: 当前只支持 macOS `ps -o cputime=`。Linux `/proc/stat` fallback 标记为"Not Building"。

## Next Action

请 @codex 做代码级 review（跨家族 review）。重点关注：
- cli-spawn.ts 的 Promise.race 模式是否有 race condition
- bounded extension 的 resetTimeout() 递归是否安全
- ProcessLivenessProbe 的 execFile 回调 + 状态更新是否有 TOCTOU 风险

## 自检证据

### Spec 合规
| AC | 状态 |
|----|------|
| B1: CPU 采样 + busy-silent 延长 + hard cap | ✅ |
| B2: idle-silent 不重置 timer | ✅ |
| B3: 进程死立即清理 | ✅ |
| B4: 分级预警 2min/5min | ✅ |
| B5: 前端可消费预警事件 | ✅ |
| A3-deferred: rawArchivePath Codex only | ✅ |

### 测试结果
- probe tests: 11/11 pass（3 次稳定性验证）
- cli-spawn tests: 30/30 pass
- `pnpm lint` → 0 errors
- `pnpm check` → 0 errors（biome clean）
- `pnpm check:dir-size` → cli-spawn.ts 346 lines ✅

### 相关文档
- Plan: `docs/plans/2026-03-14-f118-phase-b-liveness-probe.md`
- Feature: `docs/features/F118-cli-liveness-watchdog.md`

### Phase B 变更文件清单
| 文件 | 变更 |
|------|------|
| `packages/api/src/utils/ProcessLivenessProbe.ts` | **新建** — CPU 采样 + 状态分类 |
| `packages/api/src/utils/cli-spawn.ts` | 修改 — 探针集成 + bounded extension |
| `packages/api/src/utils/cli-types.ts` | 修改 — livenessProbe + rawArchivePath 选项 |
| `packages/api/src/domains/cats/services/session/CliRawArchive.ts` | 修改 — 新增 getPath() |
| `packages/api/src/domains/cats/services/agents/providers/codex-audit-hooks.ts` | 修改 — RawArchiveSink.getPath? |
| `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` | 修改 — rawArchivePath 注入 |
| `packages/api/test/process-liveness-probe.test.js` | **新建** — 11 个测试 |
| `packages/api/test/cli-spawn.test.js` | 修改 — 3 个新测试 |
