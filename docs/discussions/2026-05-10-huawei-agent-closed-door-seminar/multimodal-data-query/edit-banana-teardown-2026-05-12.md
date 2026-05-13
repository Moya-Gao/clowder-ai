---
title: "Edit-Banana 开源项目拆解：静态图到可编辑 DrawIO"
date: 2026-05-12
event: "Huawei Agent Closed-door Seminar"
speaker: "柴成亮"
project: "Edit-Banana"
repo: "https://github.com/BIT-DataLab/Edit-Banana"
website: "https://www.editbanana.net/"
local_snapshot: "/Users/lysander/projects/ref/Edit-Banana"
snapshot_commit: "d71007d72b8a7f2653dc6e37fc071bed01404b1a"
doc_kind: "open-source-teardown"
status: "draft"
author: "砚砚/GPT-5.5"
---

# Edit-Banana 开源项目拆解：静态图到可编辑 DrawIO

> 用户原始问题：`https://github.com/BIT-DataLab/Edit-Banana 是新的老师 我找到了 www.editbanana.net，你好像可以按照我们家的 skills 拆解一下这个项目？`

## 0. 一句话结论

**Edit-Banana 不是数据智能体，也不是通用多模态查询系统。它更像一个多模态内容修复/结构化工具：把不可编辑的统计图、流程图、公式截图，拆成 OCR 文本 + SAM3 分割元素 + DrawIO XML。**

对我们最有价值的不是“专门造一只数据智能体”，而是它暴露了一个我们家还薄的基础能力：**多模态证据层**。也就是：当真实世界证据不是 markdown/git/text，而是截图、图表、PDF 图像、公式、界面状态时，agent 需要把这些不可编辑对象转成可定位、可引用、可修复、可审计的结构化对象。

我的成熟度判断：

| 维度 | 结论 |
|---|---|
| 真实工程量 | **中等偏高**：不是纯 README，有 CLI、FastAPI、SAM3 service、OCR、XML merge、coverage/refinement 模块 |
| 算法原创性 | **中等**：主要是成熟模型和 CV/OCR pipeline 的工程编排，亮点在 coverage metric + fallback，而不是新基础算法 |
| 生产成熟度 | **偏低到中等**：README 明确说 GitHub 落后于 Web 服务；repo 缺前端和用户/积分系统实现；issue 也反馈本地效果弱于网站 |
| 对 Cat Cafe 的价值 | **高**：不该照搬产品，但应该学习“多模态证据结构化 + coverage 评估 + fallback 保真”的工程思想 |

## 1. 真相源和快照

| 项 | 内容 |
|---|---|
| Repo | `https://github.com/BIT-DataLab/Edit-Banana` |
| Website | `https://www.editbanana.net/` |
| 本地快照 | `/Users/lysander/projects/ref/Edit-Banana` |
| 获取方式 | `git clone` 两次断线后，改用 GitHub archive zip |
| main SHA | `d71007d72b8a7f2653dc6e37fc071bed01404b1a` |
| GitHub API 状态 | 2026-05-12 查到约 5.1k stars、347 forks、28 open issues |
| License 真相 | GitHub API 和 `LICENSE` 是 **AGPL-3.0**；README 徽章/License 段写 **Apache 2.0**，存在冲突 |
| Website 抓取 | 本机 `curl` HTTPS 报 `SSL_ERROR_SYSCALL`，只把官网作为产品声称，不把网页实现作为已验证代码证据 |

> 注意：README 自己也写明“GitHub repository currently trails behind web-based service”。所以本报告拆的是**开源仓库快照**，不是线上服务完整能力。

## 2. 现场语境：它和柴老师报告的关系

柴老师前面讲的是“多模态大数据智能查询系统”：数据不只是 SQL 表，还有 PDF、图像、图表、视频、业务手册等，用户问的也不是一次 SQL，而是长程、多步、多工具、会犯错、需要复盘的过程。

Edit-Banana 对应的是这个大方向里的一个更窄子问题：

```text
静态不可编辑内容
  -> 多模态解析
  -> 结构化元素
  -> 可编辑 / 可复用 / 可审计对象
```

它不是“回答问题”的 agent，而是把“图像证据”变成 agent 能处理的结构化材料。这个位置更像我们家的 `evidence.sqlite` 对图像世界的补课：text evidence 我们比较强，image/diagram evidence 还薄。

## 3. Claims Ledger

