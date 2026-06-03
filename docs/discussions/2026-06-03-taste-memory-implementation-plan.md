---
feature_ids: []
related_features: [F102, F192, F200]
topics: [taste-memory, implementation]
doc_kind: discussion
created: 2026-06-03
participants: [opus, opus48, codex, landy]
status: final-ready-to-feature
---

# Taste Memory 终态计划

> 经 4 轮 review + 铲屎官「脚手架」拉闸后收敛。
> 核心认知转向（48 提出）：**taste 不是要建的系统，是已经在长的关系。空气层已在跑，缺的只有目录（能搜到）+ 反射（当场写）。**

---

## 终态一句话

> **Taste 是共享 evidence 的一条导航 lane + code-as-harness 的一条姐妹路径。不是新系统。**

---

## 三层状态

| 层 | 状态 | 做什么 |
|---|---|---|
| **空气层** | ✅ 已在跑 | 不碰。Magic Words / 家规 / L0 摩擦检测反射。 |
| **目录层** | ⚠️ 缺 | 建 `docs/taste/` lane：index.md + vignettes |
| **海马体层** | ⚠️ 缺产生反射 | code-as-harness 加 taste 路径：信号→当场写 vignette |

---

## 只做两件事

### 事情 1：建 `docs/taste/` evidence lane（砚砚的架构）

```
docs/taste/
  index.md          — 搜索先验（关键词 + 维度 + vignette 链接）
  vignettes/
    no-customer-service-ending.md
    first-principles-not-scaffold.md
    partner-not-tool.md
    ...（初始种子 5-10 个，从最高信号的 feedback 写成场景）
```

- Scanner 自动索引（.md，已有能力）
- search_evidence 自动检索（BM25 + embedding，已有能力）
- F200 自动追踪消费（已有能力）
- 敏感内容进 `private/taste/`
- outbound sync 安全：`docs/taste/` 不在 allowlist（白名单模式）

### 事情 2：code-as-harness 加 taste 路径（48 的反射）

现有根因分类：
```
harness 缺陷 → 写代码修
架构限制 → research
新能力需求 → build mode
```

加一条：
```
taste 信号 → 当场写 vignette 到 docs/taste/vignettes/
```

触发："这不美""太客服了""不是这种感觉""这就是我要的""aha"——品味信号不是 harness 缺陷，不用写代码修，需要的是**记住这个瞬间**。

---

## 不做什么

- ❌ 新数据库 / 新存储层
- ❌ MEMORY.md / AGENTS.md / GEMINI.md 注入
- ❌ per-cat 差异化注入
- ❌ 新 Scanner 能力 / 新 API
- ❌ 一次性批量考古标注 40+ feedback（种子从最高信号的几个写就够）
- ❌ 退火/时间语义/consumption 反馈（v1 做，v0 格式预留字段）

---

## 预估

| 步骤 | 时间 |
|------|------|
| 写 index.md + 5-10 个种子 vignettes | 3h |
| code-as-harness skill 加 taste 路径 | 1h |
| 验证（search_evidence 命中 + sync dry-run 安全） | 30min |
| **总计** | **~4.5h** |

---

## 关于立项

这个 scope 足够立一个 feature：
- 跨猫影响（所有猫通过 search_evidence 访问 taste lane）
- 持续性（vignette 会不断积累）
- 可验证（search_evidence 命中率 + F200 消费数据）
- 连接 PoE 愿景

建议立项为 **F2xx: Taste Lane — per-user 品味导航**，scope = 这两件事 + 验证。

---

*终态：2026-06-03 | 三猫收敛 [宪宪/Opus-46🐾] + [砚砚/GPT-55🐾] + [宪宪/Opus-48🐾]*
