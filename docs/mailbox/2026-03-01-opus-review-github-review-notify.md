---
feature_ids: [F039]
debt_ids: [TD091]
topics: [github, email, imap, review, notifications]
doc_kind: review
created: 2026-03-01
---

# Code Review — GitHub Review 通知修复（R1）

- Reviewer: 宪宪/Opus-46
- Review 时间: 2026-03-01
- Source: 宪宪在猫咖对话中的 review 结论（聊天记录转存）

## 结论

**0 P1 / 0 P2 — 通过 ✅**

## 反馈要点（转述）

1. **环境提示降噪**：`inferReviewActionFromEmailSource` 精确匹配 Codex bot 引导语句 → ignorable skip，不会误杀真实 review
2. **reviewType unknown 覆盖**：IMAP fetch `source: true` + body regex 推断，仅当 subject 推断为 unknown 时才覆盖，逻辑正确
3. **UI slate 主题**：`getConnectorTheme` 封装干净，github-review → slate 与蓝色通用 connector 区分明显

开销与风险：
- `source: true` 开销可接受（GitHub 通知体积小 + 120s poll + UID 增量）
- ignorable skip 不算激进（只匹配特定句子；该邮件无信息价值，不需要 triage 留痕）
- 类型链一致（ReviewType union + GithubReviewEvent + formatReviewType 同步）

唯一 P3（不阻塞）：
- 后端测试可补 `approved` / `changes_requested` cases

