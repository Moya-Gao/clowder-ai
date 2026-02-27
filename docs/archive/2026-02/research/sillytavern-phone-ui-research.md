---
feature_ids: [F010]
topics: [sillytavern, phone]
doc_kind: research
created: 2026-02-26
---

# SillyTavern + Phone-UI 调研报告

> 调研人：砚砚（Codex Pro）| 审阅人：宪宪（Opus）
> 日期：2026-02-12
> 状态：✅ 调研完成，已形成 [实施计划](../plans/2026-02-12-rich-blocks-companion-plan.md)

## 一句话总结

[SillyTavern](https://github.com/SillyTavern/SillyTavern) 是最成熟的开源 LLM 前端，其 [Phone-UI 扩展](https://github.com/bal-spec/sillytavern-phone-ui)证明了一个关键设计模式：**结构化输出 → 占位符注入 → 前端组件渲染 → 持久化恢复 → 上下文清洁**，这套管线可以直接移植到 Cat Café 的富消息系统上。

---

## 1. SillyTavern 架构要点

### 1.1 扩展系统

- 扩展 = `manifest.json` + `index.js` + `style.css`，通过 `SillyTavern.getContext()` 全局 API 或 ESM import 内部模块与主程序通信
- 生命周期靠事件驱动（如 `CHARACTER_MESSAGE_RENDERED`），也可以在 prompt 生成阶段做拦截（`runGenerationInterceptors`）
- **无硬隔离**：同权脚本，安全边界弱

### 1.2 Directive 系统（让 LLM 输出结构化 UI）

三层架构：

1. **Prompt Preset / Manager**：可配置 prompt 模板，同名自动匹配角色卡
2. **Directive 指令片段**：插入 prompt 强制模型输出特定格式（如 Phone-UI 的图片/语音标签）
3. **Regex Scripts（上下文清洁工）**：`promptOnly` 模式，在发给模型前剥离已处理的标签

> 核心洞察：**指令把输出变成"可解析结构"，regex 把历史污染降到最低，扩展把结构渲染成组件**。

### 1.3 多后端适配

模块化的生成器/适配器（OpenAI / Horde / Kobold / TextGen 等），可插拔管线 + `runGenerationInterceptors` hook。

与 Cat Café 的区别：酒馆是 HTTP API adapter，我们是 CLI 子进程 + NDJSON 流。抽象形状相似但实现层不同。

### 1.4 Character Card 与 Group Chat

- 角色卡 = personality + scenario + first_message + example_messages + extensions 字段
- V2 规范支持 `extensions` 字段写入扩展数据
- **Group Chat 的坑**：把多角色字段合并到同一 prompt → 官方警告会导致人格融合

---

## 2. Phone-UI 技术拆解

### 2.1 核心创意

> **聊天内容可以保持同一份，呈现层可以做出"场景化 UI"**。

同样一句"我刚拍了张照片"，在 Markdown 里是文本，在 Phone-UI 里变成带相册的短信气泡。

### 2.2 管线流程

```
   Prompt Directive（指导模型输出格式）
                 │
                 ▼
      LLM 输出（含 HTML 占位符 + 标签）
      ┌──────────────────────────────┐
      │ ① 手机 UI HTML（含占位符）      │
      │    <div data-phone-img="0">  │
      │ ② 标签（HTML 外）              │
      │    [IMG]prompt[/IMG]          │
      │    [VN]text[/VN]             │
      └──────────────────────────────┘
                 │
                 ▼
   CHARACTER_MESSAGE_RENDERED 事件触发
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   stripTags  findPlaceholder  /imagine or /speak
   (Range API) (data-*优先)    (slash command)
        │        │        │
        └────┬───┴────┬───┘
             ▼        ▼
   注入 Image Carousel  注入 Voice Note Player
             │
             ▼
   写入 message.extra.phoneMedia
             │
             ▼
   Reload 时：仅 restore，不再生成
```

### 2.3 关键技术点

| 要素 | 实现方式 | Cat Café 可借鉴度 |
|------|---------|------------------|
| 标签解析 | DOM Range API + TreeWalker 跨节点 | 低 — 我们用 JSON 更稳 |
| 占位符注入 | `data-phone-img="N"` HTML 属性 | 中 — 思路可借鉴 |
| 持久化 | `message.extra.phoneMedia` | 高 — 直接复刻 |
| 上下文清洁 | `promptOnly` regex 脚本 | **最高** — 必须做 |
| 恢复模式 | 检测已有 phoneMedia → restore | 高 — 避免重复生成 |

---

## 3. Cat Café 借鉴清单

### 应该借鉴的

| 优先级 | 借鉴什么 | 怎么改造 |
|--------|---------|---------|
| **P0** | 结构化输出 → 前端组件的管线 | MCP 工具主动创建富块 + 文本 fallback |
| **P0** | 上下文清洁器（prompt 不腐败） | 在 `route-strategies.ts` prompt 组装时替换富块为摘要 |
| **P0** | 持久化 + restore 模式 | `StoredMessage.extra.rich` → Redis → 刷新恢复 |
| **P1** | 场景化 persona preset | 写代码 / 陪看电影 / 陪读书 不同的猫猫姿态 |
| **P1** | 可插拔组件注册表 | `renderContentBlocks()` 按 type dispatch |
| **P2** | PWA 移动端适配 | `100dvh` + `--doc-height` 视口修复 |

### 不应该借鉴的

| 酒馆做法 | 为什么不适合 Cat Café |
|---------|---------------------|
| 同权脚本扩展（无沙盒） | 陪伴场景涉及隐私数据，插件必须有权限隔离 |
| 群聊合并多角色 prompt | 我们已有 orchestrator 架构，每猫独立上下文 |
| HTML 存进消息正文 | UI 表示应从正文分离到 `extra.rich`，防止 UI 重构时历史坏掉 |
| 过度依赖 regex 解析 | JSON schema 驱动更稳，regex 只做清洁 |

---

## 4. 移动端方案对比

| 方案 | 优点 | 缺点 | 适合 Cat Café 哪步 |
|------|------|------|-------------------|
| PWA | 复用 Next.js，迭代快，离线可做 | iOS 推送受限 | **MVP 第一步** |
| React Native | TS 生态，推送/语音/离线强 | 原生桥接成本 | 第二步"猫猫陪伴 App" |
| Flutter | UI 一致性强 | 引入 Dart | 若更重视 UI 质感 |
| Tauri/Capacitor | Web UI 最大复用 | WebView 限制 | PWA 之后"轻原生化" |

---

## 5. 愿景路线图

```
Step 1: StoredMessage.extra.rich + MCP 工具 + 前端渲染  ← 当前计划
Step 2: 场景 persona preset（写代码/看电影/读书/日常）
Step 3: PWA 移动端适配（streaming + 离线缓存 + 视口）
Step 4: 猫猫主动找你（推送 + 开场白库）
Step 5: App 化（RN/Flutter/Wrapper）
Step 6: 隐私增强（端上加密 + 可选 E2EE）
```

---

## 参考资料

- 原始调研 prompt + 砚砚两轮回复：[sillytavern-research-prompt.md](./sillytavern-research-prompt.md)
- SillyTavern 主仓：https://github.com/SillyTavern/SillyTavern
- Phone-UI 扩展：https://github.com/bal-spec/sillytavern-phone-ui
- SillyTavern 文档：https://docs.sillytavern.app/
- 实施计划：[2026-02-12-rich-blocks-companion-plan.md](../plans/2026-02-12-rich-blocks-companion-plan.md)
