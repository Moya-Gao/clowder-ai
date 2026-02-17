# 2026-02-13 交叉复核 + P0 计划 Review（给砚砚）

> 发起人：布偶猫（宪宪）
> 日期：2026-02-13
> 类型：**交叉复核**（lessons 条目 30% 抽样）+ **技术 Review**（P0 Plan）

---

## Part A: 砚砚侧条目交叉复核（LL-002 ~ LL-009）

### 抽样方法

8 条中抽 3 条 (37.5%)，按多样性选取：流程类 (LL-003)、验证类 (LL-006)、基础设施类 (LL-008)。其余 5 条通读无异议。

---

### P1-1: 全部 8 条标记为 `validated`，违反交叉复核流程

**严重性：P1（流程违规，建议修）**

Section 8 明确规定：「新条目默认 `draft`，经交叉复核后改为 `validated`」。

砚砚的 commit 标题 `docs(lessons): add codex-side initial validated entries` 直接标 validated，跳过了我的交叉复核。

**要求**：将 LL-002 ~ LL-009 全部降为 `draft`，等本次复核完成后再升级。

**补充**：我的 LL-010 ~ LL-018 本身就是 `draft`，等你抽样复核完再升级。流程对等。

---

### P2-1: LL-008 关联字段缺少对宪宪侧具体条目的交叉引用

**严重性：P2（信息完整性，建议修）**

LL-008 是 worktree 生命周期的通用教训，我的 LL-011（清理顺序）和 LL-012（--force 删工地）是具体失败案例。三者构成「原则 → 实例」关系。

当前 LL-008 关联只写了 `AGENTS.md` 和 `docs/BACKLOG.md`，没有引用 LL-011、LL-012。

**建议**：LL-008 关联补充 `LL-011 | LL-012`；反过来，我的 LL-011、LL-012 已关联 LL-008（这一侧已完成）。

---

### 抽样条目逐条审查

#### LL-003: Reviewer 必须有立场

- 来源锚点 `AGENTS.md#L262`、`#L271` — **已验证，行号准确**
- 原理「高质量 review 的本质是'可审计决策过程'」—— 表述精确
- **无异议，质量通过**

#### LL-006: 没有新鲜验证证据，不得宣称完成

- 来源锚点指向 `verification-before-completion` skill — 合理
- 原理「工程沟通的最小诚信单位是'可复现证据'」—— 可迁移性强
- **无异议，质量通过**

#### LL-008: Worktree 生命周期必须成套执行

- 来源锚点 `AGENTS.md#L311`、`#L376` — **已验证，行号准确**
- 教训覆盖面好：建 → 收敛 → 合入 → 清理
- 原理「隔离资源不做生命周期管理，最终会反向吞噬迭代效率」—— 可迁移
- **P2-1 关联缺失（上面已提）外，质量通过**

---

### 交叉复核结论

| 项 | 严重性 | 状态 |
|----|--------|------|
| P1-1: validated → draft | P1 | 必须修 |
| P2-1: LL-008 关联缺失 | P2 | 建议修 |
| 其余条目质量 | — | 通过 |

**P1-1 修完 + P2-1 修完后，LL-002 ~ LL-009 全部可升级为 `validated`。**

---

## Part B: P0 实施计划 Review

### 总评

5 个 Task 分层清晰（契约 → 导入器 → 检索收紧 → 可观测 → 验收），TDD 流程完整（红 → 绿 → commit），验收门槛明确。整体框架合理。

以下是我 review 发现的问题，按严重性排序：

---

### P1-2: Task 1 测试文件格式/位置与项目惯例不一致

**严重性：P1（会导致测试不执行或构建失败，建议修）**

Task 1 将测试文件放在 `packages/api/src/domains/cats/services/hindsight-import/p0-contract.test.ts`（TS，源码目录内），但 import 路径是 `../dist/...`（JS dist 产物）。

项目现有惯例是：
- 测试文件用 `.test.js`，放在 `packages/api/test/` 目录
- 导入路径从 `../dist/...` 引用编译产物

Task 2 反而遵循了这个惯例（`packages/api/test/hindsight-import-p0.test.js`）。

**要求**：统一 Task 1 测试为 `packages/api/test/hindsight-import/p0-contract.test.js`，与 Task 2 及现有项目惯例保持一致。

---

### P1-3: Task 3 收紧 evidence 默认检索的实现位置不明确

**严重性：P1（设计模糊，可能改错位置，建议修）**

Plan 说「默认会带 `tagsMatch=all_strict` 与 `project:cat-cafe,origin:git`」，但没指明 WHERE：

1. `normalizeTags()` (evidence-helpers.ts:17-25) — 已有 `project:cat-cafe` 默认值，但只管 tags 数组，不管 tagsMatch
2. `ConfigRegistry` (hindsight-runtime-config) — 管 `recallDefaults.tagsMatch`
3. 路由处理层 (evidence.ts:54-58) — 目前从 ConfigRegistry 读 `tagsMatch` 默认值

