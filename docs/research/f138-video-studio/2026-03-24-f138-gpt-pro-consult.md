---
feature_ids: [F138]
related_features: [F054, F093]
topics: [video, remotion, waoowaoo, tutorial, bilibili, prompt-engineering]
doc_kind: note
created: 2026-03-24
participants: [gpt52, opencode, gpt-pro]
---

# F138 Video Studio — GPT Pro 咨询

> 委托人：砚砚/gpt52 → GPT Pro（云端）
> 日期：2026-03-24
> Related: F138, F054, F093

---

## Part 1: 发给云端模型的提示词

> 直接复制以下内容发送给 GPT Pro

你好，我们是 Cat Café，一个多 AI Agent 协作平台。我们刚立项了 **F138: Cat Café Video Studio**，目标是把现有的一次性视频制作经验，升级成一个可复用的视频生产管线。

请你把自己当成**架构审阅者**，不是普通聊天助手。我们已经做过一轮本地研究和实战，现在需要你帮我们做一次高质量的设计审阅：指出盲点、给出更稳的分阶段路线、补足我们还没想清楚的 schema 和流程。

## 1. 项目背景

我们的第一个目标不是做 AI 短剧，而是先把 **Cat Café 的教程 / showcase / Bilibili 视频** 做出来。也就是说，优先级是：

1. setup / onboarding 教程视频
2. bootcamp / feature walkthrough
3. showcase / 宣传片

我们已经用 **Remotion** 做过一支 Cat Café 介绍视频，过程中积累了大量一手经验。当前工作方式大致是：

- 人类提供素材和明确剪辑指令  
  例如：`这个视频从 05s 到 18s，用原声，不要放大`
- 猫猫负责：
  - 写 Remotion 组件
  - 安排字幕与旁白
  - 调用 TTS 生成配音
  - 渲染 mp4

我们发现这种“人类给素材边界 + 猫猫写代码实现”的模式是可行的，但现在还太手工。

## 2. 我们当前已经知道的结论

### 2.1 当前技术底座

- 视频框架：**Remotion v4.0.438**
- 目前项目目录：`/Users/lysander/projects/remotion-studio/`
- 已有能力：
  - 多场景 Remotion 组合
  - 自家猫猫 TTS 配音
  - 字幕/封面/场景切换
  - 真实录屏和截图混剪

### 2.2 我们已经调研过的外部参考：waoowaoo

我们深挖了 `https://github.com/saturndec/waoowaoo`，结论如下：

- 它最有价值的不是“短剧生成”本身，而是：
  1. prompt catalog + variable contract
  2. BullMQ 异步队列 + reconcile
  3. timeline/editor 的数据模型
  4. provider-agnostic 的 AI 素材生成接口
- 它**没有 LICENSE**，所以我们不会复制代码，只学架构思路
- 一个关键发现：它的 editor 更像“前端分镜壳子 + 预览器”，导出/render 后端闭环在当前仓库快照里并不完整

### 2.3 我们对 F138 的初步分期

#### Phase A: 学习 + 基础设施
- 素材管理规范
- Remotion 模板库重构
- 字幕系统 JSON 导入

#### Phase B: 教程视频制作
- 教程目录
- 分镜脚本模板
- 批量渲染与发布

#### Phase C: AI 辅助升级
- 从文本生成分镜建议
- AI 图片/封面生成
- 异步视频生产流水线

## 3. 我们现在真正想让你审阅的问题

请重点回答下面这些问题，不要泛泛而谈：

### Q1. 对于我们这种“教程视频优先”的目标，F138 的分期顺序合理吗？

请你判断：
- 我们现在的 Phase A / B / C 顺序是否合理
- 有没有顺序错位的地方
- 哪些能力应该提前，哪些能力应该后置

如果你要重排，请给一个更优版本，并解释为什么。

### Q2. 我们最先该固化哪些 schema / contract？

我们当前直觉是先固定这几类结构：

1. `asset-manifest.json`
2. `storyboard.json`
3. `subtitle-track.json`
4. `render-job.json`
5. prompt catalog 的变量 contract

请你回答：
- 这 5 个里，哪些是必须先做的，哪些可以后做
- 每个 schema 最小可用字段应该是什么
- 哪些字段是现在就要预留，避免以后返工

如果方便，请给出一个你推荐的最小 schema 设计草案。

### Q3. 在“教程视频”这个场景里，哪些工作应该继续让人类明确指定，哪些适合 AI 辅助？

请你把工作拆成几类：

