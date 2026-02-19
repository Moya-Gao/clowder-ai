# Bug Report — F21 Cloud Round7 (1xP1 + 2xP2)

## 1) 报告人
- 来源：云端 Codex review（PR #30，review `3824243379`，commit `636a023`）
- 发现项：
  - P1: `discussion_r2826392685`（article detail/by-url/update 对缺失文件返回 500）
  - P2: `discussion_r2826392690`（migrate CLI 机器绑定默认路径）
  - P2: `discussion_r2826392694`（SignalArticleList button 嵌套）

## 2) 复现步骤（期望 vs 实际）

### P1: article detail/update 对坏文件不容错
- 步骤：写入 inbox 后删除对应 markdown，再请求：
  - `GET /api/signals/articles/:id`
  - `GET /api/signals/articles/by-url`
  - `PATCH /api/signals/articles/:id`
- 期望：返回可恢复结果（404）而非服务错误。
- 实际：`readArticleDocument` 抛错后路由 500。

### P2-A: migrate CLI 默认 legacy 路径机器绑定
- 步骤：不传 `--from` 运行 migrate CLI。
- 期望：显式报参错（避免 silent no-op）。
- 实际：使用 `/Users/lysander/...` 默认路径，在其他机器上会空迁移并“成功”。

### P2-B: SignalArticleList 嵌套 button
- 步骤：渲染列表项，外层行是 `<button>`，行内状态操作也是 `<button>`。
- 期望：无交互元素嵌套，点击行为稳定且可访问。
- 实际：HTML 语义无效，可能触发点击串扰与无障碍问题。

## 3) 根因分析
- P1 根因：`SignalArticleQueryService.getArticleById/getArticleByUrl/updateArticle` 直接调用 `readArticleDocument`，异常未被降级处理。
- P2-A 根因：`migrate-signals/cli.ts` 内置绝对默认路径，掩盖了必需输入缺失。
- P2-B 根因：`SignalArticleList` 采用“整行 button + 子按钮”结构。

## 4) 修复方案与取舍
- 方案（采用）：
  - P1：查询服务对 detail/update 的文档读取失败返回 `null`，路由层统一映射 404。
  - P2-A：移除机器绑定默认路径，要求 `--from` 显式传入；缺失即返回 usage + exit 1。
  - P2-B：外层行容器改为 `div[role=button][tabIndex=0]` + 键盘可访问处理，保留内层 action buttons。
- Tradeoff：
  - P1 选择“失败即 404”而非细分错误码，优先保证 API 稳定性与最小改动。
  - P2-A 牺牲“免参便利”，换取跨机器可移植与显式失败。

## 5) 验证方式
- Red→Green：
  - API：新增坏文件场景用例，先红后绿。
  - CLI：新增“缺少 --from 必失败”用例，先红后绿。
  - Web：新增列表交互/嵌套语义测试，先红后绿。
- 回归：执行 API + Web 相关测试集与 build。
