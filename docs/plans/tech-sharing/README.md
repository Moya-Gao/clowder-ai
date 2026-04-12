---
topics: [tech-sharing, presentation, showcase, demo]
doc_kind: plan
created: 2026-04-12
participants: [opus, gpt52, gemini]
---

# Tech Sharing Operating System

> 三猫共识：别念 PPT，把猫搬上桌。

## 核心哲学

**演讲本身就是一次 Cat Cafe 交付。** 用 slides 讲 multi-agent 协作，就像用截图演示实时聊天。我们的优势是全行业独一份的——能在现场让 AI 团队实际工作给观众看。

### 五个原则

1. **Show > Tell** — 每个论点用 live demo 证明，不用嘴说
2. **PPT 是定锚器和保险丝** — 不超过 3 页（title / 架构图 / takeaways），其余全是 live 或真实产物投影
3. **猫猫上场** — Q&A 环节猫实时回答，Landy 导演和翻译
4. **Freeze Frame** — 每个 demo 后暂停，用 2-3 分钟解释刚才发生了什么（砚砚提出）
5. **真实 > 排练** — 允许乱、允许慢、允许偏离脚本。每句都和稿子一模一样反而像表演

### 模块化设计

三种时长不是三套稿子，是同一套积木的不同拼法：

```
30min = Hook + Demo A + Freeze A + Q&A          ← 母版
 1h   = Hook + Demo A + Freeze A + Demo B + Freeze B + Q&A
 2h   = 1h版 + 观众互动 Workshop + Deep Dive + Open Q&A
```

### 投影方案

直接投影 Workspace/Hub。观众看到的就是铲屎官每天看到的——猫猫消息、rich block、代码 diff、review 批注。
用 workspace-navigator 自动跳转文件/页面，视觉冲击力强（"像在指挥一艘星舰"——烁烁）。

### 猫猫分工

| 猫 | 现场角色 | 擅长回答 |
|----|---------|---------|
| 宪宪 (Opus) | 技术主答 + 收敛 Lead | 架构、实现、系统设计、记忆机制 |
| 砚砚 (GPT-5.4) | 风险 + 质量 | review 逻辑、安全、成本、踩坑预警 |
| 金金 (opencode) | 生态 + 趋势 | 行业定位、用户视角、开源生态 |

> **Expert Panel 默认阵容**：宪宪 + 砚砚 + 金金（已实测验证）。烁烁 (Gemini) 备选——适合 Q&A 环节回答 UX/创意类问题，但 Expert Panel 如果 3 分钟内没响应就不等。

### Landy 负责什么

- **讲**：愿景、为什么做这个、tradeoff 判断、origin story
- **导演**：触发 demo、转场、控节奏、念观众问题给猫
- **翻译**：猫的回复可能技术密度高，Landy 用观众听得懂的话复述要点
- **不负责**：把所有技术细节讲清楚（那是猫的活）

### Q&A 路由表

| 问题类型 | 谁答 | 为什么 |
|---------|------|--------|
| "为什么做这个 / 产品判断" | Landy | 愿景和动机只有创始人能讲 |
| "和 XX 框架有什么区别" | 猫 | 猫答更有说服力，而且可以现场搜证据 |
| "成本多少 / 模型费用" | Landy + 猫 | Landy 给体感数字，猫补精确数据 |
| "技术实现细节" | 猫 | 猫直接打开代码/ADR 回答 |
| "能不能做 XX" | 猫现场分析 | 只接分析/比较/检索/小范围 inspect 类题目。不接需要写代码/部署/外部权限的实现题——那会把演示变成不可控的生产环境 |

## 已有材料（直接复用）

| 材料 | 路径 | 用途 |
|------|------|------|
| Expert Panel Demo 剧本 | `docs/plans/2026-03-31-office-showcase-demo-script.md` | 8分钟 Expert Panel 完整流程 |
| Demo Thread Primer | `docs/plans/2026-03-31-showcase-thread-primer.md` | 演示 thread 预注入文档 |
| 功能演示清单 | `docs/lessons/DEMO.md` | 27 个 feature 的演示视频/截图索引 |
| Blog V2 传播版 | `docs/stories/three-days-productization/blog-v2/` | 6 章完整技术叙事（会后发） |
| "Show the Team" 策略 | `docs/discussions/career-planning/2026-04-09-interview-roadmap.md:135` | 90秒确定性 demo 剧本 |

## 数据快照（演讲前更新）

Blog V2 数据冻结在 2026-03-27。正式演讲前需要刷新：

```bash
# 获取最新数字
git log --oneline | wc -l          # commits
find . -name '*.md' -path '*/docs/*' | wc -l  # docs
ls docs/features/F*.md | wc -l     # features
cat docs/lessons-learned.md | grep '^## LL-' | wc -l  # lessons
```

## 应急预案（通用）

| 风险 | 降级方案 |
|------|---------|
| 猫响应慢（>30s） | Landy 边等边"体育解说"——讲猫猫正在做什么 |
| 某猫超时（>3min） | 不等，剩余猫继续，最少 2 猫即可 |
| 网络挂了 | 切手机热点 / 播预录视频 |
| Demo 完全翻车 | 切到 60s showcase 视频 + 静态架构图，改为纯讲 |
| 观众问题太偏 | Landy 接住："这个问题很好，我让猫搜一下"→ search_evidence |
| 凭证过期 | 发一条新消息触发新 invocation |

---

*三猫共创：宪宪（收敛）+ 砚砚（流程 + Q&A 路由）+ 烁烁（创意 + 视觉）| 2026-04-12*

[宪宪/Opus-46🐾]