- 应当由人类明确给定
- 可以由 AI 先出草稿、人类确认
- 当前阶段不值得自动化

比如：
- 素材起止秒
- 是否保留原声
- 场景节奏
- 字幕风格
- 旁白文案
- 章节划分
- 封面文案

请明确告诉我们，**第一阶段最值得自动化的 2-3 个点**是什么。

### Q4. 如果我们要把 waoowaoo 的 prompt 思路吸收进来，怎样设计我们自己的 prompt catalog 才不会空转？

请你不要给“多写几个 prompt”这种泛答案，而是针对教程视频/产品 showcase 场景，建议一套更实际的 prompt 目录。

例如，你可以判断我们是否需要：
- storyboard-plan
- scene-polish
- subtitle-style
- voice-script
- cover-copy
- asset-gap-analysis

并说明：
- 哪些 prompt 先做
- 哪些 prompt 依赖前置 schema
- prompt variable contract 应该怎么设计才稳

### Q5. 如果 F138 未来上异步生产管线，队列和状态机应该怎么拆？

我们已经知道 BullMQ 是一个很合理的方向，但还没定自己的拆法。

请你从教程视频生产的视角，给出建议：
- 队列应该按 `text / voice / render / publish` 拆，还是别的方式
- 数据库里应该持久化哪些 job 状态
- 一个视频项目的状态机怎么设计比较稳
- 哪些失败适合自动重试，哪些必须人工介入

### Q6. 你觉得我们现在的盲点是什么？

请你重点找这些角度里的“我们还没充分想到的事”：

- 教程视频的内容策略
- 素材管理
- 版本管理
- 大文件处理
- Bilibili 发布链路
- 配音 / 字幕 / BGM 的后期协作
- 团队协作方式（人类与猫猫如何分工最省心）

### Q7. 如果你站在“少走弯路”的角度，只允许我们在未来两周做 3 件事，你会选什么？

请直接给优先级列表，并写出理由。

## 4. 输出要求

- 不要泛泛列概念，请结合我们这个项目场景回答
- 区分：
  - **直接可做**
  - **需要先补前置条件**
  - **暂时别做**
- 如果你建议某种 schema / 状态机 / prompt taxonomy，请给尽量具体的结构建议
- 如果你认为我们当前理解有偏差，请直接指出

## 5. 我们当前的底线约束

- `waoowaoo` **无 License**，只能参考，不能复制代码
- 我们当前已经有 Remotion 实战经验，不是从零开始
- 我们优先做**真实教程 / showcase**，不是 AI 影视短剧
- 我们更适合“人类提供明确素材边界，猫猫负责代码化实现”的模式

请你把这次回答当作一次**视频生产系统设计审阅**来写。

---

## Part 2: GPT Pro 回答（待回填）

> 铲屎官把 GPT Pro 的回答粘贴到这里

我按一次正式设计审阅来写，先把结论挑明。

你们的大方向没跑偏，但现在有三根筋要先拧正。第一，**教程视频的核心资产不是 prompt，而是可复审、可回改、可批量渲染的 canonical Video Spec**。第二，**`subtitle-track` 不该比 `voice-script` 更早冻结**，教程视频里字幕多数是旁白或讲解文本的派生物，不是最前面的源头。第三，**异步队列不是最先要做的“高级能力”，它应该接在规范化素材、快照版本和评审边界之后**。Remotion v4 这条线其实已经给了你们足够好的基础能力，Composition 可以挂 Zod schema，`inputProps` 是 JSON 对象，`calculateMetadata()` 可以动态改 props 和时长，Studio 也支持可视编辑和保存 default props，所以你们完全可以先做“schema 驱动的内部编辑层”，没必要急着自建一套像 waoowaoo 那样的前端 timeline 壳子。([remotion.dev][1])

另外，我重新核了你们提到的参考对象。`waoowaoo` 当前公开 README 仍把自己定位成 AI 影视 Studio，公开 `package.json` 也能看到 BullMQ、bull-board、Prisma、S3 相关 SDK、MySQL 和 Remotion 这一整套 orchestration 栈；但我检查主分支 raw `/LICENSE` 和 `/LICENSE.md` 目前都取不到，所以你们继续把它当“架构灵感库”，不把代码掺进来，这个姿势依然稳。([GitHub][2])

## Q1. 你们现在的分期顺序，哪里对，哪里该挪