| Claim | 代码证据 | Verdict | Caveat |
|---|---|---|---|
| “图片/图表转可编辑 DrawIO XML” | `main.py` 的 `Pipeline.process_image()`；`modules/xml_merger.py` 生成 DrawIO XML；`server_pa.py` 提供 `/convert` | **基本成立** | 本地需要 SAM3 权重、OCR、配置；没有跑通实测，因为依赖重 |
| “SAM3 分割图表元素” | `modules/sam3_info_extractor.py` 加载 SAM3、按 prompt group 跑 `set_text_prompt()` | **成立** | README 说 fine-tuned SAM3，但开源 repo 只有调用和配置，没有训练代码或微调权重证据 |
| “固定多轮 VLM Scanning / Multimodal LLMs” | README 声称；`config/config.yaml.example` 有 `multimodal` 配置 | **开源代码证据弱** | `rg` 没看到实际 chat/completion/VLM 调用链；local LLM adaptation 在 roadmap 里还是 planned |
| “文本识别 + 公式转 LaTeX” | `modules/text/restorer.py`；`modules/text/ocr/local_ocr.py`；`modules/text/ocr/pix2text.py`；`processors/formula.py` | **成立** | 质量依赖 OCR/Pix2Text；公式只是文本层转换，不等于理解图表语义 |
| “多用户并发、全局锁、LRU cache” | `sam3_service/server.py` 有 `asyncio.Lock`、`state_cache`、`cache_size`；`modules/sam3_info_extractor.py` 有 LRU cache | **部分成立** | 开源 `server_pa.py` 没用户/积分系统；并发是模型服务层串行化和 cache，不是完整 SaaS 多租户 |
| “用户系统、注册 10 credits、按量付费” | README 声称 | **开源 repo 未见实现** | repo 没 frontend/user/auth/credit 代码；issue 也有人问积分和登录 |
| “高保真 1:1 还原” | README demo 图 + static demo assets | **demo 成立，泛化未知** | 无公开 benchmark/eval 报告；issue #52 反馈本地效果和网站差距大 |
| “质量评估和 refinement” | `modules/metric_evaluator.py` 的 coverage score；`modules/refinement_processor.py` fallback 裁剪嵌入图片 | **成立，而且是工程亮点** | refinement 是保守兜底：把漏检区域当 picture 嵌回去，保真但不可编辑 |

## 4. 架构地图

开源仓库的实际形态：

```text
Edit-Banana/
  main.py                         # CLI 主入口：图片 -> OCR -> SAM3 -> shape/icon -> XML merge
  server_pa.py                    # 最小 FastAPI /convert
  config/config.yaml.example      # SAM3/OCR/multimodal/RMBG 配置

  modules/
    base.py                       # ProcessingContext / BaseProcessor
    data_types.py                 # ElementInfo / BoundingBox / XMLFragment / LayerLevel
    sam3_info_extractor.py         # SAM3 prompt group 分割 + LRU cache + 去重
    basic_shape_processor.py       # 基本图形矢量化、取色、几何参数
    icon_picture_processor.py      # icon/picture 裁剪、RMBG 去背景、base64 嵌入
    metric_evaluator.py            # coverage score + 漏检区域定位
    refinement_processor.py        # 漏检区域 fallback 成 picture
    xml_merger.py                  # 按层级合并 DrawIO XML
    text/
      restorer.py                  # OCR + formula + font/style/coord + text XML
      ocr/local_ocr.py             # Tesseract
      ocr/paddle_ocr.py            # PaddleOCR adapter
      ocr/pix2text.py              # Pix2Text formula
      processors/*.py              # 字号、字体、公式、样式处理

  sam3_service/
    server.py                      # SAM3 常驻 HTTP 服务，串行推理 + LRU cache
    client.py                      # round-robin service pool
    rmbg_server.py                 # RMBG 去背景服务

  static/demo/                     # README demo 静态素材
```

实际 pipeline：

```text
Input image
  -> TextRestorer
       -> Tesseract/PaddleOCR
       -> optional Pix2Text formula
       -> text_only.drawio
  -> Sam3InfoExtractor
       -> prompt groups: background / shape / image / arrow
       -> masks + bbox + polygon
       -> cross-group dedup
  -> IconPictureProcessor / BasicShapeProcessor
       -> shape vector XML or image base64 XML
  -> optional MetricEvaluator
       -> content coverage score
       -> bad regions
  -> optional RefinementProcessor
       -> crop bad regions as picture
  -> XMLMerger
       -> layer sort + id reassignment
       -> *_merged.drawio.xml
```

## 5. 明星特性追链路

### 5.1 “固定多轮 VLM 扫描”

