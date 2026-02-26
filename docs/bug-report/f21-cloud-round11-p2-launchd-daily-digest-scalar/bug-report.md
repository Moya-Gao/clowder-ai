---
feature_ids: [F021]
topics: [cloud, round11, launchd]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: F21 Cloud Round11 — launchd daily_digest YAML 标量解析不完整

> 日期：2026-02-20  
> 报告人：Cloud Codex Review（PR #30 round11）  
> 定位/修复：缅因猫（砚砚）  
> 严重度：P2

## 1. 报告人

- 报告来源：cloud round11 自动 review
- 问题：`scripts/signal-fetcher-launchd.sh` 的 `read_schedule_from_notifications` 仅匹配无注释且有限 quote 形式的 `daily_digest`。

## 2. 复现步骤（期望 vs 实际）

1. 创建 `config/notifications.yaml`，包含：
   `daily_digest: '09:45' # local morning digest`
2. 运行：
   `SIGNALS_ROOT_DIR=<tmpdir> bash scripts/signal-fetcher-launchd.sh print-plist`
3. 查看输出 `StartCalendarInterval`。

期望行为：
- 解析到 `09:45`，输出 `<integer>9</integer>` 与 `<integer>45</integer>`。

实际行为（修复前）：
- 未匹配该 YAML 写法，回退默认 `08:00`，输出 `<integer>8</integer>` 与 `<integer>0</integer>`。

## 3. 根因分析

- 原实现使用单条严格 sed：
  `daily_digest:[space]*"?(HH:MM)"?` 且行尾必须结束。
- 该模式无法覆盖：
  - 单引号写法（`'09:45'`）
  - 行内注释（`# ...`）
- 导致合法 YAML 标量被漏解析，进入默认时间回退逻辑。

## 4. 修复方案（为何选择）

- 将 schedule 提取改成三条 sed 规则并行匹配：
  1. 双引号
  2. 单引号
  3. 无引号
- 三条规则统一允许末尾空白和可选行内注释 `(#.*)?`。

Why：
- 保持脚本依赖不变（纯 bash/sed），改动最小，覆盖 cloud 指出的合法 YAML scalar 变体。

Tradeoff：
- 仍是“按行文本提取”，不是完整 YAML parser；但对 `daily_digest` 固定 `HH:MM` 场景足够，且维护成本低。

## 5. 验证方式

### Red（先失败）

- 新增测试：
  `packages/api/test/signal-fetcher-launchd-script.test.js`
  - `parses single-quoted daily_digest with inline comment from notifications.yaml`
- 修复前结果：FAIL（仍输出 08:00）。

### Green（修复后通过）

```bash
pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetcher-launchd-script.test.js
# => 3/3 pass

pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetch-scheduler.test.js test/signal-fetch-script.test.js test/signal-fetcher-launchd-script.test.js
# => 17/17 pass

pnpm -r --if-present run build
# => pass（web 仅既有 lint warning）
```
