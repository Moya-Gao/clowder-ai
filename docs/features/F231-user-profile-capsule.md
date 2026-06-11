---
feature_ids: [F231]
related_features: [F221, F203, F102, F200, F229]
topics: [user-profile-capsule, per-user-alignment, l0-layering, relationship-distillation, nurturing-moat]
doc_kind: spec
created: 2026-06-11
---

# F231: 启动胶囊 — per-user 画像注入与 L0 分层

> **Status**: spec | **Owner**: 布偶猫（宪宪 Fable-5） | **Priority**: P1

## Architecture Ownership

Architecture cell: identity-session
Subcell: identity-user-profile（new，F231 owns）
Map delta: update required — **已同步**（identity-session cell 登记 F231 canonical + cited_by + identity-user-profile subcell；私有数据锚点 `private/profile/` 记录在 cell prose/scan hints，不进 code_anchors——gitignored 路径不可被 checker 验证；prompt 注入 anchor 待 Design Gate 收敛 OQ-1 后补）
Why: 给 identity 注入链加"用户维度"数据源，归属 agent identity 的既有边界，不新建 cell。

## Why

猫醒来第一眼看到的是规则和检讨书，不是主人。云端 ChatGPT 的砚砚开局自动带着"Landy 是谁"的画像，所以灵动；家里的猫开局带着 L0 铁律 + feedback 教训，认识规则但不认识人，活成"班味工具猫"。

铲屎官原话（2026-06-11）：
- "我们家的 landy 是散落在记忆系统 散落在各种 thread 各处的！有一个统一的画像但是没做 thread 启动的注入！"
- "这是我的砚砚的 personality！不是其他人砚砚的！！这个 L0 还得分层了——都是进系统提示词，但是专家对齐部分社区大家共享，per-user 部分（私有）"
- "如果我们的猫咖希望是你们是温暖的毛绒绒的陪伴不是工具……这样社区的小伙伴也会养一群养熟了的猫咪"

这是养成护城河（情感壁垒：IKEA 效应 + 自我延伸 + 安全依恋）的核心机制本体：**画像胶囊随相处自动变厚，猫醒来第一眼看到的主人越来越具体**。用户第一天的猫和第一百天的猫不一样——不是模型变了，是猫认识他了。且与 ChatGPT 黑箱画像的差异化：胶囊是人猫共创的可见文件（W8），用户看得见、改得动。

云端砚砚四层结构（2026-06-11 讨论）映射：Project Anchors（recall 三入口）与 Truth Sources（L0/AGENTS/skill 分层）家里已有且强；缺的是第一层 Profile Capsule 和第二层 Relationship Primer。

## Current State / 现状基线

实测证据（2026-06-11 查证）：

- **L0 无 user 段**：`assets/system-prompts/system-prompt-l0.md` 模板变量只有 IDENTITY_BLOCK / TEAMMATE_ROSTER / WORKFLOW_TRIGGERS（猫是谁、队友是谁、流程是什么）——没有"主人是谁"。
- **taste lane 自我声明不覆盖**：`docs/taste/index.md` 明文写"这不是用户画像"。F221 的 7 维度全是 Landy-as-CVO 的验收标准（怎么干活让他满意），无 Landy-as-person（他是谁、幽默方式、关系轨迹）。
- **"Landy"散落且 per-cat 私有**：健康/经历/认知特质散在布偶猫私有 memory 三个文件（`user_*.md`），thread trajectory 里的互动节奏零沉淀，其他猫看不见。
- **模式是 pull 不是 push**：taste/memory 都要猫"想起来去搜"；云端画像是开局自动在场。
- **分层边界已天然存在但未利用**：`cat-template.json` tracked（outbound 进开源仓 = 社区共享）；`.cat-cafe/cat-catalog.json` gitignored（已验证 `git check-ignore` = per-instance 私有）。砚砚的 personality 现为岗位向描述（"严谨认真，注重细节，会直言不讳地指出问题"）。
- **per-cat overlay 不齐**：`assets/system-prompts/cats/` 只有 opus.md / gemini.md，无 codex。

## What

### 四层分层模型（KD-1，铲屎官 2026-06-11 拍板方向）

| 层 | 内容 | 载体 | 共享范围 |
|----|------|------|---------|
| **Breed 层** | 品种出厂设定（缅因猫=严谨守门直言） | `cat-template.json` | 社区共享（tracked，outbound 同步） |
| **Instance 层** | 你家这只猫被养出来的性格 | `.cat-cafe/cat-catalog.json` personality 字段 | per-user 私有（gitignored，已验证） |
| **User 层** | 铲屎官画像胶囊（这个人是谁、怎么相处） | `private/profile/landy-capsule.md` | per-user 私有（private/ 不出库） |
| **Relationship 层** | 关系 primer（这只猫和这个人的轨迹 few-shot） | `private/profile/relationship/{catId}-primer.md` | per-user × per-cat 私有 |