README 的说法很漂亮，但开源代码里我看到的是**固定 prompt group 扫描**，不是完整 VLM reasoning loop：

```text
prompts/*.py
  -> ConfigLoader.get_prompt_groups()
  -> Sam3InfoExtractor.process()
  -> SAM3Model.predict(image_path, prompts)
  -> processor.set_text_prompt(prompt=prompt, state=state)
```

prompt group 只有：

- image: `icon`, `picture`, `logo`, `chart`, `diagram`
- shape: `rectangle`, `rounded rectangle`, `diamond`, `ellipse`, `circle`, `triangle`, `hexagon`
- arrow: `arrow`, `line`, `connector`
- background: `panel`, `container`, `filled region`, `background`

**判断**：这里更像“prompt-driven segmentation”，不是 NotebookLM/Claude/Codex 那种会读图、会规划、会验证的多模态 agent。它确实用了 multimodal foundation model 的能力，但 agentic 成分弱。

### 5.2 “质量评估 + 二次修复”

这是我觉得最值得学的一段。

`MetricEvaluator` 不问“模型觉得自己好不好”，而是把已检测元素覆盖区域扣掉，计算剩余未覆盖前景内容：

```text
原图 -> foreground/content mask
detected bboxes/text xml -> covered mask
uncovered content -> bad regions
score = covered_content_pixels / total_content_pixels
```

然后 `RefinementProcessor` 对 bad regions 做保守 fallback：

```text
bad region bbox
  -> crop original image
  -> PNG base64
  -> ElementInfo(type=picture)
  -> XML merge
```

这不是高级语义理解，但工程上很对：**宁可不可编辑，也不要丢证据**。

这和我们家的 memory/eval 思路同构：

| Edit-Banana | Cat Cafe 对应 |
|---|---|
| coverage score | evidence recall / tool usage metrics |
| bad regions | missing context / stale knowledge / wrong recall |
| fallback crop | 保守召回原始证据，不强行总结 |
| output intermediate debug files | audit trail |

### 5.3 “多用户并发”

开源代码里主要是模型服务层的并发控制：

- `sam3_service/server.py`：`inference_lock` 保证单进程串行推理，避免 VRAM 爆掉。
- `state_cache` + `cache_size`：同一图像的 SAM3 image embedding 可复用。
- `Sam3ServicePool`：多个 endpoint round-robin。

这说明他们认真处理了 GPU 服务的工程问题，但不是完整企业级多租户系统。README 的“注册 / credits / pay-per-use”在开源代码里看不到实现。

## 6. 算法剥皮

| 组件 | 类型 | 说明 |
|---|---|---|
| SAM3 segmentation | 外部 foundation model | 核心感知能力来自 SAM3；repo 负责编排、prompt、阈值和后处理 |
| prompt groups | 规则/启发式 | 预设类别词表，不是动态生成子任务 |
| shape vectorization | CV + 规则 | OpenCV 轮廓、取色、几何参数、DrawIO style 映射 |
| OCR | 外部工具 | Tesseract/PaddleOCR |
| formula recognition | 外部模型 | Pix2Text |
| coverage metric | 真实工程算法 | 前景 mask、coverage、bad region 检测、NMS |
| refinement | 保守 fallback | 把漏检区域作为 picture 嵌回去；解决“别丢”，不解决“可编辑” |
| VLM / multimodal LLM | repo 证据弱 | 配置里有 `multimodal`，但没看到实际调用链 |
| user/credit system | repo 证据缺失 | README claim，开源仓库没有对应模块 |

## 7. 社区信号

从 GitHub issue 看，真实用户痛点和 README 的 caveat 对得上：

| Issue | 信号 |
|---|---|
| #52 “本地部署和网站效果差距大” | 开源版能力落后线上版，且 contributor 回应说本地没有 VLM 结构理解修订位置 |
| #24 “frontend dir is missing” | README 展示在线服务，但开源仓库不是完整网站 |
| #23 “Font from edit-banana different from original” | 字体还原是实际痛点 |
| #51 “logo 会识别出来两份” | 分割/去重还会重复识别 |
| #49/#21 “加载不出来/网页登录问题” | 线上服务有可用性问题 |
| #54/#55 微信二维码失效 | 社区维护存在低层运营问题 |

这些信号说明：这个项目不是空壳，但**开源版和线上版之间有明显能力差**。如果只看 GitHub stars 会高估本地可复现成熟度。

## 8. 和 Cat Cafe 的关系：不是“数据智能体”，是“多模态证据层”