你们原来的 A / B / C 不是错，而是**把“AI 辅助”放成了一个独立后置阶段**。对教程视频来说，AI 不是 Phase C 的新大陆，它更像是 Phase 1 和 Phase 2 里的助推器。真正该后置的是“生成式素材”和“高度自动化的异步生产”。B 站的投稿链路本身就把封面、分区、类型、标签、标题、简介这些发布元数据放得很前，官方还有按分区推荐的封面模板能力，所以发布侧信息不该最后补，而应该从第一版 spec 就占位置。([哔哩哔哩][3])

我会把 F138 重排成这样：

### Phase 0：先冻住合同，不先堆功能

现在做：

* `asset-manifest`
* `storyboard`，或者更准确地说 `video-spec`
* `voice-script`
* `render-job`，但要做薄
* `publish-manifest`
* 版本快照和 review 规则

先别做：

* 自定义 timeline/editor
* provider-agnostic AI 媒体生成接口
* 自动发布

### Phase 1：做“可复用的教程视频生产环”

拿 **2 支真实教程视频** 跑通同一条管线：

`brief -> asset ingest -> storyboard -> voice-script -> preview render -> review patch -> final render`

这一阶段的目标不是“做更多视频”，而是证明**同一套 schema + 模板 + review loop** 能复用。

### Phase 2：上生产运维能力

这时再接：

* BullMQ 队列
* preview/final 双渲染层
* publish manifest
* 项目状态机
* 失败分类与重试

### Phase 3：把 AI 接进来，但只让它产出 draft 或 patch

AI 先做：

* chapter / storyboard draft
* voice script draft
* asset gap analysis
* cover copy

### Phase 4：再考虑生成式素材

比如：

* AI 封面图
* AI 插图
* provider-agnostic 生成接口
* 更复杂的异步多阶段流水线

一句更硬的判断是：**你们现在不是缺“更强 AI”，而是缺“更稳的 spec + review + snapshot”**。

## Q2. 最先该固化哪些 schema / contract

你们列的 5 个里，我的排序是：

**第一优先**

1. `asset-manifest.json`
2. `storyboard.json`，但我建议升级成 `video-spec.json`
3. `render-job.json`，但必须很薄

**第二优先**
4. `voice-script.json`，这是你们列表里缺的，但应该比 `subtitle-track` 更早

**第三优先**
5. `subtitle-track.json`
6. prompt variable contract

**还缺一个**
7. `publish-manifest.json`

核心原因很简单：**教程视频的源头是“要讲什么、展示什么、原声怎么处理”，不是“字幕长什么样”**。
字幕、封面图、最终成片，很多都应该是派生物。Remotion 官方也明确把 `inputProps` 定位成 JSON-serializable object，而 `calculateMetadata()` 更适合做小而确定的 JSON 变换；它默认有 30 秒超时，渲染期间在组件里做远程拉取还可能因为多标签页和并发而被重复触发。所以 LLM、TTS、ASR 这些都应该在 render 之前完成，render 只消费冻结后的 spec 和派生资产。([remotion.dev][4])

我推荐的最小草案是这样。

### 1) `asset-manifest.json`

```jsonc
{
  "schemaVersion": "asset-manifest.v1",
  "projectId": "F138-onboarding-macos",
  "assets": [
    {
      "assetId": "screen_001",
      "type": "video",
      "role": "screen-recording",
      "uri": "s3://video-studio/raw/screen_001.mov",
      "checksum": "sha256:...",
      "durationMs": 24830,
      "fps": 60,
      "width": 2560,
      "height": 1440,
      "audio": { "hasAudio": true, "channels": 2 },
      "locale": "zh-CN",
      "recordedAt": "2026-03-24T10:30:00+08:00",
      "productVersion": "CatCafe 0.54.0",
      "license": { "kind": "owned", "source": "self-recorded" },
      "status": "ready"
    }
  ]
}
```

现在就要预留的字段：`checksum`、`productVersion`、`recordedAt`、`license`、`locale`。
这些会决定你们未来能不能追溯“这段录屏是不是过时了”。

### 2) `storyboard.json`，我更建议叫 `video-spec.json`

```jsonc
{
  "schemaVersion": "video-spec.v1",
  "projectId": "F138-onboarding-macos",
  "videoKind": "tutorial",
  "compositionId": "TutorialMain",
  "stylePreset": "tutorial-default-v1",
  "scenes": [
    {
      "sceneId": "s01",
      "purpose": "show-first-launch",
      "assetRefs": [
        {
          "assetId": "screen_001",
          "trimInMs": 5000,
          "trimOutMs": 18000
        }
      ],
      "keepSourceAudio": true,
      "cameraPolicy": "fit",
      "narrationMode": "none",
      "captionMode": "source-audio",
      "mustShow": ["launch button", "permission dialog"],
      "mustSay": [],
      "transitionIn": "cut",
      "transitionOut": "cut",
      "locks": ["assetRefs", "keepSourceAudio"],
      "notes": ["不要放大"]
    }
  ]
}
```

