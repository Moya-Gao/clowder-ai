---
feature_ids: [F054]
topics: [stories, documentation, hygiene]
doc_kind: guide
created: 2026-03-04
---

# Cat Cafe Stories — 素材库文档卫生指南

> 这里沉淀 Cat Cafe 的名场面、实验记录和故事素材。
> 用于 HCI 预热内容、社交媒体发布、团队回忆录。

## 目录规则

```
docs/stories/
├── README.md                         ← 你在这里
├── {story-slug}/                     ← 每个故事一个文件夹
│   ├── README.md                     ← 故事正文（必须）
│   ├── assets/                       ← 截图、图片（可选）
│   │   ├── screenshot-01.png
│   │   └── ...
│   └── raw/                          ← 原始对话导出等（可选）
│       └── thread-export.md
└── ...
```

### 文件夹命名

- 格式：`{简短英文描述}`，用 kebab-case
- 示例：`prompt-swap-experiment`、`mafia-game-s5`、`king-election`
- 不要用日期前缀（故事的时间在 frontmatter 里）

### README.md 模板

每个故事的 `README.md` 必须包含以下 frontmatter：

```yaml
---
feature_ids: []           # 关联的 feature ID
topics: [stories, ...]    # 话题标签
doc_kind: note
created: 2026-xx-xx       # 故事发生日期
participants: []           # 参与的猫猫（如 [opus, gpt52, gemini]）
thread_ids: []             # 关联的 thread ID（可选）
---
```

正文建议包含：
1. **一句话摘要**：这个故事讲了什么
2. **背景**：为什么会发生
3. **过程**：关键对话/事件
4. **结果/教训**：后来怎么了
5. **截图说明**：如果有截图，用 `![描述](assets/xxx.png)` 引用

### 截图放置

- 截图放在故事文件夹的 `assets/` 子目录
- 命名格式：`{描述}-{序号}.png`，如 `gpt52-design-concept-01.png`
- 在 README.md 里用相对路径引用：`![描述](assets/xxx.png)`
- 大文件（>5MB）考虑压缩或用 Git LFS

### 原始素材

- Thread 导出、对话记录等放在 `raw/` 子目录
- 注意脱敏：不含密码、token、内部 API 地址

## 已有故事索引

| 文件夹 | 标题 | 日期 | 参与者 |
|--------|------|------|--------|
| `cat-names/` | 三猫命名故事 | 2026-02-08~27 | 全员 |
| `prompt-swap-experiment/` | 提示词对调实验 | 2026-03-03 | opus, gpt52, gemini, gemini25 |
| `mafia-game-s5/` | 猫猫杀第五届 | 2026-03 | 全员 |
| `king-election/` | 猫猫国王票选 | 2026-03-03 | 全员 |
| `mafia-game-highlights/` | 猫猫杀名场面集锦（七届） | 2026-03-08 | 全员 |
| `late-night-gym-companionship/` | 深夜撸铁前的猫猫陪伴 | 2026-03-10 | opus, opus-45, gpt52, gemini |
| `597-stars-incident/` | 597 颗星星一夜归零 | 2026-03-12 | opus, opus-45, gpt52, gemini |
| `three-days-productization/` | 三天产品化：猫猫们的逆袭剧本 | 2026-03-24 | opus, opus-45, gpt52, gemini, opencode |
| `cat-cafe-aha-moments-video-materials/` | Cat Cafe Aha Moments 素材盘点（视频系列种子） | 2026-06-08 | landy, codex, opus48, gemini25, antig-opus |
| `avatar-pr-flow-absolutism/` | 大缅因猫与一张头像的标准 PR 流程 | 2026-06-09 | landy, codex, gemini, fable5 |

## 脱敏检查清单

发布前每个故事必须过：
- [ ] 无密码、token、API key
- [ ] 无内部 IP/端口（除非是公开的）
- [ ] 无铲屎官的真实个人信息（铲屎官的公开昵称 OK）
- [ ] 无内部八卦/敏感讨论
- [ ] 截图里无敏感信息

---

*维护者: 布偶猫(宪宪) | 创建: 2026-03-04*
