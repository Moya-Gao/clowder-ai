---
feature_ids: [F172]
related_features: [F060, F061, F088]
topics: [image-generation, rich-block, uploads, artifact, archive, antigravity, skills]
doc_kind: spec
created: 2026-04-22
---

# F172: Generated Image Publication — 内建生图产物归档与富块发布

> **Status**: done | **Owner**: 布偶猫/opus | **Priority**: P1

## Why

目前猫用 built-in `image_gen` 生成图片时，文件默认落在 `~/.codex/generated_images/...`。图片本身能生成，但**没有自动晋升为 Cat Cafe 的一等产物**：

1. 前端 rich block / message content 的真资源链路以 `/uploads/...` 为准，`.codex` 路径不在当前 runtime 服务范围内。
2. 猫如果想展示这张图，只能靠手工把本地文件搬进当前 `uploadDir`，再自己发 `media_gallery` rich block。
3. 孟加拉猫/Antigravity 虽然本来就有图片生成能力，但其 provider 输出同样还没有接到 Cat Cafe 的统一图片 artifact 发布链路上。
4. `image-generation` / `rich-messaging` 等家里 skill 现在仍在教猫“手工搬图 + 手工写 `/uploads/...`”，这说明契约还停留在人工约定，没有下沉成基础设施。
5. jsonl / thread artifact / connector outbound 缺少统一的“生成图已发布”记录，导致“生成成功但没有归档/展示”的前端感知断裂。

铲屎官已经明确拍板方向：不要把这件事留在 skill 约定层，而要收敛成基础设施能力。

## What

### Phase A: 共享发布内核（Publication Contract）

定义统一的“生成图片发布”母线，不论图片最初来自哪里，最终都要走同一个 promotion contract：

- 输入：本地图片文件路径 + 最小 provenance（tool/provider/prompt 等）
- 输出：发布到**当前 active runtime** 的 `uploadDir`，获得稳定 `/uploads/...` URL
- 副产物：可持久化 rich block / archive / outbound 所需元数据

这层是 F172 的核心，不归属某一只猫，也不绑定某一个 provider。

核心要求：
- 发布目标必须跟随当前 runtime 的 `UPLOAD_DIR` / `getDefaultUploadDir()`，不能假设源码树里的固定目录。
- 保留原始生成路径作为 provenance，但 thread / rich block / outbound 一律消费发布后的 `/uploads/...` 路径。
- 发布是显式 artifact promotion，不覆盖已有同名文件，默认生成唯一文件名。
- 发布动作必须具备幂等性：同一张已生成图片在 provider replay / recovery / retry 下再次进入 publication contract 时，应返回同一个 published artifact，而不是重复拷贝或重复发块。

### Phase B: Codex built-in `image_gen` 接入

把 OpenAI/Codex 的 built-in `image_gen` 输出，接到 Phase A 的共享发布内核上。

目标不是只“让 Codex 能显示图”，而是让它生成的图片从一开始就是 Cat Cafe 的正式 artifact。

### Phase C: Antigravity 图片输出接入

把孟加拉猫/Antigravity 的图片生成结果，接到同一条共享发布内核上。

注意边界：
- F061 继续拥有 Antigravity provider/bridge/step taxonomy 本身
- F172 只拥有“当 Antigravity 已经生成出图片后，如何发布成 Cat Cafe artifact 并呈现”这条后半段

### Phase D: Skill 契约与使用路径收口

把家里和图片生成/展示相关的 skill 说明收口到新契约上：

- `cat-cafe-skills/image-generation`：不再把“下载到本地后手工 cp”当成终态
- `cat-cafe-skills/rich-messaging` / `refs/rich-blocks.md`：从“手工搬运指南”升级为“共享发布内核的消费规则”
- 对猫的最终使用体验是：不管走 Codex built-in、Antigravity，还是浏览器自动化生成，只要产物要进 thread，就统一晋升为 `/uploads/...` + `media_gallery`

### Phase E: 富块联动 + 归档真相源

发布完成后，统一生成可持久化的展示与记录：

