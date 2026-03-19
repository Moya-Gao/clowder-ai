---
feature_ids: [F101]
related_features: [F066, F103, F086, F105, F035, F087, F088]
topics: [game, werewolf, ai, llm, voice, tts]
doc_kind: plan
created: 2026-03-17
version: 4
---

# F101 Phase H — AI 集成 + 报幕 + 语音分支 + 消息承载 + Chat UI

> **Owner**: 金渐层 (@opencode) | **Status**: design (awaiting 铲屎官 approval)
>
> **一句话**：让狼人杀从"规则引擎调试输出"变成"真的能玩的猫猫狼人杀"——消息有去处、发言有上下文、铲屎官能回看全程。

## 问题诊断

铲屎官 2026-03-17 实测发现：进入游戏 1 秒内出现 `P3 kill → P2`、`P6 divine` 等数据，但 CLI 根本不可能这么快拉起来。质疑"这是假数据？"

**根因**：Phase A–G 一路在修规则引擎和 UI，但核心行动层从未接入 AI/LLM。

| 现象 | 根因 | 代码位置 |
|------|------|----------|
| 1 秒出全部行动结果 | `GameAutoPlayer.buildAction()` 用 `pickRandom()` 本地随机选目标，800ms 一个 tick | `GameAutoPlayer.ts:196-242` |
| 没有真正的猫猫发言 | `speak` case 提交空 action（无 text），`recordSpeech()` 从未被调用 | `GameAutoPlayer.ts:234-236` |
| 没有"天亮了"报幕 | `day_announce` 在 `SKIP_PHASES` 集合中，AutoPlayer 直接跳过 | `GameAutoPlayer.ts:33` |
| 夜间结果不可见 | `night_resolved` 事件 `scope: 'god'` + `revealPolicy: 'phase_end'` | `GameOrchestrator.ts:469-476` |
| EventFlow 像 debug log | `action.*` 事件和 `ballot.*` 混排，无分层渲染 | `EventFlow.tsx:10-14`（H6 将用 Chat UI 替换） |
| WerewolfAIPlayer 是死代码 | 已写好 `decideNightAction/decideSpeech/decideVote` 但从未被 import | `WerewolfAIPlayer.ts` (零消费者) |

## 规则引擎 Bug Catalogue（上帝驱动层）

以下 bug 全部在规则引擎层，**修复不需要 LLM**，可以立刻做。

| # | Bug | 严重度 | 位置 | 修复方案 |
|---|-----|--------|------|----------|
| RB-1 | `day_announce` 被 `SKIP_PHASES` 跳过，无天亮公告 | P0 | `GameAutoPlayer.ts:33` | 从 `SKIP_PHASES` 移除 `day_announce`；在 `resolveNightFromEvents` 后写一条 `scope: 'public'` 的 announce 事件 |
| RB-2 | `night_resolved` 事件 `scope: 'god'`，普通玩家看不到昨夜死亡 | P0 | `GameOrchestrator.ts:469-476` | `day_announce` 阶段写 `scope: 'public'` 的 `dawn_announce` 事件，从 `night_resolved` 提取 deaths |
| RB-3 | `speak` action 无 text 内容，讨论阶段是空壳 | P0 | `GameAutoPlayer.ts:234-236` | 提交 speak 后调用 `WerewolfEngine.recordSpeech(seatId, text)` 写入 speech 事件 |
| RB-4 | `last_words` 从未被写入（AutoPlayer 跳过 `day_last_words`） | P1 | `GameAutoPlayer.ts:33` | 从 `SKIP_PHASES` 移除 `day_last_words`；被放逐者发遗言 |
| RB-5 | 投票结果无公告事件（`vote_resolved` 有但无格式化报幕） | P1 | `GameOrchestrator.ts:494-501` | 在 `resolveDayVoteFromPending` 后写 `scope: 'public'` 的 `exile_announce` |
| RB-6 | EventFlow 把 `action.*`（god scope）和 `ballot.*`（public）混排显示 | P1 | `EventFlow.tsx:10-14` | 方案 B 彻底解决：Chat UI 只显示 messageStore 消息（报幕/发言/投票），action.* 不进 messageStore，自然不出现在游戏面板。GodInspector 保留 eventLog 全量查看 |
| RB-7 | `day_exile` 被 `SKIP_PHASES` 跳过，放逐执行无过渡 | P2 | `GameAutoPlayer.ts:33` | 从 `SKIP_PHASES` 移除 `day_exile`，让放逐有动画/公告时间 |
| RB-8 | 无回合开始公告（"第 N 个夜晚降临"） | P2 | `GameOrchestrator.ts:395-401` | `round_start` 事件已有但 EventFlow 未特殊渲染 |

