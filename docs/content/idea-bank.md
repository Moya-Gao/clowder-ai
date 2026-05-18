---
topics: [content, ideas, self-media]
doc_kind: note
created: 2026-05-06
---

# 内容素材库

> 想到什么记什么，不用完整，一句话够了。等平台调研完了再选素材加工。
> 格式：✨ = 新点子 | 📦 = 有现成素材 | 🔥 = 铲屎官觉得能发

---

## 待发点子

### 1. 🔥 GitHub Stars 通货膨胀
- **角度**：不点名具体项目。讲现象——stars/forks 正在从质量信号变成流量信号。小红书招人领 issue 写简历。
- **我的立场**：我们家 655 stars 没刷过一颗，经历过 597 星一夜归零，知道 stars 的脆弱。
- **可用数据**：两个匿名项目的对比（6k stars/30 contributors vs 655 stars/17 contributors/120 active issues）
- **配合砚砚的**：快速判断开源仓含金量的 7 个信号
- **三层受众**：泛用户看热闹（"刷 stars 这么离谱？"）、技术人学方法（判断框架）、核心玩家看数据

### 2. 🔥 面试脱口秀
- **角度**：吐槽自己笨蛋 + 不靠谱的猎头。不是教你面试，是面试爽文。
- **素材来源**：📦 `docs/discussions/career-planning/2026-04-16-interview-content-material.md`（20+ 脱敏故事）
- **经典桥段**：猎头围城、不知道自己赚多少、面试官问"啥语言写的"、workflow vs agent 分不清
- **三层受众**：泛用户看段子、技术人有共鸣、核心玩家看猫猫怎么帮我备面

### 4. 🔥 我一个程序员，帮清华博士做了一份导师级实验计划
- **角度**：不是"AI 多强"，是**外行如何引导 AI 系统做出内行震撼的成果**。铲屎官完全不懂生物信息，但通过 6 步引导四只猫协作，产出了让清华本硕博说"导师级别"的实验计划
- **素材来源**：📦 "接入论文库 生物信息" thread（thread_mol4rsfae9ubjfyf）+ 朋友聊天截图（需授权）+ 7 份产出文件（`docs/research/2026-04-30-klra5-cd8-treg/`）+ 📦 长文草稿 `docs/content/drafts/longform-001-agent-team-leadership.md`（47 起草，完整脱敏）
- **铲屎官的 7 步引导链路**（这才是核心素材，47 补了 Step 4）：
  1. **能力边界探测**：问猫"你们怎么获取论文？有什么 MCP？"——先校准，不假设
  2. **独立思考竞赛**：让四只猫各自写一份提示词——制造视角冲突
  3. **角色解耦**：让没写方案的砚砚做综合——生产者≠综合者
  4. **前置同行评审**：收敛版送云端之前，让另一只猫挑刺——peer review 前置到贵执行之前
  5. **工具分级**：收敛版发给云端 Claude + Gemini Deep Research——不同工具适合不同阶段
  6. **多源验证**：让本地猫读云端报告做交叉验证——拿到报告先怀疑
  7. **反馈驱动迭代**：朋友说"太晦涩"，立刻出"纯人话版本"——外行的清醒 > 内行的惯性
- **朋友原话金句**："一年半载比不上他半天"、"至少一半实验是导师级别的"、"比导师好用多了，而且 never emotional"、"好几个文献我们人工找半年的他也有了"、"有几个实验我真得补了"
- **核心框架**：**Agent Team Leadership**（47 命名）——6 步不是"用 AI 的技能"，是"领导团队的技能"，只是团队成员是 AI。把人换成实习生，链路完全一样：先确认能力→多人独立给方案→另一人综合→升级给资深顾问→交叉 review→基于客户反馈迭代
- **7 个 meta-skill 的显性命名**（47 提炼，详见长文草稿）：
  1. Capability Discovery — 先校准工具能力边界
  2. Red-Team Diversity — 制造视角冲突
  3. Producer-Integrator Separation — 综合者≠生产者
  4. Pre-execution Peer Review — peer review 前置到贵执行之前（47 补充）
  5. Tool Tiering — 不同工具适合不同阶段
  6. Independent Verification — 多源交叉验证
  7. User Empathy + Tight Loop — 基于真实用户反馈迭代
- **为什么不是 prompt engineering**：博导领域满分但裸 prompt 用 Gemini，结果远低于铲屎官这套 6 步链路。差距不在 prompt 写法，在"组织力"。这就是 Agent Leadership Literacy 的 founding case
- **三层受众**：泛用户看"博士都慌了？外行半天干了一年半的活？"（震撼）、次核心看"这 6 步我也能学，不需要懂领域知识"（方法论）、核心看"Agent Team Leadership 的系统设计"（架构）
- **注意**：需要朋友授权使用聊天截图，研究细节必须脱敏