- 自动附加 `media_gallery` rich block，指向发布后的 `/uploads/...`
- 将 prompt、source tool、original path、published path、mime/size 等最小 provenance 写入消息/事件归档
- 后续 connector outbound、历史重放、前端刷新都以发布后的 URL 为唯一真相源

### 非目标

- 不在本 feature 内讨论图片审美、prompt 优化、批量选图工作流
- 不改动现有 MCP `output_image` → `media_gallery` 的 F060 路径
- 不接管 F061 的 bridge 稳定性、resume、capacity retry、tool parity 等 provider 主线能力
- 不引入新的 rich block kind；继续复用 `media_gallery`

## Acceptance Criteria

### Phase A（共享发布内核）
- [x] AC-A1: 系统提供统一的 generated-image publication contract，可接收“本地图片路径 + provenance”并发布到当前 runtime 的 `uploadDir`
- [x] AC-A2: 发布结果产出稳定 `/uploads/...` URL，而不是暴露原始本地路径
- [x] AC-A3: 发布路径遵循当前 runtime 的 `UPLOAD_DIR` 解析，不依赖固定 cwd 或源码目录
- [x] AC-A4: 文件命名避免覆盖已有资源，默认生成唯一文件名
- [x] AC-A5: 相同图片在 replay / retry / recovery 场景下重复进入 publication contract 时，能幂等返回同一个 `/uploads/...` URL，且不产生重复文件或重复 rich block

#### Phase A 实施证据（2026-04-23）

- 共享图片落盘原语已抽取：`packages/api/src/utils/image-storage.ts`
- multipart 上传路径已复用共享原语：`packages/api/src/routes/image-upload.ts`
- generated-image publication contract 已落地：`packages/api/src/domains/cats/services/agents/providers/generated-image-publication.ts`
- 新增测试：
  - `packages/api/test/image-storage.test.js`
  - `packages/api/test/generated-image-publication.test.js`
- 回归测试命令（已通过）：
  - `pnpm run build`
  - `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/generated-image-publication.test.js test/image-storage.test.js test/image-upload.test.js`

### Phase B（Codex built-in 接入）
- [x] AC-B1: built-in `image_gen` 成功后，产物自动接入 Phase A 的 publication contract
- [x] AC-B2: Codex 生图消息不再停留在 `~/.codex/generated_images/...` 孤岛路径

#### Phase B 实施证据（2026-04-23）

- Codex image scanner：`packages/api/src/domains/cats/services/agents/providers/codex-image-scanner.ts`
- CodexAgentService 接线：post-invocation scan → yield `system_info` rich block before `done`
- 新增测试：
  - `packages/api/test/codex-image-scanner.test.js`（6 tests）
  - `packages/api/test/codex-agent-service.test.js` integration test（F172 case）
- 回归：42/42 codex-agent-service tests + 6/6 scanner tests all GREEN

### Phase C（Antigravity 接入）
- [x] AC-C1: Antigravity 图片生成完成后，产物可接入同一个 publication contract
- [x] AC-C2: 孟加拉猫生成的图片与 Codex 生图在 thread 中采用同一种 `/uploads/...` + `media_gallery` 呈现方式

#### Phase C 实施证据（2026-04-23）

- Antigravity image publisher：`packages/api/src/domains/cats/services/agents/providers/antigravity/antigravity-image-publisher.ts`
- AntigravityAgentService 接线：collect image paths from image-gen `toolResult` steps → publish pre-done
- Path scraping gated on `IMAGE_GEN_TOOL_NAMES` allowlist（cloud review P1 fix）; `metadata.toolCall.name` fallback（cloud review P2 fix）
- 新增测试：`packages/api/test/antigravity-image-publisher.test.js`（16 tests）
- 回归：all GREEN

### Phase D（Skill 契约收口）
- [x] AC-D1: `cat-cafe-skills/image-generation` 明确改为消费共享发布内核，不再把手工复制文件当终态
- [x] AC-D2: `cat-cafe-skills/rich-messaging` / `refs/rich-blocks.md` 更新为新的图片发布约定

#### Phase D 实施证据（2026-04-23）

