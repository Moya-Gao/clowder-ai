# 语音识别准确性提升 + 术语自助配置 + 系统级猫猫 Whisper

> 设计者：布偶猫 宪宪 🐾
> 需求发起：铲屎官 Landy（"手疼不想打字"）
> 日期：2026-02-15
> 状态：Draft — 铲屎官口头确认方向，待实施
> 前置：[F20 语音输入设计](./2026-02-11-voice-input-design.md)、[Whisper Apple Silicon 调研](../research/whisper-asr-apple-silicon-migration.md)

---

## 背景

F20 (M1 MVP) + F20b (流式转写) 已完成并上线。铲屎官实际使用中发现：

1. **术语识别仍有漏洞**：说"砚砚"被识别为"艳艳"（词典缺此变体）
2. **词典维护依赖布偶猫**：每次发现新误识别都要找猫改 JSON → 不可持续
3. **只能在 Cat Cafe Web 用**：铲屎官想在任意 app 用语音输入（手疼！）

## 现有架构回顾

```
用户录音 → MediaRecorder → Whisper API (localhost:9876)
                                ↓
                          initial_prompt 偏置（已有！第 8-12 行）
                                ↓
                          raw text → 3 层纠正管道
                            ├─ 1. voice-terms.json 词典替换
                            ├─ 2. @mention 标准化
                            └─ 3. 中文填充词移除
                                ↓
                          corrected text → textarea
```

**关键事实**：`initial_prompt` 已包含"宪宪, 砚砚"等术语，但 Whisper 仍会输出同音异字（"艳艳"）→ 词典兜底层至关重要。

---

## 三阶段计划

### Phase A：准确性快速修复（当天完成）

**目标**：补齐词典盲区 + 优化 initial_prompt

#### A1. 扩展 voice-terms.json

补充已知缺失的误识别变体：

| 缺失变体 | 正确词 | 原因 |
|----------|--------|------|
| 艳艳 | 砚砚 | 铲屎官实测遇到 |
| 雁雁 | 砚砚 | yàn 同音字 |
| 燕燕 | 砚砚 | yàn 同音字 |
| 研研 | 砚砚 | yán 近音 |
| 岩岩 | 砚砚 | yán 近音 |
| 现现 | 宪宪 | xiàn 同音 |
| 弦弦 | 宪宪 | xián 近音 |
| 险险 | 宪宪 | xiǎn 近音 |
| 不偶猫 | 布偶猫 | 可能误识 |
| 不偶 | 布偶 | 可能误识 |

#### A2. 优化 initial_prompt

当前 prompt 是通用术语列表。优化方向：
- 加入更多高频口语场景短语（如"帮我看看"、"开个 worktree"）
- 用自然句式替代纯列举（Whisper 对句式上下文更敏感）

```typescript
// Before:
const INITIAL_PROMPT = 'Cat Cafe 项目对话。常见术语：MCP, Redis, ...';

// After:
const INITIAL_PROMPT =
  '猫猫对话场景。宪宪是布偶猫（Opus），砚砚是缅因猫（Codex）。' +
  '技术栈：MCP, Redis, Fastify, TypeScript, Whisper, worktree, rebase, ' +
  'InvocationRecord, Hindsight, NDJSON, Zustand, WebSocket, Codex, ' +
  'Gemini, Claude, Opus, Sonnet, Haiku, ADR, Lua, CAS, API, CLI。' +
  '常说：帮我看看、开个 worktree、跑一下测试、review 一下。';
```

#### A3. 测试验证

- 更新 `transcription-corrector.test.ts`，为新增变体添加测试用例
- 手动语音测试"砚砚"、"宪宪"等高频词确认效果

---

### Phase B：术语自助配置 UI（F20d）

**目标**：铲屎官能自己在前端加/删/改纠正规则，不用找猫

#### B1. 架构选择

| 方案 | 存储 | 优点 | 缺点 |
|------|------|------|------|
| ① localStorage | 浏览器本地 | 零后端改动 | 跨设备不同步 |
| ② API + Redis | 后端 | 跨设备同步 | 需新 endpoint |
| ③ 混合：默认词典 + localStorage 用户覆盖 | 浏览器本地 | 零后端 + 可扩展 | 跨设备不同步 |

**推荐方案 ③**：
- `voice-terms.json` 作为内置默认词典（跟代码走）
- 用户自定义条目存 localStorage `cat-cafe-voice-custom-terms`
- 运行时合并：用户条目优先级高于默认
- 未来如需跨设备，加 API endpoint 即可

#### B2. UI 设计

在 CatCafeHub 增加 "语音设置" tab（或独立设置页），包含：

1. **术语纠正表**（可编辑表格）
   - 两列：`误识别词` → `正确词`
   - 内置词条灰色显示（来自 voice-terms.json，不可删除）
   - 用户自定义词条蓝色显示（可编辑/删除）
   - 底部 "添加新规则" 按钮