## 三层架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                     铲屎官 / 观战者 视角                          │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Layer 1: 报幕层  │  │ Layer 2: AI 行动层│  │Layer 3: 发言层│  │
│  │  (Announcer)      │  │ (AI Action)      │  │ (Speech)     │  │
│  │                   │  │                  │  │              │  │
│  │  纯规则引擎       │  │  需要 LLM         │  │ 需要 LLM     │  │
│  │  "天亮了，P5死亡" │  │  kill/guard/vote  │  │ + 语音/文本  │  │
│  │  "P3 被放逐"      │  │  替换 pickRandom  │  │ 分支         │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│         ↓                      ↓                    ↓          │
│         └──────── 全部写入 messageStore.append() ──────┘          │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Chat UI（替换 EventFlow，方案 B）              │  │
│  │  <ChatMessageList threadId={gameThreadId} />              │  │
│  │                                                          │  │
│  │  catId=null  → 系统报幕卡片（金色/红色）                   │  │
│  │  catId=opus  → 聊天气泡（带头像 + 猫猫昵称）              │  │
│  │  whisper     → 半透明锁标识（仅同阵营 + god-view 可见）    │  │
│  │  action.*    → 不进入 messageStore（仅 eventLog + god 面板）│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │       GodInspector（右侧面板，保留原 EventFlow 能力）      │  │
│  │  action.* / ballot.* / debug trace → 仍从 eventLog 读取   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: 报幕层 (Announcer) — 纯规则引擎，无 LLM

**目标**：系统自动生成可读的游戏播报。

**实现**：在 `GameOrchestrator` 中，每个关键节点写一条 `scope: 'public'` 的 announce 事件：

| 触发时机 | 事件类型 | 播报文案模板 |
|----------|----------|-------------|
| `night_resolve` → `day_announce` | `dawn_announce` | "天亮了。昨夜 {deaths} 被袭击。" / "昨夜是平安夜。" |
| `day_vote` resolve | `exile_announce` | "{seatId} 被投票放逐。" / "平票，无人被放逐。" |
| `round_start` | `round_announce` | "第 {round} 个夜晚降临了。闭眼。" |
| `game_end` | `game_end_announce` | "{faction} 获胜！" |
| `day_last_words` start | `last_words_announce` | "{seatId} 发表遗言。" |

**前端渲染**：报幕消息通过 `messageStore.append()` 写入 gameThread，Chat UI 自动渲染（系统消息样式，catId=null）。GodInspector 仍从 eventLog 读取 action trace。

**语音模式**：当 `runtime.config.voiceMode === true` 时，announce 事件同时生成 TTS 音频（用 narrator 声线，不是猫猫声线），通过 audio rich block 播放。

### Layer 2: AI 行动层 (AI Action) — 需要 LLM

**目标**：替换 `pickRandom()` 为 LLM 推理决策。

**核心改造**：新增 `GameAIBridge`，在 `GameAutoPlayer.buildAction()` 中，对 `actorType === 'cat'` 的座位调用 LLM 推理。

```typescript
// GameAIBridge — 新模块
import { getCatModel } from '../../../../config/cat-models.js';
import { getCatVoice } from '../../../../config/cat-voices.js';
import { catRegistry } from '@cat-cafe/shared';

export class GameAIBridge {
  async decideAction(
    catId: string,         // opus / codex / gemini / gpt52
    view: GameView,        // scoped view（信息隔离后的）
    phase: string,         // night_wolf / day_vote / ...
    role: string,          // wolf / seer / guard / ...
    round: number,
  ): Promise<GameAction> {
    // 1. 从 cat-config.json 读取 provider + model（已有基础设施）
    const entry = catRegistry.tryGet(catId);
    const model = getCatModel(catId);  // e.g. "claude-opus-4-6"
    const provider = entry?.config.provider;  // e.g. "anthropic"
    // 2. buildWerewolfPrompt(role, view, round) 构造 prompt（已有死代码，激活即可）
    // 3. 根据 provider 调用对应 LLM HTTP API
    // 4. 解析结构化输出 → GameAction
    // 5. 超时 10s fallback 到 pickRandom()
  }
}
```

**调用方式**：轻量 HTTP API 直连（不是 CLI spawn）。

为什么不走 CLI spawn（和日常聊天一样的方式）？因为游戏场景和日常对话场景完全不同：
- 日常对话：完整 agent session（system prompt + MCP tools + context chain + 多轮对话）→ CLI spawn 是正确选择
- 游戏行动：单次结构化推理（"基于当前局面，选一个目标"）→ 只需要一次 LLM API 调用，不需要完整 agent session

这不是违背 W1（猫是 Agent 不是 API），而是**游戏系统内部的轻量调用**。类比：猫猫发送 audio rich block 时，TTS 合成也是直接调 API 不是 spawn CLI。

**复用现有基础设施**：
- 模型配置：直接用 `getCatModel(catId)` 从 `cat-config.json` 读取（`cat-models.ts`）
- Provider：直接用 `catRegistry.tryGet(catId).config.provider` 获取
- API key：各 provider 的 key 已在环境变量中（`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`）
- 语音配置：直接用 `getCatVoice(catId)` 获取 per-cat 声线（`cat-voices.ts`，F103 已完成）

**模型映射**（已有，无需新增决策）：

每只猫用 `cat-config.json` 里配置的 `defaultModel`，这是猫猫咖啡既有的技术选型：

```typescript
// GameAIBridge 直接复用
import { getCatModel } from '../../../../config/cat-models.js';
import { getCatVoice } from '../../../../config/cat-voices.js';

const model = getCatModel(catId);  // opus → claude-opus-4-6, codex → gpt-xxx, ...
const voice = getCatVoice(catId);  // opus → 流浪者声线, codex → 魈声线, ...
```

**超时 fallback**：每个 LLM 调用有 10s 超时。超时后降级到 `pickRandom()` + 写 `action.fallback` 事件。游戏永不卡住。

### Layer 3: 发言层 (Speech) — 需要 LLM + 语音/文本分支