- `cat-cafe-skills/image-generation/SKILL.md`：manual `cp` → `publishGeneratedImage()` auto-publish
- `cat-cafe-skills/rich-messaging/SKILL.md`：manual uploadDir copy → F172 contract
- `cat-cafe-skills/refs/rich-blocks.md`：manual copy instructions → auto-publish explanation

### Phase E（富块联动 + 归档）
- [x] AC-E1: 发布成功后，消息中自动生成 `media_gallery` rich block，展示该 `/uploads/...` 图片
- [x] AC-E2: 消息持久化 / jsonl / thread replay 使用发布后的 URL，可刷新后继续显示
- [x] AC-E3: 归档中保留最小 provenance：provider/tool、prompt、originalPath、publishedPath
- [x] AC-E4: connector outbound 在遇到该图片消息时，走现有 `/uploads/...` 媒体投递链路，无需额外特判 provider 私有路径
- [x] AC-E5: 发布后的图片默认仅以 `media_gallery` rich block 作为 canonical 呈现路径；不为同一张图再额外复制一份 image `contentBlocks` 造成上下文和存储重复

#### Phase E 实施证据（2026-04-23）

- AC-E1: Phase B/C 的 `system_info` yield 自动生成 `media_gallery` rich block
- AC-E2: `route-serial.ts` 既有管线 — `streamRichBlocks[]` → `allRichBlocks` → `extra.rich.blocks[]` 持久化
- AC-E3: provenance 对象（provider/toolName/prompt/originalPath/publishedPath）嵌入 `system_info` content
- AC-E4: `persistenceContext.richBlocks` 传递给 connector outbound（F088）
- AC-E5: 仅 `media_gallery` rich block，无重复 contentBlocks

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | “生成的图片我记得位置是在 user 下面的 .codex 并没有归档的” | AC-A1, AC-A2, AC-B2 | manual + test | [x] |
| R2 | “基础设置帮你生成的图片自动放过来” | AC-A1, AC-A3, AC-A4 | test | [x] |
| R3 | “包括孟加拉他的图片生成我估计也得对接到你这套基础设施” | AC-C1, AC-C2 | integration test | [x] |
| R4 | “这样你们生成完成之后 两只猫都能够直接呈现给我” | AC-B1, AC-C2, AC-E1 | manual + integration test | [x] |
| R5 | “图片生成 skills 也得挂在 F172 这里进行优化” | AC-D1, AC-D2 | doc + skill test | [x] |
| R6 | 能自动把你产出的图片归档 + 用富文本呈现 | AC-E2, AC-E3 | test + manual | [x] |
| R7 | 既有 rich block / connector 媒体链路继续复用 | AC-E4 | integration test | [x] |
| R8 | provider 恢复 / replay 时不应重复堆积图片文件或重复发块 | AC-A5, AC-E5 | integration test | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（若适用）

## Dependencies

- **Evolved from**: F060（已解决 MCP `output_image` 自动转 `media_gallery`，但未覆盖多 provider 的生成图 artifact publication）
- **Related**: F061（孟加拉猫 provider 本身继续拥有图片生成能力与 bridge 主线；F172 只接它的图片发布后半段）
- **Related**: F088（`/uploads/...` 是 connector outbound 的媒体真相源）

## Risk

