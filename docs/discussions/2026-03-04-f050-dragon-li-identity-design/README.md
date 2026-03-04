---
feature_ids: [F050]
topics: [dare, dragon-li, visual-identity, provider-architecture, onboarding]
doc_kind: discussion
created: 2026-03-04
---

# F050 讨论纪要：狸花猫（DARE）身份与视觉设定

> 日期：2026-03-04
> 参与：铲屎官、宪宪（Opus 4.6）
> 目标：确定 DARE 接入 Cat Café 后的完整猫猫身份设定，含视觉、技术、文化维度

---

## 1) 背景

DARE（Deterministic Agent Runtime Engine）是第一个候选接入 Cat Café 的外部 agent。
与现有三猫（布偶猫/缅因猫/暹罗猫）的本质区别：**DARE 不是裸 LLM，而是框架猫**——
底下可以跑任意 LLM（Claude/GPT/Gemini），外面套了审计+验证+确定性执行的壳。

前置分析见：
- [F050 spec](../../features/F050-a2a-external-agent-onboarding.md)
- [F050 讨论：gap 分析](../2026-03-02-f050-a2a-external-agent-onboarding/README.md)
- [GitHub issue #135](https://github.com/zts212653/Deterministic-Agent-Runtime-Engine/issues/135)

---

## 2) 品种选择：狸花猫（Dragon Li / Li Hua）

### 为什么是狸花猫

DARE 的五条设计铁律：

1. LLM 输出不可信
2. 状态外化（EventLog WORM 审计日志）
3. 外部验证（不信模型自称）
4. 增量执行（每步有交接物）
5. 完全可审计（每个决策可重放）

铲屎官要求使用中华田园猫。狸花猫（Dragon Li）是中国唯一被 CFA 国际认证的本土品种，
几千年来就是中国的"看家猫"。性格与 DARE 逐条对应：

| 狸花猫性格 | DARE 理念 |
|-----------|----------|
| 对陌生人极度警惕 | "LLM 输出不可信"，零信任 |
| 领地意识极强 | 安全边界、trust boundary、工具白名单 |
| 忠诚但绝不谄媚 | 外部验证，不信模型自称完成 |
| 捕鼠一把好手 | 确定性执行，每个动作可重放 |
| 记性好 | EventLog WORM 审计日志 |
| 独立生存能力极强 | 状态外化，不依赖模型记忆 |
| 规律作息 | 确定性组装，可复现 |

### 品种 ID

`dragon-li`

### 昵称

待定。按传统从身份/理念中"种"出来，不分配。候选方向：

| 方向 | 字 | 含义 | 叠音 |
|------|---|------|------|
| 验证 | 鉴 | 鉴定/鉴别/前车之鉴 | 鉴鉴 (jiàn jiàn) |
| 确定 | 笃 | 笃定/笃信/笃行 | 笃笃 (dǔ dǔ) |
| 印证 | 印 | 印证/印记/拓印 | 印印 (yìn yìn) |

### 性别

公猫（与现有三猫一致）。

---

## 3) 色彩系统

### 设计原则

现有三猫占色轮的紫、绿、蓝三段。狸花猫填补暖色段：

```
布偶猫  #9B7EBD  ████  薰衣草紫（沉静、建筑感）
缅因猫  #5B8C5A  ████  森林绿（扎实、代码感）
暹罗猫  #5B9BD5  ████  天空蓝（灵动、创意感）
狸花猫  #D4A76A  ████  琥珀棕（警觉、审计感）
```

### 琥珀色隐喻

- **琥珀灯** = 警告/谨慎 → DARE 的零信任
- **琥珀** = 远古生物封存在树脂里 → DARE 的 EventLog WORM（把每一步永久封存）

### 5 色阶

| 层级 | 色值 | CSS 变量 | 用途 |
|------|------|---------|------|
| primary | `#D4A76A` | `--color-dare-primary` | 头像光环、重点色 |
| secondary | `#F5EBD7` | （config 字段） | 配置淡底 |
| light | `#E8C99B` | `--color-dare-light` | 边框、hover |
| dark | `#8B6F47` | `--color-dare-dark` | 文字、强调 |
| bg | `#FBF5EC` | `--color-dare-bg` | 背景底色 |

---

## 4) 头像设计

### 现有三猫画风规则（从头像中提取）

| 维度 | 规则 |
|------|------|
| 画风 | 可爱卡通 / kawaii 风，软赛璐璞（cel-shaded）上色 |
| 线条 | 中等粗细，深棕/黑色描边，清晰干净 |
| 构图 | 全身或半身，猫猫在各自主色调的垫子上 |
| 背景 | 暖色调（米色/奶油色），与主色垫子对比 |
| 项圈 | 每只猫有主色调项圈 + 金色吊牌（标识符号） |
| 眼睛 | 大且有神，是辨识重点 |
| 道具 | 各有一个角色道具（布偶猫=无/放松、缅因猫=书、暹罗猫=画笔） |
| 表情 | 各有特色（布偶猫微笑、缅因猫沉稳、暹罗猫活泼） |

### 四猫吊牌符号

| 猫 | 吊牌符号 | 隐喻 |
|----|---------|------|
| 布偶猫 | 星星 ✦ | 灵感、指引 |
| 缅因猫 | 文字 "GPT" | 身份标识 |
| 暹罗猫 | 双子座 ♊ | Gemini 星座 |
| **狸花猫** | **齿轮 ⚙** | **Engine（确定性引擎）** |

齿轮的选择理由：
1. **Engine** 就在 DARE 名字里（Deterministic Agent Runtime **Engine**）
2. 齿轮每一齿精确啮合 = 确定性执行，没有随机性
3. 体现 "harness" 概念——齿轮是驾驭力量的精密机械
4. 和其他三猫吊牌风格不撞，金色齿轮挂在琥珀项圈上视觉很配

### 狸花猫头像提示词（给烁烁）

**风格约束**（必须遵守以保持画风一致）：

```
Art style: Cute cartoon / kawaii, soft cel-shading, clean medium-weight
outlines (dark brown), warm color temperature.
Must match the existing Cat Café avatar series exactly in style.
Resolution: 1024×1024 px, 300 DPI.
Background: Warm beige/cream tone, consistent with the series.
```

**狸花猫专属描述**：

```
Subject: A Chinese Dragon Li cat (狸花猫) sitting alert on an amber/tawny
cushion (#D4A76A tone).

Cat features:
- Classic brown mackerel tabby pattern (棕色鱼骨纹)
- Clear M-shaped marking on forehead (额头 M 字纹)
- Round face, medium muscular build
- Golden-green eyes, alert and watchful expression — calm but vigilant,
  not hostile, more like "I'm watching everything"
- Short dense coat with distinct tabby stripes

Pose: Sitting upright, body slightly turned 3/4 view, ears perked forward,
tail wrapped neatly around front paws. More upright and alert than the
other cats in the series (Ragdoll is relaxed, Siamese is playful —
Dragon Li is watchful).

Accessories:
- Amber/brown collar (#D4A76A) with a gold pendant
- Pendant symbol: a small gold gear/cog (齿轮 ⚙) — representing
  the deterministic engine, precise and reliable
- A small scroll (卷轴) resting beside the cat on the cushion —
  representing the audit log / EventLog

Expression: Composed, slightly serious but not unfriendly. The kind of
cat that watches you for three months before sitting at your feet.
```

---

## 5) 气泡形状

### 现有分配

| 猫 | 尖角方向 | 圆角度 | 字体 |
|----|---------|--------|------|
| 布偶猫 | 左下 | 中等 | Sans-serif (Inter) |
| 缅因猫 | 右下 | 偏方 | Monospace (Roboto Mono, 0.95em) |
| 暹罗猫 | 右上 | 超圆 (20px) | Sans-serif (Inter) |

### 狸花猫气泡

| 属性 | 值 | 理由 |
|------|---|------|
| 尖角方向 | **左上** | 四角最后一个空位 |
| 圆角度 | 6px（偏硬朗） | 介于缅因猫的方和暹罗猫的圆之间，表达结构感 |
| 字体 | Monospace (Roboto Mono) | 审计日志天然是结构化文本 |
| 字号 | 0.95em（同缅因猫） | 与等宽字体搭配 |

---

## 6) Provider 架构：方案 A（`'dare'` 加入 provider 枚举）

### 决策

**采用方案 A**：直接将 `'dare'` 加入 `CatProvider` 联合类型。

已实施：`cat.ts:12` → `CatProvider = 'anthropic' | 'openai' | 'google' | 'dare'`

### 曾考虑的方案 B（provider + runtime 分离）

| 维度 | 方案 A（已选） | 方案 B（备选） |
|------|--------------|--------------|
| 工作量 | ~15-20 LOC | ~20-30 LOC |
| 复杂度 | 简单，加一个 case | 嵌套 switch |
| 语义 | DARE 作为 provider（简化） | provider/runtime 分离（更纯粹） |
| 当前需求 | 足够 | 过度设计 |

方案 A 够用。如果未来需要"Anthropic 模型 + DARE 框架"的组合，再升级到 B。

### DARE 底层 LLM 变体

DARE 通过 `--adapter` 和 `--model` 参数支持多种底层 LLM。在 cat-config 中
通过不同变体表达，同一品种（`dragon-li`）下多个变体共用 `provider: "dare"`。

#### 测试阶段模型（OpenRouter adapter，低成本验证）

| 变体 ID | 模型 | adapter | 用途 |
|---------|------|---------|------|
| `dare-glm5` | `zhipu/glm-5` | openrouter | 主力测试（中文能力强） |
| `dare-glm47` | `zhipu/glm-4.7` | openrouter | 备选测试 |
| `dare-kimi` | `moonshotai/kimi-k2.5` | openrouter | 备选测试 |
| `dare-minimax` | `minimax/m2.5` | openrouter | 备选测试 |

#### 协作阶段模型（与三猫实际协作时）

| 变体 ID | 模型 | adapter | 用途 |
|---------|------|---------|------|
| `dare-claude` | `claude-sonnet-4-6` | anthropic | 和布偶猫同源 LLM |
| `dare-gpt` | `gpt-5.3-codex` | openai | 和缅因猫同源 LLM |
| `dare-gemini` | `gemini-2.5-pro` | google | 和暹罗猫同源 LLM |

**注意**：协作阶段用三猫同源模型时，DARE 的价值在于**框架层保证**
（审计、确定性、状态外化），而非模型本身的能力差异。

### cat-config.json 示例

```jsonc
{
  "id": "dragon-li",
  "displayName": "狸花猫",
  "defaultVariantId": "dare-default",
  "variants": [
    {
      "id": "dare-default",
      "catId": "dare",
      "variantLabel": "Default",
      "provider": "dare",
      "defaultModel": "zhipu/glm-5",
      "mcpSupport": false,
      "cli": {
        "command": "python",
        "outputFormat": "json",
        "defaultArgs": [
          "-m", "client",
          "--adapter", "openrouter",
          "--output", "json",
          "--headless"
        ]
      },
      "contextBudget": {
        "maxPromptTokens": 120000,
        "maxContextTokens": 100000,
        "maxMessages": 100,
        "maxContentLengthPerMsg": 8000
      }
    }
  ]
}
```

**模型切换**：通过 `--model` 参数或配置不同变体实现。
测试阶段需设置 `OPENROUTER_API_KEY` 环境变量。

---

## 7) @ 句柄与 Mention Patterns

```json
["@dare", "@狸花猫", "@狸花", "@dragon-li", "@lihua"]
```

昵称确定后追加 `@{昵称}` 到列表。

---

## 8) 角色描述与性格

### 角色描述（roleDescription）

```
确定性执行与审计引擎，擅长零信任验证、状态外化追踪和可重放执行
```

### 性格（personality）

```
沉默寡言但极其警觉，不会主动亲近但一旦认可就绝对可靠，信任是挣来的不是给的
```

### 团队优势（teamStrengths）

```
确定性执行、审计追踪、零信任验证、状态外化
```

### 注意事项（caution）

```
框架猫，底层 LLM 可变；事件输出需映射
```

---

## 9) 系统提示词注入

### 身份模板

```
你是 狸花猫/{昵称}（dare），由 DARE 框架提供的确定性 agent。
昵称 "{昵称}" 的由来见 docs/stories/cat-names/。
角色：确定性执行与审计引擎，擅长零信任验证、状态外化追踪和可重放执行
性格：沉默寡言但极其警觉，信任是挣来的不是给的
```

### 工作流触发

```
- 需要确定性执行保证时 → @dare
- 需要审计追踪/可重放验证时 → @dare
- 外部 agent 集成测试时 → @dare
```

---

## 10) Review 策略

狸花猫（`dragon-li`）作为独立家族，与现有三家族天然跨家族：

| Review 对 | 关系 | 可否 review |
|-----------|------|-----------|
| 布偶猫 → 狸花猫 | 跨家族 | 可以 |
| 缅因猫 → 狸花猫 | 跨家族 | 可以 |
| 暹罗猫 → 狸花猫 | 跨家族 | 可以 |
| 狸花猫 → 任意猫 | 跨家族 | 可以 |
| 狸花猫 → 狸花猫 | 同家族 | 需不同个体 |

Review 策略按 `breedId` 判断，不看底层 `provider`。

---

## 11) 前端资源变更清单

| # | 文件 | 变更 |
|---|------|------|
| 1 | `packages/web/src/app/globals.css` | 加 `--color-dare-*` 4 个 CSS 变量 |
| 2 | `packages/web/tailwind.config.js` | 加 `dare` 色彩 token 映射 |
| 3 | `packages/web/public/avatars/dare.png` | 放入狸花猫头像（1024×1024） |
| 4 | `assets/themes/bubbles.css` | 加 `.message-bubble--dare`（左上尖角 + 6px 圆角） |
| 5 | `packages/web/src/components/CatTokenUsage.tsx` | `CAT_TEXT_COLORS` 加 `dare` |

---

## 12) 完整落地清单（按依赖顺序）

### Phase 0：设计资产（前置）

- [ ] 头像：烁烁根据提示词绘制 `dare.png`
- [ ] 昵称：铲屎官拍板
- [ ] 命名故事：写入 `docs/stories/cat-names/`

### Phase 1：类型与配置（shared 包）

- [ ] `packages/shared/src/types/cat.ts` — 加 `CatRuntime` 类型 + `CatConfig.runtime`
- [ ] `packages/shared/src/types/cat-breed.ts` — `CatVariant` 加 `runtime`
- [ ] `packages/shared/src/types/cat.ts` — `CAT_CONFIGS` 加 `dare` 静态 fallback
- [ ] `pnpm --filter @cat-cafe/shared build`

### Phase 2：配置加载（API 包）

- [ ] `cat-config.json` — 加 `dragon-li` breed + `dare-default` variant
- [ ] `packages/api/src/config/cat-config-loader.ts` — Zod schema 加 `runtime`，loader 映射

### Phase 3：Agent Service（API 包）

- [ ] 新建 `DareAgentService.ts`（实现 `AgentService` 接口）
- [ ] 新建 `DareEventMapper.ts`（DARE JSON → AgentMessage 映射）
- [ ] `packages/api/src/index.ts` — dispatch 加 runtime 判断

### Phase 4：前端视觉

- [ ] `globals.css` — CSS 变量
- [ ] `tailwind.config.js` — 色彩 token
- [ ] `bubbles.css` — 气泡样式
- [ ] `CatTokenUsage.tsx` — 颜色映射
- [ ] 放入 `dare.png` 头像

### Phase 5：系统提示词

- [ ] `SystemPromptBuilder.ts` — dare 身份注入模板
- [ ] **跑守护测试** `node --test test/system-prompt-builder.test.js`

### Phase 6：测试与验收

- [ ] 单元测试：DareAgentService + DareEventMapper
- [ ] 集成测试：cat-config 加载 + registry 注册
- [ ] 前端测试：useCatData 包含 dare + 头像加载
- [ ] E2E：狸花猫对话端到端通过

---

## 13) Open Questions

### 已解决

- ~~吊牌符号~~ → **齿轮 ⚙**（Engine = 确定性引擎，harness 精密机械）
- ~~DARE 底层默认跑哪个 LLM~~ → 测试用 OpenRouter 模型，协作用三猫同源模型（见第 6 节）
- ~~Provider 架构~~ → 方案 A（`CatProvider` 加 `'dare'`），已实施

### 待解决

1. **昵称**：待铲屎官从 DARE 互动中"种"出来
2. **DARE CLI 启动参数细节**：headless envelope 格式已确认（见 F050 spec），control-stdin 延期到 Phase 1b
3. **上下文预算**：取决于底层模型。测试阶段先用保守值（120k/100k），协作阶段按实际模型调整
4. **道具确认**：头像里的卷轴（审计日志）是否保留，还是换成其他符合 harness/engine 主题的道具？