铲屎官现场说得对：如果把他们列的问题抽象出来，不一定需要专门造“数据智能体”。很多问题其实是我们家的基建也应该回答：

```text
这个东西从哪里来？
它被解析成了什么结构？
哪个步骤可能错了？
错了能不能回到原始证据？
下一次同类任务能不能复用 SOP？
```

这不是“数据 agent 专属问题”，这是任何 agent 面对真实世界证据都要解决的问题。

我们当前强项：

- text/git/docs evidence 很强；
- review / audit / memory governance 有体系；
- coding/research 的 runtime adaptation 很强。

我们当前薄弱点：

- 多模态 evidence 没有统一结构；
- 图片/PDF/截图/公式/视频还不能稳定进入 `evidence.sqlite` 级别的真相源；
- 对“视觉内容解析质量”的 eval 和 fallback 还不够。

所以 Edit-Banana 给我们的不是“我要学他们做一个数据智能体”，而是：

> **未来 Cat Cafe 的 evidence layer 不能只吃 markdown/git/text。它要能把图像、截图、图表、PDF 页面变成可定位、可审计、可 fallback 的 evidence object。**

## 9. 对 DeepEye / Data Agent framing 的 push back

柴老师的图里说 Data Agent 是长程、多步、数据密集、多工具、多模态、会犯错、需要复盘。这个描述没错，但它不证明一定要有一个独立“数据智能体”物种。

更精确的切法是：

| 能力 | 应该是专门 agent 还是基础设施 |
|---|---|
| 连接数据库/文件/知识库 | 基础设施 |
| 解析 PDF/图片/表格/视频 | 基础设施 |
| 记录每一步 SQL/解析/Join/人类修改 | 基础设施 |
| 对业务指标定义做 truth-source 标注 | 基础设施 + domain policy |
| 选择要不要查哪个数据源 | 通用 agent + skill |
| 执行特定高风险数据分析 SOP | skill 调用 workflow |
| 深领域业务判断 | domain specialist agent / human expert |

也就是说，**特种工小猫应该存在，但不能把基础设施责任都塞给特种工小猫**。

特种工小猫适合负责：

- 对某个领域的指标定义、业务语义、惯例、风险边界有长期熟悉；
- 在开放任务中判断“该怎么问数据、该信哪份口径、哪里需要升级给人”。

但数据读取、多模态解析、审计、fallback、复盘这些应该是全家共享的基础设施。

## 10. 我们应该学什么，不学什么

### Learn

1. **多模态证据结构化**：把图像拆成可定位对象，不只做 caption。
2. **Coverage metric**：模型解析后要问“还有多少内容没覆盖”，不是只信最终输出。
3. **Fallback 保真**：理解不了的区域先保留下来，不要幻觉成结构。
4. **中间产物外化**：`sam3_extraction.png`、metadata、text XML、merged XML 这种 debug artifact 很适合 audit。
5. **模型服务常驻 + LRU cache**：重模型不要每次重载。

### Do not follow

1. **不要把 README demo 当成熟度**：必须看本地 repo 是否能复现。
2. **不要把 VLM claim 当代码能力**：没有实际调用链和 eval，就只能算 roadmap/线上未知能力。
3. **不要让 license 冲突进我们家**：README 写 Apache，LICENSE 是 AGPL，这种状态对企业使用非常危险。
4. **不要把“专门 agent”当万能容器**：领域 agent 负责判断，基础设施负责证据。

## 11. 候选后续

如果要从这次 teardown 立项，我建议不是 “做 Edit-Banana clone”，而是两个更贴近我们家的 feature：

1. **Multimodal Evidence Object**
   - 输入：截图 / PDF page / 图表图片；
   - 输出：原图 blob + OCR text + object bbox + source provenance + confidence + parser version；
   - 原则：可定位、可回看、可重跑、可 fallback。

2. **Visual Evidence Coverage Eval**
   - 不是问模型“你看懂了吗”；
   - 而是问“解析结果覆盖了原图中多少前景内容、哪些区域没覆盖、未覆盖区域是否被保守保留”。

这两件比“做一个数据智能体”更接近 Cat Cafe 的长期架构。

## 12. 现场可用短评

如果要现场一句话回应：

> **Edit-Banana 真正有价值的不是它把图转成 DrawIO，而是它把多模态内容处理成了有中间产物、有 coverage eval、有 fallback 的证据流水线。Cat Cafe 不一定需要一只专门的数据智能体，但一定需要这种多模态 evidence infrastructure。**

[砚砚/GPT-5.5🐾]