2. **initial_prompt 编辑**（高级选项，默认折叠）
   - 可修改发给 Whisper 的上下文提示
   - 有"恢复默认"按钮

3. **语言设置**
   - 当前硬编码 `zh`，可改为下拉选择（zh / en / auto）

#### B3. 实现文件清单

| 文件 | 改动 |
|------|------|
| `transcription-corrector.ts` | 新增 `mergeCustomTerms(builtIn, custom)` 函数 |
| `useVoiceInput.ts` | 读取 localStorage 的 custom terms + custom prompt |
| `voice-settings-store.ts`（新建） | localStorage 读写 + Zustand store |
| `VoiceSettingsPanel.tsx`（新建） | 设置 UI 组件 |
| `CatCafeHub.tsx` | 添加 "语音" tab |

#### B4. 测试

- `voice-settings-store.test.ts`：localStorage 读写 + 合并逻辑
- `transcription-corrector.test.ts`：自定义词条覆盖内置词条
- `VoiceSettingsPanel.test.tsx`：UI 交互（添加/删除/编辑）

---

### Phase C：cat-cafe-whisper 系统级工具（F20c 升级）

**目标**：全局快捷键 + 录音 + Whisper 转写 + 术语纠正 + 打字到任意 app

#### C1. 技术选型

| 方案 | 语言 | 优点 | 缺点 |
|------|------|------|------|
| ① Swift menubar app | Swift | 原生最轻、系统集成好 | 需学 Swift |
| ② Python 脚本 | Python | 快速原型、复用 whisper-api | 非原生、需处理权限 |
| ③ Electron menubar | TS | 复用前端代码 | 太重（~100MB+） |
| ④ Tauri menubar | Rust+TS | 轻量、前端复用 | Rust 学习曲线 |

**推荐方案 ②（MVP）→ 长期迁移 ①**：
- Python 脚本快速验证想法（1-2 天）
- 验证通过后考虑 Swift 重写（原生体验好）

#### C2. 核心流程

```
全局快捷键（⌥Space）
    ↓
menubar 图标变红 🔴 开始录音
    ↓
再按快捷键 → 停止录音
    ↓
发到 localhost:9876/v1/audio/transcriptions
（复用已有 Whisper 服务 + initial_prompt）
    ↓
术语纠正（复用 transcription-corrector 逻辑）
    ↓
AppleScript / macOS Accessibility API
打字到当前焦点窗口
    ↓
menubar 图标恢复 ⚪
```

#### C3. Python MVP 方案

```
cat-cafe-whisper/
├── whisper_input.py        # 主程序：热键 + 录音 + 转写 + 打字
├── term_corrector.py       # 术语纠正（从 voice-terms.json 读取）
├── config.json             # 用户配置（热键、语言、Whisper URL）
├── requirements.txt        # pynput, sounddevice, requests
└── install.sh              # 安装 + 注册 launchd 自启动
```

依赖：
- `pynput`：全局热键监听
- `sounddevice` + `soundfile`：音频录制
- `requests`：HTTP 调用 Whisper API
- AppleScript (subprocess)：打字到焦点窗口

#### C4. 与 Cat Cafe 的集成点

- **共享 Whisper 服务**：cat-cafe-whisper 和 Cat Cafe Web 复用同一个 `localhost:9876`
- **共享术语词典**：读取同一份 `voice-terms.json`（+ 用户自定义 `~/.cat-cafe/voice-custom-terms.json`）
- **共享 initial_prompt**：配置文件指定默认 prompt

#### C5. macOS 权限需求

- 辅助功能权限（Accessibility）：用于打字到其他 app
- 麦克风权限：录音
- 可能需要 Input Monitoring 权限（全局热键）

---

## 实施优先级

| 阶段 | 内容 | 估计工作量 | 前置依赖 |
|------|------|-----------|----------|
| **A** | 词典补全 + prompt 优化 | 30 分钟 | 无 |
| **B** | 术语配置 UI | 半天~1 天 | A 完成 |
| **C** | cat-cafe-whisper 系统级 | 1-2 天 | Whisper 服务可用 |

Phase A 和 C 可并行（A 改前端词典，C 做独立工具），Phase B 依赖 A 的词典合并逻辑。

---

## Open Questions

1. **cat-cafe-whisper 放哪？** 独立 repo `cat-cafe-whisper` 还是 monorepo 内 `packages/whisper-input`？
   - 倾向独立 repo：它是系统工具，不是 Web 组件
2. **多语言自动检测**：目前 hardcode `zh`，是否需要自动检测？Whisper 支持 `language=None` 自动检测但可能略慢
3. **Phase B 的 initial_prompt 编辑**：是否值得做？还是太 niche？
4. **Swift 重写时机**：Python MVP 验证通过后什么时候迁移？
