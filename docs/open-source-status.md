---
feature_ids: [F059]
related_features: [F042, F046, F086, F087, F094]
topics: [open-source, status, debt, governance]
doc_kind: note
created: 2026-03-12
---

# Clowder AI 开源现状与债务清单

> **用途**：单独记录 F059 当前推进状态、已完成项、剩余债务、修复顺序。
> **原则**：**家里的历史债，先在家里修；开源版特有问题，再修 sync pipeline。**

## 当前快照

### 已完成

- `clowder-ai` 已建立并保持 **private beta** 状态
- `cat-cafe -> clowder-ai` 同步管线已落地：
  - `sync-manifest.yaml`
  - `scripts/sync-to-opensource.sh`
  - public docs/export 脚本
- `clowder-ai` 已同步代码、skills、公开 docs、治理文件
- `clowder-ai` 本地可启动：
  - API: `3003`
  - Frontend: `3004`
  - memory mode 可用
- `clowder-ai` 当前门禁状态：
  - `pnpm install --frozen-lockfile` ✅
  - `pnpm check` ✅
  - `pnpm lint` ✅
- `main` 保护规则已开启：
  - Require PR
  - Require 1 approval
  - Require status checks
  - Restrict updates
  - Block force push / deletion
- CI 触发已改成白名单 `paths:`，文档改动不再白白消耗 GitHub Actions 分钟

### 当前口径

> **Clowder AI 现状态**：内测可运行，但还不是公开发布完成态。

---

## 债务分类

## A. 家里的历史债（先在 `cat-cafe` 修）

这些问题如果继续只在 `clowder-ai` 修，会让两个仓分叉。默认先在家里修，再同步。

### A1. Directory Size Guard 历史红灯

**现象**
- CI 里的 `Directory Size Guard` 仍然会红
- 目前已知超阈值的目录以 `packages/api/src/routes` 为主

**处理原则**
- 优先在 `cat-cafe` 拆目录
- 如果短期拆不动，按 ADR-010 加 **time-bound exception**
- 修完后再同步到 `clowder-ai`

**状态**：未完成

### A2. `Test (Public)` 历史红灯

**现象**
- `clowder-ai` 的 `Test (Public)` 仍非稳定绿灯
- 这类问题默认先判断为源仓测试债

**处理原则**
- 先在 `cat-cafe` 修测试或修实现
- 保持 `test:public` 在家里和公开仓同口径
- 修完后同步

**状态**：未完成

### A3. 源仓结构和质量债持续回流

**现象**
- 我们已经修过多轮 `pnpm check` / `pnpm lint`
- 但后续新功能仍可能把历史债重新带进公开仓

**处理原则**
- 后续所有源仓代码债，先在 `cat-cafe` 收口
- `clowder-ai` 不做长期独立修补，避免分叉

**状态**：持续项

---

## B. 开源版特有问题（在 sync pipeline / public repo 修）

这些不是家里源仓的通用问题，而是公开导出和公开表达带来的问题。

### B1. docs / skills 的私有路径残留

**现象**
- 公开版 docs/skills 中仍可能残留：
  - `docs/mailbox/`
  - `docs/plans/`
  - `docs/discussions/`
  - `docs/archive/`
- 这类内容不会阻塞启动，但会让外部猫读到不存在的路径

**处理原则**
- 在 export/sanitize 脚本里继续 public 化
- 不在 `clowder-ai` 手工逐文件打补丁

**状态**：未完成

### B2. 协作文档公开化不彻底

**重点文档**
- `docs/SOP.md`
- `cat-cafe-skills/refs/shared-rules.md`
- `CLAUDE.md`
- `AGENTS.md`
- `GEMINI.md`

**现象**
- 主骨架已同步
- 但部分 skill / refs 还带内部口吻或内部流程痕迹

**处理原则**
- 保留“变聪明的骨架”
- 去掉公开仓不存在的内部路径和私有流程依赖

**状态**：未完成

### B3. README / SETUP / MCP 说明仍需打磨

**重点**
- 设计能力依赖 `Pencil` 类 MCP 要写清楚
- 没有设计类 MCP 时，体验会明显退化，要在 README / SETUP 里说清楚
- credits / inspiration 要分清：
  - 我们自己写的 skills
  - 外部 MCP / 官方工具

**状态**：未完成

### B4. 公开仓 git author / commit 口径

**现状**
- 已经明确：公开仓后续提交应统一为我们的 GitHub 账号 author
- commit 应带猫猫签名

**状态**：规则已定，后续持续执行

---

## C. 已经收口的关键事项

- `main` 保护规则已设好，不再是裸 main
- CI 白名单触发已设好，不再“改一个 md 全仓跑”
- `clowder-ai` 已完成一次可运行性验证
- 默认端口已切到 `3003/3004`，不碰家里 runtime 的 `3001/3002`
- Hindsight 默认关闭
- 公开版 owner / mention / author 口径已收过一轮

---

## 修复顺序（严格按顺序）

1. **先修家里的历史债**
   - Directory Size Guard
   - `Test (Public)`
   - 其他会回流到公开仓的源仓质量问题

2. **再修公开版导出问题**
   - docs 残留私有路径
   - skills/refs public 化
   - README / SETUP / MCP 说明

3. **然后重新同步到 `clowder-ai`**
   - 同步代码
   - 同步 public docs
   - 重新跑：
     - `pnpm install --frozen-lockfile`
     - `pnpm check`
     - `pnpm lint`
     - runtime boot on `3003/3004`

4. **最后再考虑公开发布态**
   - 截图替换
   - collaborator onboarding
   - 商标/品牌说明补齐

---

## 现在不做的事

- 不在 `clowder-ai` 长期单独修源仓历史债
- 不把 `docs/phases/`、`docs/methods/`、`docs/mailbox/`、`docs/plans/` 直接同步过去
- 不为了省事把 private beta 仓直接改 public

---

## 下一轮直接行动

- [ ] 在 `cat-cafe` 修 `Directory Size Guard`
- [ ] 在 `cat-cafe` 修 `Test (Public)`
- [ ] 重新同步到 `clowder-ai`
- [ ] 再扫一轮 docs/skills 私有路径残留
- [ ] 补 `README` / `SETUP` 的 MCP 与设计能力说明