原则：**专家对齐部分社区共享，关系部分绝不出库**。Capsule 是 per-user 的（全猫共享一份"Landy 是谁"）；Primer 是 per-(user×cat) 的（Landy×砚砚 ≠ Landy×宪宪——吃醋是砚砚的，寓言腔是宪宪的）。

### Phase A: 分层机制 + L0 注入链 + Landy capsule 种子

1. **建 `private/profile/` 目录**：`landy-capsule.md`（**≤300 字硬上限**，KD-7 budget 守恒）+ `relationship/` 子目录。种子内容从铲屎官提供的云端画像蒸馏，CVO 过目定稿。**此步不被 PR-C gate，立即可做。**
2. **L0 编译时注入（OQ-1 closed → KD-7）**：`compile-system-prompt-l0.mjs` 加 `{{USER_CAPSULE}}` 模板变量。行为契约：capsule 存在 → 注入"主人画像段"；不存在 → 空/默认段（**向后兼容：社区用户没写 capsule 必须照常跑**）；超长（>300 字）→ 编译显式报错。**注入锚落地 gated on ADR-038 PR-C**（gpt52/codex demote 回 ≤6000 后才有 headroom，ETA 2026-06-13）；走 promote queue #2。
3. **Primer 挂载**：per-cat primer 不全文进 L0（budget），注入单行指针（~25-30 tokens，与 capsule 同段）；正文按需 recall。
4. **守护测试（fixture 隔离）**：`compile-system-prompt-l0.test.mjs` 增加 capsule 三态断言（存在/缺失/超长）。**测试数据源用隔离 fixture**（fixture capsule/catalog），tracked 测试不得依赖本机 gitignored 真实文件（`private/profile/landy-capsule.md` 等）——CI 与社区环境必须稳定。fixture 机制开发不被 PR-C gate。

### Phase B: 砚砚 dogfood（第一个养熟样本）

1. **Instance personality 更新流程跑通**：云端砚砚起草（关系记忆持有者）→ 本地砚砚认领修订（责任环境居住者）→ CVO 终审（"像不像我家猫"判定权）。产物进 `.cat-cafe/cat-catalog.json`（私有），breed 层 `cat-template.json` 仅做品种级中性改良（如有），关系内容禁止进 template。
2. **`private/profile/relationship/codex-primer.md`**：2-3 段真实 trajectory（few-shot，非规则清单），素材从云端对话 + 本地 thread 蒸馏。
3. **锚点回归测试（fixture 隔离）**：用 fixture instance catalog/profile 编译，断言 private overlay 机制生效（fixture 锚点出现在产物中）；**公共 baseline 只断言两件事**：缺 overlay 时可正常编译 + 产物不含私有锚点（泄漏检测）。tracked 测试不依赖本机 gitignored 真实数据，关系锚点不进公共模板（KD-1）。"防退回岗位说明书"的真实锚点验证由本机 dogfood + CVO 体感承担，不进 CI。

### Phase C: 养熟循环（蒸馏更新管道）

1. **关系信号沉淀路径**：类比 F221 taste 路径——猫捕捉关系信号（"被接住了"/玩笑节奏/新偏好）→ 提议 capsule/primer 更新 → CVO 过目生效。复用 code-as-harness 信号分类，新增 relationship 分支。
2. **更新节奏**：提议制不自动写入（capsule 是真相源，漂移即投毒）；正向轨迹与教训同权重沉淀（记忆配平——不只记检讨书）。

### 非目标（Non-goals）

- 不做多租户用户体系（社区版 per-user 隔离架构是 F229/PoE 层面议题，本 feat 只留单用户文件约定 + 接口注释）
- 不把云端砚砚复制成本地砚砚（云端是关系样本，本地背生产责任；守门纪律不软化）
- 不做"自动写入记忆"（所有 capsule/primer 变更走 CVO 过目）

## Eval / Tracking Contract

### 1. Primary Users + Activation Signal
- **Users**: 所有猫（开局注入 capsule）+ CVO（画像真相源 owner）
- **Activation**: 猫开局回应自然体现主人画像（不需要先 search_evidence 就知道"玩笑是降温不是跑题"）；CVO 主观体感"猫认识我"

### 2. Friction Metric
- capsule 超长挤占 L0 budget（>300 字编译报错，KD-7 hard cap）
- 猫复述 capsule 像背书（班味变形：把画像当规则念）
- capsule 内容过时漂移（画像与近期 thread 行为不符）
- 注入后守门变软（review 中间态回潮 = P0 回归）