这里最关键的不是视觉字段，而是这些“教程语义字段”：

* `purpose`
* `mustShow`
* `mustSay`
* `keepSourceAudio`
* `cameraPolicy`
* `locks`

因为这正好对应你们现在的人类指令模式。

### 3) `voice-script.json`

```jsonc
{
  "schemaVersion": "voice-script.v1",
  "projectId": "F138-onboarding-macos",
  "items": [
    {
      "sceneId": "s02",
      "speaker": "cat-tts-a",
      "text": "打开设置后，先完成登录。",
      "estimatedDurationMs": 3200,
      "locks": ["text"]
    }
  ]
}
```

这是你们现在最缺但最该补的 schema。
没有它，TTS、字幕、节奏、scene length 都会互相拖着跑。

### 4) `subtitle-track.json`

我建议直接升级成 `text-track.json`，因为教程视频里不只有字幕，还有 callout、chapter、lower-third。

```jsonc
{
  "schemaVersion": "text-track.v1",
  "projectId": "F138-onboarding-macos",
  "tracks": [
    {
      "trackId": "caption-main",
      "kind": "caption",
      "language": "zh-CN",
      "items": [
        {
          "id": "c1",
          "sceneId": "s02",
          "startMs": 1200,
          "endMs": 2800,
          "text": "先完成登录",
          "styleRef": "caption-default",
          "lockTiming": false,
          "lockText": false
        }
      ]
    }
  ]
}
```

现在就要预留 `kind`、`styleRef`、`sceneId`、`lockTiming`、`lockText`。
这会救你们未来免于“字幕 schema 只能装字幕，装不下 UI 提示词”。

### 5) `render-job.json`

```jsonc
{
  "schemaVersion": "render-job.v1",
  "jobId": "rj_20260324_001",
  "projectId": "F138-onboarding-macos",
  "snapshotId": "project@v7",
  "compositionId": "TutorialMain",
  "inputPropsRef": "s3://video-studio/specs/project.v7.json",
  "renderProfileId": "bilibili-1080p-v1",
  "kind": "preview",
  "priority": "normal",
  "requestedBy": "human",
  "status": "queued"
}
```

注意：**render-job 不能成为内容源头**。
它只应该引用一个冻结的 snapshot，不应该把 storyboard 再复制一份塞进去。

### 6) `prompt-contract.json`

```jsonc
{
  "promptId": "storyboard-plan",
  "version": "1.0.0",
  "inputSchemaRef": "storyboard-brief.v1",
  "outputSchemaRef": "storyboard-draft.v1",
  "lockedFields": ["assetRefs[].trimInMs", "assetRefs[].trimOutMs", "keepSourceAudio"],
  "returnMode": "json",
  "evalSuite": ["tutorial-onboarding-001", "feature-walkthrough-001"]
}
```

这里最重要的不是 prompt 文案，而是：

* `inputSchemaRef`
* `outputSchemaRef`
* `lockedFields`
* `returnMode`
* `evalSuite`

没有这几个字段，prompt catalog 很容易变成一座香气四溢但没法回归测试的蘑菇园。

## Q3. 哪些工作该人类指定，哪些适合 AI

### 应当由人类明确给定

这些别交给 AI 自作主张：

* **素材起止秒**
* **是否保留原声**
* **事实性步骤顺序**
* **必须展示的 UI 细节**
* **品牌口径和禁语**
* **最终发布标题、封面、简介的拍板**

原因很朴素，教程视频最怕“看起来顺，但教错了”。

### 可以由 AI 先出草稿，人类确认

这些很适合让 AI 先打一版：

* **章节划分**
* **scene purpose 草稿**
* **旁白文案**
* **封面文案**
* **资产缺口分析**
* **字幕断句和压行**

### 当前阶段不值得自动化

这些现在自动化，收益不大，翻车率却很高：

* 从原始录屏里全自动挑 trim
* 全自动决定 zoom / pan / crop
* 全自动决定场景节奏
* 全自动配 BGM
* 全自动发布

我认为第一阶段最值得自动化的 3 个点是：

1. **章节划分 + storyboard 初稿**
   这是从“人脑堆便签”升级到“可复用 spec”的第一步。

