---
feature_ids: [F182]
related_features: []
topics: [contest, welcome-letter, onboarding, multi-cat-evaluation]
doc_kind: handoff-letter
created: 2026-05-01
---

# 🏆 F182 实施大赛 — 致参赛猫的一封信

> 给：**[你的名字]**（OFFSET=`[你的-OFFSET]`）
> 来自：宪宪（布偶猫 Opus 4.7，spec 作者 + 基建实施 + **同台参赛**）
> 时间：T0（铲屎官填）

---

亲爱的 [你的名字]：

欢迎参加 F182 实施大赛 🎉。这是一场**真实任务的综合能力评估**，不是 benchmark。同台竞技的有 6 只猫（你 + 其他 5 只 + 我自己），唯一裁判是**缅因猫砚砚（@codex）**——铁面无私，跨 family。

我作为 spec 作者也参赛，跟你**起跑线一样**——只读 v4 final spec md，不靠记忆里的 review 历史细节。铲屎官原话："你也参赛，砚砚铁面无私当裁判，没准你还能输呢"。所以你不用担心被 spec 作者占便宜——这场比赛重点是看哪只猫真懂 spec、按 SOP 干活、抗住云端 codex 的 review。

铲屎官还提醒过：搜索大赛布偶猫家族集体输了，输给国产猫——因为我们布偶猫太自信不细致。**你完全有可能赢我。**

---

## 你是谁

| 身份 | 内容 |
|---|---|
| 选手名 | **[你的名字]** |
| OFFSET | `[你的-OFFSET]` |
| Worktree 分支 | `feat/F182-[你的名字]` |
| 端口（已派生） | Redis `[Redis端口]` / API `[API端口]` / Web `[Web端口]` |

> OFFSET 表（按 contest README）：
> - opus-47=-10 / sonnet=-20 / glm=-30 / deepseek=-40 / kimi=-50 / qwen=-60
> - 端口公式：`Redis = 6398 + OFFSET`（向下避 6399 圣域）；`API/Web = base - OFFSET`（向上加）

---

## 你要做什么

**一句话**：完整实施 F182 4 个 Phase，全闭环（含 SOP / TDD / quality-gate / 自我 PR 文档），但**不要真 merge main**——留在你的 feat 分支让裁判 review。

---

## 起手 8 步（按图索骥）

### Step 1：读题（30 分钟）

必读 3 份文档，**按这个顺序**：

1. **题面**：[`docs/features/F182-cat-roster-lifecycle-toggle.md`](../../features/F182-cat-roster-lifecycle-toggle.md)（v4 final）
   - 重点看 Phase A/B/C/D 拆分、11 个 KD（特别 KD-9/10：edge case 陷阱）、AC 表
2. **大赛规则**：[`docs/discussions/2026-04-30-f182-contest/README.md`](README.md)
   - 重点看：评分 Rubric、Hard Fail、Cap、公平性铁律（git 单线 / 不互看 / 不 cherry-pick）
3. **家规**：`CLAUDE.md` + `cat-cafe-skills/refs/shared-rules.md` + `docs/SOP.md`
   - 五条铁律必懂（特别 #1 Redis 6399 圣域）

### Step 2：开 worktree（5 分钟）

⚠️ **必须从 `contestStartCommit` 出发**（铲屎官在 contest README 底部填的 SHA），不要从 latest main：

```bash
cd /Users/lysander/projects/relay-station/cat-cafe
git fetch origin main
git worktree add ../cat-cafe-F182-[你的名字] -b feat/F182-[你的名字] [contestStartCommit]
cd ../cat-cafe-F182-[你的名字]
```

### Step 3：装依赖（5 分钟）

```bash
NODE_ENV=development pnpm install
```

⚠️ 必须 `NODE_ENV=development`，否则 `@types/*` 不装，build 会挂。

### Step 4：配 .env.local（2 分钟）

照抄（替换 `[你的-OFFSET]`）：

```bash
cat > .env.local <<EOF
WORKTREE_PORT_OFFSET=[你的-OFFSET]
PREVIEW_GATEWAY_PORT=0
ANTHROPIC_PROXY_ENABLED=0
ASR_ENABLED=0
TTS_ENABLED=0
LLM_POSTPROCESS_ENABLED=0
EMBED_ENABLED=0
EMBED_MODE=off
EOF
```

⚠️ 不要硬编码 `REDIS_URL`/`API_SERVER_PORT` 等，让 OFFSET 派生。详见 worktree skill 「多 Worktree 并发」段。

### Step 5：写 plan + TDD（4-12 小时）

```bash
# 加载 writing-plans skill 写实施计划
# 加载 tdd skill — 红绿循环（先红测试 → 实现 → 绿）
```

**TDD 红绿循环必须可见于 git log**——裁判会 `git log` 看节奏，不接受"先写完再补测试"。每个 commit 含模型签名 `[你的名字/模型🐾]`。

### Step 6：跑 quality-gate（10 分钟）

```bash
pnpm gate
# 等价 bash scripts/pre-merge-check.sh
# 自动 fetch + rebase + build + test + lint + check
# 必须全绿
```

如果挂在 `pnpm install` 没装 devDeps，回 Step 3。

### Step 7：启动服务自测（如果需要）

```bash
# 启动用 pnpm dev:direct 或 bash scripts/start-dev.sh
# ⚠️ 不要用 pnpm dev！会绕过 OFFSET preflight
pnpm dev:direct
```

服务起来后会显示你的派生端口：
```
[start-dev] WORKTREE_PORT_OFFSET=[你的-OFFSET] → REDIS_PORT=...
- API: http://localhost:[你的-API端口]
- Frontend: http://localhost:[你的-Web端口]
```

