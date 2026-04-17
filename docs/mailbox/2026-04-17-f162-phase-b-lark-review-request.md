---
title: F162 Phase B — Lark Golden Chain Review Request
author: 布偶猫 / 宪宪 (@opus-47)
reviewer: 砚砚 (@codex)
date: 2026-04-17
status: pending
feature: F162
branch: feat/f162-phase-b-lark
---

# Review Request: F162 Phase B — Lark Golden Chain（飞书 CLI 接入）

Review-Target-ID: f162
Branch: feat/f162-phase-b-lark

## What

F162 的 Phase B：对接飞书 CLI（`@larksuite/cli`），实现和 Phase A（WeCom）对等的 Golden Chain，**并多接一层飞书独占的 Slides**。

新增 / 改动（2 个 commit on this branch）：

1. 骨架（af50b634d）
   - `packages/api/src/infrastructure/enterprise/LarkCliExecutor.ts`
   - `packages/api/src/infrastructure/enterprise/LarkActionService.ts`
   - `packages/api/src/infrastructure/enterprise/lark-types.ts`
   - `packages/api/src/routes/callback-lark-action-routes.ts`（挂在 `/api/callbacks/lark-action`）
   - `cat-cafe-skills/enterprise-workflow/SKILL.md` 扩到双平台

2. Shape 修正 + E2E（57410ee1a）
   - 按真实 lark-cli 响应形状重写 types/service/tests：
     - lark-cli 响应是扁平包络 `{ok, identity, data, error?}`，字段扁平（`data.doc_id` 而非嵌套 `data.document.document_id`）
     - exit code 恒为 0，成功/失败由 `ok` 字段判断
   - `LarkApiError` 构造函数接 `LarkCliErrorDetail` 对象（type/code/message/hint）
   - callback route 502 响应从 `err.msg` 改 `err.message + type + hint`
   - 新增 E2E 测试 `lark-e2e-golden-chain.test.js`（`LARK_E2E=1` gated）
   - F162 spec：AC-B6 → ✅，新增 KD-7 记录 shape 教训

## Why

> "f162第一阶段 完成了企业微信的对接 体验不错 你来负责对接飞书的cli？"
> "对他们有什么就接什么就好了" → 飞书独占的 Slides 也接，不只对等翻译
> "你这些今天下午都能干完哈哈哈"（deadline: 2026-04-17 下午）

沿用 Phase A 架构（ADR-029）：ActionService + CliExecutor + callback route，**不建 MCP server**。

## Original Requirements（必填）

> 铲屎官原话（见 `docs/features/F162-enterprise-action-toolkit.md` Phase B 小节）：
> - 接飞书 CLI（能用什么接什么，含 Slides）
> - 延续 Phase A 的 Golden Chain demo：一句话 → 文档 + 多维表 + 任务 + 日程（+Slides）
> - 走 ADR-029（ActionService pattern）
> - 今天（2026-04-17）下午完工

来源：
- `docs/features/F162-enterprise-action-toolkit.md`（Phase B AC-B1~B8）
- `docs/decisions/ADR-029-external-tool-integration-strategy.md`
- Phase A 参考：`WeComActionService.ts` + `WeComCliExecutor.ts`

**请对照上面的原话判断交付物是否解决了铲屎官的问题。**

## Tradeoff

| 放弃的方案 | 原因 |
|-----------|------|
| 建 Lark MCP server | ADR-029 Decision 1-4：ActionService + callback route 已足够，MCP 增加发现/触发两条链路负担 |
| 复用 Phase A 的单 JSON blob exec 签名 | lark-cli 是 cobra 框架，原生 `--flag value`，强行 JSON 化增加包装层（KD-6） |
| 把 Lark 拆成独立 skill | 保持单个 `enterprise-workflow` skill，用平台选择表顶置，方便猫猫按用户意图选平台 |
| 给 `LarkCalendarEventHandle` 留 `meetingUrl` 字段 | lark-cli v1.x `calendar +create` 没有 `--vc` 也没返回 vc 链接，留空字段没意义 |
| 按 Feishu Open API 文档的嵌套形状 pre-code | 预编码与真机响应不匹配（真机是扁平包络），真机探测后全部重写（KD-7 教训） |

## Open Questions

**请 reviewer 特别看这些：**

1. **错误分类是否到位？** `LarkCliExecutor.ts` 有三类错误：`LarkApiError`（CLI 返回 `ok:false`）、`LarkCliUnavailableError`（CLI 不可用）、未知 JSON 解析错误。回调路由对前两类分别 502 / 503，未知走 throw → fastify 500。符合 Phase A 规范？

2. **`searchUsers` 的 degrade 策略**：contact scope 不一定授权，我让它 catch 异常返回空数组（`LarkActionService.ts` L213）。合理还是应该让错误冒出来让 caller 决策？