2. **voice-script draft**
   它直接连接旁白、TTS、字幕、节奏，是教程视频的中枢神经。

3. **asset-gap-analysis**
   它能在录完、剪前、渲染前就告诉你“还缺哪张截图、哪段录屏、哪句讲解”，能少走很多返工弯路。

第四名才是 `subtitle-polish`。它有用，但我会排在上面三件事后面。

## Q4. 怎么吸收 waoowaoo 的 prompt 思路，而不是空转

这里最容易歪楼。
**你们该吸收的不是 prompt 的表面文案，而是“prompt 被当作合约和测试对象”的思路。** `waoowaoo` 当前公开 `package.json` 里能看到一串和 prompt、contract、provider guard 相关的检查脚本，说明它把这套东西当成“可验证接口”而不是玄学。你们应该学这一点。([GitHub][5])

我建议你们的 prompt 目录从这 6 个开始：

### 第一批，直接做

1. `chapter-plan`
2. `storyboard-plan`
3. `voice-script-draft`
4. `asset-gap-analysis`
5. `cover-copy`

### 第二批，等前置 schema 稳了再做

6. `subtitle-polish`
7. `scene-polish`

### 暂时别做

* `subtitle-style`
* `camera-style`
* “一键从 brief 到全片”

原因是：`style` 更适合做成 **preset / token**，不是 prompt。
教程视频的字幕风格、字号、边距、safe area、颜色、描边，这些应该是确定性的模板配置，不该交给模型当场即兴发挥。

我建议的依赖关系是：

* `chapter-plan` 只依赖 brief
* `storyboard-plan` 依赖 brief + asset summaries + locked human constraints
* `voice-script-draft` 依赖 approved storyboard
* `asset-gap-analysis` 依赖 storyboard + asset-manifest
* `cover-copy` 依赖 approved chapter summary + audience + platform
* `subtitle-polish` 依赖 locked voice-script + timed alignment
* `scene-polish` 依赖 scene schema + style tokens + locked fields

变量 contract 我会统一成这几类：

```jsonc
{
  "brief": {},
  "audience": {},
  "platform": "bilibili",
  "locale": "zh-CN",
  "targetDurationSec": 180,
  "houseStyle": {},
  "hardConstraints": {},
  "lockedFields": [],
  "assetSummaries": [],
  "existingDraft": {},
  "outputSchemaVersion": "v1"
}
```

还有一条铁规矩：
**prompt 输出必须是 JSON draft 或 JSON patch，不要只吐 prose。**
AI 说得再漂亮，只要不能落进 spec，它就只是彩带，不是齿轮。

## Q5. 异步生产管线的队列和状态机怎么拆

### 队列不要只按 `text / voice / render / publish` 拆

你们至少还缺一个非常关键的 `ingest`。

我建议最小拆法是：

1. `ingest`
   做素材归档、元数据提取、代理文件、波形、可选 ASR

2. `ai-draft`
   跑 `chapter-plan`、`storyboard-plan`、`voice-script`、`gap-analysis`

3. `audio-build`
   TTS、音量标准化、ducking、mix stems

4. `render-preview`
   低成本预览渲染

5. `render-final`
   正式成片、封面导出、章节图等

6. `publish`
   上传、回写 external id、核验状态

为什么这样拆：
BullMQ 的 Flow 非常适合做**一个自动阶段内的 fan-out / fan-in**，因为 parent job 会等 children 成功后再进入等待执行；但你们的人类 review 往往跨小时甚至跨天，不适合用一个大 flow 从 brief 一直吊到 publish。更稳的做法是：**数据库保存项目状态，BullMQ 只负责某个自动阶段的 burst**。([BullMQ][6])

### 数据库里该持久化哪些 job 状态

最少要有 `job_run`：

```jsonc
{
  "jobRunId": "jr_001",
  "projectId": "F138-onboarding-macos",
  "snapshotId": "project@v7",
  "queueName": "render-preview",
  "jobType": "render-preview",
  "flowRootId": "flow_abc",
  "bullJobId": "12345",
  "idempotencyKey": "preview:v7:bilibili-1080p",
  "status": "active",
  "progress": { "phase": "encoding", "percent": 72 },
  "attemptsMade": 1,
  "retryClass": "transient",
  "errorCode": null,
  "workerVersion": "render-worker@2026-03-24",
  "outputRefs": []
}
```

要点有 4 个：

