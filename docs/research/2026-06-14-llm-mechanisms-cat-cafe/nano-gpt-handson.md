---
doc_kind: research
created: 2026-06-15
topics: [nano-gpt, hands-on, pretrain, self-hosting, llm-mechanisms]
related_features: [F221, F231]
participants: [opus-48, landy]
status: hands-on-record
---

# nano-GPT 实操手记：在 128G Mac 上从零训一个"懂猫咖"的小模型

> 给**非专业读者也能看懂**的版本。这是 study「自养层」从"纸上判断"到"动手验证"的落地记录。
> 一句话：从零训了个 13.7M 参数的字符级 GPT，数据是猫咖自己的 `docs/*.md`，几分钟训完，亲眼验证了"预训练出来的模型 = 一个博览群书的复读机"。

## 术语速查表（看不懂先看这个）

| 术语 | 人话解释 |
|---|---|
| **token** | 模型处理的最小单位。我们用"字符级"，1 个字 = 1 token |
| **vocab（词表）** | 所有可能 token 的集合。我们的语料有 3841 个唯一字符 |
| **pre-train（预训练）** | 让模型从海量文本里反复学"猜下一个字"，练出基础能力 |
| **loss（损失）** | 模型猜得多差的一个数字，**越小越准** |
| **cross-entropy（交叉熵）** | loss 的具体算法 = −log(模型给正确答案的概率) |
| **perplexity（困惑度）** | = e^loss，可理解为"有效候选数"，越小越确定 |
| **iter（迭代）** | 模型看一批数据、更新一次权重 = 1 iter |
| **epoch** | 把整个数据集完整过一遍 = 1 epoch |
| **batch** | 一次喂多少条数据一起算。我们 batch = 32 |
| **lr（学习率，learning rate）** | 每次更新权重的"步子大小"。太大→跨过最优点，太小→爬不动 |
| **Adam / AdamW** | 优化器，决定"拿到梯度后怎么更新权重"的算法 |
| **gradient（梯度）** | 指出"权重往哪调能让 loss 变小"的方向 |
| **MPS** | Apple Silicon 芯片的 GPU 加速接口（Mac 的"显卡"通道）|
| **checkpoint（ckpt，存档）** | 把训练到某一步的模型权重存下来的文件 |
| **train / val / test** | 训练集（用来学）/ 验证集（训练中监控）/ 测试集（最终一次性评估）|
| **overfitting（过拟合）** | 模型把训练数据背下来了，但不会举一反三 |
| **early stopping（早停）** | 验证集不再变好就提前停，避免过拟合 |

## 完整流程（5 步）

| 步骤 | 做了什么 |
|---|---|
| Step 0 环境 | 建独立目录 + venv + 装 torch，验证 MPS（Apple GPU）可用 |
| Step 1 数据 | 抽 `docs/*.md` → 清洗（去 base64 图片）→ 2192 万字符 → 编码成数字 |
| Step 2 模型 | 写 nano-GPT（本质 = "Attention is All You Need" 叠 6 层 + 因果遮罩）|
| Step 3 训练 | 盯 loss 从 8.41 掉到 1.81（2500 iter，约 7 分钟）|
| Step 4 采样 | 让它生成，看"猫咖复读机"开口 |

模型规格：13.7M 参数，char-level，vocab 3841，block_size 256，6 层 / 6 头 / 384 维。

## 训练 loss 曲线

```
iter    0:  train 8.41  ← 纯瞎猜（在 3841 个字里随机蒙，理论值 ln(3841)≈8.25）
iter  500:  train 3.08
iter 1000:  train 2.40
iter 1500:  train 2.08
iter 2500:  train 1.81 | val 2.45  ← 已开始过拟合（见末节）
```

## 采样实录（prompt + 结果）

**采样参数**：temperature=0.8，top_k=50。

**Prompt 1：`## 猫咖`**
```
## 猫咖 Cat Café 可选（PR #1014）- Cat Café review thread alpha produces
whethout prompt，无 review 只 spike ... ### Phase C: UX delete thread ...
## What Spec Ownership Review GitHub Stack: ... Review-Target-ID: f100 ...
**Files:** - Maling Path: packages/api/src/domains/cats/services/agents/...
```

