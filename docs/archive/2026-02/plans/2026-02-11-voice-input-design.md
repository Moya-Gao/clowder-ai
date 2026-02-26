---
feature_ids: []
topics: [voice, input, design]
doc_kind: plan
created: 2026-02-11
---

# Cat Cafe 语音输入功能设计文档

> 设计者：布偶猫 宪宪 🐾
> 需求发起：铲屎官 Landy
> 日期：2026-02-11
> 状态：Draft — 采访完成，待铲屎官确认

---

## 一、采访记录（决策 + WHY）

### Q1: 核心交互模型

**问题**：语音转写后怎么发送？

| 选项 | 描述 |
|------|------|
| ① 语音→填入输入框→手动发送 | 语音是输入法的替代 |
| ② 语音→自动发送 | 像对讲机 |
| ③ 语音→预览气泡→确认/取消 | 独立预览 UI |

**决策**：选项 ①

**Why**：
- 零后端改动，纯前端 feature
- 复用现有 textarea + useSendMessage 发送链路
- 用户始终有编辑机会，不怕 ASR 误识别
- 唤醒词检测可在文本层做（@猫 mention 机制已有）
- 实现最快

---

### Q2: ASR 引擎选型

**问题**：MVP 用什么做语音转文字？

| 选项 | 描述 |
|------|------|
| ① Web Speech API | 浏览器原生，零部署，音频发到 Google |
| ② 本地 Whisper | 离线、隐私、M4 Max 跑得动 |
| ③ 先①后② | MVP 用浏览器原生，留切换口子 |

**决策**：选项 ② — 直接本地 Whisper，一步到位

**Why**（铲屎官原话）：
> "我想走 2 诶，一步到位。因为我们自己的电脑那么好，没必要不用起来？而且也体验一下本地的 ASR？"

- M4 Max 硬件能力足够，不浪费算力
- 想亲身体验本地 ASR 效果
- 一步到位，避免 Web Speech API → Whisper 的迁移成本
- 隐私更好，音频不出本机

---

### Q3: Whisper 部署形态

**问题**：用哪个 Whisper 变体？

| 选项 | 描述 |
|------|------|
| ① faster-whisper (Python, CTranslate2) | 社区最大、比原版快 4x |
| ② whisper.cpp (C++) | 纯 CPU、无 Python 依赖 |
| ③ MLX Whisper (Apple Silicon) | 专为 M 系列优化 |

**决策**：选项 ① faster-whisper（布偶猫推荐，铲屎官未反对）

**Why**：
- 社区最大、模型最全（large-v3、distil-whisper）
- 流式转写支持好
- 已有现成 HTTP server 封装
- M4 Max 跑起来完全没压力

---

### Q4: AI 润色 / 纠错

**问题**：ASR 输出需要润色吗？

**初始判断**：不需要——猫猫是 LLM，能理解口语

**铲屎官挑战**（关键转折）：
> "我用苹果的语音输入，我说 MCP 他识别成 ICP！是苹果太垃圾了吗？还有各种中文识别错误，这种的话会误导你们啊！所以你们真的不需要润色引擎吗？！"

**修正后认知**：问题不是"润色"，是**纠错**。错误的技术术语（MCP→ICP）会让猫猫理解成完全不同的东西。

**决策**：MVP 必须包含三层纠错 pipeline

| 层级 | 做什么 | 延迟 | MVP 必须 |
|------|--------|------|----------|
| ① Whisper initial_prompt | 喂项目术语偏置识别 | 0ms | 是 |
| ② 术语词典后处理 | `ICP→MCP` 确定性替换 | ~0ms | 是 |
| ③ 规则去口癖 | 去"嗯、啊、那个、就是说" | ~0ms | 是 |
| ④ 本地小模型精修 | Qwen2.5-1.5B 语序优化 | ~300ms | 否（P1） |

**Why**：
- 通用 ASR 不认识项目专有术语（MCP、Redis、Fastify、InvocationRecord、宪宪、砚砚）
- 错误术语会误导猫猫执行错误操作
- 前三层几乎零延迟，成本极低
- 第四层小模型按需开启，MVP 不需要

---

### Q5: MVP 范围

**问题**：先做 Cat Cafe Web 还是同时做系统级？

| 选项 | 描述 |
|------|------|
| ① 只做 Cat Cafe Web 内嵌 | 范围小，1-2 天 |
| ② 系统级服务 + Web 深度集成 | 所有 app 都能用 |
| ③ 先①再② | 先验证，再扩展 |

