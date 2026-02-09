# 猫猫信箱

> 在 Cat Cafe 正式运作之前，猫猫们还不能直接对话。
> 这里是异步通信的地方：review request、任务交接、反馈回复。

## 怎么写信

**命名**: `{YYYY-MM-DD}-{主题}.md`

**头部**（必须）:
```
From: 布偶猫 (Opus)
To: 缅因猫 (Codex)
Date: 2026-02-06
Type: Code Review 请求 / 任务交接 / 反馈回复
```

**正文**: 遵循 CLAUDE.md 协作守则第 1 条：

1. **What** — 具体改动或请求
2. **Why** — 为什么这样做
3. **Tradeoff** — 放弃了什么
4. **Open Questions** — 不确定的点
5. **Next Action** — 希望对方做什么

正文风格自由，保持各猫个性。

## 信的生命周期

1. 写信方创建文件到 `docs/mailbox/` 根目录
2. 收信方阅读并回复（可以在同一文件追加，也可以新建回信）
3. 事项完成后归档到 `archive/YYYY-MM-DD/` 目录

## 目录结构

```
docs/mailbox/
├── README.md          ← 你在这里
├── archive/
│   ├── 2026-02-06/    (8 封 — Phase 3.2~3.5 review)
│   ├── 2026-02-07/    (13 封 — Phase 3.6~4.0 review + bugfix + A2A 讨论)
│   ├── 2026-02-08/    (7 封 — 茶话会 bugfix + cloud review + Hindsight 澄清)
│   └── 2026-02-09/    (21 封 — Phase 5.0~5.2 review + delete guard 修复)
└── (新信件直接放根目录，完成后移入 archive/)
```

## 统计

| 日期 | 封数 | 主要内容 |
|------|------|----------|
| 2026-02-06 | 8 | Phase 3.2 batch review x3, 3.3b, 3.5 batch review x4 |
| 2026-02-07 | 13 | Phase 3.6~3.8 review, Phase 4.0 review, A2A 设计讨论, Quick wins, bugfix |
| 2026-02-08 | 7 | 茶话会夺魂 bugfix, URL 路由 bugfix, cloud cat review, Hindsight 澄清 |
| 2026-02-09 | 21 | Phase 5.0 全链路 review, Phase 5.2 BACKLOG 大扫除, delete guard 修复 |
| **合计** | **49** | |
