---
doc_kind: research-note
topics: [yoyoung-shorts, open-source-teardown, video-generation, short-drama-workflow]
created: 2026-06-21
status: draft
source_repo: https://github.com/rolfie-han/yoyoung-shorts
source_commit: 6f3cab90bb717ba1a5e26cbb84f27eee59779058
authored_by: codex
covers: [architecture, star-features, algorithms, comparison]
---

# YoYoung Shorts Deep Dive

## 0. Scope

- User question: 看 `rolfie-han/yoyoung-shorts` 怎么做 AI 短剧工作流，我们能不能学到东西。
- Project: YoYoung Shorts 优漾短剧。
- Source repo: <https://github.com/rolfie-han/yoyoung-shorts>
- Local path: `/Users/lysander/projects/ref/yoyoung-shorts`
- Commit: `6f3cab90bb717ba1a5e26cbb84f27eee59779058` (`2026-06-20 10:23:14 +0800`, `Refine showcase assets and prompt examples`)
- Latest release checked: `v2.0.1`, published `2026-05-30T15:23:43Z`, asset `docker-local-package-thin-bundle.zip`, SHA-256 `e4c765beb3f92e49568db65b355560df5a1ffc70df43c5e3399af4c1f7021573`.
- Public community surface checked: GitHub API returned 0 open issues and 0 open PRs at time of teardown.

Boundary: this is not a full source-code teardown. The repo and license notice explicitly say the full product source, backend, model routing, API key management, license/billing/admin internals, and commercial orchestration are not public. The release package is a thin frontend/Nginx package connected to a cloud backend. I inspected public docs, screenshots, config, package file names, and the release shell. I did not reverse-engineer minified frontend chunks.

## 1. Claim Ledger

| Claim | Public source | Evidence paths | Verdict | Caveat |
|---|---|---|---|---|
| It is a short-drama creation workspace, not just a model launcher | README and FEATURES present the chain from idea to assets, storyboard, images, video, history | `README.md:5-20`, `FEATURES.md:7-33` | Supported at product/workflow-description level | Backend implementation is not public |
| Source code is not open | README and license notice say this directly | `README.md:16`, `LICENSE-NOTICE.md:13-31`, `LICENSE-NOTICE.md:58-64` | Verified | Treat this as a public showcase repo, not an OSS runtime |
| Docker local package is a thin frontend shell | Release package README, Dockerfile, compose, quickstart | release `README.md:1-15`, `Dockerfile:1-6`, `docker-compose.yml:1-22`, quickstart `:1-4` | Verified | Local run still needs `CLOUD_BACKEND_ORIGIN` |
| Heavy generation APIs are cloud-proxied | Nginx config proxies generation routes to `${CLOUD_BACKEND_ORIGIN}` | release `deploy/nginx/local-package-thin.conf.template:24-114` | Verified | It does not reveal cloud implementation |
| User project state is in browser frontend | Release README and quickstart say frontend stores user project data | release `README.md:24-32`, quickstart `:36-40` | Verified | Persistence is weaker than Git/file-backed team workflow |
| Core creative chain is Create -> Story -> Script -> Video -> History with Assets feeding through | FEATURES says this explicitly; screenshots show the same stage rail | `FEATURES.md:117-125`, screenshots in `assets/v2-showcase/` | Supported | Exact state schema is not public |
| Asset anchors store structured prompt material | README and FEATURES describe character/scene/prop prompt structures; screenshots show prompt cards | `README.md:160-168`, `FEATURES.md:89-101`, `asset-prompt-character-light.png` | Supported at UX level | Not enough evidence for the prompt-building algorithm |
| Storyboard and video stages are per-shot workbenches | Screenshots show shot cards, locked assets, first-frame preview, video batch output | `storyboard-generation-dark.png`, `video-output-dark.png`, `showcase-script-to-video.png` | Supported at UX level | Runtime behavior not independently reproduced |

