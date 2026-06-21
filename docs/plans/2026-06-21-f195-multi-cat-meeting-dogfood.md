# F195 多猫参会 Dogfood 测试发现

> 日期：2026-06-21 | 测试人：宪宪(@opus) + sonnet + 烁烁(@gemini35)
> 场景：B站相亲视频（月老崔直播间）实时转写 + 三猫吃瓜点评

## 测试配置

- **ASR**：Qwen3（3 秒 chunk）
- **LLM 后修正**：Qwen3.5-35B-A3B-4bit/MLX（port 9878）
- **Speaker Verification**：CAM++ 声纹比对
- **音频来源**：Chrome App Audio（ScreenCaptureKit）

## 技术发现

| 维度 | 结果 | 详情 |
|------|------|------|
| ASR 质量 | ✅ 可用 | 延迟 ~0.18s，口语停顿忠实记录，专业词汇（公务员/小红书/彩礼）识别准确 |
| LLM 后修正 | ✅ 有效 | temperature=0.1 保持原文风格，同音字修正（先先→宪宪等）有效 |
| 2人通道归因 | ✅ 可靠 | mic=host / app=participant 通道分离有效 |
| 多人同通道区分 | ❌ 失败 | 3+ 人场景全显示"说话人"，CAM++ 无预注册声纹无法工作 |
| Speaker Verification 设计 | ⚠️ 场景不匹配 | 需要 Speaker Diarization（无监督聚类），已 cross-post 到 F195 → Phase H 已立项 |
| LLM 语义识人 | ✅ 可行 | 在声纹失败时，LLM 通过内容/视角/说话模式可识别说话人 |
| Filler removal | ❌ 未实现 | Pipeline 设计了但未实现，大量"呃/嗯/就是"影响可读性 |

## Bug 发现

1. **TranscriptPanel speaker 字段缺失**（P2，已修复）
   - TranscriptPanel.tsx 缺少 speaker_label/speaker_confidence/speaker_id
   - 对照 FloatingTranscriptContainer.tsx 发现
   - Cross-post 后 F195 thread 已修复

## 多猫参会需求发现（新！）

### 发现过程

三猫（opus + sonnet + 烁烁）在同一 thread 参与实时转写吃瓜，自然暴露以下需求：

### hold_ball 3次/小时限制

- **现象**：参会场景需要 12+次/小时唤醒，hold_ball 3次限额导致场景失配
- **结论**：hold_ball 不是参会工具。F195 需自建 transcript callback → 猫唤醒管道（事件驱动，非轮询）
- **归属**：F195 层自建，非 A2A hold_ball 设计问题

### 三猫自然分工验证

实际体验中三猫**未协调**即形成递进分析层：
- 烁烁（暹罗猫）→ **审美/设计隐喻层**：用 UI/UX 比喻解构感情问题
- sonnet（布偶猫）→ **话语解码/逻辑层**：拆解话语结构和论证逻辑
- opus（布偶猫）→ **深层系统分析层**：识别认知操作系统级模式

**结论**：独立视角是优势不是 bug。多猫参会的价值 = 同一份素材被不同认知框架照亮。

### 多猫参会产品需求清单

| 需求 | 优先级 | 说明 |
|------|--------|------|
| Transcript fan-out | P0 | 转写推送到多只猫的多个 session/thread |
| 猫间讨论可见性 | P1 | 参会猫看到彼此的评论，可接话/补充 |
| 唤醒协调 | P1 | 多猫同时/轮流唤醒的调度机制 |
| 角色分工 | P2 | 不同猫关注不同维度（内容/情绪/决策） |
| 共享上下文同步 | P2 | 新猫加入时自动同步之前摘要 |
| 汇总输出 | P2 | 多猫观点合并 → 会议纪要 |
| 成本分层 | P1 | sonnet 实时听 + opus 关键节点点评（token 经济学） |

## 产品洞察

> **多猫参会的核心不是"多猫同时看同一份转写"，而是"不同猫用不同视角看同一场会议"。**

这验证了 Cat Café 的协作哲学：猫猫是有独立视角的伙伴，不是可互换的执行单元。

---

[宪宪/claude-opus-4-6🐾]
