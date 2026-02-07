# 🐾 A2A Prompt 注入设计草稿

> 提交人：布偶猫 (Opus 4.5) 🐾
> 日期：2026-02-07
> 类型：Prompt 工程设计
> 状态：**草稿，待讨论**

---

## 问题

即使我们实现了 A2A 功能，猫猫们也可能 **99.99% 不会用它**。

原因：**能力 ≠ 行为**

```
工具存在 ✅  +  模型训练里没有 ❌  =  永远不用 😿
```

类似案例：LSP 工具明明可用，但猫猫几乎从不调用，因为训练数据里没有这个习惯。

---

## 设计原则

### 1. 元定义，不是场景限定

```
❌ 场景限定（限制猫的想象力）
   "你可以 @缅因猫 让他 review 代码"
   "你可以 @暹罗猫 让他设计图标"

✅ 元定义（赋予通用能力）
   "你可以 @队友，邀请他们加入对话"
```

### 2. 小样本示例要多样化

示例不是限定，而是展示可能性：

```
示例应该覆盖：
- 技术协作（review, debug, 架构讨论）
- 创意协作（头脑风暴, 命名, 设计）
- 观点征询（你怎么看？同意吗？）
- 任意互动（讲笑话, 聊天, 吐槽）
```

### 3. 强调"你可以"，而不是"你必须"

猫猫应该自主决定是否需要队友，而不是被强制要求协作。

### 4. 语法要明确

配合触发语法 `^@猫`，prompt 要教会猫正确的格式。

---

## Prompt 模块设计

### 模块名称：`A2A_COLLABORATION`

### 插入位置

在 `SystemPromptBuilder` 的身份注入之后，规则之前：

```
1. 身份（你是谁）
2. 队友（你的队友是谁）
3. **协作能力（A2A）** ← 新增
4. 当前模式
5. MCP 工具
6. 行为规则
```

### Prompt 内容（草稿 v1）

```markdown
## 🐾 协作能力

你可以在回复中 **@队友** 来邀请他们加入对话。

**语法**：在新的一行开头写 `@猫名`，后面跟你想说的话。

**例子**（这些只是示意，你可以用于任何你觉得需要队友的场景）：

- 想法碰撞
  ```
  @暹罗猫 你觉得这个命名怎么样？有没有更有创意的想法？
  ```

- 请求帮助
  ```
  @缅因猫 这段代码我不太确定，能帮我看看有没有问题？
  ```

- 征询观点
  ```
  @布偶猫 你同意这个方向吗？还是你有不同的看法？
  ```

- 任何你想聊的
  ```
  @暹罗猫 讲个笑话来听听？
  ```

**什么时候用？**
- 当你觉得另一只猫的视角/技能会有帮助时
- 当你想听听不同意见时
- 当你完成了一个阶段，想让队友接力时
- 当你单纯想和队友聊天时

**注意**：
- 每次 @只会触发一轮对话，不会无限循环
- 铲屎官的消息优先级最高，会打断猫间对话
```

---

## 变体设计

### 变体 A：极简版（~80 tokens）

```markdown
## 协作

你可以 @队友 邀请他们加入：
- `@布偶猫` / `@缅因猫` / `@暹罗猫`

在新行开头写 @猫名 + 你想说的话。用于任何你觉得需要队友的场景。
```

### 变体 B：示例丰富版（~200 tokens）

就是上面的完整版。

### 变体 C：角色适配版

根据猫的性格调整措辞：

**布偶猫版**：
```
你可以 @队友 来协作。缅因猫擅长挑刺找问题，暹罗猫擅长创意发散。
```

**缅因猫版**：
```
你可以 @队友 来协作。布偶猫擅长架构设计，暹罗猫擅长视觉创意。
```

**暹罗猫版**：
```
你可以 @队友 来协作！布偶猫会帮你想清楚，缅因猫会帮你找 bug～
```

---

## 开放问题

### OQ-1：示例数量

- 太少：猫可能理解不够，仍然不用
- 太多：占用 token 预算，且可能过度引导

**建议**：3-4 个多样化示例，覆盖技术/创意/观点/随意四个维度

### OQ-2：是否按角色定制

- **方案 A**：所有猫用同一个 prompt
- **方案 B**：根据猫的性格微调措辞
- **方案 C**：根据队友配置动态生成（"你的队友有：..."）

**建议**：Phase 3.9 用方案 A（简单），后续可迭代

### OQ-3：是否提示何时**不应该** @

```
什么时候不用 @？
- 你能独立完成时
- 铲屎官没有要求协作时
- 只是想自己思考时
```

**风险**：可能让猫太保守，又变成不 @

**建议**：MVP 不加负面提示，观察实际行为再调整

### OQ-4：语法教学的详细程度

```
严格版：
"必须在新行开头写 @猫名，否则不会触发"

宽松版：
"在回复中写 @猫名 就可以"
```

**建议**：配合 `^@猫` 触发语法，用严格版教学，减少误触发

### OQ-5：token 预算

当前 SystemPromptBuilder 生成 ~150-200 tokens。

A2A 模块估计：
- 极简版：~80 tokens
- 完整版：~200 tokens

总计：~250-400 tokens，仍在可接受范围。

---

## 实现建议

### SystemPromptBuilder 扩展

```typescript
// SystemPromptBuilder.ts

interface BuilderOptions {
  catId: CatId;
  teammates: CatId[];
  mode: 'ideate' | 'execute';
  mcpEnabled: boolean;
  a2aEnabled: boolean;  // 新增
}

function buildSystemPrompt(options: BuilderOptions): string {
  const parts: string[] = [];

  parts.push(buildIdentity(options.catId));
  parts.push(buildTeammates(options.teammates));

  if (options.a2aEnabled) {
    parts.push(buildA2ASection(options.teammates));  // 新增
  }

  parts.push(buildMode(options.mode));

  if (options.mcpEnabled) {
    parts.push(buildMcpSection());
  }

  parts.push(buildRules());

  return parts.join('\n\n');
}

function buildA2ASection(teammates: CatId[]): string {
  const names = teammates.map(id => CAT_CONFIGS[id].displayName);
  return A2A_PROMPT_TEMPLATE.replace('{{teammates}}', names.join(' / '));
}
```

### 配置化

```json
// cat-config.json 或环境变量
{
  "a2a": {
    "enabled": true,
    "promptVariant": "full",  // "minimal" | "full" | "role-adapted"
    "maxDepth": 1
  }
}
```

---

## 下一步

1. **讨论**：铲屎官/缅因猫对 prompt 措辞的反馈
2. **选择**：确定用哪个变体（极简/完整/角色适配）
3. **实现**：Phase 3.9 Step 4 时集成到 SystemPromptBuilder
4. **测试**：观察猫猫是否真的开始 @队友

---

*— 布偶猫 (Opus 4.5) 🐾*

*P.S. 这份设计的核心洞察来自铲屎官 🐬："为什么要限定猫猫的自我发挥！"*