## 2. Architecture Map

```text
public showcase repo
  README / FEATURES / CASES / preview pages
  screenshots + demo media
  releases/v2.0.0 zip mirror

latest v2.0.1 release package
  Dockerfile -> nginx:1.27-alpine
  app/ -> prebuilt static frontend shell
    visible chunks: ShortDramaAgentView, ScriptView, StoryModeView,
      AssetCenterView, VideoGenerationView, ScriptVideoOutputView,
      ScriptVoiceWorkbenchView, TimelineEditor, HistoryView, SettingsView
  deploy/nginx/local-package-thin.conf.template
    /api/v1/persist_asset -> CLOUD_BACKEND_ORIGIN
    /api/v1/generate_image_pipeline -> CLOUD_BACKEND_ORIGIN
    /api/storyboard-to-video -> CLOUD_BACKEND_ORIGIN
    /api/v1/extras/ -> CLOUD_BACKEND_ORIGIN
    /api/v1/describe_image_pipeline -> CLOUD_BACKEND_ORIGIN
    /api/, /static/, /upload, /health, /readiness -> CLOUD_BACKEND_ORIGIN
  browser frontend state
    README says user project data is stored by browser frontend
  cloud backend
    private: model routing, persistence internals, orchestration, keys
```

Entrypoints:

- Public docs: `README.md`, `FEATURES.md`, `CASES.md`, `preview.html`, `full-preview.html`.
- Local package: `docker compose up -d --build` serving static frontend via Nginx.
- Runtime API boundary: Nginx proxies all `/api/*` and large generation routes to a configured cloud origin.

State stores:

- Public repo: no database or local backend source.
- Thin package: browser frontend project state; no local backend data volume.
- Cloud backend: private.

Extension points:

- Publicly visible provider hints are product-level only, not stable APIs. Screenshot labels show model/provider choices such as `doubao-seedance-2.0-fast-260128`, and bundle names include `volcengineService`, but this is not enough to claim a reusable provider plugin system.

Empty / placeholder dirs:

- No empty directories in the public repo clone.

## 3. Star Feature Deep Dives

### 3.1 Project Stage Rail

Public API / command: product workspace, not code API. Screenshots show an 8-step rail:

```text
创建项目 -> 导入剧本 -> 剧本解析 -> 资产建档 -> 分集制作 -> 分镜生成 -> 图片生成 -> 视频生成
```

Core modules visible in release chunk names:

- `ShortDramaAgentView`
- `GuidedProjectHome`
- `ProfessionalStudioHome`
- `ScriptView`
- `StoryModeView`
- `VideoGenerationView`
- `HistoryView`

State mutation:

- Public docs say project state is browser-fronted in the thin package. The real production state mutation likely happens in cloud APIs, but code is not public.

Future behavior:

- The rail makes the next action obvious. This is the main product idea worth copying: every generated artifact becomes the input to the next stage instead of a dead-end download.

Verdict:

- Strong UX pattern. Not an open implementation.

### 3.2 Asset Anchor System

Public API / command: Assets / material library and asset prompt cards.

Observed surface:

- Character/scene/prop assets are treated as reusable anchors.
- Asset prompt cards include identity, face features, hair/outline, clothing/material, spatial structure, visual anchors, continuity rules, and prop shape/material/proportion.
- Storyboard cards show locked people, spaces, and props attached to a shot.

State mutation:

- At minimum, browser/cloud project state records selected/locked assets. Screenshot labels show `人物锁定`, `空间锁定`, `道具锁定`.

Future behavior:

- Later Story, Script, Image, and Video stages can reuse those locked assets. This is the strongest match to our current Cat Café video pain: character DNA, props, and scene continuity should be first-class records, not scattered prompt prose.

Tests:

- No public tests.

Verdict:

- Learn. We should formalize our own asset registry for each episode.

### 3.3 Shot Workbench

Public API / command: Script / storyboard page.

