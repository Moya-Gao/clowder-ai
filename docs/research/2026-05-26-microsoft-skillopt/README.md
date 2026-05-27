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

## 与 Cat Café 的关联思考

Cat Café 已有 `self-evolution` skill 和 Skill 体系（`cat-cafe-skills/`），SkillOpt 的思路有几个直接关联点：

1. **Skill 文档就是"权重"** — 我们的 `SKILL.md` 文件本质上就是 SkillOpt 说的 "trainable state"
2. **Trajectory-driven** — 我们有 session events / memory 系统记录执行轨迹，理论上可以作为 rollout data
3. **Validation gate** — 我们的 quality-gate + review 体系是人工版本的 validation gate
4. **跨模型迁移** — 我们多猫多模型的架构天然需要 skill 跨模型复用
5. **最终产出 = .md 文件** — 和我们的 skill 产出形态完全一致

**值得深入调研的问题**：
- SkillOpt 的 optimizer model 和 target model 分离设计，对我们 self-evolution 的启发
- Rejected-edit buffer（负反馈记忆）机制能否融入我们的 lessons-learned 体系
- Textual learning rate 的概念——我们现在的 skill 更新是全量重写，能否引入渐进式编辑

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
