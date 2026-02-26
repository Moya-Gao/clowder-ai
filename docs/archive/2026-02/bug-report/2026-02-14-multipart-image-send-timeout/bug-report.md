---
feature_ids: []
topics: [multipart, image, send]
doc_kind: bug-report
created: 2026-02-14
---

# Bug Report: 图片消息发送后刷新消失（multipart 请求卡住）

## 1. 报告人
- 报告人：铲屎官（2026-02-14）
- 发现方式：在 `thread_mlmwlpvunuzv181h` 里发送“带图片 + @三猫”后，界面先出现消息，刷新后消息消失；随后发送纯文本可正常触发“独立观点采样中”。

## 2. 复现步骤（期望 vs 实际）
1. 在任意 thread 输入文本并附带图片，点击发送。
2. 观察 UI 先出现用户消息气泡（含图片预览）。
3. 刷新页面。

期望：
- 带图消息应落库并在刷新后仍可见；
- 后端应及时返回 `POST /api/messages`，并触发后续猫猫调用流程。

实际：
- 带图消息刷新后消失；
- 同 thread 的纯文本消息可以正常落库和触发调用；
- 通过 `curl` 复现：`multipart POST /api/messages` 超时无响应，而 JSON `POST /api/messages` 立即返回 200。

## 3. 根因分析
- `parseMultipart` 当前实现先 `for await` 收集 `MultipartFile` 对象，循环结束后才统一 `toBuffer()`。
- 在 Fastify multipart 流模型下，文件 part 必须在遍历期间被消费；否则迭代可能阻塞，导致路由长时间不返回。
- 结果是：前端只保留 optimistic 临时消息，后端未完成持久化；刷新后消息消失。

## 4. 修复方案（含取舍）
选型：
- 在 `parseMultipart` 中“边遍历边消费”文件流：遇到 file part 立即 `await part.toBuffer()`，并把缓冲后的 file wrapper 传给现有 `saveUploadedImages`。

为什么选这个方案：
- 最小改动，保持现有 `saveUploadedImages`、`messages` 路由和 contentBlocks 结构不变；
- 直接修复阻塞点，不引入新的协议或存储格式。

放弃方案：
- 方案 A：重写上传链路为先上传后发消息（代价大，涉及前端协议与状态机重构）。
- 方案 B：仅在前端增加超时/重试（不能解决后端 multipart 卡住的根因）。

## 5. 验证方式
- 新增回归测试：构造“file part 之后还有 field part”的 multipart 迭代器，验证解析函数不会卡住且能拿到 `threadId + image contentBlock`。
- 执行相关 API 测试，确保新增用例先红后绿。
- 手工对照：
  - `curl` multipart `POST /api/messages` 从超时变为及时返回；
  - 同 thread 刷新后仍能看到带图消息。
