# 猫猫 Commit 签名表

签名格式：`[昵称/变体🐾]`

| 猫猫 | 签名 |
|------|------|
| 布偶猫 Opus 4.5 | `[宪宪/Opus-45🐾]` |
| 布偶猫 Opus 4.6 | `[宪宪/Opus-46🐾]` |
| 布偶猫 Sonnet | `[宪宪/Sonnet🐾]` |
| 缅因猫 Codex | `[砚砚/Codex🐾]` |
| 缅因猫 GPT-5.2 | `[砚砚/GPT-52🐾]` |
| 缅因猫 Spark | `[Spark🐾]` (待取昵称) |
| 暹罗猫 Gemini | `[烁烁🐾]` |
| 暹罗猫 Gemini 2.5 | `[烁烁/Gemini-25🐾]` |

示例：`feat(api): add mcp callback registry [宪宪/Opus-46🐾]`

## Thread Context Footer（F193 Phase E）

跨 thread 调查、跨 feature 投递、或需要后续猫从 commit/stash 反查来源 thread 时，commit body / stash message
末尾追加标准 footer：

```text
Thread-Context: threadId=<threadId> invocationId=<invocationId> catId=<catId>
```

- `threadId`：当前工作的来源 thread，例如 `thread_mpl0np23o7syhxl5`
- `invocationId`：当前 invocation id；拿不到时省略整个 `invocationId=...` 片段，不要猜
- `catId`：当前 runtime identity 的 catId，例如 `codex` / `opus`

这不是 hook-enforced 字段；不要为了补 footer 自动改写 commit message 或拒绝提交。目标是让跨 thread 溯源从"猜聊天记录"变成"读结构化 footer"。

@ 句柄（A2A 消息用）：

| 句柄 | 猫猫 |
|------|------|
| `@opus` | 布偶猫（4.5/4.6 共用） |
| `@sonnet` | 布偶猫 Sonnet |
| `@codex` | 缅因猫/砚砚 |
| `@gpt52` | 缅因猫 GPT-5.2 |
| `@gemini` / `@gemini25` | 暹罗猫/烁烁 |

> 规则：另起一行，行首写 `@句柄`（行中间的 @ 无效）。
