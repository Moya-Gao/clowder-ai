# F34 Phase B1: TTS Provider 架构 + Kokoro 首发接入

## Context

铲屎官要求给三只猫猫加上说话能力（TTS）。核心目标不是挑声线，而是**建立足够优雅的 Provider 架构，让底层模型可以随时换**。

技术选型决策（基于 GPT Pro 调研 + 布偶猫分析）：
- **首发模型**：Kokoro-82M via mlx-audio（82M 轻量、MLX 原生、与 mlx-whisper 同生态）
- **架构重点**：ITtsProvider 接口 + 注册表，模型切换是配置变更而非代码重写
- **升级路径**：Kokoro → Spark-TTS（克隆）→ CosyVoice3（中文上限）→ 云端 TTS

## 架构总览

```
┌──────────────┐     POST /api/tts/synthesize      ┌──────────────────┐
│   Frontend   │ ──────────────────────────────────→│   Node API       │
│  useTts hook │     { text, catId }                │  tts.ts route    │
│  Play button │ ←──────────────────────────────────│  (resolveUserId) │
│  <audio>     │     { audioUrl }                   │  ┌────────────┐  │
└──────────────┘                                    │  │TtsRegistry │  │
        │                                           │  │  ↓ resolve │  │
        │  GET /api/tts/audio/{hash}.{format}        │  │ITtsProvider│  │
        │  (resolveUserId)                          │  └──────┬─────┘  │
        └──────────────────────────────────→────────┘─────────┼────────┘
                                                              │ HTTP POST
                                                              ↓
                                                    ┌──────────────────┐
                                                    │ Python TTS Server│
                                                    │ (mlx-audio)      │
                                                    │ :9877             │
                                                    │ /v1/audio/speech  │
                                                    └──────────────────┘
```

关键设计决策：
- **Node API 做代理层**（不是前端直连 TTS 服务）→ 因为 per-cat voice 配置在后端
- **Python 服务 OpenAI-compatible API** → 和 whisper-api.py 一致的范式
- **R2-P1 fix: 受鉴权下载端点**：音频文件存 `data/tts-cache/`（非公开目录），
  通过 `GET /api/tts/audio/{hash}` 端点下载（resolveUserId 鉴权）。
  不走公开 `/uploads/` 静态路由，阻断 hash 可探测侧信道。
  全局 hash 去重保留（不加 userId），安全边界在下载端点的 auth 层。

## 实施步骤

### Step 1: Python TTS 服务（镜像 whisper-api.py）

**新建文件**：
- `scripts/tts-api.py` — FastAPI server, `/v1/audio/speech` + `/health`
- `scripts/tts-server.sh` — 启动脚本（检查 mlx-audio + misaki[zh] 依赖）

**API 设计**（OpenAI TTS API 兼容）：
```
POST /v1/audio/speech
Body: { "input": "文本", "voice": "zm_yunxi", "model": "mlx-community/Kokoro-82M-bf16", "response_format": "wav", "speed": 1.0 }
Response: audio/wav 二进制流
```

**关键实现**：
- `asyncio.Lock()` 序列化 GPU 访问（和 whisper-api.py 一致）
- 启动时 warmup 调用预加载模型
- CORS 允许 localhost:3000/3001
- 端口 9877（与 Whisper 9876 相邻）
- venv: `~/.cat-cafe/tts-venv/`

### Step 2: 共享类型定义

**新建**: `packages/shared/src/types/tts.ts`

```typescript
/** Per-cat TTS voice configuration */
export interface VoiceConfig {
  readonly voice: string;        // provider-specific voice ID (e.g. 'zm_yunxi')
  readonly langCode: string;     // 'z' for Chinese, 'en-us' for English
  readonly speed?: number;       // playback speed (default 1.0)
}

/** TTS synthesis request */
export interface TtsSynthesizeRequest {
  text: string;
  voice: string;
  langCode?: string;
  speed?: number;
  format?: 'wav' | 'mp3';
}

/** TTS synthesis result (R1-P2: Uint8Array not Buffer — runtime-neutral for shared pkg) */
export interface TtsSynthesizeResult {
  audio: Uint8Array;
  format: string;
  durationSec?: number;
  metadata: { provider: string; model: string; voice: string };
}

/** Interface that all TTS providers must implement */
export interface ITtsProvider {
  readonly id: string;
  synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
}
```

**修改**: `packages/shared/src/types/cat-breed.ts`
- 在 `CatVariant` 中添加 `readonly voiceConfig?: VoiceConfig`

**修改**: `packages/shared/src/index.ts` — re-export tts types

### Step 3: Per-Cat Voice 配置（镜像 cat-budgets.ts）

**新建**: `packages/api/src/config/cat-voices.ts`