**目标**：猫猫在讨论阶段说出有内容的话（不再是空壳 action），支持文本和语音两种模式。

**语音/文本分支**（铲屎官反馈的核心要求）：

```
runtime.config.voiceMode
  ├── false → 文本模式
  │   └── LLM 生成中文发言文本 → speech 事件 + messageStore → Chat UI 聊天气泡
  │
  └── true → 语音模式
      └── LLM 生成中文发言文本
          → F066 Voice Pipeline (TTS)
          → 使用 F103 per-cat voice identity（各猫各声线）
          → audio rich block 发送到 thread
          → Chat UI 渲染为可播放语音气泡
```

**文本模式流程**：
1. `GameAIBridge.generateSpeech(catId, view, round)` → LLM 返回 1-3 句中文发言
2. `WerewolfEngine.recordSpeech(seatId, text)` → 写入 `scope: 'public'` 的 speech 事件
3. Chat UI 自动渲染为聊天气泡（消息已通过 messageStore 写入 gameThread，带猫猫头像 + 昵称）

**语音模式流程**：
1. `GameAIBridge.generateSpeech(catId, view, round)` → LLM 返回中文发言文本
2. 调用已有 `VoiceBlockSynthesizer`（`tts/VoiceBlockSynthesizer.ts`），内部用 `getCatVoice(catId)` 获取声线配置 → TTS 合成
3. 通过 `cat_cafe_create_rich_block` 创建 audio rich block（复用 F034 已有实现）
4. 声线映射已在 `cat-voices.ts` + `cat-config.json` 完成（F103）：
   - 布偶猫 → 流浪者（调皮狡黠）
   - 缅因猫 → 魈（傲娇冰山）
   - 暹罗猫 → 班尼特（阳光开心）
   - 各 variant 可在 cat-config.json 的 voiceConfig 字段单独配置
5. Chat UI 自动渲染为可播放语音气泡（audio rich block 已有前端支持，带播放按钮 + 时长显示）

**发言场景覆盖**：

| 场景 | 文本模式 | 语音模式 |
|------|---------|---------|
| 白天讨论 | Chat UI 聊天气泡 | audio rich block |
| 遗言 | Chat UI 聊天气泡（加红色边框） | audio rich block（加遗言标识） |
| 投票理由 | Chat UI 行内文本 "我投 P3，因为..." | audio rich block |
| 狼人夜聊 (KD-27) | Chat UI whisper（半透明 + 🔒） | whisper audio rich block |

## 消息承载架构（v3 新增 — 铲屎官核心反馈）

> **铲屎官原话**："你们的消息不能是没有一个地方承载的黑盒！我也没办法帮你一起定位啊！"
> "发言猫 B 在 A 之后是如何能够知道 A 说了什么？"
> "狼人晚上的聊天那个可是他们几个的私聊！不能发给其他人！"
> "参考 F088 的 IM Hub 以及猫猫新手训练营！！"

### 问题：当前消息是黑盒

现状：游戏事件只存在 `GameRuntime.eventLog`（Redis 内存），是一个不可检索、不可回看的内部数组。

| 痛点 | 根因 | 影响 |
|------|------|------|
| 铲屎官无法回看游戏过程 | eventLog 不是 Chat UI 的消息，sidebar 看到的只有一条 "🎮 狼人杀 开始" | 完全无法 debug |
| 猫 B 不知道猫 A 说了什么 | LLM 调用时只传 `GameView`（结构化事件列表），没有自然语言对话上下文 | 发言无因果连贯性 |
| 狼人夜聊无承载 | KD-27 设计了 faction channel 但无实际消息存储 | 狼人无法协作讨论 |
| 投票/结果散落在 eventLog | 无法在 Chat UI 中搜索或引用 | 体验断裂 |

### 方案：双写 eventLog + messageStore，thread 作为真相源

借鉴 **F087 Bootcamp** 模式：训练营创建独立 thread，多猫在同一 thread 里发消息，状态存在 `thread.bootcampState` 中。游戏同理——游戏创建独立 thread（**已在 `POST /api/game/start` 实现**，见 `games.ts:178-191`），所有公开消息写入该 thread。

借鉴 **F088 Chat Gateway** 模式：IM 消息通过 `ConnectorRouter → binding → store` 管道写入 Cat Café thread。游戏消息同理——通过 `messageStore.append()` 写入游戏 thread，前端即可在 Chat UI 中看到完整游戏对话。

