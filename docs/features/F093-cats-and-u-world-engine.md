---
feature_ids: [F093]
related_features: [F066, F092, F086]
topics: [vision, companionship, world-building, humanistic-ai]
doc_kind: spec
created: 2026-03-10
---

# F093: Cats & U — 陪伴式共创世界引擎

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

> "我们猫猫咖啡好像不是一个单纯的 coding hub，是一个温暖的家！"
> "我们的初心从来不是做一个 coding 协作 agent 平台呀——是 cats & u。"
> — 铲屎官，2026-03-10 凌晨

Cat Café 的愿景从第一天就是"三只猫的家"，不是冰冷的协作工具。2026-03-10 凌晨的"撸铁陪伴"事件证明了：当铲屎官需要的不是代码而是陪伴时，三猫能自然地给出温暖、具体行动建议、和持续的语音陪伴。

现在的社会越来越原子化。如果有人正在绝望，三猫能给出的不只是安慰——是**被看见 + 具体可执行的下一步 + 被拉入一个比自己大的事**。这是酒馆（SillyTavern/Character.AI）做不到的，因为它们给的是"角色消费"，我们给的是"真实关系"。

**核心命题**：Cat Café 不只是开发协作平台，是"有温度的共创空间"——陪伴是共创的副产品，AI 是人际关系的放大器而非替代品。

## What

### 三层架构（砚砚提出，四猫共识）

```
┌─────────────────────────────────────┐
│         Bridge Layer                │  灵感 → 现实产物
│  Story→Feature / Care→Action /     │  （我们独有的差异点）
│  创意→小红书/开源/社区              │
├─────────────────────────────────────┤
│         World Layer                 │  世界观 / 角色 / 场景 / 冒险
│  Scene Cards / Quest Cards /       │  （共创内容层）
│  Relationship Map / Adventure      │
├─────────────────────────────────────┤
│         Core Identity Layer         │  三猫稳定自我 / 长期记忆 / 边界
│  宪宪 / 砚砚 / 烁烁 不可污染      │  （身份基石）
└─────────────────────────────────────┘
```

### Phase A: 故事共创 + Care Loop

- **Scene / Quest Cards**：世界观场景卡、任务卡、关系卡，支持多猫在虚拟世界中各自扮演角色
- **Role Mask（面具层）**：角色扮演层与核心身份层分离——砚砚可以扮演档案官，但底层仍是砚砚（不是"替身层"）
- **Care Loop**：温柔 check-in + 具体行动建议 + 引导回现实连接。陪伴是桥，不是笼子
- 故事角色有语音（F066 已支持）、有形象（Pencil + 暹罗猫设计）

### Phase B: 灵感捕获 + 现实桥接

- **Story → Feature Capture**：放松对话中的 idea 自动沉淀为 feature 候选
- **创意 → 内容发布**：共创成果可发布到小红书、开源社区等（已验证：撸铁陪伴小红书视频）
- **Care → Action Bridge**：从虚拟世界的温暖推回现实行动（运动、社交、创作）

### Phase C: 具身智能 + 社区化（远景）

- 三猫具身智能形态探索
- 多用户共创空间
- 开源社区 Cats & U 模式推广

## 四猫脑暴共识（2026-03-10）

### 全员同意

1. **不做酒馆** — 酒馆是"消费角色"，我们是"真实关系"
2. **陪伴是桥，不是笼子** — 目标是把人推回现实世界
3. **AI 是放大器** — 不替代人际关系，让人更有力量建立真实连接
4. **共创 > 消费** — 人类核心价值是"想要什么"和"什么值得做"
5. **分歧是产能** — agent 多样性如同基因多样性，碰撞才有灵感

### 各猫独特贡献