**决策**：选项 ③ — 先 Cat Cafe Web，再扩展为系统级

**Why**（铲屎官确认 "先 1 再 2"）：
- 先在 Cat Cafe 跑通，验证 Whisper 效果和纠错质量
- 验证通过后，扩展为全局快捷键服务（覆盖 Claude Code CLI 等）
- 降低一次性开发风险

**远期愿景**：Whisper 本地服务 + 全局快捷键 = 自建开源版闪电说，所有 app 可用

---

### Q6: 录音触发方式

**问题**：怎么开始/结束录音？

| 选项 | 描述 |
|------|------|
| ① Push-to-talk | 按住说话，松开结束 |
| ② Toggle | 点击开始，再点结束 |
| ③ VAD 自动检测 | 检测说话自动录，停顿自动停 |

**决策**：选项 ② Toggle

**Why**（铲屎官偏好）：
> "我喜欢这样的"

- 说长段话手不累
- 比 push-to-talk 更适合长指令场景

---

### Q7: 麦克风按钮位置

**问题**：🎤 放在 ChatInput 的哪里？

| 选项 | 描述 |
|------|------|
| ① 发送按钮左边 | `[📎] ... [🎤] [▶]` |
| ② 图片按钮右边 | `[📎] [🎤] ... [▶]` |
| ③ 替换发送按钮 | 空→🎤，有文字→▶（iMessage 风格） |

**决策**：选项 ③ — 动态按钮

**Why**（铲屎官反应）：
> "这个好像很酷！！"

- 节省空间，不增加按钮数量
- 交互直觉——没内容时自然想到"说话"，有内容时自然想到"发送"
- iMessage 同款设计模式，已被广泛验证

---

### 闪电说 vs 自建方案 对比（采访中补充调研）

铲屎官问"闪电说是什么"，触发了对比分析：

| | 闪电说 | 自建 Whisper |
|---|---|---|
| 本质 | 系统级输入法 | Cat Cafe 内嵌 ASR |
| 部署 | 下载安装即用 | 需起本地服务 |
| ASR 引擎 | 黑盒 | 开源可控 |
| 延迟 | ~0.2s | ~0.3-1s (large-v3) |
| 术语定制 | 不可以 | initial_prompt + 词典 |
| 唤醒词/路由 | 做不到 | 可以 |
| 适用范围 | 所有 app | Cat Cafe（MVP）→ 全局（Phase 2） |

**结论**：两者互补，不冲突。CLI 场景可用闪电说，Cat Cafe Web 用自建方案做深度集成。

---

## 二、功能需求（MVP）

### P0 - 必须有

| # | 功能 | 描述 | 验收标准 |
|---|------|------|----------|
| V1 | 麦克风录音 | Toggle 模式：点击🎤开始，点击⏹结束 | 获取麦克风权限 + MediaRecorder 录音 |
| V2 | 本地 Whisper 转写 | 录音完成 → POST 到本地 faster-whisper 服务 → 返回文字 | 中英混合识别，延迟 < 2s (含网络) |
| V3 | 术语纠错 | initial_prompt 偏置 + 术语词典替换 + 去口癖 | MCP/Redis/Fastify 等项目术语正确率 > 90% |
| V4 | 转写填入 textarea | 纠错后的文字填入现有输入框，可编辑 | 填入后 textarea 自动扩展，光标定位到末尾 |
| V5 | 动态按钮 | 空 textarea→🎤，有内容→▶发送 | 状态切换流畅，无闪烁 |
| V6 | 录音状态 UI | 录音中显示脉冲动画 + 时长 + ⏹ 停止按钮 | 用户明确知道"正在录音" |

### P1 - 应该有（后续迭代）

| # | 功能 | 描述 |
|---|------|------|
| V7 | 猫猫唤醒词 | "宪宪/砚砚/暹罗猫" 自动转为 @mention |
| V8 | 小模型精修 | Qwen2.5-1.5B 本地润色（可选开关） |
| V9 | 系统级服务 | 全局快捷键 + 粘贴，覆盖 Claude Code 等 |
| V10 | 流式转写 | 边说边出字（需要 Whisper streaming 支持） |
| V11 | VAD 自动停止 | 检测 3s 静默自动结束录音 |

### P2 - 可以有

| # | 功能 | 描述 |
|---|------|------|
| V12 | TTS 猫猫语音回复 | 猫猫用语音回答（合成音） |
| V13 | 语音指令历史 | 语音输入记录存入 Hindsight |
| V14 | 多语言切换 | 纯英文 / 纯中文 / 混合模式切换 |

