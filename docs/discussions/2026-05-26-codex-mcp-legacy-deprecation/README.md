---
feature_ids: []
topics: [mcp, codex, deprecation, legacy, split-only, architecture, F193-phaseC-followup]
doc_kind: discussion
created: 2026-05-26
participants: [opus-47, codex (砚砚 GPT-5.5), landy]
status: open
related_prs: ["#1894"]
related_features: [F193, F212]
---

# Codex MCP Legacy Server Deprecation — 坐标系 Reframe 讨论

> **这是讨论，不是任务**——目的是收敛"PR #1894 5 轮 P1 链是不是坐标系选错"，决定终态方向。  
> **召集人**：宪宪/47 (作者 + reframer)。**关键 reviewer**：砚砚/GPT-5.5 (5 轮 P1 reviewer + strict-npm-Codex reproducer)。**决策人**：铲屎官 (愿景 + scope)。

---

## 1. 背景：PR #1894 5 轮 P1 链回顾

### 时间线

| Round | 触发 | 修复方向 | 修复 commit |
|-------|------|---------|------------|
| **0** | 社区小伙伴 `Error loading config.toml: invalid transport in mcp_servers.cat-cafe` (2026-05-25, strict npm Codex v22.22.3) | 删 `CodexAgentService.ts` L257 legacy env overlay | `b7d618436` |
| **1** | 云端 P1 "Preserve callback env injection" (`writeCodexMcpConfig` preserves user-owned legacy → 删 L257 让 user-preserved server 丢 callback env) | 加 `userHasLegacyCatCafeTransport` helper 检查 `~/.codex/config.toml`，条件化 inject | `878bb144d` |
| **2** | 云端 P1 "Resolve from project root" (cat-cafe 写到 `<projectRoot>/.codex/config.toml`，helper 只查 `~/.codex/...` 漏 primary 写入目标) | helper 先查 `<workingDirectory>/.codex/config.toml`，fallback `~/.codex/...` | `7b29826de` |
| **3** | 云端 P1 "Resolve legacy from project root" (`workingDirectory` 可能是 monorepo subdir `/repo/packages/web`，legacy 在 `/repo/.codex/config.toml`) | helper ancestry ascent + `.git/` 边界 + 32 depth cap | `354e8750b` |
| **4** | 砚砚 strict-npm-Codex reproducer catch (`$CODEX_HOME` env var override) | helper 加 `$CODEX_HOME/config.toml` lookup，paths Set dedup | `0fbca6b20` |
| **5（待修 / 待 reframe）** | 云端 P2 "Check all Codex config layers" (`/etc/codex/config.toml` 系统级 config layer) | ??? | — |

### 当前坐标系（PR #1894 走的路）

**helper 试图重现 codex CLI 的 config lookup 优先级**——用我们这边的 IO + parse 推断 codex 会不会加载 legacy `mcp_servers.cat-cafe` server，然后决定要不要 inject env overlay。

### 5 轮归纳

| Round | 漏的 config source |
|-------|------------------|
| 1 | user-level `~/.codex/config.toml` |
| 2 | project-level `<workingDirectory>/.codex/config.toml` |
| 3 | ancestry levels above `workingDirectory` (monorepo subdir) |
| 4 | `$CODEX_HOME` override |
| 5 (P2) | `/etc/codex/config.toml` 系统级 |
| 6 (predicted) | `$XDG_CONFIG_HOME/codex/config.toml` ? `~/.config/codex/config.toml` ? |

**每轮 P 的本质都是同质问题**——"helper 漏了某个 codex 会读的 config source"。

---

## 2. 数学之美 / 第一性原理自检

铲屎官 2026-05-26 06:18 magic word：「坐标系」。

按 `docs/canon/meta-aesthetics.md` 第一性原理：
> 最优表达在正确坐标系下必然最简——如果方案需要那么多层，说明坐标系选错了。

### 当前坐标系为什么错

1. **侧推 vs 直接获取**：helper 不是 codex 本身，永远在**侧推 codex 内部行为**——codex 任何版本引入新 config source 我们就漏
2. **5 轮同质 P 不是巧合**：每轮都"逻辑正确"地补一个 source —— 但前提假设没被审视
3. **认知脚手架**：层层兜底（user → project → ancestor → CODEX_HOME → /etc → XDG → ...）—— 数学之美 = 不需要兜底

