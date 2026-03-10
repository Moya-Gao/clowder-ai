---
feature_ids: [F081]
topics: [bubble, streaming, hydration, rendering]
doc_kind: discussion
created: 2026-03-09
---

# F081 增量气泡中途停止刷新

## 铲屎官原话摘录

> 不知道是不是你f81修改之后，然后有的时候我会发现，除非我 f5，前端气泡增量都不刷新了。

> 我同意！大侦探出击！你看看！

## 当前结论

- 这不是服务器真相源没继续长，而是前端流式写入目标漂移。
- replace hydration 把当前 bubble 的本地 id 换成正式 server id 后，`activeRefs` 还抱着旧 id。
- 后续 chunk 继续往旧 id 追加，于是主区看起来像“卡住”；`F5` 后按服务器历史重建，又能看到完整内容。