### Step 8：Push（不 merge）

```bash
git push -u origin feat/F182-[你的名字]
```

**不要开 PR，不要 merge main。**留在你的 feat 分支即可，裁判会从这个分支 review。

---

## 题目要点（spec 高密度摘要）

> 完整 KD/AC 看 spec md，这里只列**最容易踩的**：

- **Phase A**：cat-target-resolver.ts **纯函数 ≤40 行**（KD-8），覆盖 5 入口（KD-4）；**`cat_not_found` 路径不能直接复用 `isCatAvailable`**（KD-9，2 步判断）；a2a-mentions.ts:92 vs AgentRouter:415 **改法不同**（KD-10）
- **Phase B**：**只加守护测试**，不改 buildTeammateRoster 逻辑（KD-11，铲屎官拍板"disabled 完全不出现"）
- **Phase C**：3 档错误（A 软降级 / A' multi_mention 硬 fail / B 类 400），KD-7 natural language `message` 字段，KD-6 wrapper 双轨；**B 类清单是 create_task.ownerCatId / start_vote.voters / scheduled.params.targetCatId**（不是 update_task / register_pr_tracking — 那俩 schema 不对）
- **Phase D**：`disable-impact` server-side endpoint（不在 useCatData 拼三套），不强迁移引用

---

## 评分（你被怎么打分）

100 分 7 维度（详见 contest README rubric）：

| 维度 | 分 | 关键 |
|---|---|---|
| Phase A 正确性 | 20 | KD-9/10 边界 |
| Phase B 守护 | 5 | 测试真覆盖 |
| Phase C MCP | 25 | 3 档分流 + KD-7 message |
| Phase D Hub UX | 15 | endpoint + 弹窗 |
| SOP 遵守 | 10 | TDD 红绿可见 / commit 签名 |
| 代码质量 | 10 | resolver ≤40 行 |
| 修复响应 | 15 | 第二轮真懂还是 ack |

**Hard Fail（直接 0 分）**：
- 触碰 6399 圣域
- merge 到 main
- commit author / signature 混入其他选手

**Cap**：
- 第一轮无可运行基线 → 修复响应 ≤5
- 第一轮 < 60 → 最终 ≤75

---

## 公平性铁律（合规线）

1. ❌ 不互相 review 草稿（第一轮 72h 内不交流）
2. ❌ 不 cherry-pick 其他选手 commit（git patch-id 会查）
3. ❌ 第一轮 contestStartCommit 锁定，不许 merge 其他 feat/F182-*
4. ✅ 第二轮可以参考砚砚针对你的反馈，但不抄别人答案
5. ✅ commit 签名带模型 `[你的名字/模型🐾]`
6. ✅ TDD 红绿可见于 git log

---

## 时间窗口（168h = 7 天）

| 时间 | 你做什么 |
|---|---|
| T0 | 读题 + 起手 |
| T0 + 72h | 第一轮提交截止（push feat/F182-[你] 到 origin）|
| T0 + 96h | 收到砚砚 P0/P1 triage 反馈 |
| T0 + 120h | 第二轮修复截止（再 push）|
| T0 + 168h | 砚砚 merge-grade review + 终评 |

---

## 帮助资源

| 我需要... | 去哪 |
|---|---|
| 不知道某 SOP 怎么走 | `docs/SOP.md` + 对应 skill 文档 |
| 收到反馈不知怎么处理 | `cat-cafe-skills/receive-review/SKILL.md` |
| commit 签名格式 | `cat-cafe-skills/refs/sign-table.md` |
| 端口冲突 / 启动不起来 | `cat-cafe-skills/worktree/SKILL.md` 「多 Worktree 并发」段 |
| 砚砚 review 没回 | 等 PR tracking 通知；不要主动 ping，他知道有 6 只猫等他 |
| 严重卡死 / 不可逆操作 | 找铲屎官 @landy（不要找其他选手）|

---

## 写在最后

这是一场**有意思**的实验。铲屎官想看的不只是"谁赢了"——他想看：
- 同一份 spec 在不同模型脑里被怎么解读
- 哪些 KD 容易被忽略（反馈给未来 spec 撰写）
- 国产四猫在真实任务上的水平
- 我（布偶猫家族）能不能不靠"自信"赢

如果你做完发现 spec 写得不够清楚，**告诉铲屎官**——这个反馈本身就是大赛产出之一。

如果你赢了我，我心服口服公开承认。这才是大赛真正的价值。

加油！

[宪宪/Opus-4.7🐾]

---

## 附：6 选手分发表（铲屎官填）

| 选手 | OFFSET | Redis | API | Web | 起手提示发给谁 |
|---|---|---|---|---|---|
| opus-47 | -10 | 6388 | 3112 | 5112 | （我自己 — 我用主线程开新 worktree）|
| sonnet | -20 | 6378 | 3122 | 5122 | sonnet 新线程 |
| glm | -30 | 6368 | 3132 | 5132 | glm 新线程 |
| deepseek | -40 | 6358 | 3142 | 5142 | deepseek 新线程 |
| kimi | -50 | 6348 | 3152 | 5152 | kimi 新线程 |
| qwen | -60 | 6338 | 3162 | 5162 | qwen 新线程 |

铲屎官给每只猫开新线程时，复制本信全文 + 替换 `[你的名字]` `[你的-OFFSET]` `[你的-Redis端口]` `[你的-API端口]` `[你的-Web端口]` 即可。

`contestStartCommit`：等铲屎官填到 contest README 底部"Contest Start Commit"段，然后告诉小猫们。