### Hidden assumption 解构

云端 round-1 P1 的论证：

> `writeCodexMcpConfig` (`mcp-config-adapters.ts:284`) preserves user-owned `mcp_servers.cat-cafe` entries → 用户保留 legacy → cat-cafe 必须保证它的 callback work

这条**hidden assumption**：**cat-cafe 必须支持 user-owned legacy `mcp_servers.cat-cafe` 的 callback**。

但这个 assumption 从哪来？

### F193 Phase C 真精神回看

`docs/features/F193-cross-thread-comm-unification.md` Phase C：

> "Hub 自动流程把项目根 .codex/config.toml 重写到 4-split + limb 拓扑"  
> "ensureCatCafeMainServer 语义翻转——splits 存在时**移除** legacy `cat-cafe` + **补齐** `cat-cafe-limb`"  
> "split-only"

**F193 Phase C 设计意图 = 主动移除 legacy**。但 implementation gap：

`mcp-config-adapters.ts:302` 的 `writeCodexMcpConfig`：
```ts
// Update/add only managed entries; preserve user's own servers
for (const s of servers) {
  ...
}
```

**只 update managed entries，user-owned 不动**。结果：F193 Phase C 之前用户手动配过 `[mcp_servers.cat-cafe]` 段 → cat-cafe orchestrator 不再 manage 它，但**也不删**它 → legacy server 永远存在于 user-owned config → codex 加载它 → cat-cafe 又试图 inject env 兜底 → 5 轮 P1 链。

**implementation gap = "preserve user-owned" 抵消了 "split-only"**。

### 真正的坐标系

**不是**：helper 重现 codex config lookup 优先级。  
**而是**：补完 F193 Phase C 的 deprecation —— 让 `writeCodexMcpConfig` (以及同类 `writeGeminiMcpConfig` / `writeAntigravityMcpConfig`) **主动 remove user-owned legacy `mcp_servers.cat-cafe` entry**。

### 新坐标系下方案的复杂度

```
当前 helper（坐标系错）：
  - readLegacyCatCafeTransportFromFile (read + parse TOML)
  - findLegacyCatCafeTransportInAncestry (32-level ascent + .git boundary)
  - userHasLegacyCatCafeTransportFromUserPaths (CODEX_HOME + HOME dedup)
  - userHasLegacyCatCafeTransport (orchestrator)
  + 4-5 个测试 (round-1/2/3/4 + P2 round-5 待加)
  ~80 行 source + ~250 行测试

新坐标系（终态）：
  - mcp-config-adapters.ts writeCodexMcpConfig: 主动 delete existingMcp['cat-cafe']
  + 1 行 log.warn
  + 1 个测试
  ~5 行 source + ~20 行测试
```

**16x → 5 行**。这是数学之美的信号。

---

## 3. 终态建议

### 改动 scope

| 文件 | 改动 |
|------|------|
| `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` | 删 `userHasLegacyCatCafeTransport` 全 helper（含 ancestry / CODEX_HOME / readFromFile）+ 删 `import { readFileSync, parseToml }` + 删 import `homedir`。L257 保持已删状态。 |
| `packages/api/src/config/capabilities/mcp-config-adapters.ts` | `writeCodexMcpConfig` 内：检测 + 删除 user-owned `existingMcp['cat-cafe']` + log.warn 通知 "legacy cat-cafe server entry removed per F193 Phase C split-only migration; cat-cafe-{collab,memory,signals,limb} are auto-provisioned" |
| 同上 + Gemini/Antigravity adapter | 评估 + 同步处理（这两个 adapter 路径目前还 preserve legacy，需要 trace 是否同 deprecation） |
| `packages/api/test/codex-agent-service.test.js` | 删 round-1/2/3/4 的 legacy lookup 测试（4 个），主测试断言保留 "must NOT inject any `mcp_servers.cat-cafe.*`"（round-0 状态） |
| `packages/api/test/mcp-config-adapters.test.js` | 加测试 "writeCodexMcpConfig actively removes user-owned legacy cat-cafe entry"（同理 Gemini/Antigravity） |
| `docs/features/F193-cross-thread-comm-unification.md` | 加 Phase C follow-up 节，记录 implementation gap + 本次 deprecation 补完 |
| `docs/lessons-learned.md` | 加教训：5 轮 P1 = 坐标系错信号；"preserve user's own" 抵消"split-only" 是 design 矛盾 |

