# Review Request: F195 hotfix — audio service port conflict + transcript window UI

Review-Target-ID: fix-f195-audio-port-ui
Branch: fix/f195-audio-port-and-transcript-ui

## What

Two bugs discovered during live testing of F195 meeting copilot:

1. **Port conflict**: `audio-service.py` and `anthropic-proxy.mjs` both default to port 9877. Audio service cannot start when proxy is running. Changed audio service default to 9881 across all references (Python service, API proxy, MCP tools, env-registry, port-validator, skill ref). Port 9878 was initially chosen but conflicts with LLM postprocess — 9881 is the next available in the sidecar range.

2. **UI visibility**: Floating transcript window `border-cafe-border` + `shadow-xl` is nearly invisible against the page background (both light and dark themes). Upgraded to `border-2 border-cafe-accent-primary/30` + `shadow-2xl ring-1 ring-black/10 backdrop-blur-sm`.

7 files changed.

## Why

铲屎官重启 runtime 后尝试使用 meeting copilot，audio service 启动失败（OSError: address already in use），浮动转写窗 UI "完全看不清"。

## Original Requirements

> "咱的这个如何用啊？好像这个ui 完全看不清！！哈哈哈"
> "你得修一下这个bug 然后 还有ui的那个bug 然后我再重启就不用.env.local 加一行了吧"
- 来源：本 session 铲屎官实时测试反馈（2026-05-11）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

Port 选 9881（9876=ASR, 9877=proxy, 9878=LLM postprocess, 9879=TTS, 9880=embedding, 9881=audio capture）。`port-validator.ts` DEFAULT_EXCLUDED_PORTS 已新增 9881。

## Architecture Ownership

Architecture cell: N/A（hotfix，无架构变更）
Map delta: none
Why: 纯端口配置修改 + CSS 样式调整，不改变任何架构边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`

## Open Questions

### 技术 OQ（给 reviewer）
1. `backdrop-blur-sm` 在某些浏览器可能有性能开销——对于小面积浮动窗应该可接受，请确认
2. 9881 是否和其他 sidecar 端口冲突？（已确认 port-validator reserved list 包含 9881，9878 保留给 LLM postprocess）

### 价值 OQ（给 CVO）
无

## Next Action

请 review 代码变更，确认端口选择和 UI 样式改进合理。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-f195-audio-port-ui/codex`
- 无需启动 dev server（纯配置 + CSS 变更，tests 覆盖）

## 自检证据

### Spec 合规
- 铲屎官两个 bug 均已修复
- Hotfix pattern check: `hotfix: false`（非 hotfix 模式）
- Fallback layer check: net +0
- Artifact hygiene: clean

### 测试结果
- FloatingTranscriptWindow tests → 11/11 pass
- Python audio-service tests → 34/34 pass
- Biome check → 2910 files, 0 errors

### 相关文档
- Feature: F195 (`docs/features/F195-meeting-copilot-live-advisory.md`)
- Skill ref: `cat-cafe-skills/refs/live-audio.md`

---
*[宪宪/Opus-46🐾]*

如果判断错了我最可能错在哪：
1. `backdrop-blur-sm` 可能在低端设备上造成渲染卡顿（概率低，窗口面积小）
2. 9881 可能在某些开发场景下被其他服务占用（但 reserved list 已覆盖）