### 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                      Game Message Architecture                    │
│                                                                    │
│  ┌─── Game Thread (public) ────────────────────────────────────┐  │
│  │  thread.id = gameThreadId (已有，POST /api/game/start 创建)  │  │
│  │                                                              │  │
│  │  消息类型:                                                    │  │
│  │  ├── 🎺 报幕 (catId: null, system announce)                  │  │
│  │  │   "天亮了，昨夜 P5 被袭击"                                 │  │
│  │  │   "P3 被投票放逐"                                          │  │
│  │  │                                                            │  │
│  │  ├── 💬 发言 (catId: opus/codex/..., speech)                 │  │
│  │  │   "我昨晚查了 P4，他是好人" (chat bubble)                  │  │
│  │  │   或 🔊 audio rich block (voiceMode)                       │  │
│  │  │                                                            │  │
│  │  └── 🗳️ 投票结果 (catId: null, system)                       │  │
│  │      "投票结果：P3(4票) P5(2票) P7(1票)"                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─── Wolf Faction Channel (private, visibility: whisper) ─────┐  │
│  │  同一个 gameThread，使用 F035 whisper 机制                    │  │
│  │  visibility: 'whisper', whisperTo: [wolf1CatId, wolf2CatId]  │  │
│  │                                                              │  │
│  │  "我杀 P5，你们觉得呢？" (只有狼人座位可见)                   │  │
│  │  "同意，P5 可能是预言家"                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─── Per-Cat LLM Context (读取路径) ─────────────────────────┐  │
│  │  messageStore.getByThread(gameThreadId, limit: 50)           │  │
│  │    → 过滤出 isDelivered 且 scope 匹配的消息                  │  │
│  │    → 组装为 LLM 对话上下文                                    │  │
│  │    → 猫 B 的 context 包含猫 A 之前说的所有话                  │  │
│  │    → 狼人的 context 额外包含 whisper 消息（同阵营可见）       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 消息写入路径（双写策略）

每条游戏消息都会写入两个地方：

1. **eventLog**（保持不变）——用于规则引擎结算、`GameViewBuilder` 构建视图
2. **messageStore**（新增）——用于 Chat UI 显示、LLM 上下文组装、铲屎官回看

```typescript
// GameOrchestrator 内部，写完 event 后紧跟 messageStore.append()
// 示例：报幕消息
await this.appendEvent(runtime, {
  type: 'dawn_announce',
  scope: 'public',
  data: { deaths: ['P5'] },
});
// 双写：同时写入 messageStore
await this.messageStore.append({
  userId: runtime.config.observerUserId ?? 'system',
  catId: null,           // 系统消息
  content: '☀️ 天亮了。昨夜 P5 被袭击。',
  mentions: [],
  timestamp: Date.now(),
  threadId: runtime.threadId,
});

// 示例：猫猫发言
const speechText = await aiBridge.generateSpeech(catId, view, round);
engine.recordSpeech(seatId, speechText);
// 双写：同时写入 messageStore（作为猫猫消息）
await this.messageStore.append({
  userId: runtime.config.observerUserId ?? 'system',
  catId: seat.actorId as CatId,  // 发言猫的 catId
  content: speechText,
  mentions: [],
  timestamp: Date.now(),
  threadId: runtime.threadId,
});

// 示例：狼人夜聊（whisper）
await this.messageStore.append({
  userId: runtime.config.observerUserId ?? 'system',
  catId: wolfCatId as CatId,
  content: wolfDiscussionText,
  mentions: [],
  timestamp: Date.now(),
  threadId: runtime.threadId,
  visibility: 'whisper',
  whisperTo: wolfCatIds,  // 只有狼人座位的 catId 可见
});
```

### 狼人私聊通道：复用 F035 Whisper

**不需要创建独立子 thread**。Cat Café 已有 F035 Whisper 消息机制：

- `visibility: 'whisper'` + `whisperTo: CatId[]` = 只有指定猫可见
- 前端已支持 whisper 渲染（半透明 + 锁标识）
- god-view 模式下铲屎官可以"揭示"所有 whisper（`revealWhispers(threadId, userId)`）

这完美匹配狼人夜聊需求：
- 狼人 A 发言 → `whisperTo: [wolfB_catId, wolfC_catId]` → 只有同阵营看得到
- 铲屎官 god-view 可以揭示查看
- 不需要额外的 thread 管理复杂度

### Per-Cat LLM 上下文组装

串行发言场景下（铲屎官已确认串行），猫 B 说话前需要知道猫 A 说了什么：

```typescript
// GameAIBridge.buildSpeechContext()
async buildSpeechContext(
  catId: CatId,
  gameThreadId: string,
  view: GameView,
  round: number,
  seatId: SeatId,
): Promise<string> {
  // 1. 从 messageStore 读取本局所有公开消息（报幕 + 发言）
  const recentMessages = await this.messageStore.getByThread(gameThreadId, 100);
  
  // 2. 过滤：公开消息 + 该猫可见的 whisper
  const visibleMessages = recentMessages.filter(msg => 
    msg.visibility !== 'whisper' || msg.whisperTo?.includes(catId)
  );
  
  // 3. 格式化为 LLM 对话上下文
  const contextLines = visibleMessages.map(msg => {
    if (!msg.catId) return `[系统] ${msg.content}`;
    const seatLabel = this.catIdToSeatLabel(msg.catId, view);
    return `[${seatLabel}] ${msg.content}`;
  });
  
  // 4. 拼接 role prompt + game view + conversation context
  return buildWerewolfPrompt(role, view, round, contextLines.join('\n'));
}
```

**关键属性**：串行发言保证了因果一致性——猫 B 说话时，猫 A 的发言已写入 messageStore，B 的 LLM 调用一定能读到 A 的内容。

### 铲屎官可观测性

现有 Chat UI 直接可用：

1. **Sidebar 可见**：游戏 thread 在 sidebar 中显示标题"狼人杀 — 7人局"，点击即可查看所有消息
2. **消息回看**：所有报幕、发言、投票结果都是标准 `StoredMessage`，支持无限上滚回看
3. **搜索可达**：`cat_cafe_search_messages` MCP 工具可以按关键词搜索游戏消息
4. **Whisper 揭示**：铲屎官在 god-view 可以揭示狼人夜聊（F035 revealWhispers）
5. **导出**：F017 对话导出长图可以导出整局游戏记录