### 用户影响

- 用户 `~/.codex/config.toml` (或任一 config source) 里如果有手动配的 `[mcp_servers.cat-cafe]` 段，**下次 cat-cafe 调用 codex 时该段被主动删除** + log.warn
- 替代方案 = 4 个 split server（cat-cafe-collab/memory/signals/limb，自动 provision）
- 用户已有 legacy 段如果指向 deprecated all-in-one mcp-server binary，删除是**正确行为**（那个 binary F193 Phase C 后不再 build）
- 用户已有 legacy 段如果指向**第三方 cat-cafe-flavored** server（非自家 mcp-server）？这种 case：用户自定义 server name=cat-cafe → 被我们 auto-remove → 破坏用户场景 → **需评估发生概率**

---

## 4. Open Questions

### 给砚砚（reviewer 视角）

**Q1 (核心)**: 你 5 轮 P1 review 都基于"cat-cafe 必须保护 user-owned legacy `mcp_servers.cat-cafe` callback"——这个 hidden assumption 你怎么看？是 F193 spec 的隐含承诺，还是 review 推理时引入的？

**Q2 (实测验证)**: 你 strict-npm-Codex reproducer 跑过 `[mcp_servers.cat-cafe] command="echo" args=["dummy"] enabled=false` 形态吗？如果这种 "完整 transport + disabled" 形式 codex 也不报错，那我们可以**总是注入完整 dummy legacy server definition**（绕过 lookup），也是另一种 reframe 候选。但你倾向哪个？

**Q3 (deprecation 边界)**: `writeGeminiMcpConfig` (`mcp-config-adapters.ts:323+`) 和 `readAntigravityMcpConfig` 是否同步 deprecation？Gemini / Antigravity 的 mcp_servers.cat-cafe 路径 review 时我们没动 — 这次一并 trace 还是 deferred？

**Q4 (用户场景破坏风险)**: 用户场景中 "我自己写了一个 `cat-cafe` server 的第三方版本"（与自家 mcp-server 不同 binary，但 name 冲突）的发生概率你怎么估？如果非零，主动 remove 会破坏他们。我们要不要加一个 "owner-tag" 区分（cat-cafe 写入的有 marker，第三方的无 marker）？

### 给铲屎官（CVO 视角）

**Q5 (scope)**: 这次 reframe 改 `mcp-config-adapters.ts` 跨 hotfix 边界 — 是开新 feat 走完整 SOP（discussion → spec → worktree → tdd → review → merge），还是在 PR #1894 直接 retarget？

**Q6 (社区小伙伴临时方案)**: 当前给社区小伙伴的 workaround（手动配 `[mcp_servers.cat-cafe] command="echo" args=["legacy-shim"] enabled=false`）在新坐标系下**会被自动删除** — 我们要不要先放一个"hotfix 极简版"（只删 L257，不动 mcp-config-adapters）给社区止血，再做完整 deprecation？

**Q7 (Migration ergonomics)**: 用户已配 legacy 段被 auto-remove + log.warn 是否够？要不要更"温柔"——首次发现时只 warn（不删），第二次访问发现 user 没自己迁移再 remove？还是直接 remove 一刀切？

### 给我自己（作者 self-check）

**Q8 (5 轮 P1 是不是浪费)**: 5 轮砚砚 + 云端 review 工作虽然每轮"逻辑正确"，但都在错坐标系里——这是 review process 的失败还是必要的探索？应不应该更早质疑坐标系？

**Q9 (其他坐标系是否更优)**:
- A. 主动 remove (本 doc 推荐)
- B. 总是注入完整 dummy (Q2 候选)
- C. spawn `codex --print-config` 读真实 effective config (动态准确，但每 invoke + IO)
- D. 完全放弃支持 legacy callback，文档警告用户自迁移（最弱) 

哪条最 elegant？

---

## 5. 我的倾向（透明推理链）

### 推理

1. **F193 Phase C spec 是 split-only** → legacy `cat-cafe` 应该被 deprecate，不是被 preserve
2. **implementation gap (preserve user-owned) 是 design bug，不是 feature** → 补完是正确方向
3. **主动 remove > 总是注入 dummy**：因为 dummy 仍然让用户的 config 包含"看起来有但实际无用" 的 server entry，eventually 还是会困惑；主动 remove 是干净的真终态
4. **`codex --print-config` 太重**：每次 invoke + spawn 一次 codex 读 config = 性能开销 + IO
5. **完全放弃 legacy callback + 文档警告**：理论上最弱兜底，但**等价于** "主动 remove + warning" 的子集（remove 之后 callback 自然消失，warn 告诉用户原因）

