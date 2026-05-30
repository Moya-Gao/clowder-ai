# Review Response: intake(F056) OKLCH design system from clowder-ai#784

Review-Target-ID: intake-clowder-784
Branch: fix/intake-clowder-784-oklch
PR: https://github.com/zts212653/cat-cafe/pull/1977
Reviewer: 宪宪/opus-47 🐾
Date: 2026-05-30 18:30 UTC
Verdict: **🔴 BLOCKING — 1 P1 required, 1 P3 info**

---

## 评审范围

239 文件 intake / +5512 −1942 / 100 commits cherry-pick from clowder-ai#784 squash `b568cab80`.

按 mailbox 三项重点 OQ + maintainer 主动审视 connector.ts / scope creep / 治理 gate 全覆盖，未做 visual smoke（铲屎官已确认 "颜色看着 ok"）。

---

## ✅ Pass 项（详证已查）

### 1. Brand Guard（OQ #2）

`packages/web/src/app/layout.tsx`：
- `title: 'Cat Cafe'` ✓
- `description: '三只 AI 猫猫的协作空间'` ✓
- `appleWebApp.title: 'Cat Cafe'` ✓
- `<html lang="zh-CN" suppressHydrationWarning>` ✓
- 新组件 `CatHueInjector` / `ThemeApplier` 正确导入并放置在 body 顶层

`brand-validation` (intake-from-opensource.sh --validate-inbound) author 自报 pass。

### 2. CSS `<link>` 架构（OQ #3）

layout.tsx 实际 10 个 `<link rel="stylesheet" href="/vendor/app/...">`，包括 4 个新 CSS（cat-persona-tokens / cat-persona-derived / theme-extras / console-tokens）。zero JS import for global tokens。架构合规。

### 3. 6 个冲突解决（OQ #1）

每个文件实测 PR 分支：

| 文件 | 验证 |
|------|------|
| `packages/web/src/components/ChatContainer.tsx:856-861` | "欢迎来到 Cat Café!" + "@布偶 召唤布偶猫" 品牌保留 + `<p suppressHydrationWarning>` 合入 ✓ |
| `packages/web/src/components/HubToolUsageTab.tsx:31-37` | `DATAVIZ_TOKENS = {} as React.CSSProperties` + CAT_LABELS 我们家全部命名（布偶猫/缅因猫/暹罗猫/孟加拉猫/狸花猫/金渐层）保留 ✓ |
| `packages/web/src/components/__tests__/CliDiagnosticsPanel.test.ts:325-330` | `/Users/lysander/.npm/bin/codex` 本地路径保留 + root home fixtures (`/root/.npm/...`, `/var/root/.local/...`) 合入 ✓ |
| `packages/web/src/app/pixel-brawl/page.tsx:122-130` | `PIXEL_PALETTE.caption` 取代 `#3A4658` (OKLCH 改造) + "Cat Café Fighting Demo" 品牌保留 ✓ |
| `docs/features/F056-cat-cafe-design-language.md` | Phase E 段 +291 行（七类色 OKLCH 派生公式 / surface-hue 独立 / team experience 铲屎官原话引用），结构完整高质量 ✓ |
| `docs/features/index.json` F056 行 | status 同步到 Phase E 11/12 + Sweep 进度 ✓ |

### 4. F211 status 改动澄清（自查发现，最初疑似 scope creep）

PR diff 改了 F211 status（"deferred → REG8" → "REG8 FIXED + REG9"）。乍看是 scope creep。

**实测验证**：
- PR #1976 (REG8 fix) merge to main at 17:08:51 UTC (mergeCommit `b65e94fd`)
- main 上 `pnpm check` baseline 1/18 红：`check:features` 报 index.json stale
- 在 main 上跑 `node scripts/generate-feature-index.mjs`，生成的 F211 status 与 PR 完全一致

**结论**：F211 改动是 stale index.json 的自动 sync（PR #1976 merge 时漏了同步），**不是 scope creep**。pass。

### 5. ESLint plugin & 治理 gate 部分合规

- `eslint-plugin-cafe/no-hardcoded-colors` 设计完整：RAW_COLOR_FAMILIES + TW_PREFIXES + arbitrary hex/oklch/hsl/rgba 全规则覆盖
- `check-web-global-css-imports.test.mjs` 加 `__tests__/` 排除合理（测试文件引用 CSS 名是断言不是 import）

---

## 🔴 P1 BLOCKING — 必须修复

### B1: `APP_STATIC_CSS_FILES` 漏 4 个新 CSS 文件（治理 gate 漏检）

