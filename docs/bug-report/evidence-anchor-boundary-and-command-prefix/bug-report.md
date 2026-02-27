---
feature_ids: [F013]
topics: [evidence, anchor, boundary]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: Evidence 锚点边界校验与命令前缀误匹配

## 1. 报告人
- 报告人：缅因猫（Codex）
- 发现方式：复审 `Phase 5.0-S2` 后续提交（含 `dc27d5a`、`9cf8bd8`）时，基于代码审查与行为推演发现

## 2. 复现步骤

### Bug A: `validateAnchors()` 可越界访问 `docs/` 目录外路径
1. 启动 API 服务并确保 `GET /api/evidence/search` 可调用。
2. 让 evidence 结果包含锚点：`docs/../package.json`（可由 Hindsight memory metadata anchor 注入）。
3. 调用 evidence 搜索接口并观察返回 `confidence`。

期望：
- `docs/` 锚点校验只能访问 `docsRoot` 内文件；越界路径必须判定为无效并降级为 `low`。

实际：
- 当前实现 `join(docsRoot, r.anchor.slice('docs/'.length))` 后直接 `access()`，`docs/../package.json` 会访问到仓库根目录文件并通过校验。

### Bug B: `/approve` 与 `/archive` 命令匹配过宽
1. 在 Web 聊天输入框输入 `/approved e1` 或 `/archive123 e1`。
2. 观察 `useChatCommands` 的命令分发行为。

期望：
- 只有严格命令 `/approve` 与 `/archive`（命令后为空或空白）才触发发布接口调用。

实际：
- 当前使用 `startsWith('/approve')` / `startsWith('/archive')`，会把 `/approved`、`/archive123` 误识别为有效命令并发起请求。

## 3. 根因分析
- Bug A 根因：路径拼接后缺少 `docsRoot` 边界约束校验（canonical path containment）。
- Bug B 根因：命令解析使用宽松前缀匹配，缺少命令词边界判断。

## 4. 修复方案
- Bug A：
  - 新增安全路径解析函数：仅接受 `docs/<relative-path>`，并校验 `resolve(docsRoot, relativePath)` 必须位于 `docsRoot` 内。
  - 任何越界或非法锚点一律按“不可访问”处理（降级 `confidence=low`）。
- Bug B：
  - 新增严格命令匹配辅助函数，要求命令后为字符串结束或空白字符。
  - `/evidence`、`/approve`、`/archive` 改为统一使用严格匹配，防止前缀碰撞。

为什么选这个方案：
- 改动局部、行为可测试、无需变更外部 API 契约。

放弃方案：
- 放弃“通过正则全局替换命令分支”的大改，避免引入额外回归风险。

## 5. 验证方式
- API 侧新增回归测试：
  - `docs/../...` 锚点不会通过存在性校验，结果 `confidence` 必须被降级为 `low`。
- Web 侧：
  - 构建与 lint 通过；
  - 命令匹配逻辑改为纯函数并补最小单测（若当前工程无测试框架，则至少通过类型与构建验证并在 review 信中写明验证限制）。
