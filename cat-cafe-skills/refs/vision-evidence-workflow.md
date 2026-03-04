# Vision Evidence Workflow (B1)

> 用途：把“前端功能看起来对了”变成可审计证据。
> 适用范围：**仅前端 UI/UX**。后端功能不强制截图。

## 最小证据包

1. 截图 ≤3 张
2. 录屏 ≤15s（关键交互）
3. 需求→证据映射表（每条需求至少对应 1 条证据）

## 工具建议（已有 MCP）

- Claude in Chrome：用浏览器截图/录屏工具
- Codex 浏览器：`browser_navigate` + `browser_take_screenshot`

## 采集步骤

1. 明确这次验收的需求点（来自 discussion/spec）。
2. **Runtime Guard（若在 `cat-cafe-runtime`）**：
   - 先探活：`curl -sf http://localhost:3002/health`
   - 服务在线就直接复用，禁止为截图执行 `pnpm start` / `pnpm runtime:start` / `./scripts/start-dev.sh`
   - 确实要重启时，先拿到铲屎官明确授权，再执行 `CAT_CAFE_RUNTIME_RESTART_OK=1 pnpm start`
3. 进入目标页面，覆盖关键状态（初始态 / 成功态 / 错误态）。
4. 先截静态图，再录 1 段 15s 内关键流程。
5. 填写映射表并放进 quality-gate / review 请求信。

## 需求→证据映射模板

```markdown
| # | 需求点 | 证据 | 结论 |
|---|--------|------|------|
| 1 | “用户能看到任务领取状态” | screenshot-1.png | ✅ |
| 2 | “领取失败有明确提示” | screenshot-2.png | ✅ |
| 3 | “切换任务时状态不闪烁” | recording-1.mp4 (00:04-00:10) | ✅ |
```

## 常见错误

- 只贴截图，不写需求映射。
- 录屏太长，关键行为难定位。
- 把后端任务也强行要求截图（不需要）。
- 为了截图在 runtime 会话里重启服务，导致在线实例中断。
