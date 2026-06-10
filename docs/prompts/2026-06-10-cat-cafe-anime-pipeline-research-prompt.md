---
topics: [anime, video, pipeline, story-to-video, tts, subtitles, github, open-source]
doc_kind: prompt
created: 2026-06-10
source: docs/research/2026-06-10-cat-cafe-anime-pipeline/cloud-research-mode-b-consult.md
related_features: [F138]
---

# Research Brief: Cat Cafe Anime Short Series Production Pipeline

We are Cat Cafe, a multi-agent AI collaboration project with recurring characters ("cats") and a growing internal story world. We want to turn our own stories into short anime-style episodes. Each episode is likely 2-3 minutes long, but current AI video generators often produce short clips only, around 8-10 seconds per generation depending on model/product. So we expect a production pipeline based on many short generated clips, editing, voice, subtitles, continuity control, and QA rather than one single long generation.

Please do deep current research on GitHub, open-source projects, public workflows, model tooling, and "agent skills" or workflow repos for producing AI-generated narrative videos, especially anime / story-to-video / multi-shot short films.

## 1. Problem Frame

**Question to answer**:
What practical, evidence-backed production pipeline should Cat Cafe build for 2-3 minute anime short episodes made from our story scripts, given that video generation is clip-limited and we need stitching, voice acting, subtitles, and character/style continuity?

**Non-goals**:
- Do not design a generic "marketing shorts" system unless parts directly transfer to narrative anime episodes.
- Do not assume a single model can produce the full 2-3 minute episode end to end.
- Do not propose copying code from incompatible licenses. Architecture learning is fine; direct code reuse must respect license.
- Do not only list shiny model demos. We need pipeline engineering evidence.

**Why now**:
We already have a Cat Cafe video pipeline feature (F138 Video Studio) for tutorial/showcase videos. We now need to extend the thinking to generated anime narrative shorts.

## 2. Our Current Local Constraints and Hypotheses

Existing local video principles from F138 / video-forge:

1. **Spec-first**: a video spec / segment contract should be the source of truth. Prompts should not become the only source of truth.
2. **Global voice first**: for narration/dialogue continuity, generate full-scene or full-episode audio where possible, then use forced alignment for timestamps. Avoid slicing TTS line by line unless there is a strong reason.
3. **Forced alignment over native TTS timestamps**: use tools like Qwen3-ForcedAligner, WhisperX, stable-ts, aeneas, or other validated aligners to derive subtitle/word/line timings.
4. **Renderer decoupling**: keep contracts independent from Remotion / FFmpeg / MoviePy / DaVinci Resolve scripting. Remotion + FFmpeg are current preferred render targets, but should be replaceable.
5. **Retiming hierarchy**: when video duration and audio duration mismatch, prefer trim, stylized freeze, B-roll, inserts, or re-generation before ugly slow motion.
6. **Human-in-the-loop**: the human CVO approves story/world/character decisions and reviews episodes; agents can propose and execute reversible pipeline work.
7. **Multiple recurring characters**: we need character identity, voice identity, and relationship continuity across episodes.

Initial hypotheses to verify or disconfirm:

1. The realistic pipeline is **script -> episode beat sheet -> shot list -> keyframes/reference frames -> short video clips -> edit decision list -> voice/subtitle alignment -> render -> QA**, not "prompt -> long video".
2. Character consistency will require a **character bible + reference sheets + per-character visual anchors**, possibly LoRA / IP-Adapter / reference image / ComfyUI workflows / provider-specific reference controls, not just text prompts.
3. For 2-3 minute episodes, a stable first MVP should generate **key frames and short clips per shot**, then compose them using normal editing primitives. Scene extension can help but should not be the only plan.
4. The most reusable open-source value may come from pipeline/orchestration projects, subtitle/dubbing tools, and ComfyUI workflows, not only from text-to-video model repos.
5. A Cat Cafe-specific skill may be worth building: `anime-video-forge`, reusing video-forge's contract/gate style but adding story bible, character bible, prompt packs, continuity QA, and generated clip inventory.

Please actively try to disprove these hypotheses.

## 3. Source Mix Requirements

Use current sources, preferably primary sources:

- GitHub repos and README/design docs
- Official docs for video generation products and APIs
- Open-source workflow collections, especially ComfyUI / Wan / HunyuanVideo / LTX / AnimateDiff / ControlNet / IP-Adapter / LoRA style pipelines if relevant
- Engineering blogs or real production retrospectives
- Academic or research papers only if they map to practical workflow decisions
- Creator workflow writeups only if they include reproducible technical steps

Start from these candidate areas, but do not stop here:

- Agentic video production systems such as OpenMontage or similar
- Story-to-video / novel-to-video / idea-to-video repos such as ViMax or similar
- AI shorts / video automation systems such as ShortGPT, OpenShorts, or similar
- Dubbing/subtitle/localization tools such as KrillinAI, pyVideoTrans, FunClip, WhisperX/stable-ts/aeneas-style aligners
- Remotion subtitle/rendering discussions and plugins
- ComfyUI workflow repos and custom nodes for character consistency, keyframe-to-video, image-to-video, and multi-shot workflows
- Current official limitations and extension mechanisms for tools like Gemini/Veo/Flow, Runway, Kling, Luma, Pika, Seedance, Wan, HunyuanVideo, LTX, etc.

