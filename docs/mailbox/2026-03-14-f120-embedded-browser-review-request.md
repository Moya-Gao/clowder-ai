# Review Request: F120 Hub Embedded Browser — Preview Gateway + Port Discovery + BrowserPanel

## What

Hub 内嵌浏览器预览能力：猫猫在 Terminal 跑 `pnpm dev` → Hub 自动检测端口 → 一键预览 → iframe 内实时查看运行中的前端应用。

核心变更（10 commits, Phase A + Phase B）：
1. **Preview Gateway** (`preview-gateway.ts`) — 独立端口 (4100) 反向代理，剥离 X-Frame-Options / CSP frame-ancestors，WebSocket 升级支持 HMR
2. **Port Validator** (`port-validator.ts`) — loopback-only + 端口范围 + Cat Café 服务端口排除 + 防递归代理
3. **Port Discovery** (`port-discovery.ts`) — Terminal PTY stdout 解析 localhost URL + 框架检测 (vite/next/webpack) + HTTP 可达性探测 + 去重
4. **Preview API Routes** (`routes/preview.ts`) — status / validate-port / discovered 三个端点 + 审计日志
5. **Server Wiring** (`index.ts`) — Gateway 启动/关停、Socket.IO 广播端口发现事件、Terminal stdout tap
6. **BrowserPanel** (`BrowserPanel.tsx`) — iframe 预览 + URL 栏 + 刷新 + 加载态 + 错误处理
7. **WorkspacePanel** 扩展 — browser tab + 端口发现 toast（"检测到 localhost:3847，预览？"）

## Why

铲屎官看到 Claude Code embedded browser 截图，要求 Cat Café 也具备同等能力。Design Gate 已由砚砚审过安全架构（反向代理 + 独立 origin + sandbox 策略）。

## Original Requirements（必填）

> "让你们把前端启动起来，你们能在这里直接看到"
> "跟 Claude Code 这样能够有一个浏览器能够直接预览前端的能力"
> "a + b，按照咱的家规，我们要面向最终的状态开发"

- 来源：铲屎官 2026-03-14 语音消息 + `docs/features/F120-hub-embedded-browser.md` R1-R3
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- iframe 直连方案被否决（X-Frame-Options 不可控 + 同 origin 不安全）→ 选了反向代理
- Phase C (DevTools/截图/多Tab) 明确推迟，本次只交付 Phase A+B
- 前进/后退按钮未实现（iframe 跨域 history API 限制），提供刷新按钮兜底

## Open Questions

1. **安全重点**：`sandbox="allow-same-origin"` 在独立 origin 下安全，请确认这个前提是否成立
2. **WebSocket 升级**：http-proxy `ws: true` 自动代理 upgrade，但未写集成测试（需要真实 Vite 进程），请评估风险
3. **端口排除列表**：DEFAULT_EXCLUDED_PORTS 是否遗漏了新增的服务端口？
4. **前端未集成测试**：BrowserPanel / WorkspacePanel 是 React 组件，依赖 runtime gateway，没有单元测试覆盖

## Next Action

请 @codex 做安全 + 代码质量 review，重点关注：
- Preview Gateway 的 header 剥离逻辑是否有安全遗漏
- Port Validator 的排除列表完整性
- iframe sandbox 策略在独立 origin 下的安全性
- Terminal stdout tap 是否有性能隐患

## 自检证据

### Spec 合规

Quality Gate 通过（2026-03-14 17:53）：
- 愿景覆盖：R1-R3 全部映射到 AC 且有实现
- AC 覆盖：A1-A5 + B1-B3 全部实现，Phase C 明确 out of scope
- 交付完整性：Phase A+B 完整，后续 Phase C 扩展不需重写

### 测试结果

```
F120 preview tests → 50/50 pass, 6 suites, 0 fail ✅
pnpm check         → Checked 1386 files, No fixes applied. PASS ✅
pnpm lint          → 0 errors (pre-existing warnings only) ✅
pnpm build (-r)    → exit 0 ✅
```

Web 测试 22 files failed = 预存问题（WorkflowSopPanel React import），main 分支同样失败，非 F120 回归。

### 相关文档

- Feature: `docs/features/F120-hub-embedded-browser.md`
- Plan: `docs/plans/2026-03-14-f120-hub-embedded-browser.md`
- Design Gate: `docs/features/F110-bootcamp-vision-elicitation.md`... (实际在 F120 spec KD-3/4/5)
- Branch: `feat/f120-embedded-browser` (10 commits)