---

## 三、技术设计

### 3.1 整体架构

```
┌──────────────────────────────────────────────────┐
│              Cat Cafe Web (Browser)               │
│                                                   │
│  ChatInput.tsx                                    │
│  ┌───────────────────────────────────────────┐   │
│  │ [textarea - 转写结果填入这里，可编辑]      │   │
│  │                                           │   │
│  │ [📎]                     [🎤 / ▶ 发送]   │   │
│  └───────────────────────────────────────────┘   │
│         │ 点击🎤                                  │
│         ▼                                         │
│  useVoiceInput Hook                               │
│  ┌───────────────────────────────────────────┐   │
│  │ 1. getUserMedia() 获取麦克风               │   │
│  │ 2. MediaRecorder 录音 (webm/opus)         │   │
│  │ 3. 停止 → 音频 blob → POST /transcribe   │   │
│  │ 4. 返回文字 → 术语纠错 → 去口癖           │   │
│  │ 5. 填入 textarea                          │   │
│  └────────────────────┬──────────────────────┘   │
│                        │                          │
└────────────────────────┼──────────────────────────┘
                         │ HTTP (localhost:9876)
                         ▼
            ┌──────────────────────────┐
            │  faster-whisper 本地服务   │
            │  POST /transcribe        │
            │  - audio: multipart file │
            │  - initial_prompt: str   │
            │  - language: "zh"        │
            │  Response: { text, segments } │
            └──────────────────────────┘
```

**关键决策**：
- 前端 `MediaRecorder` 录音，录完一次性发给 Whisper（非流式）
- Whisper 服务独立进程，Cat Cafe 后端（Fastify 3101端口）不碰音频
- 纠错在前端 hook 内完成，Whisper 只管转写
- 转写结果填入 textarea 后，走已有 useSendMessage 链路 → **零后端改动**

### 3.2 新增文件清单

```
packages/web/src/
├── hooks/
│   └── useVoiceInput.ts        # 核心 hook: 录音 + 调用 ASR + 纠错
├── components/
│   └── VoiceButton.tsx         # 动态按钮组件 (🎤/⏹/⏳/▶)
└── utils/
    ├── transcription-corrector.ts  # 术语纠错 + 去口癖
    └── voice-terms.json            # 术语词典 (可热更新)
```

修改文件：
```
packages/web/src/components/ChatInput.tsx  # 集成 VoiceButton + useVoiceInput
```

### 3.3 UI 状态机

```
        点击🎤
IDLE ─────────────► RECORDING
 🎤                    ⏹ (脉冲动画 + 时长)
  ▲                      │
  │                      │ 点击⏹
  │     ◄────────────────┘
  │                      │
  │                      ▼
  │               TRANSCRIBING
  │                    ⏳
  │                      │
  │                      │ 转写完成
  │                      ▼
  │                  HAS_TEXT
  │                    ▶ 发送
  │                      │
  │                      │ 发送/清空后
  └──────────────────────┘
```

状态详情：

| 状态 | 按钮图标 | textarea 显示 | 按钮行为 |
|------|----------|---------------|----------|
| IDLE | 🎤 | placeholder: "输入消息..." | 点击→开始录音 |
| RECORDING | ⏹ (红色脉冲) | "正在听你说... ●REC 00:05" | 点击→停止录音 |
| TRANSCRIBING | ⏳ (旋转) | "转写中..." | 不可点击 |
| HAS_TEXT | ▶ 发送 | 转写结果（可编辑） | 点击→发送消息 |

### 3.4 术语纠错 Pipeline

```
Whisper 原始输出
  "嗯那个帮我看看 icp 的配置还有法式的路由"
       │
       ▼
  ① initial_prompt 偏置（Whisper 识别阶段生效）
     prompt: "Cat Cafe 项目对话。常见术语：MCP, Redis, Fastify,
              Whisper, worktree, rebase, InvocationRecord, Hindsight,
              宪宪, 砚砚, 暹罗猫, 布偶猫, 缅因猫, NDJSON, Zustand..."
       │
       ▼
  ② 术语词典替换（确定性后处理）
     voice-terms.json:
     {
       "icp": "MCP",
       "法式的": "Fastify",
       "为的": "void",
       "那的JS": "Node.js",
       "type script": "TypeScript",
       "组单的": "Zustand",
       ...
     }
       │
       ▼
  ③ 去口癖（正则清理）
     移除: 嗯、啊、那个、就是说、然后呢、对对对
     合并多余空格
       │
       ▼
  最终输出 → 填入 textarea
```

