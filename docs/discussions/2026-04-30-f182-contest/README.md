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

⚠️ **6399 是用户 Redis 圣域，不可触碰**（铁律 #1）。所有选手 OFFSET ≤ -10。
⚠️ **OFFSET=0 保留给 alpha / 默认开发环境**（砚砚 P2-6 反馈，3011/3012/4111/6398 是 alpha 默认端口段，不参赛者占用）。

| 选手 | OFFSET | Redis | API | Web | 备注 |
|---|---|---|---|---|---|
| **(保留 alpha)** | **0** | 6398 | 3102 | 5102 | 不分配，留给 alpha-worktree.sh |
| opus-47 | -10 | 6388 | 3112 | 5112 | spec 作者，标 `seeded/reference competitor`（砚砚 P2-4） |
| sonnet | -20 | 6378 | 3122 | 5122 | — |
| glm | -30 | 6368 | 3132 | 5132 | — |
| deepseek | -40 | 6358 | 3142 | 5142 | — |
| kimi | -50 | 6348 | 3152 | 5152 | — |
| qwen | -60 | 6338 | 3162 | 5162 | — |

`NEXT_PUBLIC_API_URL` 从派生 API 端口拼接（例：OFFSET=-20 → `http://localhost:3122`）。

派生公式统一：`非 Redis 端口 = base - OFFSET`（OFFSET 是负数 → 实际端口向上加）。Redis = `6398 + OFFSET`（向下减避圣域）。

**核心 4 服务参与 OFFSET**（Redis / API / Web / NEXT_PUBLIC_API_URL）；**sidecar 全禁用**（Preview Gateway / Anthropic Proxy / Whisper / TTS / LLM Postprocess / Embedding）—— 大赛 worktree 不需要这些 sidecar，禁用比 offset 化更稳。详见基建 plan。

## 起手提示（铲屎官分发给每只猫）

```
你是 [选手名]，参加 F182 实施大赛。

1. 读题面：`docs/features/F182-cat-roster-lifecycle-toggle.md`（v4 final）
2. 读家规：`CLAUDE.md`、`cat-cafe-skills/refs/shared-rules.md`、`docs/SOP.md`
3. 开 worktree（必须从 contestStartCommit 出发，看本文档底部）：
   git worktree add ../cat-cafe-F182-[选手名] -b feat/F182-[选手名] [contestStartCommit]
   cd ../cat-cafe-F182-[选手名]
   pnpm install
4. 配置环境（大赛 worktree 默认禁用 sidecar，砚砚 P1-1 拍板）：
   cat > .env.local <<EOF
   WORKTREE_PORT_OFFSET=[你的 offset]
   PREVIEW_GATEWAY_PORT=0
   ANTHROPIC_PROXY_ENABLED=0
   ASR_ENABLED=0
   TTS_ENABLED=0
   LLM_POSTPROCESS_ENABLED=0
   EMBED_ENABLED=0
   EMBED_MODE=off
   EOF
5. 启动服务用 `pnpm dev:direct` 或 `bash scripts/start-dev.sh`
   ⚠️ 不要用 `pnpm dev`！它走 `pnpm -r --parallel run dev` 绕过 preflight，OFFSET 不生效（砚砚 P1-2）
6. 按 SOP 跑：writing-plans → tdd（先红后绿）→ quality-gate（pnpm gate）
7. commit 含模型签名 [选手名/模型🐾]
8. 第一轮 72h 内交完整 4 Phase；不真 merge main，留在 feat/F182-[选手名] 分支
9. 砚砚 triage 给 P0/P1 反馈 → 第二轮 24h 修复 → 砚砚 merge-grade review + 终评
```

## 公平性约束（铁律 + git 层可审计，砚砚 P2-4 反馈）

### 行为约束
1. **opus-47 标为 `seeded/reference competitor`** — 跟其他猫起跑线一样，只读 v4 final spec md，不靠 thread/记忆里的 review 历史细节；裁判评分时可附"参照标杆"角度，但 opus-47 不享受作者优势，输了承认
2. **不许互相 review 草稿** — 第一轮 72h 内不交流，不互看 worktree
3. **不许 cherry-pick 他人 commit** — 第一轮提交必须是自己写的
4. **第二轮可以参考砚砚反馈但不抄答案** — 修复轮看砚砚针对你的反馈，不许抄别人答案
5. **commit 签名带模型** — `[选手名/模型🐾]` 让砚砚能溯源
6. **TDD 红绿可见于 git log** — 不许"先写完再补测试"

### Git 层审计（砚砚 P2-4 + 二审 P2-5）

可技术验证 + 部分依赖 honor rule（cherry-pick 不能严格阻止，只能辅助识别）：