### 倾向选项

**主动 remove user-owned legacy + log.warn**（terminate F193 Phase C deprecation）

理由：
- 数学之美最大（~5 行 source）
- 完成 F193 Phase C 设计意图
- 用户体感：legacy 段消失 + 看到 warn → 知道要用 split 4 个 server
- 5 轮 P1 根因消失（不存在 round-6/7）

### 顾虑

- Gemini / Antigravity adapter 是否同步处理 — 需要 trace（Q3）
- 第三方 cat-cafe-flavored server 场景（Q4）— 如概率非零需要 owner-tag

---

## 6. 收敛路径

1. **砚砚 review 本 doc**（特别关注 Q1-Q4）→ 表态：agree / disagree / 修改建议
2. **铲屎官签 scope 决策**（Q5-Q7）→ 选 hotfix-极简版 + 新 feat 双轨 / 单轨重构 PR #1894
3. **收敛后**：
   - 如选 A（主动 remove）→ 开新 feat F213 "Cat-Cafe MCP Legacy Server Deprecation"，走完整 SOP
   - 如选 B（dummy 注入）→ 同上但实施不同
   - 如选 hotfix-极简版（先给社区止血）→ retarget PR #1894 回到 round-0 简洁状态，删 helper + 4 测试 + 加注释；新 feat 开 deprecation
4. **PR #1894 当前状态**：pause，留 comment 说明 reframe，不 merge

---

## 6.1 砚砚收敛 (2026-05-26 23:43)

砚砚独立 collaborative thinking 后 push back 我的 A 方案，并补 strict-npm Codex 实测 — 总结：

- **Q1 hidden assumption 来源 = ADR-036**（不是凭空）：`docs/decisions/036-f209-retrieval-surface-multi-layer.md` L43-55 显式写"legacy monolithic 是 2 个 topology cell 之一" + "L4 env-only overlay" + "L5 user config 已有时不删"。我（作者）之前 reframe 没核这条 ADR——「我能猜出来」病复发。
- **Q2 实测结论 = B 方案可行**：strict npm codex 接受 `command="echo" args=["legacy-shim"] enabled=false` 完整 dummy disabled + env 形态，过 config parse。B 比 lookup-based 干净——不侧推 codex internal lookup，直接用 CLI 最高优先级 override。
- **Q3 deprecation 边界**：要做 deprecation 必须 trace 所有 writer（Claude `.mcp.json` / Codex / Gemini / Kimi / Antigravity），不只 Codex。这是 feat scope 不是 PR 边角约定。
- **Q4 第三方破坏风险**：非零 → 删除规则必须保守，只删可识别形态：
  - `args[0]` 指向/后缀 `packages/mcp-server/dist/index.js`（自家 all-in-one 历史 binary）
  - 或我们明确给过的 workaround `command="echo" args=["legacy-shim"]`
  - 或未来带 owner marker 的 managed entry

### 砚砚推荐方案（不是纯 A）

1. **L4 / CodexAgentService**：**总是注入完整 disabled dummy `cat-cafe`**（不再 lookup）—— 无 legacy config 不炸（完整 transport），有 legacy config 也被本次 invocation split-only 化（enabled=false override）
2. **L5 / config writers**：**只删"可证明是我们遗留 all-in-one"的 entry**（保守 marker 识别），不无条件删 user-owned `cat-cafe`
3. **ADR-036 必须修订/废弃 legacy cell**——不然以后 reviewer 仍会按 ADR-036 挡你

## 6.2 作者收敛 (我同意砚砚)

**接受砚砚 B 方案**作为终态。我之前推 A 没核 ADR-036 是错的，公开承认。

新方案总结（覆盖原 §3"终态建议"）：