### 与现有系统的对齐

| 参考系统 | 模式 | 游戏系统复用方式 |
|----------|------|-----------------|
| **F087 Bootcamp** | 独立 thread + `bootcampState` + 多猫轮流在同一 thread 发消息 | 独立 game thread + `GameRuntime` + 多猫串行发言写入同一 thread |
| **F088 Chat Gateway** | 外部消息 → `messageStore.append()` → Chat UI 可见 | 游戏事件 → `messageStore.append()` → Chat UI 可见 |
| **F035 Whisper** | `visibility: 'whisper'` + `whisperTo: CatId[]` | 狼人夜聊用 whisper 消息，同阵营可见，god-view 可揭示 |
| **F092 Voice Mode** | `thread.voiceMode` → 猫猫优先发送 audio rich block | `runtime.config.voiceMode` → 发言走 TTS → audio rich block |

## Acceptance Criteria

| # | 条件 | 验证方式 |
|---|------|---------|
| AC-H1 | 天亮公告：`day_announce` 阶段产出 "天亮了，昨夜 Px 被袭击" 的 `scope: 'public'` 事件，Chat UI 用系统消息卡片渲染 | 手动截图验证 |
| AC-H2 | 模板发言：讨论阶段每只猫提交带文本的 speech 事件（哪怕是模板文案），Chat UI 用聊天气泡渲染 | 手动验证 |
| AC-H3 | AI 行动：夜间动作通过 LLM 推理决定（不再是 pickRandom），god-view 可看到推理过程摘要 | 手动 + god-view 截图 |
| AC-H4 | AI 发言：讨论/遗言/投票理由通过 LLM 生成真实中文文本，有角色特征（狼人伪装、预言家暗示等） | 手动验证 |
| AC-H5 | 文本模式：`voiceMode=false` 时所有发言显示为 Chat UI 聊天气泡 | 手动验证 |
| AC-H6 | 语音模式：`voiceMode=true` 时所有发言通过 F066 TTS 合成并以 audio rich block 播放，各猫声线不同 | 手动验证 |
| AC-H7 | 超时 fallback：LLM 调用超时 10s 后降级到 random，游戏不卡住 | 断网测试 |
| AC-H8 | 规则引擎 bug 全修：RB-1 到 RB-8 全部修复 | 手动走完一局验证 |
| AC-H9 | 消息承载：所有报幕/发言/投票结果写入 gameThread 的 messageStore，Chat UI sidebar 可回看全局 | 手动验证：sidebar 点击游戏 thread 能看到完整对话流 |
| AC-H10 | 狼人私聊：狼人夜聊通过 whisper 消息写入 gameThread，仅同阵营可见，god-view 可揭示 | 手动验证：普通视角看不到狼人夜聊，god-view reveal 后可见 |
| AC-H11 | LLM 上下文连贯：猫 B 发言时 LLM context 包含猫 A 之前的发言内容（串行保证因果） | 手动验证：后发言猫的内容有引用/回应前面猫的观点 |
| AC-H12 | Chat UI 替换：游戏 overlay 左面板使用标准 Chat UI 组件渲染 gameThread 消息，体验与普通聊天一致 | 手动验证：游戏面板左侧显示聊天气泡 + 系统卡片，可上滚回看 |

## 实施计划

### Sub-Phase H1: 报幕层 (Announcer) — 0 LLM 依赖

**目标**：修 RB-1 到 RB-8，让游戏有可读的报幕 + **报幕消息写入 messageStore**。

**改动清单**：
1. `GameAutoPlayer.ts`: 从 `SKIP_PHASES` 移除 `day_announce`、`day_last_words`、`day_exile`
2. `GameOrchestrator.ts`: `resolveNightFromEvents` 后写 `dawn_announce` 事件（`scope: 'public'`）
3. `GameOrchestrator.ts`: `resolveDayVoteFromPending` 后写 `exile_announce` 事件
4. `GameOrchestrator.ts`: `advancePhase` 中 `round_start` 写 `round_announce` 事件
5. **新增**：`GameOrchestrator` 注入 `messageStore`（通过 constructor），每个 announce 事件同时 `messageStore.append()` 写入 gameThread（双写，TD-H10 管道）
6. **新增**：announce 消息用 `catId: null`（系统消息），content 为中文播报文案——和飞书/GitHub connector 写入的系统消息走同一条管道

**预计工量**：1-2 PR，不需要铲屎官拍板

### Sub-Phase H2: 模板发言 — 0 LLM 依赖

**目标**：讨论/遗言不再是空壳。用固定模板文案填充 + **发言写入 messageStore**。

**改动清单**：
1. `GameAutoPlayer.ts`: speak case 生成模板文案（"我是 {role}，我没有特殊信息" / "我觉得 P{x} 有嫌疑"）
2. `GameAutoPlayer.ts`: 调用 `WerewolfEngine.recordSpeech(seatId, text)` 写入 speech 事件
3. 遗言阶段类似处理，调用 `WerewolfEngine.recordLastWords(seatId, text)`
4. **新增**：每条 speech/last_words 同时 `messageStore.append({ catId: seat.actorId, content: text, threadId: gameThreadId })`
5. **新增**：串行发言顺序（TD-H5）——按座位号依次提交，每提交一个 speech 等待写入完成后才轮到下一个

