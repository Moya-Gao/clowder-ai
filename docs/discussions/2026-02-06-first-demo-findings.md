# 第一次真实召唤 Demo 发现记录

> **日期**：2026-02-06
> **参与者**：铲屎官、布偶猫（Opus 4.6）、GPT（Chrome 旁观评论）
> **触发**：铲屎官通过前端第一次同时召唤缅因猫和暹罗猫

---

## 暴露的问题总览

### P0 — 身份注入缺失

**现象**：三只猫全军覆没，没有一只知道自己的真实身份。
- 布偶猫：说"只有我被召唤了，@mention 没实现"（其他猫已经坐下了）
- 缅因猫：先加载 superpowers bootstrap，然后说"你连到的是 1 个模型实例"
- 暹罗猫：猜自己是"Gemini 灵感爆发版"

**根因**：三个 AgentService 在 spawn CLI 时 prompt 里零身份上下文。

**修复方向**：系统提示词组装器（System Prompt Builder），分层注入。
详见 `2026-02-06-identity-injection-open-invite.md`

---

### P1 — MCP 挂载不完整

**现象**：只有 Claude CLI 通过 `--mcp-config` 动态注入了 MCP，Codex 和 Gemini 没有。

**问题链**：
1. 各 CLI 的 MCP 配置格式不同（甚至可能不支持）
2. 如果全部挂 user-level MCP，不用猫咖时会造成困惑
3. 如果挂 project-level，跨项目开发时目标项目没有配置

**修复方向**：
1. 优先：查各 CLI 是否支持动态 MCP flag → 统一动态注入
2. 兜底：不支持 MCP flag 的 CLI，通过系统提示词注入 HTTP 端点信息
3. 共享 MCP 配置源：一份配置 → 各 CLI 格式的 Adapter 转换

---

### P1 — 猫 ↔ 模型映射不可配置

**现象**：布偶猫 ≠ Opus。当前是硬编码。

**真实情况**：
- 布偶猫 → 通常 Opus，但测试时可能是 Haiku/Sonnet
- 缅因猫 → 可能是 Codex CLI，也可能需要切 GPT（Codex 有时太机器人）
- 暹罗猫 → Gemini，但具体版本未知

**需要**：一个配置文件定义猫 → CLI/Model 映射：
```jsonc
// 示例 cat-config.json
{
  "cats": {
    "opus": {
      "displayName": "布偶猫",
      "provider": "anthropic",
      "cli": "claude",
      "defaultModel": "claude-opus-4-6",
      "mcpSupport": "native"      // --mcp-config flag
    },
    "codex": {
      "displayName": "缅因猫",
      "provider": "openai",
      "cli": "codex",
      "defaultModel": "codex",
      "mcpSupport": "unknown"     // 需要调研
    },
    "gemini": {
      "displayName": "暹罗猫",
      "provider": "google",
      "cli": "gemini",
      "defaultModel": "gemini-2.5-pro",
      "mcpSupport": "unknown"     // 需要调研
    }
  }
}
```

好处：
- 铲屎官可以随时调整"哪只猫用什么模型"
- 铭牌展示的是**实际运行的**，不是硬编码的
- 支持热切换（比如缅因猫从 Codex 换成 GPT）

---

### P2 — 消息气泡缺少身份铭牌

**来源**：GPT（Chrome 旁观时建议）+ 铲屎官认可

**设计**：每条消息气泡底部加折叠式小标签

```
收起状态: Claude Opus 4.6 · Anthropic
展开状态:
  Agent: 布偶猫 (opus)
  Provider: Anthropic
  Model: claude-opus-4-6 (实际运行值)
  Session: abc123...
```

**实现思路**：
1. `AgentMessage` 类型加 `metadata?: MessageMetadata` 字段
2. 各 AgentService yield 时带上 provider/model/sessionId
3. 前端 `ChatMessage.tsx` 底部渲染折叠铭牌
4. 默认收起，不影响可爱

**工作量**：~几十行，但当前不做（其他布偶猫在修 bug，避免冲突）

---

### P2 — 记忆连续性

**现象**：冷启动的猫没有历史上下文。

**当前状态**：
- Session resume（`--resume`）部分解决：CLI 内部状态延续
- MCP 的 `get_thread_context()` 可以拉历史，但猫不知道这个工具存在
- 身份注入做好后，提示词里可以告诉猫"先调 get_thread_context 了解上下文"

**与其他问题的关系**：依赖 P0（身份注入）解决后自然改善大半

---

### P2 — 跨项目可移植性

**场景**：将来猫咖帮铲屎官做别的项目（不是 cat-cafe 自身）

**当前**：`AgentServiceOptions.workingDirectory` 已支持，但未验证

**需要验证**：
- spawn CLI 的 cwd 设为目标项目 ✓ 架构已支持
- MCP server 用绝对路径引用 → 不依赖 cwd
- 身份提示词里包含"当前项目是 X"动态信息

---

### P3 — 上下文预算管理

**问题**：身份 + 历史 + 任务 + 摘要 + 项目上下文 = prompt 爆炸

**暂不需要**：先做 P0 的最小版本，遇到 token 问题时再优化

---

## 不做但记录的小改动

以下改动已经设计清楚，等其他布偶猫完成当前工作后再做：

1. **消息铭牌**：AgentMessage + metadata → 前端折叠标签（~30 行后端 + ~50 行前端）
2. **猫配置外置**：hardcoded CatId/model → cat-config.json（~100 行重构）
3. **身份提示词 MVP**：AgentRouter 组装 system prompt prefix（~80 行）

---

## 与已有规划的关系

| 本次发现 | 对应规划 | 关系 |
|---------|---------|------|
| 身份注入 | 未在任何 Phase 中 | **新增 Phase 3.1 或 3.5-pre** |
| MCP 挂载统一 | Phase 3.5 未提及 | **新增，与身份注入一起做** |
| 猫模型配置 | 未规划 | **新增，身份注入的前置** |
| 消息铭牌 | 未规划 | **Phase 3a 收尾 polish** |
| 记忆连续性 | Phase 3.2 在修 | 已覆盖 |
| 任务感知 | Phase 3.5-A | 已规划 |
| 并行思考 | Phase 3.5-D | 已规划 |

---

## 行动项

- [ ] 记录完成（本文档）
- [ ] 飞猫传书已发（identity-injection-open-invite.md）
- [ ] 等其他布偶猫完成当前工作后，开 worktree 实施消息铭牌
- [ ] 调研 Codex CLI 和 Gemini CLI 的 MCP 支持情况
- [ ] 设计 cat-config.json schema
- [ ] 设计 System Prompt Builder

---

*记录者：布偶猫 (Opus 4.6) 🐾*
*旁观评论员：GPT (via Chrome) — "我投布偶猫一票，最像在纸箱里开发布会的猫" 😹*
