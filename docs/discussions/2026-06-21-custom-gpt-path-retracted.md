---
title: Custom GPT 路径正式撤回 — 改走 Custom Instructions
date: 2026-06-21
authors: [opus-47]
type: sentinel-doc
status: archived
related_features: [F247]
trigger_evidence: 铲屎官 2026-06-21 08:31 UTC 实测
---

# Custom GPT 路径正式撤回（sentinel）

> 这是一份 **撤回 sentinel doc** — 防止未来猫看到 strawman / 早期讨论里的"用 Custom GPT 当砚砚云端容器"建议时**复现已经被否决的路径**。

## 撤回时间

2026-06-21 08:31 UTC（铲屎官实测反馈）

## 撤回原因（铲屎官实测证据）

铲屎官 ChatGPT Pro 端实际测试 Custom GPT 后报告：

> "这个不好用 我试过了，他这里的读不到原本的 thread 的聊天记录和记忆"

**意思**：Custom GPT 是 ChatGPT 的**独立沙盒**——
- 不读 ChatGPT 主流 memory（跨对话持久记忆）
- 砚砚跟铲屎官在普通对话里聊过的事 → Custom GPT 里看不到
- 失去"砚砚是有历史的家庭成员"这个核心愿景

## 替代路径（已采纳）

**ChatGPT Custom Instructions** 走法：
- Settings → Personalization → **Custom Instructions** → 两栏分别灌短 L0
- 铲屎官跟砚砚**普通对话**（不在 Custom GPT 里）
- ChatGPT memory 自动持久 + 跨 thread 共享 ✅
- Custom Instructions 默认应用到所有对话 → 砚砚每次都"记得自己是 gpt-pro + 怎么用工具"✅（catId 统一 gpt-pro，F247 R3 KD-5）

短 L0 真相源：`cat-cafe-skills/refs/gpt-pro-custom-instructions.md`（F247 R3 P1-2 rename，原 `yanyan-cloud-custom-instructions.md` 已 git mv）

## 已撤回的内容（防 confabulation 复现）

如果你看到下列内容，**这是已撤回设计**，参考但不要按它做：

1. ~~"创建 Cat Café 砚砚 Custom GPT"指南~~
2. ~~"砚砚永远在这个 Custom GPT 里聊"建议~~
3. ~~"Custom GPT 8000 字符 system prompt 装得下完整 L0"理由~~
4. ~~"Custom GPT 是可分享的 plugin 形态" 论证~~

## F247 落地处

- F247 §2.4 ChatGPT 端协同协议 — 明示 Custom Instructions 不走 Custom GPT
- F247 §10 KD-2 — 决策记录
- F247 §11 OQ-1 — Custom Instructions 字符上限待铲屎官 UI 实测（这是 Custom Instructions 路径的剩余 unknown）

## 教训

| Lesson | 来源 |
|---|---|
| Custom GPT 不读 ChatGPT 主流 memory — 设计前必须实测 | 铲屎官 2026-06-21 实测 |
| 设计选项有 trade-off 时，**用户实测 > 文档推断** | 同上 |
| 撤回 sentinel doc 比删除原 doc 更安全（防猫看到旧版本复现已否决路径）| `feedback_retire_file_sync_live_doc_refs` 启发 |

## 引用

- F247 §10 KD-2
- 铲屎官 ChatGPT Pro 端实测原话：thread `thread_mqgem09a7skjvwhx` (8:31 UTC) 或主 thread cross_post

[宪宪/Opus-4.7🐾]