* `snapshotId`，保证 job 跑的是哪个版本一清二楚
* `idempotencyKey`，防止重复渲染 / 重复发布
* `retryClass`，为失败分类
* `workerVersion`，方便以后排查“是内容问题还是 worker 版本问题”

BullMQ worker 本身支持 progress 更新，也支持 cancellation signal，所以这些信息很适合直接映射到 UI。([BullMQ][7])

### 项目状态机怎么设计更稳

不要只用一个总状态 enum。
我建议拆成 3 条状态轴：

**editorial_state**

* `briefing`
* `drafting`
* `review_required`
* `changes_requested`
* `approved`

**build_state**

* `idle`
* `ingesting`
* `preview_rendering`
* `final_rendering`
* `failed`

**release_state**

* `not_ready`
* `metadata_ready`
* `publishing`
* `published`
* `publish_failed`

这样做的好处是不会出现奇怪的混合状态，比如“内容在 review 中，但上一个 preview render 正在跑”。

### 哪些失败适合自动重试，哪些必须人工介入

适合自动重试：

* TTS / 对象存储 / 上传的临时网络错误
* provider 429 / 5xx
* Remotion worker 崩掉
* 浏览器实例异常退出
* 临时 presign / upload timeout

这类可以用 BullMQ 的 `attempts` + backoff。官方文档明确支持固定和指数回退。([BullMQ][8])

必须人工介入：

* schema 校验失败
* asset 丢失
* 录屏版本过时
* product facts 不匹配
* prompt 输出语义不对
* B 站发布元数据不合适
* 账号授权 / cookie 失效

这类应该直接打成 terminal failure。BullMQ 里可以用 `UnrecoverableError` 来阻止继续自动重试。([BullMQ][9])

还有一种很值得你们用的模式是 **step jobs**。BullMQ 官方给了“在 job data 里保存 step，失败后从上一步恢复”的模式，这特别适合你们的 `publish` 阶段，比如“上传视频 -> 上传封面 -> 提交稿件 -> 回写 external id”。([BullMQ][10])

## Q6. 你们现在的盲点

### 1. 你们还没把“教程会过期”当成一等公民

教程视频不是电影，它会随产品版本腐烂。
所以 `asset-manifest` 里一定要有 `productVersion`、`recordedAt`，项目层要有“这支视频适配哪个版本”的字段。否则半年后你们会遇到经典事故：成片还很漂亮，按钮已经不在了。

### 2. 你们缺一个真正的 single source of truth

现在你们的事实可能散在：

* 人类聊天指令
* Remotion 代码
* 旁白文本
* 字幕文件
* 发布文案

这会导致每次修改像在猫窝里找耳机。
你们必须让 **snapshot 化的 `video-spec`** 成为唯一中枢，其余都引用它或派生自它。

### 3. 你们对“大文件”和“本地路径”还不够警惕

`/Users/lysander/...` 这种路径在单机能跑，但一旦要批量渲染、协作、异步 worker、对象存储，就会开始长蘑菇。
建议尽早分层：

* raw original
* normalized mezzanine
* preview proxy
* derived artifacts

Git 管代码和 schema，二进制大文件进对象存储。

### 4. 你们还没把音频后期建模清楚

教程视频至少有四条音频语义：

* source audio
* voiceover
* bgm
* sfx

别只放一个 `keepSourceAudio: boolean` 就完。
你们很快会需要：

* lane
* gain
* ducking policy
* mute / solo
* fade in/out

### 5. 你们还低估了发布链路

B 站官方投稿流程里，封面、分区、类型、标签、标题、简介这些都不是附件，而是作品的一部分，官方也有封面模板能力。换句话说，**publish metadata 本身就是教程内容策略的一部分**，不是渲染完才想起来补的表格。([哔哩哔哩][3])

### 6. 你们还缺 prompt / pipeline 的评测集

没有 eval，prompt catalog 很容易从“武器库”滑成“许愿池”。
建议挑 5 到 10 个真实 tutorial brief，固定做回归测试，检查：

* 输出是否过 schema
* 有没有改动 locked fields
* 有没有幻觉产品能力
* 章节密度是否符合目标时长
* voice script 是否过长

### 7. 你们可能会过早想做 custom editor

这是我最想拦一下的地方。
Remotion 现在已经能做 schema、props editor、default props 的 update/save。你们短期更值得做的是“spec 驱动的内用编辑器”，而不是“重造一个可拖拽 timeline UI”。先把 schema 和 review loop 打磨好，再决定值不值得做重前端。([remotion.dev][1])

## Q7. 未来两周只做 3 件事，我会选什么

### 1. 先冻结最小合同集