```typescript
// Priority: env var > cat-config.json > hardcoded defaults
const DEFAULT_VOICES: Record<string, VoiceConfig> = {
  opus:   { voice: 'zm_yunjian',  langCode: 'z', speed: 0.95 },  // 温柔少年
  codex:  { voice: 'zm_yunxi',    langCode: 'z', speed: 1.0 },   // 清朗书生
  gemini: { voice: 'zm_yunyang',  langCode: 'z', speed: 1.05 },  // 活泼明快
};
// 注：voice name 是 placeholder，实际要试听后调
```

模式完全复制 `cat-budgets.ts`：`env var > cat-config.json voiceConfig > DEFAULT_VOICES > GLOBAL_FALLBACK`。

### Step 4: TTS Provider + Registry

**新建目录**: `packages/api/src/domains/cats/services/tts/`

**新建**: `tts/ITtsProvider.ts` — 重新 export shared 类型（port 层）

**新建**: `tts/MlxAudioTtsProvider.ts`
- 实现 `ITtsProvider`
- 通过 HTTP 调用 Python TTS 服务 (`TTS_URL` env var, default `http://localhost:9877`)
- `synthesize()` → `POST /v1/audio/speech` → 返回 Buffer
- 构造时接受 `{ baseUrl?, httpClient? }` — httpClient 可注入用于测试
- 超时 30s + AbortSignal 透传

**新建**: `tts/TtsRegistry.ts`
- 镜像 `AgentRegistry`：`Map<string, ITtsProvider>`
- `register(id, provider)` / `get(id)` / `has(id)`

### Step 5: TTS API 路由

**新建**: `packages/api/src/routes/tts.ts`

```
POST /api/tts/synthesize
Body: { text: string, catId?: string, voice?: string, langCode?: string }
Response: { audioUrl: string, durationSec?: number }
```

**鉴权（R1-P1 fix）**：
- `resolveUserId(request)` — 必须登录才能调用，拒绝匿名请求
- B1 MVP 是 text 入参模式，不涉及 messageId → 不需要 thread 授权校验
- 未来加 `messageId` 入参时，需补充 thread 归属校验（确认 user 有权访问该 thread）

逻辑：
1. **鉴权**: `resolveUserId(request)` → 401 if unauthenticated
2. 解析 catId → 查 `getCatVoice(catId)` 获取 voice/langCode/speed
3. voice 参数覆盖默认（允许前端试听其他声线）
4. 调用 `ttsRegistry.get('mlx-audio').synthesize(request)`
5. **缓存**：hash key = `sha256(provider + model + voice + langCode + speed + format + text)`。
   保存到 `data/tts-cache/{hash}.{format}`（非公开目录），已存在则跳过合成。
6. 返回 `{ audioUrl: '/api/tts/audio/{hash}.{format}', durationSec }`

```
GET /api/tts/audio/{hash}.{format}
Response: audio/wav 二进制（受鉴权保护）
```

**R2-P1 fix**: 音频下载走受鉴权端点，不走公开 `/uploads/` 静态路由。
`resolveUserId(request)` → 通过后 `fs.createReadStream(data/tts-cache/{hash})` 返回。
全局 hash 去重保留（不加 userId/threadId），安全边界在此端点的 auth 层。

**R3-P1 fix: 路径安全约束**（防 path traversal / 任意文件读取）：
- `hash` 参数：**必须是 64 位十六进制** (`/^[0-9a-f]{64}$/`)，否则 400
- `format` 参数：**必须是枚举** (`wav | mp3`)，否则 400
- 路径拼接：`path.resolve(TTS_CACHE_DIR, \`${hash}.${format}\`)` 后做 **前缀校验**：
  `resolvedPath.startsWith(path.resolve(TTS_CACHE_DIR))` 为 false → 403
- 文件不存在 → 404（不泄露是否曾合成过该文本）

**修改**: `packages/api/src/routes/index.ts` — 注册 tts 路由

### Step 6: Audio Rich Block 类型（附带完成 B2）

**修改**: `packages/shared/src/types/rich.ts`
- `RichBlockKind` union 加 `'audio'`
- 新增 `RichAudioBlock` 接口: `{ kind: 'audio', url: string, title?: string, durationSec?: number, mimeType?: string }`
- `RichBlock` union 加 `RichAudioBlock`
- `VALID_KINDS` 加 `'audio'`

**修改**: `packages/web/src/stores/chat-types.ts` — 同步添加

**修改**: `packages/api/src/routes/callbacks.ts` — `richBlockSchema` discriminated union 加 audio variant

**新建**: `packages/web/src/components/rich/AudioBlock.tsx`
- `<audio controls>` + 猫猫声波动画（简单 CSS）
- 显示 title、duration

**修改**: `packages/web/src/components/rich/RichBlocks.tsx` — switch 加 `case 'audio'`

### Step 7: 前端 TTS 播放集成

**新建**: `packages/web/src/hooks/useTts.ts`
- `useTts()` hook: `synthesize(messageId, text, catId)` → POST `/api/tts/synthesize` → 返回 audioUrl
- 内部状态：`idle | loading | playing | error`
- 播放管理：HTMLAudioElement 实例，播放完自动 cleanup
- **R2-P2 fix**: 前端缓存 `Map<messageId, audioUrl>`（按消息去重，避免重复请求）；
  后端缓存按内容 hash 全局去重（相同文本不重复合成）。两层缓存各司其职。

