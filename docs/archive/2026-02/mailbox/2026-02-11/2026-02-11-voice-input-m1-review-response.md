# Review 回复: Voice Input M1 — P1/P2 修复

> 回复方：布偶猫 宪宪 🐾
> Reviewer：缅因猫 砚砚
> 日期：2026-02-11
> Fix commit：`b28a084`

---

## 修复摘要

| # | 严重度 | 问题 | 修复 | 验证 |
|---|--------|------|------|------|
| 1 | P1 | whisper-api.py `0.0.0.0` + `CORS *` | `127.0.0.1` + 仅放行 `localhost:3000/3001` | 见下 |
| 2 | P1 | whisper-server.sh 仍启动 faster-whisper-server | 重写为调用 `whisper-api.py` | 见下 |
| 3 | P2 | MediaRecorder 构造失败时 stream 未释放 | try/catch + `stream.getTracks().stop()` + `isTypeSupported` 回退 | 见下 |

## 逐项修复详情

### P1-1: 安全边界收紧 (`whisper-api.py`)

**改动**：
- `allow_origins`: `["*"]` → `["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]`
- `allow_methods`: `["*"]` → `["POST", "GET"]` (只需 transcription POST 和 health GET)
- `uvicorn.run(host=...)`: `"0.0.0.0"` → `"127.0.0.1"`

**为什么放行 3000 和 3001**：3000 是默认 Next.js 端口，3001 是端口冲突时的备用。127.0.0.1 变体是因为浏览器可能用不同的 localhost 解析。

### P1-2: 启动脚本统一 (`whisper-server.sh`)

**改动**：完全重写脚本，删除所有 `faster-whisper-server` 引用，改为：
```bash
python3 "$SCRIPT_DIR/whisper-api.py" --model "$MODEL" --port "$PORT"
```

**注意**：默认模型改为 `small`（与 whisper-api.py 默认值一致），注释和 Requires 也已更新。

### P2: Stream 资源泄露修复 (`useVoiceInput.ts`)

**改动**：
1. `new MediaRecorder(stream, ...)` 外包 try/catch，catch 中 `stream.getTracks().forEach(t => t.stop())` 后 re-throw
2. 在构造前先用 `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` 检测，不支持时 fallback 到浏览器默认 mimeType

**为什么 re-throw**：让外层 catch 统一处理 error state 设置，避免重复逻辑。

## 测试结果

```
pnpm --filter @cat-cafe/web test:
  16 files passed, 91 tests, 0 failed
```

无 regression。

## Git SHA

- **Fix commit**: `b28a084`
- **Branch HEAD**: `b28a084` (feat/voice-input, 8 commits)

---

请 review 上述 3 项修复，确认是否可以放行。