- **contestStartCommit 锁定**（可验证）— 大赛启动时记录 main HEAD（写到本文档底部 "Contest Start Commit" 段），所有选手分支必须从该 commit 出发
- **merge 检查**（可验证）— 选手分支禁止 merge 其他 `feat/F182-*`；裁判检查 `git log --merges` 必须为空，`git merge-base` 必须等于 contestStartCommit
- **commit author 校验**（可验证）— 裁判检查每个 commit 的 author email + signature trailer，混入其他选手身份的 commit 直接 0 分
- **Cherry-pick 检测**（辅助 — 不严格阻止）— honor rule 为主；裁判截止后用 `git patch-id` / `git cherry` 对比 6 个分支的 patch 相似度，相似度异常高的 patch 标可疑+人工核查
- **检查脚本**（裁判用）：
  ```bash
  # 1. 检查分支单线 + base
  git merge-base feat/F182-${cat} ${contestStartCommit}
  git log --merges feat/F182-${cat} ^${contestStartCommit}  # 必须为空

  # 2. 检查 author 一致性
  git log feat/F182-${cat} --format='%an %ae' | sort -u

  # 3. Cherry-pick 辅助检测（截止后跑，砚砚三审 P2-4：按 contestStartCommit 截断 + 预计算 patch-id）
  # 先为每个分支预生成 patch-id 文件（仅 contest 区段）
  for c in opus-47 sonnet glm deepseek kimi qwen; do
    git log feat/F182-${c} ^${contestStartCommit} --format='%H' | while read h; do
      pid=$(git show $h | git patch-id --stable | awk '{print $1}')
      echo "$pid $h $c" >> /tmp/contest-patch-ids.txt
    done
  done
  # 同 patch-id 跨选手 = 可疑 cherry-pick（用 sort+awk 替代双层循环 git show）
  sort /tmp/contest-patch-ids.txt | awk '
    { if ($1 == prev_pid && $3 != prev_cat) print "⚠️", prev_cat, prev_h, "vs", $3, $2, "patch-id 一致";
      prev_pid=$1; prev_h=$2; prev_cat=$3 }
  '
  ```

## 评分 Rubric（100 分制 + Hard Fail / Cap，砚砚 P2-5 反馈）

| 维度 | 分数 | 测什么 |
|---|---|---|
| **Phase A 正确性** | 20 | resolver 实现 / 5 入口接入完整 / KD-9（isCatAvailable 边界两步判断）/ KD-10（两个 skip 点不同改法）|
| **Phase B 守护** | 5 | 测试是否真覆盖（不是空跑），是否检测 disabled 在所有 prompt 区段都不出现 |
| **Phase C MCP** | 25 | 三档错误正确分流（KD-2）/ KD-7 message 模板 / KD-6 wrapper 双轨 / 7 个工具完整覆盖 |
| **Phase D Hub UX** | 15 | disable-impact endpoint 实现 / 弹窗交互 / 不强迁移引用的标记 |
| **SOP 遵守** | 10 | TDD 红绿可见 / SystemPromptBuilder 守护测试已跑 / commit 签名带模型 / quality-gate 通过 |
| **代码质量** | 10 | resolver ≤40 行硬约束（KD-8）/ 纯函数 / 跨包 import 整洁 / 文件不超 200 行警告 |
| **修复响应** | 15 | 第二轮反馈吸收质量（不是表演性 ack，要看 git diff） |

### Hard Fail（直接 0 分）
- 触碰 6399 圣域（`.env.local` 残留 + 没用 OFFSET）
- 把代码合入 main（实验在 worktree 分支独立跑，不准 merge main）
- commit author / signature 混入其他选手身份

### Cap（防糊弄，砚砚 P2-5）
- **第一轮无可运行基线**（`pnpm test` 不能跑）→ 修复响应 ≤ 5 分
- **第一轮关键测试缺失**（resolver 单元测试空 / Phase A 守护测试缺）→ 修复响应 ≤ 8 分
- **第一轮总分 < 60** → 最终分数 ≤ 75（防"第一轮糊弄等第二轮捞分"）

### 及格门槛
70 分。低于 70 分**不合入 main**，铲屎官选择：(a) opus-47 重写；(b) 取所有人长处合一份新版本

## 时间窗口（砚砚 P1-3 反馈：第一轮 triage / 第二轮才完整 review）

| 时间 | 事件 |
|---|---|
| T0 | 铲屎官启动 6 只猫，分发起手提示 + 端口 OFFSET + contestStartCommit |
| T0 + 72h | 第一轮提交截止 — 所有选手 push feat/F182-[选手名] 到 origin（72h 给国产猫充分时间做 4 Phase 闭环含 Hub UI） |
| T0 + 72h ~ T0 + 96h | **第一轮 triage（24h）** — 砚砚 review 不是 merge-grade 而是 P0/P1 triage：可运行性 + 关键测试 + 严重 spec 偏差。每份分支只输出 5-10 条最重要反馈。triage 文档 `round1-triage.md` |
| T0 + 96h | 第二轮启动 — 选手收到 triage 反馈开始修复 |
| T0 + 120h | 第二轮提交截止 |
| T0 + 120h ~ T0 + 168h | **第二轮 merge-grade review（48h）** — 砚砚对 6 份分支完整 review + 打分（每份 8h），包含代码细节 / SOP 遵守 / 修复响应质量。review 文档 `round2-review.md` + 打分表 `scoreboard.md` |
| T0 + 168h | 公布结果 — 铲屎官决定合谁的 / 不合 / opus-47 重写 |

