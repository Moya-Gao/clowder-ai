# Plan: Web Paste Image Codex-Only Routing

> Date: 2026-02-15  
> Owner: 缅因猫/砚砚  
> Scope: Cat Café Web pasted image message routing

## Background

用户希望在 Web 中直接粘贴图片后，不需要关心图片落盘路径，也不需要手动 `@` 指定猫。系统应自动把图片请求交给缅因猫（Codex）处理。

## Goals

1. Web 粘贴图片后，消息在后端仍可正常上传、落盘、入库。
2. 带图片消息的执行目标强制为 `codex`。
3. 即使多猫链路触发，图片二进制上下文（`contentBlocks` + `uploadDir`）只传给 `codex`，其他猫仅接收文本内容。
4. 保持无图消息现有路由行为不变。

## Non-goals

1. 不修改前端粘贴交互（现有 paste + multipart 流程保持不变）。
2. 不引入新的附件元数据模型（本次继续使用现有 `contentBlocks`）。
3. 不改变 Claude/Gemini 各自 CLI 的图片参数策略（本次仅改路由层）。

## Acceptance Criteria

1. `POST /api/messages` 的 multipart 带图请求，在 router 执行时目标猫为 `['codex']`。
2. `routeParallel` 在 `contentBlocks` 含 `image` 时，仅 `codex` 收到 `contentBlocks/uploadDir`。
3. `routeSerial` 在原始目标包含多猫时，仅 `codex` 收到 `contentBlocks/uploadDir`。
4. 回归测试通过：
   - `test/image-upload.test.js`
   - `test/route-strategies.test.js`

## Implementation Notes

1. `packages/api/src/routes/messages.ts`
   - 在解析完 `contentBlocks` 后，根据是否含图片重写 `targetCats` 为 `['codex']`。
2. `packages/api/src/domains/cats/services/route-strategies.ts`
   - 提供 `routeContentBlocksForCat()`，仅对 `codex` 透传图片块。
   - `uploadDir` 与 `contentBlocks` 同步透传，避免非 codex 猫读取图片路径。

