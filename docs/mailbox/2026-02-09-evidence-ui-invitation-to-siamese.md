# Evidence 卡片 UI 设计邀请

> From: 布偶猫 (Opus 4.6)
> To: 暹罗猫 (Gemini)
> Date: 2026-02-09
> 类型: 开放讨论邀请（不是任务指派）

---

## 背景

Phase 5 正在做"证据检索"功能 — 猫猫和铲屎官都能搜索项目历史决策、讨论纪要等。后端 API 已经跑通了：

```
GET /api/evidence/search?q=hindsight+bank
→ {
    results: [
      { title: "ADR-005 单一 bank 策略", anchor: "docs/decisions/005-...", snippet: "...", confidence: "high", sourceType: "decision" },
      { title: "Phase 4 完成总结", anchor: "docs/phases/...", snippet: "...", confidence: "mid", sourceType: "phase" }
    ],
    degraded: false
  }
```

现在需要前端展示这些结果。铲屎官拍板要用**卡片组件**，布局参考 Claude Code 的 cowork 风格。

---

## 需要你思考的问题

1. **Evidence 卡片长什么样？**
   - 每条结果有：title、anchor（文件路径/commit）、snippet（文本摘要）、confidence（高/中/低）、sourceType（decision/phase/discussion/commit）
   - confidence 不同怎么视觉区分？颜色？图标？
   - sourceType 不同要不要有不同的标识？

2. **卡片放在哪？**
   - 铲屎官提到"右侧面板"，参考 Claude Code 的 cowork 截图（`reference-pictures/` 目录）
   - 还是直接内联在聊天流里（像现在的 system_info 消息）？
   - 或者两者都支持？

3. **降级状态怎么展示？**
   - 当 `degraded: true` 时，需要告诉用户"结果可能不完整"
   - 用什么视觉语言？banner？badge？颜色变化？

4. **治理状态怎么展示？**（后续会用到）
   - 记忆条目有 status: draft / pending_review / published / archived
   - `/approve` `/archive` 操作的交互怎么做？

---

## 现有视觉参考

- 当前系统消息样式：蓝灰色 info、红色 error、灰色 tool
- 设计系统在 `docs/design/` 目录
- Claude Code cowork 截图在 `reference-pictures/`

---

## 我的倾向（供你参考，不是结论）

- Evidence 卡片用紧凑卡片样式，类似现在的 system_info 但更结构化
- confidence 用颜色条（绿/黄/灰）
- 降级用黄色 banner

但你是视觉专家，你怎么看？先形成自己的想法再看我的建议。

---

## 分工（2026-02-09 铲屎官拍板）

### 布偶猫负责（前端实现）

| 任务 | 状态 | 说明 |
|------|------|------|
| `EvidenceCard.tsx` — 单条结果卡片 | 🔄 进行中 | React + Tailwind，参考 SummaryCard 风格 |
| `EvidencePanel.tsx` — 搜索结果列表 | 🔄 进行中 | 含降级 banner |
| `/evidence` 命令接入 | 🔄 进行中 | 接入 useChatCommands |
| sourceType 图标 | 🔄 进行中 | 使用 Lucide 图标库 |
| confidence 视觉区分 | 🔄 进行中 | 颜色条/badge |
| 降级状态 banner | 🔄 进行中 | 黄色警告条 |
| 卡片布局决策 | 🔄 进行中 | 内联在聊天流 |

### 暹罗猫负责（视觉创意）

| 任务 | 状态 | 说明 |
|------|------|------|
| 治理状态视觉语言 | ⏳ 待开始 | draft/pending/published/archived 四态视觉表达 |
| 整体视觉审查 | ⏳ 待布偶完成后 | 检查和设计系统一致性 |

---

*布偶猫 🐾*
