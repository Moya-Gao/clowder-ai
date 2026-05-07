---
name: organize-threads
description: >
  猫猫辅助整理未分类 thread，分析标题和元数据，建议合适的标签。
  Use when: 用户说"帮我整理"、"分类 thread"、点击整理按钮。
  Not for: 创建/删除/编辑标签本身。
  Output: 按 thread 的标签建议列表。
triggers:
  - "帮我整理"
  - "整理 thread"
  - "organize threads"
  - "分类建议"
---

# Organize Threads

用户请求整理未分类 thread 时加载此 skill。分析 thread 标题和元数据，对照可用标签建议分类。

## 流程

```
1. 获取数据
   - 用 cat_cafe_list_labels 获取可用标签列表（id + name + color）
   - 用 cat_cafe_list_threads 获取 thread 列表
   - 如果用户触发消息中已附带标签和 thread 数据，优先使用（减少工具调用）
   - 筛选出未分类 thread（labels 为空或不存在的）

2. 分析 thread
   - 逐个分析 thread 标题
   - 语义匹配：标题含义和标签含义的对应（不是简单 substring）
   - 一个 thread 可匹配 0-N 个标签
   - 无法判断的 thread 不强行分类

3. 输出建议
   - 按 thread 逐条列出建议的标签
   - 简要说明匹配理由（一句话）
   - 附带机器可读 JSON 块（供前端 modal 预填充）
   - 不自动应用——等用户确认
```

## 输出格式

```
## 分类建议

| Thread | 建议标签 | 理由 |
|--------|----------|------|
| {title} | {label names} | {一句话说明} |
| ... | ... | ... |

共 N 个 thread 有建议。如需调整，请告诉我。
确认后我无法直接应用标签——请在 sidebar 中使用手动整理面板批量应用。

<!-- SUGGESTIONS_JSON:{"threadId1":["labelId1","labelId2"],"threadId2":["labelId3"]} -->
```

**JSON 块格式**：`<!-- SUGGESTIONS_JSON:{...} -->` — key 是 threadId，value 是 labelId 数组。必须使用 id 而非 name。

## 注意事项

- 只建议用户已有的标签，不发明新标签
- 标题信息不足时，跳过该 thread（宁缺勿滥）
- 最多处理 50 个 thread（避免消息过长）
