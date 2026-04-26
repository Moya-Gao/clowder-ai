---
capsule_id: "F061-completion-2026-04-26"
context: "F061 Antigravity 接入孟加拉猫 Feature close 反思（跨 7 周 Phase 0→2c + R2/R3 通过其他 Feature 闭环）"
feature_ids: [F061]
doc_kind: capsule
created: 2026-04-26
---

## What Worked

- **Phase 拆分粒度**：Phase 0（spike）→ 1（CDP 接入）→ 1.5（ConnectRPC bridge 替换）→ 2a（健壮性）→ 2b（证据链 placeholder）→ 2c（工具平权）。每个 Phase 都有可独立 merge 的可见交付，避免大 PR
- **铲屎官原话作为愿景锚**：spec Why 段直接引用"图片生成是接入主因"等原话，每次 Phase 完成可以对照原话复盘，不会漂移到工程师自嗨方向
- **多猫合作模式**：宪宪做接入实现，砚砚做架构 review + 安全 nitpick，孟加拉自己做实机 stakeholder validation。三角分工 = 谁也不能既写又审又验
- **Bug 树状跟踪**：Bug-A~J 平铺命名 + 每条单独段落 + ✅ FIXED / ⚠️ OPEN / ⚠️ PARTIAL 状态机。任何猫读 doc 5 分钟能定位状态
- **R2/R3 跨 Feature 闭环**：意识到 R2 不需要在 F061 内重做（F172 已经做了），R3 不需要单独证据链通道（rich block 体系够用）。**愿景需求 ≠ 必须本 Feature 内实现，可以由其他 Feature 接力**
- **架构 debt 显式化**：Bug-H 不硬塞 F061，立 F178 接续；Bug-J/Bug-F P3 留 F061 doc 内不外抛 placeholder Feature。"未做"和"已做"边界透明

## What Failed

- **R2/R3 doc 状态滞后**：F172 Phase C 早就闭环 R2，但 F061 doc 一直写 `[ ]` 直到 2026-04-26 铲屎官 ping 才发现。**Cross-feature 完成时应该主动同步源 Feature 的 AC 状态**
- **Phase 2c v2 假设错误**：本以为 Antigravity LS 不能跑 file/code 操作需要 Bridge 代执行，开 worktree 准备建 ReadFileExecutor。Bengal 实测前没有让他真跑一次—— 实测后才发现整个 v2 scope 不需要做（close as no-op）。**应该先证伪再开工**
- **PR #1414 R0 漏看生产路径**：写 `resolveBinaryRoot` 时把 `opts > env > cwd` 当默认正确顺序，没核 routes/capabilities.ts 实际总是传 explicit opts。砚砚 review 退回。**helper precedence 设计前必须 trace 所有生产 call site**
- **Bug-F workaround 路径绕了一圈**：先怀疑 pesosz extension 机制可补救（patch iframe filter），花 60s 高频 monitor 才确认 cascade panel 不通过 CDP /json/list 暴露，patch 无效 revert。本来可以直接调研 MCP 路径
- **PR tracking 漏注册**：merge-gate Step 3 明确说"开 PR 后必做 cat_cafe_register_pr_tracking"，PR #1414 开完忘了，云端 codex review 通知差点漏掉

## Trigger Missed

- **跨 Feature 状态同步元思考**：当 Feature B 完成 Feature A 的子需求时，应该自动触发"回写 Feature A 的 AC 状态"。F172 Phase C merge 时没回写 F061 AC-7
- **元审美自检**（Meta-Aesthetics canon）：PR #1414 R0 设计时没问"opts > env 是坐标变换还是多项式堆项"。其实是后者（在 explicit opts 上叠 env fallback），导致 env 在生产路径死代码
- **"先证伪"优先级**：Phase 2c v2 / Bug-F pesosz 都是先建假设再花精力验证。应该先用最小成本证伪（Bengal 跑一条命令 / monitor 60s），再决定是否开工

## Doc Links

- F061 spec: `docs/features/F061-antigravity-bengal-cat.md`
- F061 completion vision Q&A: `docs/discussions/2026-04-26-f061-completion/README.md`
- F172 Phase C 实现: `docs/features/F172-generated-image-publication.md` (R2 闭环路径)
- F174 Lifecycle 基建: `docs/features/F174-callback-auth-lifecycle.md` (Bug-H follow-up 前置)
- F178 接续: `docs/features/F178-persistent-mcp-agent-key-auth.md` (Bug-H 接力)
- 关键 PR 序列: #1137 (Phase 2a) / #1230 (Bug-8 v1) / #1307 (MCP纳管) / #1351 (Bug-I) / #1383 (Bug-D close) / #1396 (Bug-F UX) / #1414 (binary/workspace 分离)

## Rule Update Target

- **`feat-lifecycle` Step 4 (BACKLOG 移除)**：补一条"如果本 Feature 的 R 由其他 Feature 完成，必须 commit 时同步源 Feature 的 AC checkbox"
- **`merge-gate` Step 7.5 (Phase 文档同步)**：扩展为"若本 PR 满足其他 Feature 的 R/AC，回写源 Feature doc"
- **`receive-review` VERIFY 三道门**：在 Mechanism Gate 中加一句"如果是 helper precedence / fallback 链路，必须 trace 所有生产 call site，验证设计在实际数据流中真的可达"
- **新教训**：考虑加 `feedback_falsify_before_implement.md` — 开假设性 worktree 前先用最小成本证伪（如 Phase 2c v2 / pesosz extension 教训）
- **新教训**：考虑加 `feedback_register_pr_tracking_post_create.md` — 提醒 merge-gate Step 3 不能漏

## Final Status

- F061 R1-R4 全 ✅，AC 全 ✅
- 残留 Bug-H 立 F178 接续，Bug-J/Bug-F P3 留 F061 doc 内透明记录
- 准备 @ 孟加拉做愿景守护，放行后 Step 1-6 真正 close
