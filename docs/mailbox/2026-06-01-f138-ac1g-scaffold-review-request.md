---
feature_ids: [F138]
topics: [video, scaffold, review-request]
doc_kind: review-request
created: 2026-06-01
---

# Review Request: F138 AC-1g video:new scaffold command

Review-Target-ID: f138-garden-skills-absorption
Branch: feat/f138-garden-skills-absorption

## What

新增 `pnpm video:new <slug> --type --style` scaffold 命令，一键创建视频项目目录和模板文件（brief.md / voice-script.md / asset-markers.md / video-spec.json / assets/）。

核心变更：
- `scripts/video-forge/new-project.mjs` — scaffold 实现（~250 行）
- `test/scripts/video-new-project.test.mjs` — 13 个测试
- `package.json` — 新增 `video:new` 和 `check:video-new` script

## Why

Garden-skills 吸收方案 KD-15 的 P0 项。学习 garden-skills 的 scaffold 一键起手体验，但保留 F138 核心架构（全局音频 KD-12、forced alignment KD-10、video-spec 中枢 KD-4）。

模板文件结构完全对齐现有 showcase-60s 项目，生成的 video-spec.json 可直接接入 pipeline.sh。

## Original Requirements（必填）
> "还是想聊怎么把 garden-skills 里好的部分吸收进！！" — 铲屎官，2026-06-01
> "我觉得ok 排进 F138 下一个 Phase。" — 铲屎官，2026-06-01
> "那你直接开wktree和砚砚完成闭环？" — 铲屎官，2026-06-01

- 来源：当前 thread 讨论（F138 garden-skills absorption）
- 铲屎官拍板吸收方案并要求开 worktree 闭环
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 没有把 garden-skills 的 `narrations.ts` 作为降级模式引入——砚砚在讨论中修正：不新增并列真相源，约束思想升级编译进现有 spec（beat_ledger，AC-1h 后续做）
- 没有引入 garden-skills 的逐 step TTS / 浏览器录屏——与 KD-12 全局音频原则冲突
- `--style` 目前只存值不做任何验证——reserved for AC-1i style-recipes

## Architecture Ownership（必填）

Architecture cell: video-forge-pipeline（scripts/video-forge/）
Map delta: none
Why: 新增独立 scaffold 脚本，不改动现有 pipeline.sh / generate-spec.py / tts.py / align.py，不影响运行时架构

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. voice-script.md 模板的 `estimated_duration_sec: 60` 和 `char_count_target: 270` 是硬编码的合理默认值，还是应该也通过 --flag 参数化？
2. video-spec.json 的 `global_audio.speaker_id` 默认 `opus`，是否应该支持 `--speaker` flag？

### 价值 OQ（给 CVO，如有）

无——scaffold 工具是纯 DX 提升，回滚成本零。

## Next Action

请 review 代码质量、模板内容与 showcase-60s 的一致性、测试覆盖度。通过后我走 merge-gate 合入。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f138-garden-skills-absorption/codex`
- Start Command: 无需启动服务——纯 CLI 脚本，`node --test test/scripts/video-new-project.test.mjs` 即可验证
- Ports: N/A（不涉及 web/api 服务）

## 自检证据

### Spec 合规

- AC-1g 要求"scaffold 命令可用" ✅
- 模板对齐 showcase-60s 结构 ✅（voice-script.md frontmatter / asset-markers.md doc_kind / video-spec.json schema）
- KD-12 全局音频：模板明确写"CosyVoice 全局一次性读完，不分段" ✅
- KD-10 forced alignment：模板引导走 pipeline.sh（FA 在 step 3）✅
- KD-4 video-spec 中枢：生成的 spec 与 showcase-60s 同构 ✅
- Idempotency guard：拒绝覆盖已有项目 ✅

### 测试结果

```
pnpm check:video-new   # 13 passed, 0 failed
pnpm biome check       # 0 errors (lint clean)
```

### 根目录工件闸门

```
git status --short | rg '^.. [^/]+\.(png|...)$'  # 无输出
git diff --name-only origin/main...HEAD | rg ...  # 无输出
```

### 相关文档

- Feature: F138 Video Studio（`docs/features/F138-video-studio.md`）
- KD-15: garden-skills absorption strategy
- PR: #2032

### 如果我判断错了，最可能错在哪

1. 模板 frontmatter 字段名与现有约定有细微不一致（我手对了 showcase-60s 但可能漏了其他视频项目的约定）
2. `parseArgs` 在某些 Node.js 版本的 edge case 行为不同（只测了 v24）
3. voice-script 模板的"须知"段落措辞可能与 video-forge SKILL.md 不完全一致