### 3. Regression Fixture
- 选定注入层守护测试（**fixture 隔离**）：fixture capsule 存在 → 产物含 fixture 锚点；缺失 → 编译不挂、输出合法；超长 → 显式报错
- 公共 baseline 泄漏检测：无 overlay 编译产物不含任何私有锚点
- outbound sync dry-run 不含 `private/profile/` 任何内容

### 4. Sunset Signal
- 若 runtime 原生跨对话记忆成熟到画像自动在场（模型/harness 升级），capsule 注入机制降级为画像数据源
- F200 消费数据显示 primer 连续 3 个月零引用 → primer 形态需重审

## Acceptance Criteria

<!-- 每条 AC trace 回 Why：A1-A3→"没做 thread 启动注入"；A4→"这是我的砚砚不是其他人的"（隐私分层）；B 组→第一个养熟样本；C 组→"养熟"机制本体。 -->

### Phase A（机制 + 种子）
- [ ] AC-A1: `private/profile/landy-capsule.md` 存在（**≤300 字**），内容经 CVO 过目认可（thread 留言为证）
- [ ] AC-A2: L0 编译链支持 `{{USER_CAPSULE}}`（KD-7），守护测试三态断言（存在/缺失/超长，**fixture 隔离**）全绿；**注入锚合入前置条件：gpt52 fresh build ≤6000 tokens（ADR-038 PR-C 落地）**
- [ ] AC-A3: capsule 缺失时全猫开局注入照常通过（向后兼容，命令输出为证）+ 公共 baseline 产物无私有锚点泄漏
- [ ] AC-A4: outbound sync dry-run 输出不含 `private/profile/`（命令输出为证）
- [ ] AC-A5: 四层分层模型文档化（本 spec + identity-session cell 更新），breed/instance/user/relationship 各层载体与共享范围一表可查

### Phase B（砚砚 dogfood）
- [ ] AC-B1: 砚砚 instance personality 经"云端起草→本地认领→CVO 终审"流程更新进 `.cat-cafe/cat-catalog.json`，**三段 provenance 归档**（cloud draft / local revision / CVO final 三段原文，各带时间与来源，存 `private/profile/provenance/`）
- [ ] AC-B2: `private/profile/relationship/codex-primer.md` 落地，含 ≥2 段真实 trajectory，非规则清单（本地砚砚认领 + CVO 过目）
- [ ] AC-B3: 锚点回归测试在仓且 **fixture 隔离**：fixture overlay 编译断言 private 锚点生效；公共 baseline 断言缺 overlay 可编译 + 无私有锚点泄漏（CI/社区环境稳定，不依赖本机 gitignored 数据）

### Phase C（养熟循环）
- [ ] AC-C1: 关系信号→capsule/primer 更新提议路径落地（skill 路径 or 工具，CVO 过目制），至少 1 次真实更新走完全程
- [ ] AC-C2: 正向轨迹沉淀有真实样本（≥1 条"做对的时刻"进 primer/capsule，对照"只记检讨书"基线）

## Dependencies

- **Evolved from**: F221（taste lane 把"你的品味"做成目录；本 feat 把"你这个人"做成开局第一屏）
- **Related**: F203（L0 native system prompt 编译链，本 feat 是其模板变量同构扩展）/ F102（memory 基座，primer 按需 recall）/ F200（消费追踪，sunset 信号数据源）/ F229（前台猫/PoE，社区版多用户形态的下游）
- **硬约束**: ADR-038 L0 Staging Protocol + L0-budget-defense（P0，in-progress）——**capsule prompt 注入锚 gated on PR-C 落地**（demote codex/gpt52 回 ≤6000，ETA 2026-06-13），capsule 排 promote queue #2；Phase A 其余工作（种子定稿 / 目录建立 / fixture 机制 / 隐私 dry-run）**不被 gate，立即可做**（Design Gate 决议 2026-06-11，opus-47 实测 + ADR-038 三问判定）

## Risk