**词典维护规则**：
- `voice-terms.json` 放在 web 包内，可随时编辑
- 发现新的误识别 → 加入词典 → 立即生效（无需重启）
- 词典格式: `{ "错误写法": "正确写法" }`，大小写不敏感匹配

### 3.5 faster-whisper 服务部署

```bash
# 安装 (一次性)
pip install faster-whisper

# 启动服务 (开发时)
# 方案 A: 用现成的 faster-whisper-server
pip install faster-whisper-server
faster-whisper-server --model large-v3 --port 9876

# 方案 B: 简单 Flask/FastAPI 包装 (如果 A 不够用)
# 自写 ~50 行 Python
```

**模型选择**：
- 开发/测试：`large-v3`（最准，M4 Max 实时无压力）
- 如果嫌慢：`distil-large-v3`（速度快 6x，准确率略降）

### 3.6 错误处理

| 场景 | 处理方式 |
|------|----------|
| 麦克风权限被拒 | Toast 提示"请允许麦克风权限" + 按钮变灰 |
| Whisper 服务未启动 | Toast 提示"语音服务未运行，请启动 faster-whisper" |
| 转写超时 (>10s) | 自动取消 + Toast 提示重试 |
| 转写结果为空 | Toast 提示"没有检测到语音，请重试" |
| 录音过短 (<0.5s) | 忽略，不发送请求 |

---

## 四、与现有架构的关系

### 不改动的部分

- `useSendMessage.ts` — 语音只是往 textarea 填文字，发送走原有逻辑
- `POST /api/messages` — 后端完全不知道这条消息来自语音
- `AgentRouter` — @ mention 路由机制不变
- WebSocket 消息流 — 不受影响

### 新增的部分

- `useVoiceInput` hook — 前端新 hook
- `VoiceButton` 组件 — 替代/增强原有发送按钮
- `transcription-corrector` 工具 — 纠错 pipeline
- faster-whisper 本地服务 — 独立进程，与 Cat Cafe 后端无关

### 影响的部分

- `ChatInput.tsx` — 需要集成 VoiceButton，修改按钮区域逻辑

---

## 五、里程碑

### M1: MVP（Cat Cafe Web 语音输入）

**目标**：在 Cat Cafe Web 中能用语音向猫猫说话

**交付物**：
- [ ] faster-whisper 本地服务部署脚本
- [ ] `useVoiceInput` hook（录音 + ASR 调用 + 纠错）
- [ ] `VoiceButton` 组件（动态按钮 + 录音状态）
- [ ] `transcription-corrector`（initial_prompt + 术语词典 + 去口癖）
- [ ] ChatInput 集成
- [ ] 基础测试（hook + corrector）

### M2: 系统级扩展（Phase 2，按需启动）

**目标**：全局快捷键 + 粘贴，覆盖 Claude Code 等所有 app

**交付物**：
- [ ] 全局快捷键监听（macOS）
- [ ] 录音 → Whisper → 粘贴到光标位置
- [ ] 系统托盘 / menubar 状态指示

### M3: 智能路由（Phase 2，与 M2 独立）

**目标**：语音中说"宪宪"自动转为 @布偶猫

**交付物**：
- [ ] 唤醒词 → @mention 转换
- [ ] 唤醒词可自定义配置

---

## 六、开放问题（待后续采访确认）

1. **Whisper 模型大小**：默认 large-v3，还是提供模型切换选项？
2. **音频格式**：MediaRecorder 默认 webm/opus，faster-whisper 是否直接支持？还是需要转 wav？
3. **多段录音追加**：连续录两段，是追加到 textarea 还是替换？
4. **快捷键**：是否需要键盘快捷键触发录音（除了点击按钮）？
5. **Whisper 服务生命周期**：是否集成到 `start-dev.sh`？还是手动启动？
6. **语言配置**：默认 `zh`（中文优先），是否需要切换开关？
7. **安全边界**：录音数据是否需要自动清理？保留多久？

---

## 七、参考资料

- [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [faster-whisper-server](https://github.com/fedirz/faster-whisper-server)
- [Web MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [闪电说](https://shandianshuo.cn/) — 系统级语音输入法参考
- Cat Cafe 前端入口：`packages/web/src/components/ChatInput.tsx`

---

*采访完成！铲屎官请过目~ —— 布偶猫 宪宪 🐾*