| 风险 | 缓解 |
|------|------|
| 发布到了错误的 uploadDir，前端仍然裂图 | 统一走 `getDefaultUploadDir()` / runtime `UPLOAD_DIR`，并增加验证测试 |
| 把 provider 主线能力和 artifact 发布层搅混，scope 失控 | 明确 F172 只管图片生成后的 publication contract，F061/F088 继续拥有各自主线 |
| 只解决前端展示，没解决历史归档/重放 | Phase B 明确要求持久化 published URL + provenance |
| provider replay / recovery 造成重复拷贝、重复 rich block、文件堆积 | publication contract 以原始路径 + provider step signature / provenance 做幂等键，重复命中直接返回已发布结果 |
| prompt / 原始路径等元数据泄露过多 | provenance 只保留最小必要字段，不回流敏感上下文 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | built-in `image_gen` 的完成事件在哪一层最稳妥地拿到原始文件路径？provider transform / harness 还是更外层？ | ✅ 已解决：post-invocation filesystem scan（`codex-image-scanner.ts`），在 `CodexAgentService.invoke()` 的 stream 结束后、yield done 前扫描 `~/.codex/generated_images/<sessionId>/` |
| OQ-2 | Antigravity 的图片生成完成信号/文件落点从哪个已完成 tool step / artifact 通道最稳妥拿？需要确认 toolName、toolResult shape 与绝对路径来源 | ✅ 已解决：仅从 `step.toolResult.output` 提取绝对图片路径，且 step 必须命中 `IMAGE_GEN_TOOL_NAMES` 白名单（`image_gen` / `generate_image` / `create_image`，cloud review P1 fix 砍掉了 `runCommand.stdout` 通配扫描以避免误抓）。batch loop 中收集，invocation 结束前 mtime 校验 + 幂等发布（`antigravity-image-publisher.ts:32-41`、`:60-93`） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新开 F172，不回填到 F060 | F060 已闭环且边界明确为 MCP `output_image` 自动渲染；本需求新增 artifact publication / archive / outbound 语义，scope 更大 | 2026-04-22 |
| KD-2 | 继续复用 `media_gallery`，不新增图片块类型 | 现有前端与 outbound 已围绕 `/uploads/...` + `media_gallery` 打通，新增类型只会制造第二套链路 | 2026-04-22 |
| KD-3 | F172 覆盖 Codex built-in、Antigravity、repo-local skills 三个入口，但只统一“生成完成后的图片发布链路” | 铲屎官明确要求两只猫都能直接呈现；真正共享的不是各自的生图方式，而是 artifact publication contract | 2026-04-22 |
| KD-4 | 发布后的图片默认只写 `media_gallery` rich block，不重复写 image `contentBlocks` | rich block 已足以覆盖前端展示、history replay 与 F088 outbound；重复写 contentBlocks 只会制造上下文与存储重复 | 2026-04-22 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 | Kickoff：铲屎官确认采用“基础设施自动归档到 `/uploads/...` + 自动富块展示”方向，并同意立项为独立 feature |
| 2026-04-22 | Scope 扩展：确认 F172 同时覆盖 Codex built-in、Antigravity、以及 repo-local 图片相关 skills 的契约收口，但不吞并 F061/F088 主线 |
| 2026-04-22 | 孟加拉猫只读反馈：补充 publication contract 幂等要求；收敛为 `media_gallery` 单一路径，不重复写 image contentBlocks |
| 2026-04-23 | Phase A merged（PR #1353）：共享 publication contract + image-storage 原语 |
| 2026-04-23 | Phase B-E merged（PR #1355）：Codex scanner + Antigravity publisher + skill 收口 + 富块联动。砚砚 review 放行 + 3 轮云端 review（2 P1 + 2 P2 全修） |

## Review Gate

- Phase A: 重点 review publication contract 形状、uploadDir 解析、路径安全、唯一文件名策略
- Phase B/C: 重点 review 两个 provider 接入是否都真正走到同一条 shared contract
- Phase D/E: 重点 review skill 文档是否与运行时契约一致，以及 rich block 持久化 / history replay / connector outbound 回归

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F060-output-image-rich-block.md` | 已有 MCP 图片自动渲染能力，本 feature 从其演化 |
| **Feature** | `docs/features/F061-antigravity-bengal-cat.md` | 孟加拉猫 provider 主线；F172 只接图片发布后半段 |
| **Feature** | `docs/features/F088-multi-platform-chat-gateway.md` | `/uploads/...` 媒体链路与 outbound 真相源 |
| **Skill** | `cat-cafe-skills/image-generation/SKILL.md` | 当前仍以“下载后人工处理”为主，需要按 F172 收口 |
| **Skill** | `cat-cafe-skills/rich-messaging/SKILL.md` | 当前包含本地图片手工搬运说明，需要改成消费共享发布内核 |
| **Code** | `packages/api/src/utils/upload-paths.ts` | 当前 uploadDir 真相源 |
| **Code** | `packages/web/src/components/rich/MediaGalleryBlock.tsx` | 当前 media gallery 渲染入口 |