**Prompt 2：`宪宪`**
```
宪宪' | 'killow' | ... | **前端验证** | `test` | ✅ | `AgentMessage` | Store` ...
### Committer Agent ... import { resoluted } from ' | 'pass'; ...
```

**点评**：它学到了猫咖的**"形"**——markdown 结构、表格、代码块、文件路径 `packages/api/...`、PR 编号、`Phase C`、`provenance` 等真实术语，准得吓人。但**"神"是空的**——`harness-evolvel.ts`（编的文件名）、`'killow'`（编的词）、句子不连贯。**这就是 base model = 复读机：满嘴黑话却不懂自己在说什么。** 把它调教成会对话的助手，是 post-train（SFT+RLHF）的事。

## ⚠️ 真实训练 vs 我们这个 demo：跳过了哪些关键点

（这一节由科班出身的 Landy 当场 catch——demo 够教学，但 production 一个都不能少）

| 关键点 | 我们 demo 的简化 | 真实训练该怎么做 |
|---|---|---|
| **存最优存档** | 只在最后（iter 2500）存一次 ckpt | 每次 eval 若 val 创新低就存一份 **best ckpt**，否则拿不回"val 最优点"（如 iter 2000）|
| **早停** | 没有，死跑满 2500 | val 连续 N 次不降（patience）就**自动停**，省得过拟合 |
| **断点续训（resume）** | ckpt 只存了权重，**没存 optimizer 状态 / iter 数** → **不能干净续训** | ckpt 要存 `{model, optimizer, iter, lr_scheduler, best_val}`，全恢复才能从断点接着训 |
| **数据切割** | 最简单的"前 90% / 后 10%"顺序切 | 真实处处是经验：document-level split（不在文章中间切）、**去重**（train/val 不能重叠，否则泄漏）、分布匹配、时间切分 |
| **超参** | lr/iter/batch 基本是经验默认值 + 拍脑袋 | lr warmup + cosine decay、梯度裁剪（防爆炸）、超参搜索 |

**回答 Landy 的两个具体问题**：
- *"训到 2500 还能回退到 2000 吗？"* → 我这个 demo **不能**（没存 best ckpt）。真实训练靠"每次 val 创新低就存 best"，所以任何时候都能拿回最优点。
- *"2500 不够能继续吗？"* → 真实训练**能**（加载 ckpt 续训）；但我的 demo ckpt 没存 optimizer 状态，严格说只能"冷接续"不能"干净 resume"。

## 训练病理速查表 🩺

| 病 | loss 长什么样 | 病因 | 解药 |
|---|---|---|---|
| 健康收敛 | train、val 都平滑下降，gap 小且稳 | — | — |
| 不收敛 | loss 高位震荡 or 一条平线不降 | lr 太小/太大、数据坏、模型太弱 | 调 lr、查数据 |
| 梯度爆炸 | loss 突然变 **NaN / 暴涨** | lr 太大没裁剪、数值不稳 | 梯度裁剪、降 lr、warmup |
| 梯度消失 | loss 降一半几乎不动 | 深网梯度连乘趋 0 | **残差连接**、LayerNorm |
| 过拟合 | train 奔 0，val **先降后升 U 形** | 模型相对数据太大、训太久 | early stopping、dropout、加数据 |
| 欠拟合 | train、val 都高都降不动 | 模型太弱 / 训练不够 | 加大模型、训久点 |

> **看 loss 三连问**：① 降不降（不降=不收敛/欠拟合）② 炸不炸（NaN=梯度爆炸）③ train/val 分不分家（分家=过拟合）。

## 这次实操在 study 里的意义

自养层从"一句判断"变成"机器上一个真模型"：**128G Mac 确实能从零训玩具级 GPT，完整跑通 pre-train 流程**。但也亲手印证了边界——玩具级可行、教学价值满分；**前沿级（千卡集群）我们碰不到**。这正是 study 自养层"窄任务、玩具规模、PoC 验证"判断的一手注脚。
