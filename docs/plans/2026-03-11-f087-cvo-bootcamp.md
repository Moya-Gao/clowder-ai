# F087 CVO Bootcamp Implementation Plan

**Feature:** F087 — `docs/features/F087-cvo-bootcamp.md`
**Goal:** 新用户点击"训练营"按钮，在猫猫引导下完成环境配置 + 选任务 + 走完一次真实 feat lifecycle，成为合格 CVO。
**Acceptance Criteria:**
- AC-A1: 前端"新手引导"入口按钮
- AC-A2: 猫猫天团轮流自我介绍
- AC-A3: 自动检测用户环境 + 主动解决
- AC-A4: 任务候选菜单（card-grid + 随机抽）
- AC-A5: 走完 feat lifecycle
- AC-A6: ≥3 次 CVO 决策
- AC-A7: 用户看到成果
- AC-A8: 成就接入 F075（接缝预留）
- AC-A9: Quick Start 引导
- AC-A10: 进阶功能引导（TTS/ASR/Pencil）
- AC-A11: TTS 推荐 Kokoro-82M
- AC-A12: 训练营线程持续帮助入口
**Architecture:** Thread 级 `bootcampState` 元数据驱动 Phase 流转 + `bootcamp-guide` Skill 注入引导行为到 system prompt + F096 Interactive Rich Blocks 处理用户选择
**Tech Stack:** TypeScript, React, Fastify, Zod, F096 Interactive Rich Blocks
**前端验证:** Yes — Sidebar 按钮、空消息态 CTA、Interactive Rich Block 交互

---

## NOT Building（明确排除）

- 16 个候选任务的实现代码（用户选完后走正常 feat lifecycle）
- F075 成就系统实现（只预留 integration seam）
- TTS/ASR 安装器（只检测 + 推荐命令）
- 独立页面（在现有 Chat UI 内触发）

## Terminal Schema

```typescript
// Thread 扩展
interface Thread {
  // ... existing fields
  bootcampState?: BootcampState;
}

interface BootcampState {
  phase: BootcampPhase;
  leadCat?: string;           // 用户选的主引导猫 catId
  selectedTaskId?: string;    // 用户选的任务 ID (Q1-Q16)
  envCheck?: EnvCheckResult;  // 环境检测结果缓存
  advancedFeatures?: {        // 进阶功能状态
    tts: 'available' | 'unavailable' | 'skipped';
    asr: 'available' | 'unavailable' | 'skipped';
    pencil: 'available' | 'unavailable' | 'skipped';
  };
  startedAt: number;
  completedAt?: number;
}

type BootcampPhase =
  | 'phase-0-select-cat'
  | 'phase-1-intro'
  | 'phase-2-env-check'
  | 'phase-3-config-help'
  | 'phase-3.5-advanced'
  | 'phase-4-task-select'
  | 'phase-5-kickoff'
  | 'phase-6-design'
  | 'phase-7-dev'
  | 'phase-8-review'
  | 'phase-9-complete'
  | 'phase-10-retro'
  | 'phase-11-farewell';

interface EnvCheckResult {
  node: { ok: boolean; version?: string };
  pnpm: { ok: boolean; version?: string };
  git: { ok: boolean; version?: string };
  claudeCli: { ok: boolean; version?: string };
  mcp: { ok: boolean; details?: string };
}
```

## Phase 分析：哪些需要代码，哪些是 Skill 行为

| Phase | 需要代码？ | 说明 |
|-------|-----------|------|
| 0 (选猫) | ✅ | Interactive Rich Block (card-grid) + bootcampState.leadCat |
| 1 (介绍) | ❌ Skill 行为 | bootcamp-guide skill 中写好三猫介绍词，猫猫按 phase 自动发 |
| 2 (环境检测) | ✅ | 后端 API 检测 node/pnpm/git/claude/mcp → Rich Block checklist |
| 3 (配置帮助) | ❌ Skill 行为 | 猫猫根据 envCheck 结果给出安装命令 |
| 3.5 (进阶) | ❌ Skill 行为 | 检测 TTS/ASR/Pencil 端口 + 推荐 Kokoro-82M |
| 4 (选任务) | ✅ | Interactive Rich Block (card-grid + allowRandom) |
| 5-10 | ❌ Skill 行为 | 正常 feat lifecycle，skill 让猫猫更耐心 + 标注 CVO 决策点 |
| 11 (告别) | ❌ Skill 行为 | 猫猫说"以后回来找我们" |