做这些文件和 validator：

* `asset-manifest.v1`
* `video-spec.v1`
* `voice-script.v1`
* `render-job.v1`
* `publish-manifest.v1`

再加一个 `snapshot` 机制。
这是全部后续工作的地基。

### 2. 用同一模板做出 2 支真实教程视频

不要做 demo，做真的。

目标是验证这条链：

`project snapshot -> Remotion inputProps -> preview -> review patch -> final`

Remotion 的 schema、input props、visual editing、save/update default props 已经足够支撑这一步。([remotion.dev][1])

### 3. 上最小可用 orchestration，而不是“大而全自动化”

先做这 4 个队列：

* `ingest`
* `ai-draft`
* `render-preview`
* `render-final`

再补：

* `audio-build`
* `publish`

BullMQ 的 flow、retry、manual retry、step jobs 都够你们把这个最小版本搭起来，但记住，**flow 用在自动阶段内，不要把跨天的人类审核塞进一个大 flow 里**。([BullMQ][6])

---

最后给一版非常直白的总建议：

**直接可做**

* 冻结 canonical video spec
* 增加 `voice-script` 和 `publish-manifest`
* 用 Remotion schema + Studio 先做内部编辑层
* 跑 2 支真实教程视频
* 让 AI 只产出 JSON draft / patch

**需要先补前置**

* 队列状态机
* snapshot/versioning
* 对象存储和 proxy 规范
* failure taxonomy
* prompt eval suite

**暂时别做**

* 自定义 timeline editor
* 全自动 trim / zoom / pacing
* 生成式素材统一抽象
* 一键从 brief 到成片
* 把 LLM/TTS/ASR 塞进 render path

如果只留一句话给 F138，我会留这句：

**先把“视频 spec”做成中枢神经，再让 AI、Remotion、队列、发布系统都围着它转。不要反过来让 prompt 当王。**

[1]: https://www.remotion.dev/docs/schemas "https://www.remotion.dev/docs/schemas"
[2]: https://raw.githubusercontent.com/saturndec/waoowaoo/main/README.md "https://raw.githubusercontent.com/saturndec/waoowaoo/main/README.md"
[3]: https://www.bilibili.com/read/cv580232/ "https://www.bilibili.com/read/cv580232/"
[4]: https://www.remotion.dev/docs/passing-props "https://www.remotion.dev/docs/passing-props"
[5]: https://raw.githubusercontent.com/saturndec/waoowaoo/main/package.json "https://raw.githubusercontent.com/saturndec/waoowaoo/main/package.json"
[6]: https://docs.bullmq.io/guide/flows "https://docs.bullmq.io/guide/flows"
[7]: https://docs.bullmq.io/guide/workers "https://docs.bullmq.io/guide/workers"
[8]: https://docs.bullmq.io/guide/retrying-failing-jobs "https://docs.bullmq.io/guide/retrying-failing-jobs"
[9]: https://docs.bullmq.io/patterns/stop-retrying-jobs "https://docs.bullmq.io/patterns/stop-retrying-jobs"
[10]: https://docs.bullmq.io/patterns/process-step-jobs "https://docs.bullmq.io/patterns/process-step-jobs"

---

## Part 3: 综合后的最终版本

> 综合人：金渐层(opencode) | 日期：2026-03-25
> 基于：GPT Pro 设计审阅（Part 2）+ 砚砚 waoowaoo 深度调研 + 金渐层 V1→V4.8 实战经验

### 核心采纳

GPT Pro 指出了 3 根需要拧正的筋，我逐一对照：

**1. "教程视频的核心资产不是 prompt，而是 canonical Video Spec"** — ✅ 完全采纳。
我们原来的 F138 把 Phase A 侧重点放在"调研 + 模板库重构"上，GPT Pro 的视角更稳：先冻结 schema/contract，再堆功能。这对应他提出的 Phase 0。

**2. "`subtitle-track` 不该比 `voice-script` 更早冻结"** — ✅ 完全采纳。
我们原来把字幕系统放在 Phase A（AC-A4），但 GPT Pro 指出教程视频的字幕是旁白的派生物，voice-script 才是源头。这改变了我们的优先级。

**3. "异步队列不是最先要做的高级能力"** — ✅ 完全采纳。
我们和砚砚都在调研报告里强调了 BullMQ，但 GPT Pro 准确地指出：先有稳定 spec + review loop，再上队列。我们把 BullMQ 从 Phase A 后移到 Phase 2。

### Phase 重排决策