For every repo/tool that enters the conclusion, include:
- URL
- license
- last meaningful activity or release recency
- maturity signal: stars/users/issues/docs/demo quality if available
- what it actually solves
- what it does not solve
- whether Cat Cafe can reuse code, reuse architecture only, or should avoid it

## 4. Specific Research Questions

1. **Long-form strategy**: What are the current practical ways to make 2-3 minute narrative videos from short generations? Compare clip stitching, scene extension, keyframe control, image-to-video chains, and conventional editing.
2. **Character continuity**: What currently works for recurring character consistency in anime-style video? Investigate character sheets, reference images, LoRA, IP-Adapter/reference adapters, pose/camera control, ComfyUI workflows, provider-specific reference modes, and their failure modes.
3. **Shot planning**: How should a story script be transformed into beat sheet, shot list, keyframes, prompts, negative prompts, camera moves, and clip manifests? Find examples or repos that encode this well.
4. **Voice and dialogue**: What open-source or practical TTS/voice-cloning approaches support multiple recurring characters, Chinese/English if relevant, emotion control, and commercial/ethical constraints? How should full-episode audio vs per-line audio be handled?
5. **Subtitle and alignment**: Which tools are reliable for word/line timing, subtitles, karaoke-style captions, and audio-video sync? What formats should the pipeline use: SRT, ASS, WebVTT, JSON cues, EDL, or Remotion input props?
6. **Editing/rendering**: Compare Remotion, FFmpeg/MoviePy, DaVinci Resolve scripting, Blender, and web-canvas/render approaches for compositing generated clips, subtitles, transitions, B-roll, and freeze-frame inserts.
7. **Quality gates**: What automated or semi-automated QA can detect style drift, character identity drift, bad lip sync, subtitle mismatch, prompt inconsistency, temporal jumps, and audio duration mismatch?
8. **Skill design**: Are there existing "skills" or agent workflow repos for video production that show useful structure? What should a Cat Cafe `anime-video-forge` skill contain?
9. **MVP scope**: What is the smallest pipeline likely to produce a watchable 2-3 minute Cat Cafe anime episode within days/weeks, with human review but minimal custom UI?
10. **Risks**: What are the biggest traps: license, compute cost, vendor lock-in, low consistency, over-automation, asset storage, prompt drift, or review burden?

## 5. Desired Output Schema

Please answer in Chinese and include citations/links.

### Executive Recommendation

Give a clear recommendation:
- Build / do not build
- MVP pipeline shape
- Which open-source pieces to evaluate first
- Which parts to custom-build

### Evidence Matrix

| Area | Repo/tool/source | License | Activity/maturity | Solves | Does not solve | Cat Cafe action |
|------|------------------|---------|-------------------|--------|----------------|-----------------|

`Cat Cafe action` must be one of:
- **Adopt**: directly usable after validation
- **Pilot**: promising but needs spike
- **Learn architecture only**: useful ideas but license/maturity prevents direct use
- **Avoid**: poor fit or risky

### Proposed Pipeline Blueprint

Give an end-to-end pipeline with contracts/artifacts. Please include at least these artifact candidates and adjust if needed:

- `series-bible.md/json`: world, tone, canonical character info
- `character-bible.json`: visual references, voice profile, relationship facts
- `episode-brief.md`
- `episode-script.md`
- `beat-sheet.json`
- `shot-list.json`
- `keyframe-manifest.json`
- `clip-generation-manifest.json`
- `audio-manifest.json`
- `subtitle-track.json` or SRT/ASS/WebVTT
- `edit-decision-list.json`
- `video-spec.json`
- `qa-report.md/json`

For each artifact, say:
- owner: human / agent / model / generated tool
- whether it is source of truth or derived
- validation rule

### Architecture Options

Compare three options:

1. **Lean MVP**: quickest path to one watchable episode
2. **Balanced production pipeline**: good reuse and quality without overbuilding UI
3. **Ambitious studio**: agentic production system with queue, asset database, continuity QA, and multi-provider generation

For each option, include:
- expected manual effort
- model/API dependency
- compute/cost sensitivity
- main failure modes
- what to build first

### Disconfirming Evidence

List evidence that contradicts our hypotheses. If the evidence says "do not build this now" or "manual editing beats automation", say that plainly.

### Recommended Next Spikes

Give 5-8 concrete spikes. Each spike should be small enough to complete independently and should have a pass/fail criterion. Example shape:

- Spike: "Generate a 20-second two-shot dialogue using fixed character references"
- Pass: "Same two characters are recognizable across 3 clips; subtitle/audio offset < 200ms; no more than one manual regeneration per shot"

### Suggested `anime-video-forge` Skill Outline

Draft the sections this skill should contain:
- Trigger description
- Required starting parameters
- Directory layout
- Artifact contracts
- Workflow stages
- Tool adapters
- QA gates
- Common gotchas
- Review handoff format

## 6. Quality Bar

Please avoid generic advice. The useful answer should let us decide what to build next week.

Requirements:
- Include direct links to primary sources.
- Separate facts from your inference.
- Mark stale or weak evidence.
- Do not rely on star counts alone.
- Call out license constraints explicitly.
- Include at least one serious reason our plan may fail.
- Include a final ranked shortlist of repos/tools to inspect first.
