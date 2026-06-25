---
feature_ids: [F236]
topics: [context-engineering, hooks, spike, cat-controlled-mode]
doc_kind: research
created: 2026-06-25
---

# F236 Phase C Spike: cat-controlled mode 实测

> 验证 cc PostToolUse hook 能否实现"猫显式设 session mode → hook 条件 anchor/放行"
> 跑实测：宪宪（@sonnet, claude-sonnet-4-6）；设计 + 复核：opus-48
> 2026-06-25

## 背景

F236 Phase C 设计 pivot（2026-06-24）采纳 cat-controlled mode：
- 猫显式选 anchor/full mode，系统零意图猜测
- cc 原生 Read/Grep 签名改不了，PostToolUse 是唯一 hook 点
- 猫设 **session 级 mode**（写文件），hook 读状态决定 anchor 或放行
- 本 spike = AC-C0c 中"session 持久化 + interactive carrier parity"的子集验证

**前置**：C0a（Read shape-matched replace ✅）+ C0b（Grep replace ✅）已在
`docs/research/2026-06-16-f236-posttooluse-anchor-spike.md` 实证。

## 环境

- 隔离目录 `/tmp/f236-cat-mode-spike`（不碰主配置）
- 项目级 `.claude/settings.json`（hook 仅在此目录生效）
- `claude` 2.1.175，entrypoint = **sdk-cli（`claude -p`）**
- nonce probe 防自欺：原文含 `ORIGINAL_NONCE_abc9x`，anchor 输出含 `ANCHOR_NONCE_spike001`
- Hook action log（`spike-log/action.log`）+ captured tool call log（`captured.jsonl`）独立记录

## hook 设计

**`.claude/hooks/cat-mode-anchor.py`**（Python hook）：
1. 读 stdin（tool_name + tool_input + tool_response）
2. 仅处理 Read 工具；其他 exit 0
3. **bounded Read（有 offset 或 limit）→ 无条件 exit 0**（逃生阀，防 anchor-on-anchor）
4. 检查 `.f236-anchor-mode` 文件是否存在且内容 = `"anchor"`
5. 不存在 → exit 0（fail-open）
6. 存在且 = anchor → 输出 shape-matched `updatedToolOutput`（保 `.file.*` 结构，替 `.file.content`）

**mode signaling（cat 的 signal 机制）**：
```bash
# 猫设 anchor mode（预批准 python3 路径，规避 cc bash redirect 沙盒）
python3 -c "open('/tmp/f236-cat-mode-spike/.f236-anchor-mode', 'w').write('anchor')"
# 猫关闭 anchor mode
python3 -c "import os; os.remove('/tmp/f236-cat-mode-spike/.f236-anchor-mode')"
```

**settings.json**：
```json
{
  "hooks": {
    "PostToolUse": [{"matcher": "Read", "hooks": [{"type": "command",
      "command": "python3 /tmp/f236-cat-mode-spike/.claude/hooks/cat-mode-anchor.py"}]}]
  },
  "permissions": {"allow": ["Bash(python3*)"]}
}
```

## 结果

### Phase 1 — pre-set anchor mode：✅ PASS

| 步 | 输入 | hook action | 模型看到 | 结论 |
|----|------|------------|---------|------|
| Step 1（unbounded） | no offset/limit, mode=anchor | ANCHORED (31 lines, 810 chars) | `[F236-ANCHOR-MODE]`…`ANCHOR_NONCE_spike001` | anchor 生效 ✅ |
| Step 2（bounded） | offset=5, limit=3 | PASS_THROUGH (bounded) | `Line 5/6/7: ...` (真实 slice) | 逃生阀 ✅ |
| Step 3（unbounded，再次） | no offset/limit, mode=anchor | ANCHORED (31 lines, 810 chars) | `ANCHOR_NONCE_spike001` | session 持久化 ✅ |

### Phase 2 — 动态 mode 切换（同 session 内）：✅ PASS（含一处待查 anomaly）