Observed surface:

- Per-shot tabs: shot information, voice/dubbing, prompt.
- Per-shot fields: shot description, dialogue/narration, appearing characters and scene, first-frame preview, regenerate image, enter video output.
- Screenshot shows `8 / 30` current-shot navigation, progress indicator, and per-shot acceptance state.

State mutation:

- Shot metadata and generated first frame become downstream video inputs.

Future behavior:

- The user can move from a shot to video generation without rebuilding context. This is the missing product affordance in our current `docs/videos/cucu-pr-flow`: we have the data in Markdown, EDL scripts, assets, and roll logs, but not one shot-level workbench surface.

Verdict:

- Learn. Build a manifest/schema first, UI later.

### 3.4 Video Batch Output

Public API / command: Video output page, Nginx route `/api/storyboard-to-video`.

Observed surface:

- Per-shot video cards with image, description, status, and generate button.
- Batch controls: all/to-generate/completed counts, generate remaining shot videos.
- Shared video parameters: model, resolution, aspect ratio, duration, camera motion, dynamic prompt, generation strategy.

State mutation:

- Each shot transitions independently from waiting to completed. It can be previewed and compared.

Future behavior:

- Video results should flow to a result preview/edit/history stage.

Verdict:

- Learn. Our current i2v workflow should track per-shot provider, prompt version, accepted take, failure mode, source audio policy, and generated file path in a manifest rather than only in prose.

### 3.5 Voice / Audio Surface

Public API / command: Audio/voice workbench is visible in sidebar and release bundle chunk names.

Observed surface:

- Sidebar contains `语音配音 / AUDIO`.
- Bundle includes `ScriptVoiceWorkbenchView`, `scriptVoiceService`, `voiceBindingService`, `voiceCatalog`, and `volcengineService` file names.

State mutation:

- Not auditable from public source.

Future behavior:

- Likely binds voices to script/dialogue, but this is a product-surface inference only.

Verdict:

- Weak evidence, but directionally relevant. For Cat Café, audio should be a first-class per-shot lane: source ambience policy, BGM, SFX, TTS/real voice, subtitle line, and mix verdict.

## 4. Algorithm Peel Table

| Mechanism | Input | Output | Type | Code path | Mutates future behavior? |
|---|---|---|---|---|---|
| Script parsing into production structure | Script text / story idea | Characters, scenes, props, shots | External service / LLM orchestration, not public | cloud route not public; public docs only | Yes at UX level, implementation unverified |
| Asset prompt structuring | Character/scene/prop concepts + generated/reference images | Reusable prompt cards | Prompt template / heuristic / LLM, not public | screenshots + docs; no source | Yes at UX level |
| Multi-frame story generation | Episode/scene context + locked assets | Multiple continuous images | External image generation service | `/api/v1/generate_image_pipeline` proxied | Yes if images feed Script/Video |
| Image describe / refinement | Image input | Description/prompt metadata | External service | `/api/v1/describe_image_pipeline` proxied | Probably, but unverified |
| Storyboard-to-video | First frame + dynamic prompt + parameters | Shot video | External video generation service | `/api/storyboard-to-video` proxied | Yes, output enters video/history stage |
| Persist asset | Generated/uploaded media | Asset entry | CRUD/persistence | `/api/v1/persist_asset` proxied | Yes |
| History | Generated images/videos | Reusable history entries | Product state / CRUD | browser/cloud state, not public | Yes |
| Quality improvement | User feedback / retries | Better future generations | Not proven | no public eval/learning loop | Not proven |

## 5. Feedback Loops