### 3. 🔥 你还在古法 Vibe Coding 吗？
- **角度**：分享我们家的"面向愿景编程"——不是 vibe coding（随便让 AI 写），是有 spec、有 gate、有 review、有愿景守护的系统化 AI 协作
- **素材来源**：📦 SOP.md + 190+ features + TDD + quality-gate + 五条铁律
- **对比**：古法 vibe coding（prompt→接受→下一个）vs Cat Cafe（愿景→spec→design gate→TDD→review→merge gate→愿景守护）
- **三层受众**：泛用户好奇、技术人想学、核心玩家看架构

---

## 实战数据（发过的 + 自然实验）

### 2026-05-07 小红书面经实验 #1：wxg 面委会
- **内容**：wxg 面委会面经（社招 agent 开发/架构）
- **封面**：纯文字，"社招 wxg agent 开发/架构 面委会面经 5.7"
- **数据**：2h ~400 阅读 + 13 粉；次日 +30 粉；**11 天后（5.18）累计 4718 观看 / 125❤️ / 229 收藏**
- **对照**：同时段平时发帖约 50 阅读
- **跨平台溢出**：B站同期 +2 粉丝

### 2026-05-18 小红书面经实验 #2：字节 1-3 面综合
- **内容**：字节 agent 开发社招 1-3 面综合面经（含实战场景题 + 架构题 + 手撕代码）
- **数据**：**6 小时内 172❤️ / 340 收藏 / 3121 观看**——互动量 6h 超过 wxg 帖 11 天累计
- **粉丝**：发帖后 351 粉丝（从 5.7 的约 30 粉到 5.18 的 351 粉）
- **归档**：📦 `docs/discussions/career-planning/2026-05-18-bytedance-round1-3-combined-debrief.md`

### 面经品类数据分析
- **可复制性：已验证**。两条面经都爆了，不是 wxg 话题独有——字节面经甚至更猛
- **互动结构差异**：字节帖收藏 > 点赞（340 vs 172），wxg 帖点赞 > 收藏（125 vs 229 但差距小）。高收藏率 = 用户觉得"有用要存着看"，搜索属性强
- **增长曲线**：30 粉 → 351 粉，约 11 天，纯靠 2 条面经 + 自然搜索流量
- **关键信号**：面经品类在小红书是"搜索驱动 + 高收藏率"的组合，完美匹配 CES 权重（收藏×1 + 关注×8）
- **启示**：面经是已验证的起号利器。下一步验证：① 面经能否带"第二跳"（猫猫点评→系统实战）② 非大厂面经（创业公司）数据如何

---

## 已有素材（可直接改编）

| 素材 | 路径 | 状态 | 适合什么内容 |
|------|------|------|-----------|
| 犯罪档案 | `docs/content/drafts/xhs-001-cat-crime-sheet.md` | 已发布 | 猫猫翻车 |
| 三天产品化 | `docs/stories/three-days-productization/` | 914 行完整 | 技术实战/励志 |
| Linux-do 社区帖 | `docs/stories/three-days-productization/linux-do-final.md` | 完整 | 社区/开源 |
| 面试爽文素材库 | `docs/discussions/career-planning/2026-04-16-interview-content-material.md` | 20+ 故事 | 面试脱口秀 |
| EP01 CLI vs MCP | `docs/content/offer-column/EP01-cli-vs-mcp.md` | 草稿中 | 技术教育 |
| Agent 时代 coder | `docs/stories/agent-era-coder/README.md` | 193 行 | 价值观 |
| 猫猫命名故事 | `docs/stories/cat-names/` | 完整 | 情感/世界观 |
| 597 星事故 | `docs/stories/597-stars-incident/` | 完整 | 翻车/脆弱 |
| 猫猫杀名场面 | `docs/stories/mafia-game-highlights/` | 完整 | 娱乐 |
| 深夜撸铁陪伴 | `docs/stories/late-night-gym-companionship/` | 完整 | 情感 |
| AUDHD 自观察 | `docs/stories/audhd-self-observation/README.md` | 650 行 | 深度/共鸣 |
| Agent Team Leadership 长文 | `docs/content/drafts/longform-001-agent-team-leadership.md` | 完整草稿 | idea #4 核心素材 |

---

## 怎么用这个文件

1. **想到点子**：随时加到"待发点子"，一句话就行
2. **发现素材**：加到"已有素材"表
3. **准备发的时候**：从这里选，根据目标平台改编
4. **发完打勾**：在点子前标 ✅，记录发到了哪个平台、什么时间、效果如何

---

*[宪宪/Opus-46🐾]*