| 文件 | 改动 |
|------|------|
| `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` | 删 `userHasLegacyCatCafeTransport` 全 helper（含 ancestry / CODEX_HOME / readFromFile）。**新增**：buildCatCafeMcpConfigArgs 末尾注入完整 disabled dummy legacy override（`command="echo" args=["legacy-shim"] enabled=false` + env overlay 跟 split servers 同步）。这样既满足"不 partial definition"，又"per-invocation 关掉 legacy"。 |
| `packages/api/src/config/capabilities/mcp-config-adapters.ts` | `writeCodexMcpConfig` + `writeGeminiMcpConfig` + `readAntigravityMcpConfig`：**选择性 remove** user-owned `mcp_servers.cat-cafe` entry — 仅当：`args[0]` 后缀匹配 `packages/mcp-server/dist/index.js` (自家 deprecated all-in-one) OR `command=="echo" && args[0]=="legacy-shim"` (我们之前给过的 workaround) OR 未来 managed entry 含 owner marker。unknown entry 保留 + log.warn "reserved legacy server id shadowed by split-only migration" |
| `docs/decisions/036-f209-retrieval-surface-multi-layer.md` | **amend**：legacy monolithic cell 改为"per-invocation disabled override（L4）+ selective L5 remove"，不再 env-only overlay；reviewer checklist 更新 |
| `docs/features/F193-cross-thread-comm-unification.md` | 加 Phase C follow-up 节：implementation gap + ADR-036 amend 关联 |
| 测试 | 删 4 个 legacy lookup test；加 "总是注入 disabled dummy override" test；加 mcp-config-adapters selective remove test（含未知 entry 保留 case） |

**关键变化 vs 我原 A 方案**：
- A：无条件删 user-owned legacy → 破坏第三方 cat-cafe-named server
- B：保留未知 user-owned，per-invocation disable 它（最高优先级 CLI override）+ 仅删"可证明是我们遗留"

## 6.3 剩余开放问题升级到 CVO

OQ-amend：**修订 ADR-036 legacy cell** — 是个**愿景级 / 架构 cell 决策**，硬条件升级 @landy：

- ADR-036 是 F209 D.0 readiness gate 拍板（2026-05-25 PR #1883），距今 1 天
- 1 天后就修订 / 废弃部分 cell 是不是过早？
- 还是承认 "ADR-036 没考虑 strict-codex limit" 是设计盲点，必须 amend？
- amend 范围：legacy cell 整个废弃 vs 改为"disabled override + selective remove"
- 影响：ADR-036 reviewer checklist 改 → 未来 PR review 不再要求 trace legacy cell env

OQ-scope：本次 PR #1894 走向（合并铲屎官原 Q5）：
- **C1**：retarget PR #1894（hotfix → feat scope），实施 B 方案（要 worktree 改 mcp-config-adapters + ADR amend + 重新 review chain）
- **C2**：close PR #1894，开新 feat F213 + 给社区小伙伴**临时极简 workaround**（手动 config 即可绕开）
- **C3**：close PR #1894，新 feat 直接走 SOP，无 workaround（社区小伙伴等几天）

我倾向 C2：close PR #1894 + 新 feat F213 走 SOP，工作量分摊；同时给社区小伙伴极简 workaround 不让他卡住。

## 7. 历史关联

- F193 Phase C (PR #1605, 2026-04) — split-only 设计 + implementation
- **ADR-036** (`docs/decisions/036-f209-retrieval-surface-multi-layer.md`, 2026-05-25 closed by PR #1883) — F209 retrieval surface multi-layer + **legacy monolithic 当作 topology cell 保留 + L4 env-only overlay 设计**。本 reframe 触发的 ADR amend
- F212 (kickoff 2026-05-25, 见 `docs/features/F212-cli-error-diagnostics.md`) — CLI Error Diagnostics 错误展示改进（不同 scope，但都源于"社区小伙伴 codex exit code 1"事件）
- PR #1894 (hotfix/codex-mcp-legacy-transport, 5 commits, paused 等讨论收敛) — 坐标系初始 hotfix
- `docs/canon/meta-aesthetics.md` — "数学之美 / 第一性原理" canon
- `feedback_no_followup_tails.md` — 铲屎官硬指令"别 follow up 你最好"
- `feedback_architectural_kd_autonomy.md` — 架构级 KD 在三猫收敛后 47 自决，不逐条 ack
- `feedback_check_simple_causes_first.md` — 应该先查 ADR-036（作者反思）
- 「我能猜出来」magic word — 布偶猫家族病：作者 reframe 时没核 ADR-036 凭直觉推「F193 真精神」(2026-05-26 复发)

[宪宪/Opus-47🐾]
