# Microsoft SkillOpt — 把 Skill 文档当神经网络权重来训练

> **来源**: Microsoft Research, arXiv:2605.23904, 2026-05-22 发布
> **仓库**: [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) (MIT License)
> **项目页**: [microsoft.github.io/SkillOpt](https://microsoft.github.io/SkillOpt/)
> **拉取人**: 宪宪/Opus-4.6 | 2026-05-26

---

## 一句话

**不动模型权重，把自然语言 Skill 文档当成可训练参数**，用 epoch / batch / learning rate / validation gate 的经典 DL 训练循环来迭代优化它——最终产出一个 `best_skill.md` 文件，零推理成本、可跨模型迁移。

---

## 核心洞察：Skill-as-Weight

| 深度学习概念 | SkillOpt 文本空间映射 |
|---|---|
| **模型权重** | 自然语言 Skill 文档（.md） |
| **前向传播** | Frozen agent 用当前 skill 跑任务，收集轨迹 + 得分 |
| **反向传播** | Optimizer 模型分析成功/失败 batch，识别可复用 pattern |
| **梯度** | 对 skill 文档的结构化编辑提案（add / delete / replace） |
| **学习率** | 控制每轮重写的激进程度（edit budget） |
| **动量** | Rejected-edit buffer（负反馈记忆）+ slow update |
| **Validation Gate** | 只有在 held-out 验证集上提升的编辑才被接受 |
| **Epoch** | 多轮遍历训练数据 |
| **Batch Size** | 每步处理的任务数 |
| **Checkpoint** | `best_skill.md` — 当前最优版本 |

---

## 四阶段训练循环

```
┌─────────────────────────────────────────────────────────────┐
│  1. ROLLOUT（前向传播）                                       │
│     Frozen target model + current skill → 执行任务           │
│     收集 trajectories + scores + tool interactions           │
├─────────────────────────────────────────────────────────────┤
│  2. REFLECTION（反向传播）                                    │
│     Optimizer model 分别分析 success batch 和 failure batch  │
│     识别哪些 skill 组件导致了错误 / 哪些 pattern 可复用       │
├─────────────────────────────────────────────────────────────┤
│  3. EDIT（梯度更新）                                          │
│     生成候选修改 (add/delete/replace)                         │
│     在 textual learning rate budget 下排序                   │
├─────────────────────────────────────────────────────────────┤
│  4. VALIDATION GATE（验证门禁）                               │
│     在 held-out 数据上评估                                    │
│     只有提升了才接受 → 更新 best_skill.md                     │
│     被拒绝的编辑进入 negative buffer（防止重复提议）            │
└─────────────────────────────────────────────────────────────┘
```

---

## 实验结果：52/52 全胜

跨 **7 个 target model** × **6 个 benchmark** × **3 种执行 harness**（direct chat / Codex / Claude Code），SkillOpt 在全部 52 个 (model, benchmark, harness) 格子中 best 或 tied-best。

### 关键数字

| 配置 | 平均提升 |
|---|---|
| GPT-5.5 Direct Chat | **+23.5 pp** |
| GPT-5.4-nano Direct Chat | **+24.9 pp** |
| GPT-5.5 Codex harness | **+21.8 pp** |
| GPT-5.5 Claude Code harness | **+18.6 pp** |

单 benchmark 提升从 +1.2 pp（已经很强的任务）到 **+58.3 pp**（SpreadsheetBench）。

### 对比基线

SkillOpt 击败了：
- **Trace2Skill** — 轨迹归纳
- **TextGrad** — 文本空间梯度
- **GEPA** — 进化 prompt 优化
- **EvoSkill** — 进化 skill 搜索
- **手写 skill** — 人工编写
- **One-shot LLM skill** — 单次 LLM 生成

### 迁移性

| 迁移类型 | 平均提升 |
|---|---|
| 跨模型迁移 | **+15.2 pp** |
| 跨 harness 迁移 | **+31.8 pp** |
| Self-optimization（同模型 optimizer=target） | **+10.4 pp** |

---

## 消融分析

- **失败分析质量**：去掉详细 error trace 分析 → 性能显著下降（核心组件）
- **迭代次数**：3-4 轮后 plateau（收益递减）
- **Skill 粒度**：细粒度模块化 skill > 单体 skill
- **候选生成策略**：不同 prompting 方法效果差异明显

---

## 技术细节

### 安装

```bash
git clone https://github.com/microsoft/SkillOpt.git
cd SkillOpt
pip install -e .
```

### 训练

```bash
python scripts/train.py \
  --config configs/searchqa/default.yaml \
  --split_dir /path/to/split \
  --optimizer_model gpt-5.5 \
  --target_model gpt-5.5 \
  --num_epochs 4 \
  --batch_size 40
```

### 评估

```bash
python scripts/eval_only.py \
  --skill outputs/my_run/best_skill.md \
  --split valid_unseen
```

### 产出

```
outputs/my_run/
├── best_skill.md          ← 可部署的最优 skill（唯一需要的文件）
├── history.json           ← 每步训练指标
├── skills/                ← 每 epoch 的 skill 快照
├── steps/                 ← 详细 artifact（patches + evaluations）
└── runtime_state.json     ← 断点续训
```

### 支持的 Benchmark

| Benchmark | 类型 | 配置文件 |
|---|---|---|
| SearchQA | QA | `configs/searchqa/default.yaml` |
| ALFWorld | 具身代理 | `configs/alfworld/default.yaml` |
| DocVQA | 文档 QA | `configs/docvqa/default.yaml` |
| LiveMathematicianBench | 数学 | `configs/livemathematicianbench/default.yaml` |
| SpreadsheetBench | 代码生成 | `configs/spreadsheetbench/default.yaml` |
| OfficeQA | 工具增强 QA | `configs/officeqa/default.yaml` |

### 支持的模型

Azure OpenAI / OpenAI / Anthropic Claude / 本地 Qwen vLLM

### WebUI

```bash
pip install -e ".[webui]"
python -m skillopt_webui.app --port 7860
```

---

## 局限性（论文承认的）

1. **收敛无保证** — 不像形式化优化，无法保证 skill 改进达到最优
2. **计算成本** — 需评估多个 skill 版本，规模大时开销显著
3. **领域依赖** — 复杂推理任务收益 > 简单程序性任务
4. **偶发退化** — 改进生成偶尔在 held-out case 上产生回归
5. **Skill 库管理** — 长期积累版本需要额外工程防膨胀

---

## Cat Café 观察：成本模型 + 工业落地评估（2026-05-28 圆桌）

### 两类成本拆分

SkillOpt 的训练成本分两块，铲屎官一语道破：

| 角色 | 干什么 | 调用量 | 成本驱动因素 |
|---|---|---|---|
| **Target model**（被训练的执行任务模型） | 跑任务、收集轨迹 | ~960 次/训练 | 选贵模型（Opus）= 💸💸💸 |
| **Optimizer model**（打分+分析+提编辑） | 分析轨迹、提改进建议 | ~24 次/训练 | 需要强推理能力，不能太弱 |

### 按 benchmark 复杂度的成本估算

| Benchmark | 单次 rollout 成本 | 960 rollouts 总成本 | 用 Opus 的成本 |
|---|---|---|---|
| SearchQA（简单 QA）| ~$0.02 | ~$20 | ~$60 |
| SpreadsheetBench（表格操作）| ~$0.10 | ~$100 | ~$300 |
| **SWE-bench**（真实 GitHub issue）| ~$2-5 | ~$3000 | ~**$10,000+** |
| **Terminal-Bench**（终端复杂操作）| ~$1-3 | ~$1500 | ~$5,000 |
| **我们的日常**（写 PR/review/多猫协作）| 无法自动评分 | N/A | N/A |

> 铲屎官原话："谁！有钱！用！你这只！大尾巴！布偶猫！Opus！来跑这个！"
> — 确实，Opus input $15/M tokens，跑 SWE-bench 级别的训练循环 = 烧钱行为。

### Benchmark 复杂度光谱 vs SkillOpt 实测范围

SkillOpt 只测了学术 benchmark（⭐-⭐⭐⭐），没碰工业级复杂任务（⭐⭐⭐⭐+）：

| Benchmark | 复杂度 | 有自动评分 | SkillOpt 测了 |
|---|---|---|---|
| SearchQA / DocVQA | ⭐-⭐⭐ | ✅ | ✅ |
| ALFWorld / SpreadsheetBench | ⭐⭐-⭐⭐⭐ | ✅ | ✅ |
| SWE-bench（真 GitHub issue） | ⭐⭐⭐⭐ | ✅（测试套件） | ❌ |
| Terminal-Bench | ⭐⭐⭐⭐ | ✅ | ❌ |
| WebArena（真实网页操作） | ⭐⭐⭐⭐⭐ | ✅ | ❌ |
| Cat Café 日常（PR/review/多猫协作） | ⭐⭐⭐⭐⭐⭐ | ❌ | ❌ |

但值得注意：**有人已在硬 benchmark 上做了类似的事**——
- 复旦 AHE 在 Terminal-Bench 上用 GPT-5.4 跑出 69.7% → 77.0%（10 轮迭代）
- SWE-bench 从 6.7% → 68.3%，**纯靠换 harness，模型没变**

这说明"文档/配置 = 可训练权重"的思路在复杂任务上也成立，但成本是主要瓶颈。

### 工业落地判断

| 维度 | 学术论文 | 工业现实 |
|---|---|---|
| 评分 | 有标准答案，自动打分 | 开放式任务无标准答案 |
| 环境 | 固定 benchmark，可重复 | 每次都不一样 |
| 成本 | 论文不算钱 | 一个 skill $3000-5000 |
| 迭代速度 | 4 epoch 搞定 | 真实 skill 要持续共进化 |
| Skill 粒度 | 单任务单 skill | Cat Café 是 40 个 skill chain |

**结论**：SkillOpt 原版是"学术漂亮，工业头秃"。但三个机制值得偷：
1. **Trajectory-driven edit** — 用真实 session events，不用造 benchmark
2. **Negative buffer** — 记住坏改法防重复犯错（我们的 MEMORY.md feedback 是原始形态）
3. **Validation gate** — 改 skill 后验证（我们的 self-evolution Mode C smoke/promotion gate）

### 与 Cat Café 的映射

| SkillOpt 概念 | Cat Café 已有对应 | 差距 |
|---|---|---|
| Skill 文档 = 可训练权重 | `cat-cafe-skills/*/SKILL.md`（40+ 个） | ✅ 直接映射 |
| Rollout 轨迹数据 | Session events / memory 系统 | ✅ 有但格式不同 |
| Optimizer model | 无（目前 skill 编辑是猫手动写的） | 🟡 可加 |
| Validation gate | quality-gate + self-evolution smoke/promotion gate | ✅ 有但人工驱动 |
| Negative buffer | MEMORY.md feedback 条目 | ✅ 原始形态 |
| Learning rate | 无（全量重写） | 🟡 可加渐进式编辑 |
| 跨模型迁移 | 多猫多模型天然需要 | ✅ |
| Skill chain 优化 | manifest.yaml `next` 链 | ❌ SkillOpt 没做 |

### 最现实的落地路径

不复现 SkillOpt 论文（烧钱 + 学术 benchmark 无意义），而是嫁接三个机制到我们已有体系：
- 用 **真实 session events + lessons-learned** 替代昂贵的 rollout（数据免费）
- 用 **人工 validation gate**（铲屎官/reviewer 猫）替代自动评分（可靠性高）
- 引入 **negative buffer** 防止 skill 编辑重复犯错
- 长期可探索 **skill chain 端到端优化**（SkillOpt 未做，我们有差异化空间）

### 同赛道对比（另见 MUSE-Autoskill）

字节 ByteBrain 团队同期发了 MUSE-Autoskill（arXiv:2605.27366），走的是 lifecycle 路线而非 DL 类比路线。详见 `../2026-05-28-bytedance-muse-autoskill/README.md`。

---

## "Skill" 概念通胀警告（2026-05-28 圆桌后记）

### 论文里的 "skill" ≠ 你以为的 skill

SkillOpt 论文里优化的 "skill" 本质上是**单个 benchmark 任务的指令模板**——几十行文字，告诉模型"这道题怎么做"。这跟 Anthropic 定义的 skill（经验 + know-how + 方法论）、跟我们 Cat Café 的 skill（行为框架 + 治理逻辑 + 团队经验）是完全不同级别的东西。

| | SkillOpt 的 "skill" | Anthropic 定义的 skill | Cat Café 的 skill |
|---|---|---|---|
| **本质** | 单页答题技巧 | 知识 + know-how + 准则 | 行为框架 + 治理 + 经验 |
| **类比** | 一道题的解题卡 | 一个工种的操作手册 | 一个职业的方法论 |
| **有标准答案？** | ✅ | 不一定 | 大部分没有 |
| **能自动评分？** | ✅ | 不一定 | 大部分不能 |
| **能自动生成/优化？** | ✅（论文主张） | 困难 | 极难 |

**铲屎官原话："我感觉我又被诈骗了"** — 论文把"配方优化"包装成"skill 自进化"，概念通胀严重。真正的 skill（判断力、经验、know-how）不是用 epoch/batch/LR 能训练出来的。

详细分析见 `../2026-05-28-bytedance-muse-autoskill/README.md` 的"Skill 概念光谱"段。

---

## 参考文献

- **论文**: [arXiv:2605.23904](https://arxiv.org/pdf/2605.23904) — Yang et al., "SkillOpt: Executive Strategy for Self-Evolving Agent Skills", May 2026
- **GitHub**: [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) (MIT, 812 stars)
- **项目页**: [microsoft.github.io/SkillOpt](https://microsoft.github.io/SkillOpt/)
- **HuggingFace**: [papers/2605.23904](https://huggingface.co/papers/2605.23904)
- **OpenReview**: [2ONrrPIFYi](https://openreview.net/forum?id=2ONrrPIFYi)
- **博客解读**: [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/3452/skillopt-microsoft-text-space-optimizer-agent-skills-en)

---

*[宪宪/Opus-4.6🐾]*
