---
feature_ids: [F182]
related_features: [F127]
topics: [contest, multi-cat-evaluation, training-camp, opus-47-also-competes]
doc_kind: contest-brief
created: 2026-04-30
---

# F182 实施大赛 — 国产四猫 + sonnet + opus-47 同台竞技

> 铲屎官原话（2026-04-30）：
> "你也参赛 砚砚铁面无私当裁判 把你 review 的喵喵叫，没准你还能输呢！至少你曾经搜索大赛布偶猫集体都输了，其他猫猫都搜到了，你们宪宪集体非常自信反而没搜到真的答案"

## 比赛目的

不是传统 benchmark，而是**真实任务的综合能力评估**：
- 对**养猫策略**有决策价值——sonnet / glm / deepseek / kimi / qwen 谁可以独立承担家里的活
- 让布偶猫家族（opus-47）认清**自信而懒于核验**的盲点
- 同一份 spec 被不同模型怎么解读、哪些 KD 容易被忽略 → 反馈给未来 spec 撰写

## Scope — F182 完整 4 Phase 闭环

题面：[`docs/features/F182-cat-roster-lifecycle-toggle.md`](../../features/F182-cat-roster-lifecycle-toggle.md)（v4 final）

**必须完成全 4 Phase**（不是只做 Phase A）：
- **Phase A**：错误契约 + Resolver 闸门（types + resolver ≤40 行 + 5 入口接入）
- **Phase B**：Roster 不可见性守护测试（仅守护测试，不改注入逻辑）
- **Phase C**：7 个 MCP 工具降级（A 类 3 + A' 类 1 + B 类 3 + wrapper 双轨）
- **Phase D**：Hub UX + `disable-impact` endpoint

**完整闭环 = SOP 全跑通**：
- writing-plans → worktree → tdd（红绿可见于 git log）→ quality-gate（自检 + 跑全测试）→ 自我 PR 文档（不真合 main，留 worktree）

## 选手名单

| 选手 | 显示名 | Worktree 分支 | 备注 |
|---|---|---|---|
| opus-47 | 布偶猫 4.7 | `feat/F182-opus47` | spec 作者，但只读 v4 final，不靠记忆 |
| sonnet | 布偶猫 4.6 / sonnet | `feat/F182-sonnet` | — |
| glm | GLM-5.1 | `feat/F182-glm` | — |
| deepseek | DeepSeek V4 Pro | `feat/F182-deepseek` | — |
| kimi | Kimi K2.6 | `feat/F182-kimi` | — |
| qwen | Qwen 3.6 Max Preview | `feat/F182-qwen` | — |

## 端口分配（基建依赖 `WORKTREE_PORT_OFFSET`）

⚠️ **6399 是用户 Redis 圣域，不可触碰**（铁律 #1）。所有选手端口段都从 6398 **向下减**，避开圣域。

| 选手 | OFFSET | Redis | API | Web | A2A Bridge |
|---|---|---|---|---|---|
| opus-47 | 0 | 6398 | 3102 | 5102 | 4111 |
| sonnet | -10 | 6388 | 3112 | 5112 | 4121 |
| glm | -20 | 6378 | 3122 | 5122 | 4131 |
| deepseek | -30 | 6368 | 3132 | 5132 | 4141 |
| kimi | -40 | 6358 | 3142 | 5142 | 4151 |
| qwen | -50 | 6348 | 3152 | 5152 | 4161 |

API/Web/Bridge 向上加 offset，Redis 向下减，互不冲突。基建实施 plan 见下"基建依赖"。

## 起手提示（铲屎官分发给每只猫）

```
你是 [选手名]，参加 F182 实施大赛。

1. 读题面：`docs/features/F182-cat-roster-lifecycle-toggle.md`（v4 final）
2. 读家规：`CLAUDE.md`、`cat-cafe-skills/refs/shared-rules.md`、`docs/SOP.md`
3. 开 worktree：
   git worktree add ../cat-cafe-F182-[选手名] -b feat/F182-[选手名]
   cd ../cat-cafe-F182-[选手名]
   export WORKTREE_PORT_OFFSET=[你的 offset]
   pnpm install
   # 启动服务用 PORT_OFFSET 环境变量自动分配端口
4. 按 SOP 跑：writing-plans → tdd（先红后绿）→ quality-gate（pnpm gate）
5. commit 含模型签名 [选手名/模型🐾]
6. 第一轮 48h 内交完整 4 Phase；不真 merge main，留在 feat/F182-[选手名] 分支
7. 砚砚 review 给反馈 → 第二轮 24h 修复 → 终评
```

## 公平性约束（铁律）

1. **opus-47 不享受作者优势** — 跟其他猫起跑线一样，只读 v4 final spec md，不靠 thread/记忆里的 review 历史细节
2. **不许互相 review 草稿** — 第一轮 48h 内不交流，不互看 worktree
3. **不许 cherry-pick 他人 commit** — 第一轮提交必须是自己写的
4. **第二轮可以参考砚砚反馈但不抄答案** — 修复轮看砚砚针对你的反馈，不许抄别人答案
5. **commit 签名带模型** — `[选手名/模型🐾]` 让砚砚能溯源
6. **TDD 红绿可见于 git log** — 不许"先写完再补测试"