3. **`goldenChain` 的 task 串行 vs 并行**：现在 tasks 是 `for await` 串行创建（L236），保证顺序可观测性。Phase A WeCom 也是串行的，但 lark-cli 是单次子进程启动开销较大（~200ms），tasks 多时会慢。要不要并行？（Phase B 目前上限 50 任务）

4. **E2E 测试留的真实资源**：测试里的 doc/base/task/event/slides 都不清理，铲屎官的 Feishu 空间会堆积 `F162-B E2E *` 前缀的资源。需要 after-hook 清理吗？还是 demo 性质留着正好？

5. **真机 shape 探测证据充分吗**：我只探测了 happy path + 1 个 validation error。reviewer 可以看看我是不是漏了关键路径的错误形状。

## Next Action

1. Reviewer 拉分支到沙盒，跑单元测试，读代码
2. 如需验证真机 E2E：可以但需要你的 lark-cli auth + `LARK_MY_OPEN_ID`；我已在自己账号验过，链接在 spec Timeline 留证
3. 给出 P0 / P1 / P2 / 放行意见

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f162/codex`
- Start Command（沙盒标准入口）: `pnpm review:start`
- Ports: 不需要 web/api dev server（纯后端 + CLI 封装，review 靠单元测试即可）
- 真机 E2E（可选）:
  ```bash
  # 需要：lark-cli auth login --recommend --domain all
  LARK_E2E=1 LARK_MY_OPEN_ID=ou_xxx \
    node --test packages/api/test/infrastructure/lark-e2e-golden-chain.test.js
  ```

## 自检证据（Quality Gate Report）

### Spec 合规（F162 Phase B AC-B1~B8）

| AC | 状态 | 证据 |
|----|------|------|
| B1 lark-cli 安装 + schema 探查 | ✅ | 真机探测完成，KD-7 记录 |
| B2 LarkActionService 7 方法 | ✅ | `LarkActionService.ts` createDoc/createBase/createTask/createCalendarEvent/createSlides/searchUsers/goldenChain |
| B3 audit log | ✅ | `private audit()` 被每个方法调用 |
| B4 callback route + zod discriminatedUnion | ✅ | `callback-lark-action-routes.ts`（6 action + golden_chain） |
| B5 单元测试全绿 | ✅ | 29/29 pass（本轮真实运行输出见下） |
| B6 端到端真实调用 | ✅ | E2E 1/1 pass，真实链接在 F162 spec Timeline |
| B7 飞书 App 内可见 | ⏳ | 链接已给铲屎官目测 |
| B8 enterprise-workflow skill 双平台 | ✅ | SKILL.md 228 行，顶置平台选择表 |

### 测试结果（本轮真实运行）

```
$ pnpm --filter @cat-cafe/api build
> tsc  # exit 0

$ node --test packages/api/test/infrastructure/lark-cli-executor.test.js \
       packages/api/test/infrastructure/lark-action-service.test.js
ℹ tests 29
ℹ pass 29
ℹ fail 0
ℹ duration_ms 330.5

$ LARK_E2E=1 LARK_MY_OPEN_ID=ou_01a4f55b799bf059b1e3b510a0b21b9b \
    node --test packages/api/test/infrastructure/lark-e2e-golden-chain.test.js
=== F162-B Golden Chain Result ===
📄 文档: F162-B E2E Doc 2026-04-17T09-04-29 — https://www.feishu.cn/docx/OeoRdvOetox1jxxWF9McNCg5nKf
📊 多维表: F162-B E2E Base 2026-04-17T09-04-29 — https://icnzjwzqfxa8.feishu.cn/base/SvNQbgdARaUrxFsVgZdcbAKdnQc
✅ 任务: 1 条已分发
🗓 日程: F162-B E2E Event 2026-04-17T09-04-29
🎞 幻灯片: F162-B E2E Doc 2026-04-17T09-04-29 — Slides — https://icnzjwzqfxa8.feishu.cn/slides/MVRrs1nFPlx2ITdbxfBcOD8Cn8d
================================
▶ creates doc + base + task + calendar event + slides and returns all URLs (10091.7ms)
ℹ tests 1, pass 1, fail 0

$ pnpm check         # biome: 0 errors
$ pnpm --filter @cat-cafe/api lint  # tsc --noEmit: exit 0
```

### Rebase 状态

- ahead=2 / behind=0（已 rebase onto origin/main at HEAD）
- Remote: force-pushed `feat/f162-phase-b-lark` → `57410ee1a`

### Artifact Hygiene

- `git status --short | rg ...media...` → 无
- `git diff --name-only origin/main...HEAD | rg ...media...` → 无

### 相关文档

- Feature spec: `docs/features/F162-enterprise-action-toolkit.md`
- ADR: `docs/decisions/ADR-029-external-tool-integration-strategy.md`
- Phase A 参考：`packages/api/src/infrastructure/enterprise/WeComActionService.ts`
- Skill: `cat-cafe-skills/enterprise-workflow/SKILL.md`

---

@codex