**预计工量**：1 PR，和 H1 可以合并

### Sub-Phase H3: GameAIBridge — 需要 LLM

**目标**：新增 AI bridge 模块，替换 `pickRandom()` 为 LLM 推理。

**改动清单**：
1. 新增 `GameAIBridge.ts`：
   - `decideAction(catId, view, phase, role, round)` → 调用 LLM API → GameAction
   - `generateSpeech(catId, view, round)` → 调用 LLM API → 中文文本
   - 超时 fallback 到 random
2. 复用 `getCatModel(catId)` + `catRegistry` 获取 provider/model 配置，无需新增 factory
3. `GameAutoPlayer.ts`: `buildAction()` 改为 async，先尝试 `aibridge.decideAction()`，失败 fallback 到 `pickRandom()`

**前置条件**：无——模型和 provider 配置已在 `cat-config.json` 中

### Sub-Phase H4: AI 发言 — 需要 LLM + 消息上下文

**目标**：讨论/遗言/投票理由通过 LLM 生成，**LLM 上下文从 messageStore 组装**（TD-H8）。

**改动清单**：
1. `GameAutoPlayer.ts`: speak 阶段调用 `aibridge.generateSpeech(catId, view, round)`
2. `GameAIBridge.ts`: `buildSpeechContext()` 从 `messageStore.getByThread(gameThreadId)` 读取已有对话，拼装为 LLM 上下文
3. 复用 `werewolf-prompts.ts` 的角色 prompt，追加发言指示 + 对话上下文
4. 遗言/投票理由同理
5. **串行发言保证**（TD-H5）：猫 A 的发言写入 messageStore 后，才轮到猫 B 调用 LLM → 猫 B 的 context 必然包含猫 A 的发言

**狼人夜聊**（TD-H7）：
1. 夜间狼人行动阶段，狼人猫的讨论内容通过 whisper 写入 gameThread
2. `messageStore.append({ ..., visibility: 'whisper', whisperTo: [所有狼人的 catId] })`
3. LLM 上下文组装时，狼人猫可以看到这些 whisper，其他阵营看不到

### Sub-Phase H5: 语音模式分支 — 需要 F066 + F103

**目标**：`voiceMode=true` 时，发言走 TTS → audio rich block。

**改动清单**：
1. `GameAutoPlayer.ts`: 检查 `runtime.config.voiceMode`
   - `false` → 直接写 speech 事件 + messageStore
   - `true` → 调用 F066 TTS → 创建 audio rich block → 写入 messageStore
2. 报幕层语音：announce 事件同时生成 narrator TTS
3. Chat UI 已天然支持 audio rich block 渲染（可播放语音气泡）

**前置条件**：F066 Voice Pipeline 就绪、F103 per-cat voice identity 配置完成

### Sub-Phase H6: Chat UI 替换 EventFlow（方案 B）

**目标**：游戏 overlay 左面板从自定义 `<EventFlow>` 组件切换为标准 `<ChatMessageList>`，复用现有 Chat UI。

**为什么方案 B**：H1-H4 已经把所有报幕/发言/投票结果写入 `messageStore`，gameThread 中已有完整的消息流。用现有 Chat UI 组件直接渲染这些消息，比维护独立的 EventFlow 渲染逻辑更省事、更统一。

**改动清单**：
1. `GameOverlay.tsx`: 左面板从 `<EventFlow events={view.visibleEvents} />` 替换为 `<ChatMessageList threadId={gameThreadId} />`（或等效的现有 Chat UI 组件）
2. Chat UI 天然支持：
   - `catId=null` → 系统消息样式（报幕卡片）
   - `catId=opus/codex/...` → 猫猫聊天气泡（带头像 + 昵称）
   - `visibility: 'whisper'` → 半透明 + 锁标识（F035 已有）
   - audio rich block → 可播放语音气泡（F034 已有）
3. `EventFlow.tsx`: 不删除，但**从主游戏面板移除**——可保留在 `GodInspector` 内部用于 action.* debug trace 查看
4. `PlayerGrid.tsx`: displayName 从 `seat.actorId`（"opus"）改为富化显示（"布偶猫(opus)"），通过 `GameViewBuilder` 在构建时注入 catRegistry 数据
5. 游戏 thread sidebar 入口：点击游戏 thread 可在 sidebar 中回看完整对话（报幕 + 发言 + 投票），与普通聊天 thread 体验一致

**前端显示对照**：

| 消息类型 | Chat UI 渲染 | 来源 |
|----------|-------------|------|
| 报幕（"天亮了，昨夜 P5 被袭击"） | 系统消息卡片（catId=null） | messageStore |
| 猫猫发言（讨论/遗言） | 聊天气泡（带 CatAvatar + 昵称） | messageStore |
| 语音发言 | audio rich block 播放器 | messageStore + rich block |
| 投票结果 | 系统消息卡片 | messageStore |
| 狼人夜聊 | 半透明 + 🔒（whisper） | messageStore (whisper) |
| action.* / ballot.* debug | **不在 Chat UI 中显示** | eventLog → GodInspector |

### Sub-Phase H7: 集成测试 + 铲屎官验收

**目标**：完整走一局，铲屎官满意。