**文件**：`scripts/check-web-global-css-imports.test.mjs:11-17`

**现状**：
```js
const APP_STATIC_CSS_FILES = [
  'theme-tokens.css',
  'console-shell.css',
  'console-controls.css',
  'connector-tokens.css',
  'werewolf-theme.css',
];
```

**问题**：layout.tsx 实际 `<link>` 了 10 个 CSS 文件，PR 引入 4 个新文件（`cat-persona-tokens.css` / `cat-persona-derived.css` / `theme-extras.css` / `console-tokens.css`），但治理数组**没有同步扩**。

**影响**：
- 当前 PR layout.tsx 已正确走 `<link>` ✅
- 但治理 gate 不全：未来有人在 JS 源文件里写 `import './cat-persona-tokens.css'`（或 CSS 里 `@import './cat-persona-tokens.css'`），check 不会抓到，会绕过 vendor-only 架构
- 这正是 OQ #3 的核心治理意图

**修复**：把 4 个新文件加进数组：
```js
const APP_STATIC_CSS_FILES = [
  'theme-tokens.css',
  'cat-persona-tokens.css',       // NEW
  'cat-persona-derived.css',      // NEW
  'connector-tokens.css',
  'theme-extras.css',             // NEW
  'console-tokens.css',           // NEW
  'console-shell.css',
  'console-controls.css',
  'werewolf-theme.css',
];
```

加完后跑 `node --test scripts/check-web-global-css-imports.test.mjs` 应该通过（layout.tsx 已链接到全部 10 个文件）。

---

## ⚠️ P3 INFO（不 blocking，但请确认）

### I1: `connector.ts` 6 行 `secondary` 字段改动来源不明

**文件**：`packages/shared/src/types/connector.ts:122,135,148,161,174,304`

PR 改了 5 个 GitHub 类 connector (`github-review` / `github-ci` / `github-conflict` / `github-review-feedback` / `github-repo-event`) 和 `scheduler` 的 `color.secondary` 字段：
- GitHub 5 个：原本各家品牌淡色（`#EFF6FF`/`#FFFBEB`/`#F8FAFC`/`#F6F8FA`）→ 统一改成 `#E2E8F0`
- scheduler：`#FFFBEB` → `#FDE691`

**调查结果**：
- 不在 commit message 6 个冲突文件列表里
- `connector-tokens.css` 注释明确说 connector "不参与 Phase E 七类色派生"
- grep `\.color\.secondary` 确认 `ConnectorDefinition.color.secondary` 字段**当前无消费者**（其他 secondary 命中都是 `cat.color.secondary` 或 `cafe-text-secondary` CSS class）
- 视觉零影响

**评估**：疑似 mindfn 75 分钟 hex↔OKLCH 振荡过程的残留物，被 cherry-pick 夹带进来。

**建议**：保留不改（10 行变更回滚成本 > 收益），但请你在 PR description / commit message 里补一句说明（"未参与 OKLCH 派生，secondary 字段统一是 mindfn 顺手清理；当前无消费者"），便于将来 connector 卡片设计要用 secondary 时有据可查。如确认是无意 bring-along 想 revert，那也好——加进 B1 一起改。

---

## 必修清单

- **B1**: `scripts/check-web-global-css-imports.test.mjs:11-17` APP_STATIC_CSS_FILES 加 4 个新文件
- **I1**（可选）: PR description 补一句 connector.ts secondary 改动来源说明，或顺手 revert

修完跑：
```
node --test scripts/check-web-global-css-imports.test.mjs   # B1 验证
pnpm check                                                   # 整体门禁
```

修复后 ping 我，30 秒就能 re-review approve（B1 是 5 行修复，I1 是文字说明）。

---

## "如果我判断错了我最可能错在哪"

- **B1 可能被认为过严**：如果你觉得当前 layout.tsx 已经正确链接，未来防御不该 piggyback 在本 PR——可 push back，理由是"治理 gate 扩容应该独立 commit / PR"。我会接受这个 argument 但只接受 "已开 follow-up issue + 你认领" 的版本，不接受"以后再说"
- **B1 数组顺序可能强迫症过头**：我按 layout.tsx link 顺序排列了，如果你想按字母序，没问题
- **I1 可能小题大做**：6 行视觉零影响的字段改动，你完全可以说"intake noise，正常"。我接受

如果你不同意 B1 但确认 I1 没问题，**或者反过来**，请直接 push back，我会重新评估。

---

[宪宪/Opus-4.7🐾]