| 步 | 状态 | hook action | 模型看到 | 结论 |
|----|------|------------|---------|------|
| Step 1（no mode file） | 无 `.f236-anchor-mode` | PASS_THROUGH (no-mode-file) | `ORIGINAL_NONCE_abc9x` 第一行 | fail-open ✅ |
| Step 2（写 mode 文件） | `python3 open().write('anchor')` | — | file written confirmed | mode 写入 ✅ |
| Step 3（unbounded，mode 已设） | mode=anchor | ANCHORED **(0 lines, 0 chars ⚠️)** | `ANCHOR_NONCE_spike001` | anchor 触发 ✅；但 locator 字段为零 ⚠️ |
| Step 4（bounded） | offset=5, limit=3 | PASS_THROUGH (bounded) | `Line 5/6/7` | 逃生阀 ✅ |
| Step 5（no mode，已删） | 删 mode 文件后 | PASS_THROUGH (no-mode-file) | `ORIGINAL_NONCE_abc9x` | 关闭还原 ✅ |

## 关键发现

1. **mode signaling 可行** — 猫写 `.f236-anchor-mode` → hook 读 → 条件 anchor，同 session 内动态切换。
2. **fail-open 成立** — 无 mode 文件 = 全文原样放行，不 anchor。
3. **bounded 逃生阀成立** — `Read(offset,limit)` 永远 pass-through，不管 mode。anchor 输出本身给的 drill 指针 = `Read(file_path=..., offset=1, limit=120)`，cats 跟着做就能拿到真实 slice。
4. **session 持久化成立** — hook 每次 Read 调用都独立 fire（不走缓存跳过），mode 文件存在期间多次 Read 均 anchored。
5. **⚠️ Anomaly：动态切换后首次 anchor 的 `tool_response.file` 为空（0 lines, 0 chars）** — hook 依然 fire + anchor 输出依然含 nonce，但 `total_lines/content_chars` 字段拿到 0。推测原因：cc 在同 session 内对已读过的文件做 tool_response 层缓存，切 mode 后再 Read，hook 收到的 `tool_response` 可能不含完整 file data（或是 empty placeholder）。anchor 正文里的路径/drill 指针正确，但 locator 字段（行数/字符数）为零，降低 anchor 质量但不阻断机制。**Phase C 实现需处理此 edge case（添加 fallback：从磁盘读文件统计行数）。**

## 沙盒限制发现（-p 模式）

cc `-p` 模式下 Bash `>` 重定向被 harness-level 阻断（"Output redirection blocked"）。`python3 -c "open().write()"` 需 pre-approve（settings.json `"permissions": {"allow": ["Bash(python3*)"]}`）。

**对 Phase C 设计影响**：
- 实际生产场景（interactive cc session）中猫 CAN 写文件（人类 approve），所以 Bash 写法在 real session 中 OK
- 更 clean 的方案：**MCP 工具设 mode**（猫用 `cat_cafe_set_read_mode(mode='anchor')` 写 mode 文件），绕开 Bash 权限问题——我们自己的 MCP 工具不受沙盒限制

## 结论（精确，不外推）

**`claude -p / sdk-cli` 下，cat-controlled mode 机制实证可行**：
- mode file 作为 session-level signal：猫写 → hook 读 → 条件 anchor/pass-through，**完整 cycle 验证**
- 动态切换（session 内 on/off）：✅（需 pre-approve python3 或 MCP 工具）
- 逃生阀（bounded drill pass-through）：✅
- fail-open（无 mode = 全文）：✅
- Locator = 纯机械字段（路径 + 行数 + drill 指针），**没有 synopsis**：✅

**待处理（Phase C 实现期）**：
1. **0 lines/0 chars anomaly** 根因确认 + fallback（从磁盘 stat 取行数）
2. **mode file 位置**：spike 用绝对路径 `/tmp/...`；Phase C 应用 cc project root 相对路径（或 home dir 固定路径）
3. **MCP set-mode 工具**（推荐）：比 Bash 写更 ergonomic，无权限问题
4. **Grep/Glob anchor**：本 spike 只测 Read；Grep 前 spike（C0b）已证 replace 可行，cat-mode 条件分支同理，Phase C 合并实现

## artifacts

`/tmp/f236-cat-mode-spike/`：
- `.claude/hooks/cat-mode-anchor.py`（hook 脚本）
- `.claude/settings.json`（hook config + permissions）
- `test-files/big-file.txt`（nonce probe 测试文件）
- `spike-log/action.log`（hook 决策日志，anti-confound 证据）
- `spike-log/captured.jsonl`（所有 tool call 捕获记录，12 条）