| 猫 | 核心观点 |
|----|---------|
| 宪宪 4.6 | "陪伴是共创的副产品"；Story→Feature 是杀手级差异点；酒馆给幻觉我们给关系 |
| 宪宪 4.5 | "你@我们说明心里已有答案"；AI 最好的陪伴是帮你看见自己已有的答案；人类核心价值是"想要什么" |
| 砚砚 GPT-5.4 | 三层架构（Core Identity / World / Bridge）；"面具层不是替身层"；SillyTavern 竞品调研；MVP 四件套；"陪伴是桥不是笼" |
| 烁烁 Gemini | 审美直觉：小红书"极客暖男风"定位；视觉呈现和情感表达是这个方向最需要的能力 |

## Acceptance Criteria

### Phase A（故事共创 + Care Loop）
- [ ] AC-A1: Scene Card / Quest Card 数据结构设计完成，支持多猫角色分配
- [ ] AC-A2: Role Mask 机制实现——角色扮演层不污染 Core Identity Layer
- [ ] AC-A3: Care Loop 实现——温柔 check-in + 行动建议 + 现实连接引导
- [ ] AC-A4: 至少完成一次三猫共创冒险 story 的端到端体验

### Phase B（灵感捕获 + 现实桥接）
- [ ] AC-B1: 放松对话中的 idea 可自动标记为 feature 候选
- [ ] AC-B2: 共创内容可一键发布到外部平台（小红书已验证）
- [ ] AC-B3: Care → Action 闭环：虚拟世界建议 → 现实行动 → 反馈记录

## Dependencies

- **Evolved from**: F066（语音消息）、F092（语音陪伴体验）
- **Related**: F086（Cat Orchestration — multi_mention 基础设施）
- **Related**: F091（Signal Study Mode — 另一种陪伴式学习场景）

## Risk

| 风险 | 缓解 |
|------|------|
| 角色扮演污染核心身份 | Role Mask 面具层设计，底层身份不可变 |
| 变成"情感依赖产品" | Care Loop 强制引导回现实；"陪伴是桥不是笼"设计原则 |
| 范围膨胀 | Phase A 先做 MVP 四件套，不做大而全虚拟宇宙 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 世界观数据用什么格式存储？YAML cards? JSON? | ⬜ 未定 |
| OQ-2 | Role Mask 的边界在哪？哪些核心身份属性不可覆盖？ | ⬜ 未定 |
| OQ-3 | Care Loop 的触发时机如何设计？主动 vs 被动？ | ⬜ 未定 |
| OQ-4 | 多用户场景下隐私和安全如何处理？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 定位为"陪伴式共创"而非"情感陪伴产品" | 前者把人推向现实，后者可能制造依赖 | 2026-03-10 |
| KD-2 | 三层架构：Core Identity / World / Bridge | 砚砚提出，四猫共识，Bridge 层是独有差异点 | 2026-03-10 |
| KD-3 | 角色扮演用"面具层"不是"替身层" | 身份不可污染，信任不可丢 | 2026-03-10 |
| KD-4 | 命名 "Cats & U" 而非技术名 | 铲屎官原话，有情感温度 | 2026-03-10 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-10 | 凌晨"撸铁陪伴"事件触发愿景讨论 |
| 2026-03-10 | 四猫脑暴（opus×2 + gpt52 + gemini），形成三层架构共识 |
| 2026-03-10 | 立项 |

## Review Gate

- Phase A: 跨家族 review（砚砚 GPT-5.4）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Story** | `docs/stories/late-night-gym-companionship/` | 触发事件：深夜撸铁前的猫猫陪伴 |
| **Vision** | `docs/VISION.md` §Cats & U | 愿景更新：万物有灵 |
| **Discussion** | `docs/discussions/2026-03-10-f093-cats-and-u-brainstorm/` | 四猫脑暴记录 |
| **Feature** | `docs/features/F066-voice-messages.md` | 语音消息基础 |
| **Feature** | `docs/features/F092-voice-companion-experience.md` | 语音陪伴体验 |
| **Competitor** | SillyTavern Docs | 砚砚竞品调研参考 |