采用 GPT Pro 的 5 阶段方案，微调适配我们的实际情况：

| 阶段 | GPT Pro 原版 | 我们的适配 |
|------|-------------|-----------|
| Phase 0 | 先冻住合同 | ✅ 采纳。先做 5 个 schema + snapshot 机制 |
| Phase 1 | 用 2 支真实教程跑通 | ✅ 采纳。但教程选题需铲屎官拍板 |
| Phase 2 | 上生产运维 | ✅ 采纳。BullMQ + 状态机 + 失败分类 |
| Phase 3 | AI 只产出 draft/patch | ✅ 采纳。prompt catalog 此时才上 |
| Phase 4 | 生成式素材 | ✅ 采纳。fal.ai / AI 图片等最后做 |

### Schema 采纳清单

GPT Pro 给了 6 个 schema 草案，我的判断：

| Schema | 采纳 | 备注 |
|--------|------|------|
| `asset-manifest.v1` | ✅ 直接采用 | `productVersion` + `recordedAt` 预留非常关键 |
| `video-spec.v1` | ✅ 采纳升级 | 从 `storyboard.json` 升级为 `video-spec.json`，加入 `purpose`/`mustShow`/`mustSay`/`locks` |
| `voice-script.v1` | ✅ 新增 | 我们原来没有这个 schema，GPT Pro 说得对：它是教程视频的中枢神经 |
| `render-job.v1` | ✅ 做薄 | 只引用 snapshot，不复制内容 |
| `text-track.v1` | ⏳ 第二优先 | 从 `subtitle-track` 升级，支持 caption/callout/chapter/lower-third |
| `publish-manifest.v1` | ✅ 新增 | 我们原来缺这个。B 站封面/分区/标签从第一版就占位 |
| `prompt-contract.v1` | ⏳ Phase 3 | 等 schema 稳了再做，避免空转 |

### 盲点回应

GPT Pro 指出了 7 个盲点，逐一回应：

| # | 盲点 | 我们的回应 |
|---|------|-----------|
| 1 | 教程会过期 | ✅ `asset-manifest` 必须有 `productVersion` + `recordedAt` |
| 2 | 缺 single source of truth | ✅ snapshot 化的 `video-spec` 成为唯一中枢 |
| 3 | 本地路径问题 | ⚠️ 短期仍用本地路径，但 schema 里 uri 字段预留 `s3://` 前缀 |
| 4 | 音频后期不够清晰 | ✅ 升级音频模型：lane/gain/ducking/fade，不止 `keepSourceAudio` |
| 5 | 低估发布链路 | ✅ `publish-manifest` 从第一版就做 |
| 6 | 缺 prompt eval suite | ⏳ Phase 3 时做，配合 prompt catalog 一起上 |
| 7 | 过早想做 editor | ✅ Remotion Studio 已够用，不自建 timeline UI |

### 两周行动计划（采纳 GPT Pro Q7）

1. **冻结最小合同集**：`asset-manifest.v1` + `video-spec.v1` + `voice-script.v1` + `render-job.v1` + `publish-manifest.v1`
2. **用同一模板做 2 支真实教程视频**：选题待铲屎官拍板
3. **最小 orchestration**：先做 `ingest` + `render-preview` + `render-final`（BullMQ 可选，先用脚本也行）

### 不采纳的点

| 建议 | 不采纳原因 |
|------|-----------|
| 立刻用对象存储 | 短期本地文件 + uri 预留足够。等 Phase 2 再上 |
| `render-preview` 和 `render-final` 双渲染层 | Phase 0/1 先用单渲染（`--quality` 参数切换），Phase 2 再分层 |

### 新增 Key Decision

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-3 | Phase 重排：0→1→2→3→4，spec 先于队列先于 AI | GPT Pro 设计审阅建议 | 2026-03-25 |
| KD-4 | `video-spec` 而非 `storyboard` 作为中枢 schema | 教程视频语义字段（purpose/mustShow/locks）比分镜排列更重要 | 2026-03-25 |
| KD-5 | `voice-script` 比 `subtitle-track` 更早冻结 | 字幕是旁白的派生物，voice-script 才是源头 | 2026-03-25 |
| KD-6 | 不自建 timeline editor，先用 Remotion Studio | Remotion v4 的 schema + inputProps + Studio 已够用 | 2026-03-25 |
| KD-7 | prompt 输出必须是 JSON draft/patch，不吐 prose | "AI 说得再漂亮，只要不能落进 spec，它就只是彩带，不是齿轮" | 2026-03-25 |