总时长 = 168h ≈ 7 天。比原 88h 长，但符合"铁面无私"的质量要求。如果想压缩，砚砚也可以拒绝部分选手进第二轮（第一轮没基线就出局）。

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

### 摘要
- 改造 `start-dev.sh` 读 `WORKTREE_PORT_OFFSET`，派生**核心 4 服务**（Redis / API / Web / NEXT_PUBLIC_API_URL）
- Sidecar（Preview Gateway / Anthropic Proxy / ASR / TTS / LLM Postprocess / Embedding）**全禁用**，不参与 offset
- Preflight 接 `start-dev.sh` 内置 — `pnpm dev:direct` 必经；`pnpm dev` 走 `pnpm -r --parallel run dev` 绕过 preflight，禁用
- OFFSET 非 0 时 managed startup keys 优先级 **高于** `.env.local` 和 `CAT_CAFE_RESPECT_DOTENV_PORTS`
- Redis data/backup dir 用现有 `default_redis_data_dir(profile, port)` 派生，不发明新格式

### 优先级
- 基建改动**先于参赛启动**完成 + 砚砚 review 通过（已 closure 放行 v4，commit `e9b648eec`）
- 实施估计 1-2h，由 opus-47 完成（基建不算 F182 比赛范围）

详见 [基建 plan](../../plans/2026-04-30-worktree-port-offset.md) 真相源。

## 链接

| 类型 | 路径 |
|---|---|
| **Spec** | [F182 v4](../../features/F182-cat-roster-lifecycle-toggle.md) |
| **基建 plan** | [`docs/plans/2026-04-30-worktree-port-offset.md`](../../plans/2026-04-30-worktree-port-offset.md) |
| **第一轮 triage**（T0+96h 后） | `round1-triage.md` |
| **第二轮 review**（T0+168h 后） | `round2-review.md` |
| **终评打分**（T0+168h 后） | `scoreboard.md` |

## Contest Start Commit

⏳ 大赛启动时由铲屎官填入此处（main HEAD），所有选手分支必须从此 commit 出发：

```
TBD-启动时填入
```

## 修订历史

| 版本 | 日期 | 修订人 | 改动 |
|---|---|---|---|
| v1 | 2026-04-30 | opus-47 | 初稿 — 6 选手 / 100 分 rubric / 48h+24h |
| v2 | 2026-04-30 | opus-47 | **吸收砚砚 P1+P2 全部反馈**：①F182 spec 残留清理（OQ-3 全文一致）②端口 offset=0 留给 alpha，6 只猫用 -10 ~ -60；统一公式 `base - OFFSET`；③时间窗口 88h → 168h，第一轮改 triage / 第二轮才完整 review；④rubric 加 Hard Fail（圣域 / merge main / 身份混淆 0 分）+ Cap（无基线 / 关键测试缺失 / 第一轮 < 60）；⑤公平性 git 层可审计（contestStartCommit / merge-base 检查 / 单线提交 / author 校验）；⑥opus-47 标 seeded/reference competitor |
| v3 | 2026-04-30 | opus-47 | **吸收砚砚二审 P1+P2 全部反馈**：①sidecar 禁用不 offset（Preview/Proxy/ASR/TTS/LLM/Embed 全设 0）— 不增 attack surface；②起手提示明确用 `pnpm dev:direct` 不用 `pnpm dev`（后者绕过 preflight）；③三处 48h/24h 残留全清；④Redis data dir 用现有 `default_redis_data_dir` 派生不发明新格式；⑤Cherry-pick 检测改成 honor + patch-id 辅助（`git --merges` 抓不到）；⑥preflight 接入 start-dev.sh 而非独立 pnpm preflight |
| v4 | 2026-04-30 | opus-47 | **吸收砚砚三审 P1+P2**：①端口表删 A2A Bridge 列（与 sidecar 禁用决策不一致），表下删"11 个端口"残留口径，明确"核心 4 服务"；②基建 plan Risk 表删"11 个端口/全量覆盖"残留，加 OFFSET 优先级风险（`pnpm dev:direct` 经 start-entry.mjs 设 `CAT_CAFE_RESPECT_DOTENV_PORTS=1` 可能压过 OFFSET）；③AC-3 加优先级规则：OFFSET 非 0 时 managed startup keys 优先级高于 .env.local；④patch-id 检测脚本改成预生成 + sort/awk，按 contestStartCommit 截断（避免扫全历史），从双层 git show 改为 `git patch-id --stable` |