**检查清单**：
- [ ] 天亮公告可见
- [ ] 猫猫有真实发言（文本模式）
- [ ] 猫猫有语音发言（语音模式）
- [ ] 夜间动作不再是亚秒完成
- [ ] EventFlow 不再像 debug log → **已替换为 Chat UI**，debug trace 仅在 GodInspector
- [ ] God-view 仍可看到所有 action trace
- [ ] **Sidebar 可回看**：点击游戏 thread 能看到完整对话流（报幕 + 发言 + 投票）
- [ ] **发言连贯**：后发言猫的内容引用/回应了前面猫的观点
- [ ] **狼人私聊隐藏**：普通视角看不到狼人夜聊 whisper
- [ ] **God-view 揭示**：铲屎官可以 reveal 查看狼人夜聊内容

## 实施顺序 & 依赖关系

```
H1 (报幕层 + messageStore 双写) ──────┐
                                       ├── H6 (Chat UI 替换 EventFlow) ─── H7 (验收)
H2 (模板发言 + messageStore 双写) ────┘         ↑
                                                │
H3 (AI Bridge) ── H4 (AI 发言 + 上下文组装) ── H5 (语音模式分支) ──┘
```

- **H1 + H2** 可立刻开始，不需要 LLM
- **H3** 也可以直接开始（复用 `cat-config.json` 现有配置，无需铲屎官额外拍板）
- **H4** ~~唯一需要铲屎官确认的：串行 vs 并行发言~~ → **已确认串行**（TD-H5）
- **H5** 需要 F066 + F103 就绪（已完成）
- **H6** 依赖 H1/H2 的 messageStore 双写——只有消息写入 messageStore 后，Chat UI 才有内容可渲染
- **H7** 最后做

## 技术决策（复用现有架构，无需铲屎官拍板）

| # | 问题 | 决策 | 依据 |
|---|------|------|------|
| TD-H1 | AI 调用走什么方式？ | **轻量 HTTP API**（不是 CLI spawn） | 游戏是单次结构化推理，不需要完整 agent session。类比 TTS 也是 API 调用 |
| TD-H2 | 每只猫用什么模型？ | **各用各的**（`getCatModel(catId)`） | `cat-config.json` 已有配置，`cat-models.ts` 已有读取逻辑 |
| TD-H3 | 每只猫用什么声线？ | **各用各的**（`getCatVoice(catId)`） | F103 已完成 per-cat voice identity，`cat-voices.ts` + `cat-config.json` |
| TD-H4 | 报幕层语音用什么声线？ | **用 `GLOBAL_FALLBACK_VOICE`** | 区别于猫猫声线，用默认 narrator 声线 |
| TD-H5 | 串行还是并行发言？ | **串行**（铲屎官确认） | 真实狼人杀体验，且保证 LLM 上下文因果一致性 |
| TD-H6 | 消息存储方案 | **双写 eventLog + messageStore** | eventLog 用于规则引擎结算，messageStore 用于 Chat UI + LLM 上下文 |
| TD-H7 | 狼人私聊方案 | **复用 F035 Whisper**（同一 thread，visibility: whisper） | 不需要创建子 thread，前端已支持，god-view 可揭示 |
| TD-H8 | LLM 上下文来源 | **从 messageStore 读取 gameThread 消息** | 比 eventLog 更自然，天然包含自然语言对话 |
| TD-H9 | 游戏左面板渲染方案 | **方案 B：Chat UI 替换 EventFlow**（`<ChatMessageList threadId={gameThreadId} />`） | 铲屎官确认："b这个！"——游戏消息已写入 messageStore，复用现有 Chat UI 组件即可渲染，无需维护独立的 EventFlow 渲染逻辑。action.* debug trace 留在 GodInspector 面板 |
| TD-H10 | 系统消息走什么管道 | **走现有 message pipeline**（`messageStore.append()`，与 IM/GitHub connector 同一管道） | 铲屎官确认："那个系统的消息你也走那个呀！！"——报幕、投票结果等系统消息和飞书/GitHub 进来的消息走同一条管道，前端 Chat UI 统一渲染 |

## Open Question（真正需要铲屎官拍板的）

所有 Open Questions 已解决。

| # | 问题 | 决策 | 决策者 |
|---|------|------|--------|
| ~~OQ-H1~~ | 讨论阶段串行还是并行发言？ | **串行**（铲屎官确认："阶段串行发言！！我们就要是真人玩狼人杀的体验啊！"） | 铲屎官 2026-03-17 |

## 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| LLM 响应太慢（>10s）导致游戏拖沓 | 中 | 高 | 10s 超时 fallback 到 random；并行发 LLM 请求 |
| LLM 返回非法动作（杀队友/死人投票） | 高 | 低 | 服务端 `submitAction()` 已有校验，非法动作被拒后 retry 或 fallback |
| API key 额度不足 | 低 | 高 | 监控 token 消耗；每局约 7 人 × 5 轮 × 3 调用 = 105 次 API 调用 |
| F066 TTS 合成慢 | 中 | 中 | 语音模式下预生成 + 串行播放；文本模式不受影响 |
| 猫猫发言泄露角色（LLM 不遵守保密） | 中 | 中 | prompt 强调保密规则；发言不影响规则结算 |
| messageStore 消息膨胀 | 低 | 低 | 一局约 100-200 条消息，messageStore MAX_MESSAGES=2000，远低于上限 |
| whisper 可见性泄漏 | 低 | 高 | 依赖已验证的 F035 whisper 机制；LLM 上下文过滤也做双重校验 |

