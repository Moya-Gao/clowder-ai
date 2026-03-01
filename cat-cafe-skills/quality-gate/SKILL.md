---
name: quality-gate
description: >
  开发完成后的自检门禁：愿景对照 + spec 合规 + 验证。
  Use when: 开发完了准备提 review、声称完成了、准备交付。
  Not for: 收到 review 反馈（用 receive-review）、merge（用 merge-gate）。
  Output: Spec 合规报告（含愿景覆盖度）。
triggers:
  - "开发完了"
  - "准备 review"
  - "自检"
  - "声称完成"
---

> **SOP 位置**: 本 skill 是 `docs/SOP.md` Step 2 的执行细节。
> **上一步**: 代码开发 (Step 1) | **下一步**: `request-review` (Step 3a)

# Quality Gate

开发完成到提 review 之间的双重关卡：对照 spec 自检 + 用真实命令输出证明你的声明。

## 核心知识

**两条铁律合一**：

1. **Spec alignment**（来自 `spec-compliance-check`）：AC 可能写偏，先回读原始需求，再逐项验收
2. **Evidence before claims**（来自 `verification-before-completion`）：没有运行命令、没看到输出，就不能说"通过了"

> 铁律：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`
>
> 自问："我是这次真的运行了命令并看到输出，还是我只是相信它能工作？"

**为什么 AC 可能不够**：AC 是人写的，可能遗漏 UX 要求或场景覆盖。F041 教训：AC 全打勾，但铲屎官的原始需求（能力显示描述、多项目管理）根本没进 AC——spec compliance check 检查了 AC，但 AC 本身就是错的。

## 流程

```
BEFORE 声称完成 / 提 review:

Step 0: VISION CHECK（愿景核对）
  ① 找原始 Discussion/Interview 文档（铲屎官原话在里面）
  ② 读核心痛点："我要..."、"我不想..."
  ③ 问自己：铲屎官坐在 Hub 前用这个功能，体验是什么样的？
  ④ AC 是否完整覆盖了铲屎官的原始需求？
     → 如有遗漏，先补 AC 再继续

Step 1: FIND — 找 spec/plan 文档
  - docs/plans/{date}-{topic}.md 或 docs/phases/{name}.md
  - 同时找 Discussion/Interview（铲屎官原话所在）

Step 2: CREATE — 建检查清单
  - 列出每一个 AC / 功能点 / 边界条件
  - 列出 Discussion 里的 UX 描述和场景

Step 3: VERIFY — 逐项检查
  - 代码在哪？有测试覆盖？边界处理了？

Step 4: RUN — 运行验证命令（必须这次真实运行）
  pnpm test                              # 必须全部通过
  pnpm lint                              # 0 errors
  pnpm -r --if-present run build         # exit 0
  # Redis 相关改动额外跑：
  pnpm --filter @cat-cafe/api test:redis

Step 5: READ — 完整读输出，看 exit code，数失败数

Step 6: REPORT — 输出合规报告 + 证据
```

**前端功能额外要求**：`≤3 张截图 + 1 段 15s 录屏`，附"需求 → 截图"映射表。

## Quick Reference

| Claim | 需要 | 不够用 |
|-------|------|--------|
| 测试通过 | 这次运行输出：0 failures | "上次跑过"、"应该通过" |
| lint 干净 | lint 输出：0 errors | 部分检查、推断 |
| 构建成功 | build 命令：exit 0 | lint 通过不代表编译通过 |
| Bug 修了 | 原症状测试：通过 | 代码改了，以为修了 |
| 需求满足 | spec + Discussion 逐项打勾 | 测试通过就完事 |

**合规报告模板**：

```markdown
## Quality Gate Report

Spec: docs/plans/YYYY-MM-DD-xxx.md
原始需求: docs/discussions/YYYY-MM-DD-xxx/README.md
检查时间: YYYY-MM-DD HH:MM

### 愿景覆盖（Step 0）
| # | 铲屎官原始需求 | AC 覆盖？ | 实现？ |
|---|---------------|-----------|--------|
| 1 | "我要 XXX"    | AC#3      | ✅     |

### 功能验收
| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | XXX  | ✅   | file.ts:L10 | test.spec.ts |

### 验证命令输出（必须是这次真实运行）
pnpm test → 34/34 pass ✅
pnpm lint → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 只检查 AC，没回读 Discussion | Step 0 先读原始需求，AC 可能不完整 |
| "上次跑测试是通过的" | 这次重新跑，看输出，再声明 |
| "应该没问题" / "probably works" | Run the command. Read the output. |
| 测试通过就声称 phase 完成 | 还要对照 spec 逐项检查 |
| 部分实现就提 review | P1/P2 遗漏必须当轮补完再提 review |
| 前端功能没有截图证据 | ≤3 张截图 + 15s 录屏 + 映射表 |
| Redis 改动用默认测试命令 | 必须跑 `test:redis`，禁止直连 6399 |

**Red flags — 立刻 STOP**：
- 用 "should"、"probably"、"seems to"
- 表达满足感（"好了！"、"完成！"）时还没运行命令
- 信任 subagent 的 "success" 报告而没独立验证

## 和其他 skill 的区别

| Skill | 关注点 | 时机 |
|-------|--------|------|
| **quality-gate（本 skill）** | spec 对照 + 证据验证 | 提 review 之前 |
| `merge-gate` | reviewer 是否放行、P1/P2 是否全修 | 合入 main 之前 |
| `receive-review` | 如何处理 reviewer 的反馈 | 收到 review 之后 |

一句话：quality-gate 是"你自己检查自己"，merge-gate 是"reviewer 放行你"，receive-review 是"你处理 reviewer 的意见"。

## 下一步

Quality Gate 通过后 → 使用 `request-review` skill 请求 review（SOP Step 3a）。

Gate 未通过时：
- **P1 遗漏** → 补完再过 gate
- **P2 遗漏** → 必须当轮补完再提 review
- **测试 / lint / build 失败** → 修到绿灯再提