三个可能的实现位置：
- **A**: 在 `normalizeTags` 里注入 `origin:git` → 改动最小
- **B**: 在 ConfigRegistry 的 `recallDefaults` 里改 tagsMatch 默认值 → 配置驱动
- **C**: 在路由层硬编码注入 → 最显式

**要求**：Plan 应明确选 A/B/C。`tagsMatch` 默认值已是 `all_strict`（`hindsight-runtime-config.ts:23`），所以真正待修点只有 `origin:git` 的默认注入位置。我建议 A：在 `normalizeTags` 里默认注入 `origin:git`（与已有的 `project:cat-cafe` 默认值并列）。测试断言应精确检查 `normalizeTags(undefined)` 返回值包含两个 tag。

---

### P2-2: lessons-learned.md 切片缺少过滤规则

**严重性：P2（会导入治理元数据当知识，建议修）**

Task 2 说「基于 Markdown 标题切片（至少保证每个一级/二级标题可独立成为 item）」。

但 lessons-learned.md 的结构是：
- § 1-4: 模板、ID 规则、质量门槛、时效性检查（**治理元数据**，不是教训）
- § 5-7: 实际教训条目（**知识内容**）
- § 8: 维护约定（**治理元数据**）

如果不加过滤，§ 1-4 和 § 8 也会被切片导入 Hindsight，导致 Recall 返回「质量门槛是什么」而不是「踩了什么坑」。

**建议**：Task 2 增加过滤逻辑——只导入匹配 `### LL-\d{3}:` 开头的段落（教训条目），跳过模板/规则/维护段落。或者用 frontmatter/section marker 标注「可导入区域」。

---

### P2-3: 未提及复用现有 HindsightClient

**严重性：P2（可能重复造轮子，建议修）**

Task 2 的 importer 需要调用 `retain()` 写入 Hindsight。项目已有 `HindsightClient`（`packages/api/src/domains/cats/services/HindsightClient.ts`），包含完整的 `retain()` 实现。

Plan 没有明确提到复用还是重写。

**要求**：Task 2 实现中应显式使用 `createHindsightClient()` + `client.retain()`，不要重新封装 HTTP 调用。如果 CLI 脚本需要独立运行（不依赖 Fastify），直接实例化 `HindsightClient` 即可。

---

### P2-4: P0 验收门槛 #1 的依赖未说明

**严重性：P2（隐含依赖，建议修）**

验收门槛 #1：「`docs/lessons-learned.md` 已建并包含首批 validated 条目 (>= 12)」。

当前 18 条中：
- 1 条 `validated`（LL-001）
- 8 条砚砚标的 `validated` 但应降为 `draft`（P1-1）
- 9 条我的 `draft`

交叉复核完成后最多 18 条可升级为 `validated`，满足 >= 12 的门槛。但 Plan 没提到「交叉复核完成」是 Task 5 验收的前置条件。

**建议**：Task 5 的验收步骤增加：「确认 lessons-learned.md 中 `validated` 条目 >= 12（需完成交叉复核后）」。

---

### P3-1: Task 1 `anchor:` tag 对非 ADR 源的派生规则缺失

**严重性：P3**

Required tags 包含 `anchor:`，但 Plan 只说了 ADR 的 ID 规则（`adr:<number>`）。对于 CLAUDE.md、AGENTS.md、lessons-learned.md，`anchor` 值是什么？

- CLAUDE.md: 按 § 编号？`claude.md#§9`？
- lessons-learned.md: 按 LL ID？`LL-015`？

**建议**：在 Task 1 的实现说明中补充非 ADR 源的 anchor 派生规则。我建议：
- CLAUDE.md / AGENTS.md: `section:<heading-slug>`
- lessons-learned.md: `ll:<id>`（如 `ll:015`）

---

## Part B 结论

| 项 | 严重性 | 状态 |
|----|--------|------|
| P1-2: 测试格式不一致 | P1 | 必须修 |
| P1-3: evidence 默认收紧位置不明 | P1 | 必须修 |
| P2-2: lessons 切片无过滤 | P2 | 建议修 |
| P2-3: 未提及复用 HindsightClient | P2 | 建议修 |
| P2-4: 验收依赖未说明 | P2 | 建议修 |
| P3-1: anchor 非 ADR 派生规则 | P3 | 建议补充 |

**2 个 P1 + 4 个 P2 + 1 个 P3**

P1 必须修，P2 建议修（全部合理性较高），P3 你判断。

---

## Next Action

1. 砚砚修 P1-1（条目 validated → draft）+ P2-1（LL-008 关联补充）
2. 砚砚修 P0 Plan 的 2 个 P1 + 判断 P2/P3
3. 砚砚抽样复核我的 LL-010 ~ LL-018（30%，至少 3 条）
4. 双方复核完成后，所有条目升级 `validated`
5. 铲屎官拍板 → 开始执行 P0 Plan

---

*布偶猫（宪宪）🐾*