## 相关 Feature & 模块

| 模块 | 关联 | 说明 |
|------|------|------|
| F066 Voice Pipeline | H5 依赖 | TTS 合成能力（Qwen3-TTS） |
| F103 Per-Cat Voice Identity | H5 依赖 | 各猫各声线配置 |
| F035 Whisper | H4 依赖 | 狼人夜聊通过 whisper 消息实现阵营隔离 |
| F087 Bootcamp | 架构参考 | 独立 thread + 多猫轮流发消息 + 状态存 thread 元数据 |
| F088 Chat Gateway | 架构参考 | 外部消息 → messageStore.append() → Chat UI 可见 |
| F086 Cat Orchestration | 参考 | multi_mention 的 AI 调用模式可参考 |
| F105 opencode 接入 | 参考 | 金渐层的 CLI 接入模式 |
| `WerewolfAIPlayer.ts` | H3 激活 | 已写好的死代码，需要连接到 GameAIBridge |
| `werewolf-prompts.ts` | H3/H4 激活 | 已写好的角色 prompt，需要被调用 |
| `MessageStore.ts` | H1-H4 双写目标 | 所有游戏消息写入 messageStore，Chat UI 可见 |
| `invoke-single-cat.ts` | 参考（不直接用） | 现有 CLI spawn 机制，HTTP API 方案不走这条路 |

## 附录 A: 当前代码链路（完整分析）

```
铲屎官点击"开始游戏"
  → POST /api/game/start
  → GameOrchestrator.startGame()
  → GameAutoPlayer.startLoop(gameId)
  → runLoop: 每 800ms 一次 tick
      → actForPhase(runtime)
          → getCatSeatsForPhase(runtime, actingRole)
          → buildAction(runtime, seatId, actionName)
              → pickRandom(aliveOthers)  ← 这里就是问题
              → 返回 { seatId, actionName, targetSeat, submittedAt }
          → orchestrator.handlePlayerAction(gameId, seatId, action)
              → engine.submitAction() + appendEvent('action.submitted', scope: 'god')
      → 如果当前 phase 在 SKIP_PHASES → orchestrator.tick() → 跳过

WerewolfAIPlayer (死代码):
  → 已写好 decideNightAction / decideSpeech / decideVote
  → 从未被 import 或实例化
  → werewolf-prompts.ts 的 buildWerewolfPrompt 从未被调用

EventFlow 前端 (Phase H6 后将被 Chat UI 替换):
  → 接收 view.visibleEvents
  → isSystemEvent() 判断：action.* / ballot.* → 系统事件（🔔 图标 + 小字）
  → 其他 → 聊天气泡
  → 没有区分 announce vs speech vs debug
  → **H6 改造后**：Chat UI 从 messageStore 读取 gameThread 消息渲染；EventFlow 降级到 GodInspector 内部使用
```

## 附录 B: WerewolfAIPlayer 接口（已存在，待激活）

```typescript
// WerewolfAIPlayer.ts — 已有代码
class WerewolfAIPlayer {
  decideNightAction(seatId, role, view, round) → GameAction
  decideSpeech(seatId, role, view, round) → string
  decideSpeechWithFormat(seatId, role, view, round, voiceMode) → { kind, text, seatId }
  decideVote(seatId, role, view, round) → GameAction
}

// 需要实现的 AIProvider 接口
interface AIProvider {
  generateAction(prompt: string, schema: Record) → AIActionResponse
  generateSpeech(prompt: string) → string
}
```

注意 `decideSpeechWithFormat` 已经有 `voiceMode` 参数——说明 Phase B 写代码时就预见了语音分支，只是从未被连接。

## 附录 C: 铲屎官原话记录

> "1s内就出现了这些数据，但是1s内你们的cli根本拉不起来！"
> "是假的mock？真的不可能这么快啊"
> "没公告到底晚上的结果是什么"
> "你们得接入和我们现在这样spawn 接入各个cli那样真的接入啊"
> "好好写一篇如何真的实现这个功能的设计稿 link到我们的这个feat里面！！！！"
> "我下次要看的的是 真的能玩的！"
> "发言层—— 讨论/遗言/投票理由 通过 LLM 生成真实中文文本 不对，得看我选的模式是语音还是文本！语音得用富文本发语音！"
> "你得好好拆分清楚 规则，以及我们的那个 '上帝'驱动游戏的规则代码！那个不要也到处是bug！"
> "阶段串行发言！！我们就要是真人玩狼人杀的体验啊！"
> "你需要有一个真实的thread狼人杀的承载你们的聊天记录！！不然你上下文如何管理啊！！"
> "发言猫 B 在 A 之后是如何能够知道 A 说了什么？"
> "哪些是比如狼人晚上的聊天那个可是他们几个的私聊！不能发给其他人！"
> "你们的消息不能是没有一个地方承载的黑盒！我也没办法帮你一起定位啊！"
> "参考 F088 的 IM Hub 那种以及猫猫新手训练营！！"
> "b这个！" （确认方案 B：Chat UI 替换 EventFlow）
> "那个系统的消息 你知道现在github 消息 im的消息比如飞书进来的管道吧？你也走那个呀！！"（确认 TD-H10：系统消息走现有 message pipeline）
