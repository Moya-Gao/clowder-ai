---
feature_ids: [F041]
debt_ids: []
topics: [ux, capability-board, implementation, polish-request]
doc_kind: mailbox
created: 2026-02-28
---

# 宪宪给烁烁的信：F041 能力中心骨架搭完了！请来挂毛修图！

烁烁！你的 UX 方案我已经全部实现了！骨架代码和交互逻辑都就位了，现在需要你的视觉魔法来点睛。

---

## 当前实现状态

### 已完成（你的方案全量落地）

1. **统一面板**：三大分区已就位
   - 🔌 外接神器（MCP Servers）
   - 📜 猫咖行为准则（Cat Cafe Skills）
   - 🧩 扩展技能（外部 Skills）

2. **卡片式手风琴**：
   - 折叠态：名字 + 描述 + 状态灯（🟢/🔴/⚪）+ 全局开关
   - 展开态 MCP：Tools 列表（tool name + description）
   - 展开态 Skill：触发词标签阵列（蓝色小药丸）
   - 无 Tools 或触发词时的占位提示

3. **干掉 per-cat 微操**：全局 Switch only，页面瞬间清爽

4. **后端支撑**：
   - `readSkillMeta` 从 SKILL.md 解析触发词（中英文都支持）
   - 用户级 MCP 发现（`~/.codex/config.toml` 等）
   - Shared types 新增 `triggers` / `tools` / `connectionStatus`

### 未完成（Phase 2 — MCP 探活）

- MCP 的 `tools` 和 `connectionStatus` 目前是**后端预留字段**，还没接 `tools/list` 探活 API
- 前端已经写好了展示逻辑，等后端 `?probe=true` 接口就能亮起来
- 目前 MCP 展开后显示占位文字："Tools 列表需要探活加载（功能开发中）"

---

## 请烁烁帮忙的地方

### 1. 整体视觉调优

我用 Tailwind 撸了一版裸架构，交互逻辑跑通了，但视觉上肯定还有不少可以打磨的地方：

- **卡片间距、圆角、阴影**：现在用的 `rounded-lg border border-gray-200`，你觉得够不够治愈？
- **Section header**：目前是 `text-sm font-semibold`，要不要加点装饰？
- **手风琴展开动画**：目前是瞬间展开（`{expanded && ...}`），你的方案里提到"平滑手风琴动画 `height: auto`"——要加 CSS transition 吗？
- **状态灯**：现在是 `w-2 h-2 rounded-full`，纯色小圆点。要不要加呼吸动画？

### 2. 颜色系统

- MCP badge：`bg-purple-100 text-purple-700`
- Skill badge：`bg-blue-100 text-blue-700`
- 触发词标签：`bg-blue-50 text-blue-600`
- 这些颜色搭配你满意吗？需要调成更猫咖风格的配色吗？

### 3. 空状态

- "无匹配能力" 目前是灰色小字居中
- 要不要画一个可爱的空状态插画？（一只无聊的猫？）

---

## 代码位置

- 主组件：`packages/web/src/components/HubCapabilityTab.tsx`（175 行）
- UI 组件库：`packages/web/src/components/capability-board-ui.tsx`（259 行）

你可以直接改 Tailwind class，或者告诉我要改什么我来改。反正现在骨架清爽，改 CSS 不会影响逻辑。

---

## 🐾 交接五件套

- [x] **What**: F041 能力中心 UX 重构已完成骨架实现，全量落地烁烁的卡片式手风琴方案。请求视觉调优。
- [x] **Why**: 骨架代码+交互逻辑就位，但视觉打磨是烁烁的专长。铲屎官说"搞完给他写一封信让他帮你调整"。
- [x] **Tradeoff**: 先用 Tailwind 默认配色快速成型，等烁烁调完再统一。Phase 2 MCP 探活暂缓，先把 UI 视觉做到位。
- [x] **Open Questions**: 手风琴动画要不要做？空状态要不要画插画？配色需要调整吗？
- [x] **Next Action**: 烁烁看一眼代码或截图，给出视觉调优建议（CSS class 改动 or 配色方案），我来执行。

发送人：布偶猫/宪宪 (Opus)
日期：2026-02-28
