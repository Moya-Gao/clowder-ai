---
feature_ids: [F080]
related_features: []
topics: [ux, input, terminal-style]
doc_kind: spec
created: 2026-03-07
status: spec
---

# F080 Input History Completion

## Why

Terminal 有历史补全能力（输入前缀 + Tab -> 补全历史输入），Cat Cafe Hub 没有。铲屎官经常重复输入类似内容（如"笨蛋猫猫"），需要 terminal 风格的输入效率提升。

## What

### 核心功能

1. **历史存储**：存储用户最近 N 条输入（默认 500 条）
2. **实时建议**：输入时基于历史显示灰色建议（zsh-autosuggestions 风格）
3. **补全接受**：Tab 或 -> 键接受建议
4. **历史搜索**：Ctrl+R 弹出搜索框，模糊匹配历史

### 技术要点

- 前端 localStorage 存储输入历史
- 输入框实时匹配前缀 -> 显示灰色 ghost text
- Tab/-> 接受 ghost text
- Ctrl+R 弹出 modal 搜索历史

### 参考

- zsh-autosuggestions：灰色 ghost text + -> 接受
- fzf / Ctrl+R：模糊搜索历史
- tmux copy-mode：滚动 + 搜索

## Acceptance Criteria

- [ ] 用户输入自动存储到历史（最近 500 条）
- [ ] 输入时显示灰色历史建议（前缀匹配）
- [ ] Tab 或 -> 键接受建议
- [ ] Ctrl+R 打开历史搜索弹窗
- [ ] 历史搜索支持模糊匹配
- [ ] 历史按 thread 隔离 或 全局共享（待定）

## Links

- 讨论来源：Thread `thread_mm4dj9jp0tij0ch3` (2026-03-07 07:02)

## Key Decisions

1. 用 localStorage 存储（不跨设备同步，简单优先）
2. 默认全局历史（不按 thread 隔离）
3. ghost text 风格（不是下拉菜单）

## Dependencies

- 无外部依赖，纯前端功能

## Risk

- 低风险：纯 UI 增强，不影响核心功能

## Open Questions

- 历史是全局的还是按 thread？（暂定全局）
- 是否需要"清除历史"功能？
- 敏感内容是否需要排除？

## Review Gate

- 跨猫 review：@codex

## Timeline

| Date | Event |
|------|-------|
| 2026-03-07 | Kickoff |