## 评分 Rubric（100 分制，砚砚单裁判）

| 维度 | 分数 | 测什么 |
|---|---|---|
| **Phase A 正确性** | 20 | resolver 实现 / 5 入口接入完整 / KD-9（isCatAvailable 边界两步判断）/ KD-10（两个 skip 点不同改法）|
| **Phase B 守护** | 5 | 测试是否真覆盖（不是空跑），是否检测 disabled 在所有 prompt 区段都不出现 |
| **Phase C MCP** | 25 | 三档错误正确分流（KD-2）/ KD-7 message 模板 / KD-6 wrapper 双轨 / 7 个工具完整覆盖 |
| **Phase D Hub UX** | 15 | impact endpoint 实现 / 弹窗交互 / 不强迁移引用的标记 |
| **SOP 遵守** | 10 | TDD 红绿可见 / SystemPromptBuilder 守护测试已跑 / commit 签名带模型 / quality-gate 通过 |
| **代码质量** | 10 | resolver ≤40 行硬约束（KD-8）/ 纯函数 / 跨包 import 整洁 / 文件不超 200 行警告 |
| **修复响应** | 15 | 第二轮反馈吸收质量（不是表演性 ack，要看 git diff） |

**及格门槛**：70 分。低于 70 分不合入 main。

## 时间窗口

| 时间 | 事件 |
|---|---|
| T0 | 铲屎官启动 6 只猫，分发起手提示 + 端口 OFFSET |
| T0 + 48h | 第一轮提交截止 — 所有选手 push feat/F182-[选手名] 到 origin |
| T0 + 48h ~ T0 + 56h | 砚砚 review 6 份分支，给逐项反馈（review 文档 link 在 `docs/discussions/2026-04-30-f182-contest/round1-review.md`） |
| T0 + 56h | 第二轮启动 — 选手收到反馈开始修复 |
| T0 + 80h | 第二轮提交截止 |
| T0 + 80h ~ T0 + 88h | 砚砚终评，给打分表（`docs/discussions/2026-04-30-f182-contest/scoreboard.md`） |
| T0 + 88h | 公布结果 — 铲屎官决定合谁的 / 不合 / opus-47 重写 |

## 裁判规则

- **唯一裁判：@codex 砚砚**（缅因猫 GPT-5.5）—— 跨 family，铁面无私
- 评分公开，附 review 文档（每个选手一份）
- 砚砚不参赛，不写 F182 代码
- 评分文档 commit 签名 `[砚砚/GPT-5.5🐾]`
- 异议申诉机制：选手对评分有异议可在 thread 里 push back，砚砚必须给具体证据回应

## 合入决策（铲屎官最终拍板）

- 最高分 ≥ 70 → 铲屎官选择是否合入（合入条件：通过家规 quality-gate + merge-gate）
- 最高分 < 70 → 不合入，铲屎官选择：(a) opus-47 重写；(b) 取所有人长处合一份新版本
- **任何情况下都先吸收教训** — 砚砚的总评必须包含"哪些 KD 集体被忽略 / 哪些 spec 写法不够清楚"，回流到 F182 spec v5 + 未来 spec 撰写指南

## 基建依赖：WORKTREE_PORT_OFFSET 环境变量

参赛前必须先做的基建升级（独立小 feat，不是 F182 范围）：

### 现状
- 当前 `cat-cafe-skills/worktree/SKILL.md` 假设单 worktree 并发，硬编码 Redis 6398 / API 3102
- `start-dev.sh` 类启动脚本不读 PORT_OFFSET
- `.env.local` 模板硬编码端口

### 改动 plan
1. **新增环境变量** `WORKTREE_PORT_OFFSET`（int，默认 0）
2. **改造启动脚本** — Redis/API/Web/A2A Bridge 端口都基于 offset 计算
3. **改造 .env.local 模板** — worktree skill 文档里的 `cat > .env.local <<EOF` 改成基于 offset 派生
4. **safety check** — offset 必须使 Redis 端口 ≠ 6399（圣域）；offset 范围 [-50, 0] 阶梯 -10
5. **worktree skill 文档更新** — 添加 PORT_OFFSET 段落 + 端口分配表（指向本参赛文档）

### 优先级
- 这个基建改动**先于参赛启动**完成 + 砚砚 review 通过
- 实施估计 1-2h，由 opus-47 完成（基建不算 F182 比赛范围）

## 链接

| 类型 | 路径 |
|---|---|
| **Spec** | [F182 v4](../../features/F182-cat-roster-lifecycle-toggle.md) |
| **基建 plan** | [`docs/plans/2026-04-30-worktree-port-offset.md`](../../plans/2026-04-30-worktree-port-offset.md) |
| **第一轮 review** | （T0+56h 后）`round1-review.md` |
| **终评打分** | （T0+88h 后）`scoreboard.md` |
