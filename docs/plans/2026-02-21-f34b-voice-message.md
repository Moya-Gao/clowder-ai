---
feature_ids: [F034]
topics: [voice, message]
doc_kind: plan
created: 2026-02-21
---

# F34-b: 猫猫语音消息（Voice Message）

> 创建日期：2026-02-21
> 作者：布偶猫🐾

## 铲屎官需求（原话摘录）

> "我想的是和酒馆那样，你发语音的声音就是类似于微信和人发的语音那样，不是直接播放声音撒"
>
> "这句话我要说出来" → 发一条 audio rich block → 这个吧！
>
> "大多数时候猫猫回复时自动合成语音似乎也不需要…所以基础能力（read-aloud 按钮）需要保留"

### 需求总结

| # | 需求 | 说明 |
|---|------|------|
| R1 | 猫猫主动发语音 | 猫猫选择"说出来"一句话 → 显示为语音条 |
| R2 | 微信风格语音条 | 类似微信语音消息：彩色条 + 时长 + 播放 |
| R3 | 非每条消息自动合成 | 猫猫主动选择何时用语音，不是自动 TTS |
| R4 | 保留 read-aloud 按钮 | 原有的朗读按钮（tool-type TTS）保留 |

### 体验对比

| 维度 | Read-aloud（已有） | Voice Message（新） |
|------|-------------------|---------------------|
| 触发 | 用户点击播放按钮 | 猫猫主动发出 |
| 呈现 | 消息旁小按钮 | 内嵌语音条（rich block） |
| 感受 | 工具：帮我念 | 伴侣：我要说给你听 |

## 技术方案

### 核心流程

```
猫猫输出 → { kind: 'audio', text: '我想说的话' }
                    ↓
        Backend 拦截 audio+text 块
                    ↓
        调用 TTS Provider 合成语音
                    ↓
        填入 url + durationSec
                    ↓
        存储完整 audio rich block
                    ↓
        前端渲染微信风格语音条
```

### 1. 类型扩展 (shared)

`RichAudioBlock` 新增 `text?: string`：

```typescript
export interface RichAudioBlock extends RichBlockBase {
  kind: 'audio';
  url: string;           // 合成后填入
  text?: string;         // 语音文本（猫猫想说的话）
  title?: string;
  durationSec?: number;
  mimeType?: string;
}
```

### 2. VoiceBlockSynthesizer（新建）

单例服务（模式同 `RichBlockBuffer`）：

```typescript
// 初始化：index.ts 中调用 initVoiceBlockSynthesizer(ttsRegistry, cacheDir)
// 使用：getVoiceBlockSynthesizer().resolveVoiceBlocks(blocks, catId)

resolveVoiceBlocks(blocks, catId):
  1. 遍历 blocks
  2. 对 kind='audio' 且有 text 但无/空 url 的 block：
     a. 解析 catId → voice/langCode/speed（复用 getCatVoice）
     b. 调用 ttsRegistry.getDefault().synthesize(...)
     c. 写入缓存文件 data/tts-cache/{hash}.wav
     d. 填入 block.url = '/api/tts/audio/{hash}.wav'
  3. 合成失败 → 降级为 card block（展示错误）
  4. 返回 resolved blocks
```

### 3. 后端集成

**Route A（MCP callback）**：
- `callbacks.ts` 中 `create-rich-block` handler
- 检测 audio+text block → 调用 VoiceBlockSynthesizer → 合成后再 buffer + SSE broadcast
- SSE broadcast 的 block 已有 url → 前端直接渲染

**Route B（text extraction）**：
- `route-serial.ts` 中 `allRichBlocks` 收集后
- 调用 `resolveVoiceBlocks(allRichBlocks, catId)` → 合成后再存储

**Schema 调整**：
- Zod `richBlockSchema` audio variant：`url` 改为 `.optional()`，新增 `text: z.string().optional()`
- `isValidRichBlock()`：audio 块允许 text 替代 url

### 4. System Prompt 更新

MCP_TOOLS_SECTION 新增 audio 块说明：

```
- **audio**（语音消息）
  - 当你想"说出来"而不是打字时使用
  - 适合：打招呼、表达情感、庆祝、鼓励
  - 不适合：技术讨论、长篇回复、每条消息
  - text 字段填你想说的话（简短、口语化、1-2 句）
  - 示例：{ kind: 'audio', id: 'v1', text: '太棒了！终于搞定了！' }
```

### 5. 前端 AudioBlock 改造

根据是否有 `text` 字段切换两种样式：

**有 text = 语音消息模式**：
- 猫猫颜色圆角条（宽度随时长变化，最小 80px，最大 200px）
- 左侧播放/暂停图标
- 右侧时长显示
- 下方小字显示文本内容（可选 toggle）

**无 text = 通用音频模式**（已有）：
- 保持现有播放器样式不变

## 涉及文件

### 新建（1）
| 文件 | 说明 |
|------|------|
| `packages/api/src/domains/cats/services/tts/VoiceBlockSynthesizer.ts` | 语音块合成服务 |

### 修改（8）
| 文件 | 改动 |
|------|------|
| `packages/shared/src/types/rich.ts` | RichAudioBlock 加 `text?` |
| `packages/web/src/stores/chat-types.ts` | 同步 `text?` |
| `packages/api/src/routes/callbacks.ts` | Zod schema + 合成集成 |
| `packages/api/src/domains/cats/services/agents/routing/rich-block-extract.ts` | isValidRichBlock 放宽 |
| `packages/api/src/domains/cats/services/agents/routing/route-serial.ts` | 调用 resolveVoiceBlocks |
| `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | 语音消息 prompt |
| `packages/web/src/components/rich/AudioBlock.tsx` | 微信风格语音条 |
| `packages/api/src/index.ts` | 初始化 VoiceBlockSynthesizer |

## 不做的事

- 语音自动播放
- 流式音频（先完整生成再播放）
- 多语言自动检测（MVP 固定中文）
- 语音转文字回显（text 就是原始文本）
- 语音条动画波形（MVP 用简单进度条）

## 验证方案

1. 猫猫通过 MCP callback 发送 `{ kind: 'audio', text: '你好呀！' }` → 前端出现语音条 → 播放有声音
2. 猫猫通过 cc_rich 文本发送 audio block → 同上
3. TTS 服务不可用时 → 降级为卡片显示文本
4. read-aloud 按钮仍然正常工作
5. 单元测试：VoiceBlockSynthesizer mock provider / isValidRichBlock / AudioBlock snapshot