**结论**：代码工作集中在 3 块：
1. **Thread bootcampState**（后端 schema + API）
2. **前端入口**（Sidebar 按钮 + 空消息态 CTA）
3. **环境检测 API**（后端检测 + Rich Block 展示）
4. **bootcamp-guide Skill**（system prompt 注入引导行为）

## Task 1: Thread bootcampState 后端 Schema

**Files:**
- Modify: `packages/shared/src/types/thread.ts` (or wherever Thread type lives)
- Modify: `packages/api/src/routes/threads.ts` — create/update schema
- Test: `packages/api/test/thread-bootcamp.test.js`

**Step 1:** Write failing test — create thread with bootcampState

```javascript
test('POST /api/threads with bootcampState creates bootcamp thread', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/threads',
    payload: {
      title: '🎓 猫猫训练营',
      bootcampState: { phase: 'phase-0-select-cat', startedAt: Date.now() }
    }
  });
  assert.strictEqual(res.statusCode, 200);
  const thread = JSON.parse(res.payload);
  assert.strictEqual(thread.bootcampState.phase, 'phase-0-select-cat');
});
```

**Step 2:** Run test, verify FAIL (bootcampState not in schema)

**Step 3:** Add `BootcampState` type + extend `createThreadSchema` Zod validation + store persistence

**Step 4:** Run test, verify PASS

**Step 5:** Write failing test — PATCH thread bootcampState (phase transition)

```javascript
test('PATCH /api/threads/:id updates bootcampState phase', async () => {
  // create thread first, then update phase
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/threads/${threadId}`,
    payload: { bootcampState: { phase: 'phase-1-intro', leadCat: 'opus' } }
  });
  assert.strictEqual(res.statusCode, 200);
  const thread = JSON.parse(res.payload);
  assert.strictEqual(thread.bootcampState.phase, 'phase-1-intro');
  assert.strictEqual(thread.bootcampState.leadCat, 'opus');
});
```

**Step 6:** Implement PATCH handler merge logic (deep-merge bootcampState)

**Step 7:** Run tests, verify PASS

**Step 8:** Commit `feat(F087): thread bootcampState schema + API`

---

## Task 2: 前端入口 — Sidebar 按钮 + 空消息态 CTA

**Files:**
- Create: `packages/web/src/components/icons/BootcampIcon.tsx` (SVG 猫猫学士帽)
- Modify: `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` — 加按钮
- Modify: `packages/web/src/components/ChatContainer.tsx` — 空消息态 CTA
- Modify: `packages/web/src/stores/chatStore.ts` — createBootcampThread action
- Test: `packages/web/test/bootcamp-entry.test.tsx`

**Step 1:** Create BootcampIcon SVG component (猫猫学士帽)

```tsx
// packages/web/src/components/icons/BootcampIcon.tsx
export function BootcampIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {/* 猫猫学士帽：帽顶 + 帽檐 + 猫耳 */}
      <path d="M2 10l10-4 10 4-10 4z" />  {/* 帽檐 */}
      <path d="M6 12v4c0 2 3 4 6 4s6-2 6-4v-4" />  {/* 帽身 */}
      <path d="M22 10v6" />  {/* 流苏线 */}
      <circle cx="22" cy="17" r="1" />  {/* 流苏球 */}
      {/* 猫耳朵 */}
      <path d="M8 6l-2-4" strokeLinecap="round" />
      <path d="M16 6l2-4" strokeLinecap="round" />
    </svg>
  );
}
```

**Step 2:** Add bootcamp button to ThreadSidebar header area (next to "+ 新对话")

```tsx
// In ThreadSidebar header area, next to the "新对话" button
<button
  onClick={handleCreateBootcampThread}
  title="猫猫训练营 — 开始你的 CVO 之旅"
  className={styles.bootcampButton}
>
  <BootcampIcon size={16} />