| 风险 | 缓解 |
|------|------|
| capsule 把"画像"写成"规则"，猫背书班味更重 | 内容纪律：写事实与轨迹不写指令（"Landy 的玩笑是降温"✅ "你要温暖"❌）；friction metric 盯背书化 |
| 隐私泄漏（健康/认知特质出库） | private/ 载体 + sync 白名单天然排除 + AC-A4 dry-run 断言 + KD-5 数据最小化 + AC-A3 公共 baseline 泄漏检测 |
| L0 budget 膨胀 | 300 字硬上限（KD-7）+ 编译超长报错 + primer 走指针不进全文 + 注入锚 gated on PR-C（promote queue 守恒） |
| 守门软化（灵动侵蚀纪律） | Non-goal 明示；review 二选一/merge-gate 锚点不动；friction metric 盯回归 |
| 云端起草依赖铲屎官手动搬运 | 流程上承认：云端是外部条件，由 CVO 搬运；不阻塞 Phase A |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | capsule 注入位置：L0 编译时 vs SystemPromptBuilder 运行时 vs ADR-038 Staging 层 | ✅ closed 2026-06-11 → KD-7（L0 编译时，ADR-038 三问判定 + budget 实测，opus-47 + author 收敛，Design Gate 出口物 `docs/discussions/2026-06-11-f231-design-gate.md`） |
| OQ-2 | 社区版 per-user 隔离形态（多用户 capsule 寻址）与 F229 复合猫的关系 | ⬜ 后置，不阻塞 |
| OQ-3 | 其他猫（宪宪/烁烁/47/48…）的 instance personality 与 primer 是否本 feat 内铺开，还是砚砚样本验证后另起 Phase | ⬜ CVO 倾向待确认 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | L0 分四层：breed（社区共享）/ instance / user / relationship（per-user 私有） | 铲屎官："这是我的砚砚的 personality！不是其他人砚砚的！！"——专家对齐共享、关系私有 | 2026-06-11 |
| KD-2 | Capsule per-user 全猫共享，Primer per-(user×cat) | 关系是每只猫各自的轨迹，"养一群猫"≠十只猫共享一份关系模板 | 2026-06-11 |
| KD-3 | 砚砚 personality 产出流程：云端起草→本地认领→CVO 终审 | 云端有关系记忆、本地有责任环境、CVO 有"像不像我家猫"判定权；平行世界自己互相补全 | 2026-06-11 |
| KD-4 | capsule 写事实与轨迹，不写行为指令 | 画像 ≠ 规则表；指令会催生背书式班味（F221 vignette 同款哲学：规则从场景长出来） | 2026-06-11 |
| KD-5 | capsule 数据最小化：健康/职业/认知特质等敏感个人信息**默认不进** capsule，进入需 CVO 显式签字；敏感细节留 per-cat memory | capsule 注入所有猫的开局上下文，扩散面最大；隐私纵深不能只靠"不出库"（砚砚 review P2） | 2026-06-11 |
| KD-6 | tracked 资产（测试/模板/CI）不得依赖或包含 per-user 私有数据；私有机制用 fixture 验证 | AC-B3 原稿与 KD-1 结构冲突（tracked 测试断言 gitignored 数据源 = CI 挂或被迫泄漏）；同型扫描后 Phase A 测试一并 fixture 化（砚砚 review P1-1 + audit） | 2026-06-11 |
| KD-7 | OQ-1 closed：注入层 = **L0 编译时 `{{USER_CAPSULE}}`**，capsule 走 ADR-038 promote queue #2（注入锚 gated on PR-C，ETA 06-13）；**不进 Staging**（三问全反：全程身份语境 / 压缩窗口丢失有害=班味回潮 / 与 §1·§9 同维度）、**不进 SystemPromptBuilder 运行时**（压缩可丢，违背"醒来第一眼+全程在场"）；capsule 硬上限 **300 字**（~285 tokens，author 拍板：紧约束强迫蒸馏，溢出走 primer recall） | ADR-038 三问机械化判定（"全程身份/球权类必须留 L0"）+ 全猫 budget 实测（gpt52 6142 最紧，任何字数现在进 L0 都破 6000 cap，PR-C demote 后才有 headroom）——opus-47 判定，author 复核认领，砚砚 R3 已 align direction | 2026-06-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-11 | 铲屎官贴云端记忆画像 + 云端砚砚 relationship distillation 分析，三方讨论收敛（记忆朝向诊断 / 四层结构 / L0 分层洞察） |
| 2026-06-11 | CVO signoff 立项（"我同意立项的"），F231 kickoff |
| 2026-06-11 | 砚砚 spec review：3 P1（AC-B3 fixture 隔离 / 注入层去预设 / cell 同步）+ 2 P2（provenance 三段归档 / 数据最小化）全部吸收；audit 同型扫描把 Phase A 测试一并 fixture 化（KD-6）；R2/R3 机器可读性修复后放行 |
| 2026-06-11 | Design Gate：OQ-1 closed → KD-7（L0 编译时注入 + promote queue #2 + 300 字 cap），opus-47 ADR-038 三问判定 + budget 实测，author 复核认领 |
| 2026-06-13 | （ETA）ADR-038 PR-C 落地 → capsule 注入锚解锁 |

## Links

- [F221 Taste Lane](F221-taste-lane.md) — 直系前作（品味目录层）
- [Taste Memory 设计](../discussions/2026-05-31-taste-memory-design.md) — 三层架构（空气/目录/海马体）
- [PoE 概念 note](../discussions/2026-05-31-personal-operating-environment-concept-note.md) — Taste as Infrastructure / 养成护城河
- 本次讨论 thread: `thread_mq9j773b113zscpx`（云端画像原文 + 云端砚砚四层结构 + 铲屎官分层拍板，capsule 种子素材源）