**修改**: `packages/web/src/components/ChatMessage.tsx`
- 猫猫消息旁增加小播放按钮（🔊 图标）
- 点击 → `useTts().synthesize(message.id, message.content, message.catId)`
- 播放中显示加载/播放状态

### Step 8: 启动注册（index.ts wiring）

**修改**: `packages/api/src/index.ts`
- 创建 `TtsRegistry` 实例
- 注册 `MlxAudioTtsProvider`（读取 `TTS_URL` env var）
- 传入 tts routes options

## 涉及文件完整列表

### 新建（11 个文件）
1. `scripts/tts-api.py` — Python TTS FastAPI server
2. `scripts/tts-server.sh` — 启动脚本
3. `packages/shared/src/types/tts.ts` — TTS 类型（audio: Uint8Array，R1-P2 fix）
4. `packages/api/src/config/cat-voices.ts` — per-cat voice config
5. `packages/api/src/domains/cats/services/tts/ITtsProvider.ts` — port 层 re-export
6. `packages/api/src/domains/cats/services/tts/MlxAudioTtsProvider.ts` — Kokoro provider
7. `packages/api/src/domains/cats/services/tts/TtsRegistry.ts` — registry
8. `packages/api/src/domains/cats/services/tts/tts-cache-cleaner.ts` — TTL/LRU 缓存清理（R1-P2 fix）
9. `packages/api/src/routes/tts.ts` — API 路由（含 resolveUserId 鉴权，R1-P1 fix）
10. `packages/web/src/components/rich/AudioBlock.tsx` — audio block renderer
11. `packages/web/src/hooks/useTts.ts` — 前端 TTS hook

### 修改（8 个文件）
1. `packages/shared/src/types/cat-breed.ts` — CatVariant 加 voiceConfig
2. `packages/shared/src/types/rich.ts` — 加 audio block kind
3. `packages/shared/src/index.ts` — re-export tts types
4. `packages/web/src/stores/chat-types.ts` — 同步 audio block types
5. `packages/web/src/components/rich/RichBlocks.tsx` — 加 audio case
6. `packages/api/src/routes/callbacks.ts` — richBlockSchema 加 audio
7. `packages/api/src/routes/index.ts` — 注册 tts 路由
8. `packages/api/src/index.ts` — TtsRegistry 初始化 + 缓存清理定时器

### Step 9: TTS 缓存清理（R1-P2 fix）

**修改**: `packages/api/src/index.ts` 或独立 `tts/tts-cache-cleaner.ts`

启动时 + 每 6 小时定时执行：
1. 扫描 `data/tts-cache/` 目录
2. 删除 mtime > 7 天的文件
3. 若目录总大小 > 500MB，按 LRU（最旧 mtime 优先）淘汰直到 < 400MB
4. 日志记录清理数量和释放空间

实现方式：`setInterval` + `fs.stat` + `fs.readdir`，不引入额外依赖。

## 不做的事

- **声线精调**：voice name 是 placeholder，等跑起来试听后再调
- **B4 streaming audio**：MVP 用完整文件播放，不做流式
- **TTS 自动播放**：只做手动点击播放，不自动 TTS
- **多语言切换**：MVP 固定中文，后续加英文
- **Redis 缓存**：MVP 用文件系统缓存（hash → wav），足够用

## 验证方案

1. **Python TTS 服务**：
   ```bash
   ./scripts/tts-server.sh
   curl -X POST http://localhost:9877/v1/audio/speech \
     -H "Content-Type: application/json" \
     -d '{"input":"你好，我是布偶猫","voice":"zm_yunjian","model":"mlx-community/Kokoro-82M-bf16"}' \
     --output test.wav
   # 播放 test.wav 确认有声音
   ```

2. **Node API 集成**：
   ```bash
   curl -X POST http://localhost:3101/api/tts/synthesize \
     -H "Content-Type: application/json" \
     -d '{"text":"你好世界","catId":"opus"}'
   # 返回 { audioUrl: "/api/tts/audio/{hash}.wav", durationSec: 1.5 }
   # 再验证下载端点：
   curl http://localhost:3101/api/tts/audio/{hash}.wav --output test-api.wav
   ```

3. **前端 E2E**：在浏览器中打开 Cat Cafe → 找一条猫猫消息 → 点播放按钮 → 听到声音

4. **单元测试**：
   - `MlxAudioTtsProvider` — mock HTTP client，验证请求格式和错误处理
   - `cat-voices.ts` — 验证 3 级优先级 fallback
   - `TtsRegistry` — 注册/查找/重复注册报错
   - `AudioBlock.tsx` — 渲染 snapshot test
   - `tts.ts route` — mock provider，验证 hash 缓存 + voice resolution

5. **类型检查**：`pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api tsc --noEmit && pnpm --filter @cat-cafe/web tsc --noEmit`