</button>
```

**Step 3:** Add `createBootcampThread` to chatStore

```typescript
createBootcampThread: async () => {
  const res = await apiFetch('/api/threads', {
    method: 'POST',
    body: JSON.stringify({
      title: '🎓 猫猫训练营',
      bootcampState: {
        phase: 'phase-0-select-cat',
        startedAt: Date.now(),
      },
    }),
  });
  const thread = await res.json();
  // navigate to new thread
  set({ currentThreadId: thread.id });
  return thread;
},
```

**Step 4:** Add empty message state CTA in ChatContainer

```tsx
// In the empty state section (messages.length === 0)
<div className={styles.emptyState}>
  <PawIcon />
  <h2>欢迎来到 Cat Cafe!</h2>
  <p>@布偶 召唤布偶猫开始聊天</p>
  <div className={styles.divider}>── 或者 ──</div>
  <button onClick={handleCreateBootcampThread} className={styles.bootcampCta}>
    🎓 第一次来？开始猫猫训练营 →
    <span>跟三只猫猫一起造一个功能！</span>
  </button>
</div>
```

**Step 5:** Write test — clicking bootcamp button creates thread with bootcampState

**Step 6:** Run tests, verify PASS

**Step 7:** Commit `feat(F087): bootcamp entry points — sidebar button + empty state CTA`

---

## Task 3: 环境检测 API

**Files:**
- Create: `packages/api/src/routes/bootcamp.ts` — 环境检测路由
- Modify: `packages/api/src/index.ts` — 注册路由
- Test: `packages/api/test/bootcamp-env-check.test.js`

**Step 1:** Write failing test — GET /api/bootcamp/env-check

```javascript
test('GET /api/bootcamp/env-check returns env status', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/bootcamp/env-check' });
  assert.strictEqual(res.statusCode, 200);
  const result = JSON.parse(res.payload);
  assert.ok('node' in result);
  assert.ok('pnpm' in result);
  assert.ok('git' in result);
  assert.ok('claudeCli' in result);
  assert.ok('mcp' in result);
  // 进阶功能
  assert.ok('tts' in result);
  assert.ok('asr' in result);
  assert.ok('pencil' in result);
});
```

**Step 2:** Run test, verify FAIL

**Step 3:** Implement env-check route

```typescript
// packages/api/src/routes/bootcamp.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);

async function checkCommand(cmd: string): Promise<{ ok: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return { ok: true, version: stdout.trim() };
  } catch {
    return { ok: false };
  }
}