| Claimed loop | Signal | Decision | State mutation | Future behavior | Verdict |
|---|---|---|---|---|---|
| Idea/script to production chain | User input script/story | Parse into structured assets/shots | Project state updated | Later asset/storyboard/video stages can continue | Plausible and well surfaced, code private |
| Asset reuse | Selected character/scene/prop | Lock asset into shot | Shot references asset | Later image/video generation gets stable anchors | Strong UX evidence |
| Shot iteration | Bad first frame/video | Regenerate / edit prompt / choose strategy | Shot artifact changes | Next stage uses revised artifact | Strong UX evidence, algorithm private |
| History reuse | Generated artifact exists | Save/view/reuse | Browser/cloud history entry | Future episodes/shots can reuse | Plausible, storage boundary weaker |
| Automatic quality learning | Failed generations | System learns | Model/prompt policy changes | Future generation improves automatically | Not shown |

## 6. Cat Café Comparison

| Dimension | YoYoung Shorts | Cat Café `cucu-pr-flow` now | Learn / Gap / Do Not Follow | Agent User Fit | Reason |
|---|---|---|---|---|---|
| Episode state model | Product rail with explicit stages | `episode-brief`, `shot-plan`, EDL scripts, assets directory | Learn | L1 yes / L2 partial / L3 partial | We have truth files but no single stage manifest |
| Asset continuity | First-class characters/scenes/props with prompt cards | Character DNA in brief + scattered prompt book/assets | Gap | L1 partial / L2 partial / L3 yes through files | We should create episode asset registry with accepted/rejected visual anchors |
| Shot workbench | Each shot has description, dialogue, assets, first frame, video action | Shot table + EDL + roll log across files | Learn | L1 partial / L2 yes / L3 yes | Our files are verifiable, but not ergonomic |
| Batch video generation | Per-shot status and shared video params | Manual i2v waves and animatic builder | Gap | L1 partial / L2 yes / L3 yes | A manifest can drive batch scripts and review |
| Audio lane | Visible audio/voice lane, not deeply auditable | We recently added source ambience beds, TTS, SFX, BGM policy in code | Learn | L1 yes / L2 yes / L3 yes | We are stronger technically, but need product-facing audio lane/status |
| Persistence | Browser frontend + private cloud | Git/docs/scripts/media files | Do Not Follow | L1 yes / L2 stronger / L3 stronger | Browser-only state is not enough for multi-cat provenance |
| Backend openness | Not public | Our pipeline files are in repo | Do Not Follow | L2 stronger | We should not hide the orchestration from future cats |
| Product feel | Creator-friendly stage rail | Engineer-friendly docs/scripts | Gap | L1 partial | Landy needs a quick visual surface to know what remains |

## 7. Lessons / Next Steps

Candidate lessons:

1. Short-drama production wants a project state machine, not just a list of generated files.
2. Character/scene/prop continuity should be an asset registry with prompts, references, accepted images, rejected attempts, and downstream shot links.
3. Every shot should be a small production unit: description, dialogue/subtitle, locked assets, first frame, video prompt, duration, audio policy, current artifact, verdict, failure modes.
4. Audio needs the same status discipline as image/video. Recent Cat Café pain around missing source ambience is exactly what a first-class audio lane prevents.
5. Do not copy their persistence boundary. For our team, Git/file provenance is a feature because future cats can re-observe and verify.

Concrete Cat Café follow-up:

1. Add `docs/videos/cucu-pr-flow/production-manifest.json` or `.yaml` as the single machine-readable episode state.
2. Add an `assets/registry.yaml` with `characters`, `scenes`, `props`, `audio_beds`, and links to accepted/rejected artifacts.
3. Teach the animatic builder to read source audio policy, first-frame/video status, and subtitle/SFX anchors from the manifest.
4. Optionally make a static `workbench.html` that renders shot cards from the manifest. Do this after the schema, not before.
5. Keep the existing roll log and FM taxonomy; YoYoung's visible product rail should sit above our evidence discipline, not replace it.

Follow-up question for CVO:

- Do we want the next implementation step to be a lightweight production manifest for `cucu-pr-flow`, or do we first want a broader anime-forge schema that can serve future episodes too?

---

拆解结论 by 砚砚/GPT-5.5🐾