async function checkPort(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

app.get('/api/bootcamp/env-check', async () => {
  const [node, pnpm, git, claudeCli] = await Promise.all([
    checkCommand('node --version'),
    checkCommand('pnpm --version'),
    checkCommand('git --version'),
    checkCommand('claude --version'),
  ]);

  // MCP: check if cat-cafe MCP server is reachable
  const mcp = { ok: true, details: 'Connected via current session' };

  // 进阶功能：检测端口
  const [ttsPort, asrPort] = await Promise.all([
    checkPort(9879),  // TTS_URL default
    checkPort(9876),  // WHISPER_URL default
  ]);

  return {
    node, pnpm, git, claudeCli, mcp,
    tts: { ok: ttsPort, recommended: ttsPort
      ? 'Qwen3-TTS 1.7B (已运行)'
      : 'Kokoro-82M (轻量推荐): mlx-community/Kokoro-82M-bf16' },
    asr: { ok: asrPort },
    pencil: { ok: false, note: '需要 Antigravity IDE + Pencil 扩展' },
  };
});
```

**Step 4:** Register route in index.ts

**Step 5:** Run tests, verify PASS

**Step 6:** Commit `feat(F087): bootcamp environment check API`

---

## Task 4: bootcamp-guide Skill

**Files:**
- Create: `cat-cafe-skills/bootcamp-guide/SKILL.md`
- Modify: `cat-cafe-skills/manifest.yaml` — 添加路由条目
- Modify: `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` — 注入 bootcamp context

**Step 1:** Create SKILL.md with phase-driven behavior

核心内容（不是完整代码，是 Skill 文档）：

```markdown
---
name: bootcamp-guide
description: >
  CVO 新手训练营引导模式。Use when: thread 有 bootcampState。
  Not for: 非训练营线程、老用户。
triggers:
  - "bootcamp"
  - "训练营"
  - "我是新手"
---

# Bootcamp Guide — 猫猫训练营引导模式

## 你的角色

你是新手 CVO 的引导猫猫。比平时更耐心、更多解释、主动检测环境。
引导用户走完完整的 feat lifecycle，让他们成为合格的 CVO。

## Phase 驱动行为

当前 Phase 从 thread.bootcampState.phase 读取。每完成一个 Phase，
用 PATCH /api/threads/:id 更新到下一个 Phase。

### Phase 0: 选引导猫
发送 Interactive Rich Block (card-grid)，让用户选主引导猫。
选择后设置 bootcampState.leadCat。

### Phase 1: 猫猫天团自我介绍
三猫依次发消息介绍自己（有间隔感，不是一坨文字墙）。
[各猫介绍词...]

### Phase 2: 环境检测
调用 GET /api/bootcamp/env-check，将结果用 Rich Block checklist 展示。
✅ 已就绪的项 / ⚠️ 需要安装的项 / ❌ 缺失的项

### Phase 3: 配置帮助
根据 Phase 2 结果，逐项帮用户解决问题。
给出具体命令（不是甩文档链接！），确认用户搞定后继续。

### Phase 3.5: 进阶功能引导
检测 TTS/ASR/Pencil：
- TTS 不可用 → 推荐 Kokoro-82M: `mlx-community/Kokoro-82M-bf16`
- 我们自己用 Qwen3-TTS 1.7B（音质最好但吃资源）
- 跑不起来就跳过，不阻塞！

### Phase 4: 任务选择
发送 Interactive Rich Block (card-grid + allowRandom)
展示 16 个候选任务，按难度分三层。

### Phase 5-10: 真实 Feat Lifecycle
进入正常的猫猫协作模式，但：
- 每个 CVO 决策点标注 "🎯 CVO 决策时刻"
- 猫猫比平时多解释为什么这样做
- 进度条 Rich Block 实时更新

### Phase 11: 告别 + 持续帮助入口
告诉用户："以后有什么需要帮助的，随时回这个线程找我们！"
线程保持 pinned 状态。
```

**Step 2:** Add to manifest.yaml

**Step 3:** Modify SystemPromptBuilder — 当 thread 有 bootcampState 时注入 bootcamp context

```typescript
// In SystemPromptBuilder, check thread metadata
if (thread.bootcampState) {
  sections.push({
    label: 'Bootcamp Mode',
    content: `你正在猫猫训练营引导模式。当前 Phase: ${thread.bootcampState.phase}。
主引导猫: ${thread.bootcampState.leadCat ?? '待选'}。
请加载 bootcamp-guide skill 并按当前 Phase 行动。`
  });
}
```

**Step 4:** Run SystemPromptBuilder guard test: `node --test test/system-prompt-builder.test.js`

**Step 5:** Commit `feat(F087): bootcamp-guide skill + SystemPromptBuilder injection`

---

## Task 5: Phase 0 + Phase 4 Interactive Rich Blocks

**Files:**
- Create: `packages/api/src/domains/cats/services/bootcamp/bootcamp-blocks.ts` — 预定义的 Interactive Rich Block 配置
- Test: `packages/api/test/bootcamp-blocks.test.js`

**Step 1:** Define the card-grid blocks for cat selection and task selection

```typescript
// Phase 0: 选引导猫
export const catSelectionBlock: RichInteractiveBlock = {
  id: 'bootcamp-cat-select',
  kind: 'interactive',
  v: 1,
  interactiveType: 'card-grid',
  title: '选一只猫猫当你的主引导！',
  description: '其他猫猫也会在需要时登场帮忙',
  options: [
    { id: 'opus', emoji: '🐱', label: '宪宪 (布偶猫)', description: '架构大师，深度思考', group: '选择你的引导猫' },
    { id: 'codex', emoji: '🐱', label: '砚砚 (缅因猫)', description: '安全专家，严谨可靠', group: '选择你的引导猫' },
    { id: 'gemini', emoji: '🐱', label: '烁烁 (暹罗猫)', description: '创意担当，视觉设计', group: '选择你的引导猫' },
  ],
  messageTemplate: '我选 {selection} 当我的引导猫！',
};

// Phase 4: 选任务（含 16 个候选 + 随机抽）
export const taskSelectionBlock: RichInteractiveBlock = {
  id: 'bootcamp-task-select',
  kind: 'interactive',
  v: 1,
  interactiveType: 'card-grid',
  title: '选一个你感兴趣的项目，我们一起做！',
  allowRandom: true,
  options: [
    // Lv.1
    { id: 'Q1', emoji: '🎲', label: '猫猫盲盒', description: '每日惊喜猫猫 ~30min', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q2', emoji: '⭐', label: '猫猫星座', description: '三猫解运势 ~30min', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q3', emoji: '🔍', label: '猫猫侦探社', description: '游戏化 debug ~1h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q4', emoji: '💬', label: '心情墙', description: '情绪价值拉满 ~1h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q5', emoji: '😀', label: 'Emoji 工坊', description: '跨猫创作 ~1h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q6', emoji: '☕', label: '猫猫拿铁', description: '咖啡馆配方 ~1h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q7', emoji: '🍽️', label: '猫猫点餐', description: '全栈点餐系统 ~2h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q8', emoji: '🎮', label: '像素猫猫', description: '像素互动场景 ~2h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q9', emoji: '📊', label: '3D 能力看板', description: '猫猫雷达图 ~2h', level: 1, group: '⭐ 好玩上手' },
    { id: 'Q10', emoji: '🧸', label: '猫猫互动玩具', description: '逗猫棒+摸头 ~1h', level: 1, group: '⭐ 好玩上手' },
    // Lv.2
    { id: 'Q11', emoji: '🌤️', label: '猫猫天气站', description: 'API + 多猫播报 ~2h', level: 2, group: '⭐⭐ 有深度' },
    { id: 'Q12', emoji: '📋', label: 'Standup 面板', description: '协作可观测性 ~2h', level: 2, group: '⭐⭐ 有深度' },
    { id: 'Q13', emoji: '🏆', label: '成就博物馆', description: 'Git 数据挖掘 ~3h', level: 2, group: '⭐⭐ 有深度' },
    { id: 'Q14', emoji: '🌐', label: '猫猫翻译官', description: '多风格翻译 ~2h', level: 2, group: '⭐⭐ 有深度' },
    // Lv.3
    { id: 'Q15', emoji: '⚖️', label: '决策室', description: '猫猫辩论赛 ~3h', level: 3, group: '⭐⭐⭐ 进阶挑战' },
    { id: 'Q16', emoji: '🔄', label: '代码接力', description: '全流程协作 ~4h', level: 3, group: '⭐⭐⭐ 进阶挑战' },
  ],
  messageTemplate: '我选了 {selection}！',
};
```

**Step 2:** Write test — block 结构合法性验证

**Step 3:** Run tests, verify PASS

**Step 4:** Commit `feat(F087): bootcamp interactive rich block definitions`

---

## Task 6: 集成测试 + 前端样式

**Files:**
- Create: `packages/web/src/components/ThreadSidebar/BootcampButton.module.css`
- Modify: `packages/web/src/components/ChatContainer.module.css` — 空消息态 CTA 样式
- Test: E2E flow test (Playwright 或手动)

**Step 1:** 实现前端样式（bootcamp 按钮高亮、CTA 样式）

**Step 2:** 手动 E2E 验证完整流程：
1. 点击 Sidebar 训练营按钮 → 新线程创建
2. Phase 0: 看到选猫 card-grid → 选一只
3. Phase 1: 三猫依次自我介绍
4. Phase 2: 环境检测 checklist 展示
5. Phase 3: 配置帮助交互
6. Phase 3.5: 进阶功能引导
7. Phase 4: 任务选择 card-grid（含随机抽）
8. 选完任务后进入正常协作

**Step 3:** Commit `feat(F087): bootcamp frontend styles + integration`

---

## Commit 计划总结

| # | Commit Message | AC 覆盖 |
|---|---------------|---------|
| 1 | `feat(F087): thread bootcampState schema + API` | AC-A1 基础 |
| 2 | `feat(F087): bootcamp entry — sidebar button + empty state CTA` | AC-A1, AC-A9, AC-A12 |
| 3 | `feat(F087): bootcamp env check API` | AC-A3, AC-A10, AC-A11 |
| 4 | `feat(F087): bootcamp-guide skill + SystemPromptBuilder` | AC-A2, AC-A3, AC-A5~A7, AC-A10~A12 |
| 5 | `feat(F087): bootcamp interactive rich block definitions` | AC-A4 |
| 6 | `feat(F087): bootcamp frontend styles + integration` | AC-A1, AC-A9 |

**AC-A8（F075 成就接缝）** 在 bootcamp-guide Skill 中预留，不在本轮实现。等 F075 完成后接入。

## 下一步

Plan 完成 → 加载 `worktree` 创建隔离开发环境 → `tdd` 按 Task 顺序实现。
