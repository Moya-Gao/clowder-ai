# F051 真实猫粮看板 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 在 Hub 猫粮看板中展示与各家官方 usage 页面一致的账号级额度数据。

**Architecture:** 后端 `/api/quota` 提供缓存式额度 API。Claude 数据通过 `ccusage blocks --json` CLI 获取（官方工具，直接输出计费数据）。Codex 数据通过 `claude-in-chrome` MCP 浏览器工具从 `chatgpt.com/codex/settings/usage` 页面读取。前端重写 `HubQuotaBoardTab`，按官方页面同值展示，不做二次换算。

**Tech Stack:** Fastify (API) / React + Tailwind (Web) / ccusage CLI / claude-in-chrome MCP / Pencil MCP (UX 设计)

---

## 铲屎官原话摘要（愿景锚点）

- "三只猫的额度现在到底有多少"
- "codex 和 gpt 52 他们是一个额度"
- "用chrome去各个公司额度页面查看都比你算半天靠谱"
- "官方有什么我们看什么"
- "antigravity 下次一定"
- 截图参考: `uploads/1772470157427-435ac123.png`（三张官方页面截图）

## 硬约束

1. **看板值 = 官方页面值**，不二次换算
2. **Codex + GPT-5.2 同一额度池只展示一张卡**
3. 抓取失败显示"抓取失败"，**不用推导值冒充官方值**
4. Antigravity 本轮占位

---

## Task 0: UX 设计（Pencil MCP）

**目标**: 用 Pencil MCP 设计猫粮看板 UI，对照铲屎官截图。

**Files:**
- Create: 新 `.pen` 设计文件

**Step 1: 分析铲屎官截图中的三种卡片布局**

参考 `uploads/1772470157427-435ac123.png`：
- Codex 卡片：进度条 + 百分比 + 重置时间
- Claude 卡片：Session/Weekly 分行 + 百分比 + 重置时间
- Antigravity 卡片：占位文案

**Step 2: 用 Pencil MCP 创建看板设计**

使用 `pencil-design` skill：
1. `get_editor_state()` 确认当前状态
2. `open_document("new")` 创建新设计
3. `get_guidelines(topic="tailwind")` 获取 Tailwind 设计规范
4. `get_style_guide_tags` + `get_style_guide` 获取配色灵感
5. `batch_design` 创建三种卡片的设计：
   - Claude 卡片：Session % + Weekly All Models % + Weekly Sonnet Only % + 重置时间
   - Codex 卡片（合并 GPT-5.2）：Rate Limit 进度条 + 重置时间
   - Antigravity 卡片：占位 "待接入（下一迭代）"
   - 手动刷新按钮 + "最后检查" 时间戳

**Step 3: 截图验证设计**

`get_screenshot` 确认视觉效果，对照铲屎官截图。

**Step 4: 导出设计为 React 代码参考**

使用 `pencil-to-code` skill 导出 React + Tailwind 组件代码作为实现参考。

---

## Task 1: 后端 — 额度缓存 API

**目标**: `/api/quota` GET 返回缓存的额度数据，`/api/quota/refresh` POST 触发刷新。

**Files:**
- Create: `packages/api/src/routes/quota.ts`
- Modify: `packages/api/src/routes/index.ts` (加 export)
- Modify: `packages/api/src/index.ts` (注册路由)
- Test: `packages/api/test/quota-api.test.js`

**Step 1: 写失败测试**

```typescript
// test/quota-api.test.js
describe('GET /api/quota', () => {
  it('returns cached quota for all platforms', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/quota' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.claude);
    assert.ok(body.codex);
    assert.ok(body.antigravity);
    assert.ok(body.fetchedAt);
  });

  it('antigravity returns not-yet-implemented', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/quota' });
    const body = JSON.parse(res.body);
    assert.equal(body.antigravity.status, 'not-yet-implemented');
  });
});
```

**Step 2: 跑测试，确认红灯**

Run: `cd packages/api && node --test test/quota-api.test.js`
Expected: FAIL — 路由不存在

**Step 3: 实现最小路由**

```typescript
// packages/api/src/routes/quota.ts
import type { FastifyInstance } from 'fastify';

// 类型定义
interface ClaudeQuota {
  platform: 'claude';
  currentSession?: { usedPercent: number };
  currentWeekAllModels?: { usedPercent: number };
  currentWeekSonnetOnly?: { usedPercent: number };
  resetsAt?: string;
  error?: string;
  lastChecked: string | null;
}

interface CodexQuota {
  platform: 'codex';
  usageItems: Array<{
    label: string;       // e.g. "100.0a"
    usedPercent: number;
    resetsAt?: string;
  }>;
  error?: string;
  lastChecked: string | null;
}

interface AntigravityQuota {
  platform: 'antigravity';
  status: 'not-yet-implemented';
  hint: string;
}

// 内存缓存
let claudeCache: ClaudeQuota = { platform: 'claude', lastChecked: null };
let codexCache: CodexQuota = { platform: 'codex', usageItems: [], lastChecked: null };

export async function quotaRoutes(app: FastifyInstance): Promise<void> {
  // GET: 返回所有缓存
  app.get('/api/quota', async () => ({
    claude: claudeCache,
    codex: codexCache,
    antigravity: {
      platform: 'antigravity',
      status: 'not-yet-implemented',
      hint: '暹罗猫额度待接入（下一迭代）',
    } satisfies AntigravityQuota,
    fetchedAt: new Date().toISOString(),
  }));

  // POST: 触发刷新（Claude 用 ccusage CLI）
  app.post('/api/quota/refresh/claude', async () => {
    // Task 2 实现
  });

  // PATCH: 外部推送数据（Codex 用浏览器抓取后推送）
  app.patch('/api/quota/codex', async (request) => {
    // Task 3 实现
  });
}
```

**Step 4: 跑测试，确认绿灯**

Run: `cd packages/api && node --test test/quota-api.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/routes/quota.ts packages/api/src/routes/index.ts packages/api/src/index.ts packages/api/test/quota-api.test.js
git commit -m "feat(F051): quota cache API skeleton"
```

---

## Task 2: 后端 — Claude 额度获取（ccusage CLI）

**目标**: `POST /api/quota/refresh/claude` 调用 `ccusage blocks --json`，解析当前计费窗口数据。

**Files:**
- Modify: `packages/api/src/routes/quota.ts`
- Test: `packages/api/test/quota-claude-refresh.test.js`

**核心逻辑**: `ccusage blocks --json` 返回 `{ blocks: [...] }`，找 `isActive: true` 的 block，提取：
- `costUSD` — 当前窗口花费
- `burnRate.costPerHour` — 燃烧速率
- `projection.totalCost` / `projection.remainingMinutes` — 预测
- `startTime` / `endTime` — 窗口时间
- `models` — 使用了哪些模型

**注意**: ccusage 输出的是**计费窗口数据**（5 小时 block），不是"百分比"。铲屎官截图中 Claude 显示的"7% used / 54% used"可能来自 Claude Code 自带的 status bar。我们先展示 ccusage 给的真实数据（cost + burn rate + projection），这就是官方工具输出的原始数据。

**Step 1: 写失败测试**

```typescript
// test/quota-claude-refresh.test.js
describe('POST /api/quota/refresh/claude', () => {
  it('populates claude cache from ccusage output', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/quota/refresh/claude' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.claude.platform, 'claude');
    assert.ok(body.claude.lastChecked);
  });
});
```

**Step 2: 实现 — 调用 ccusage 并缓存**

```typescript
app.post('/api/quota/refresh/claude', async () => {
  try {
    const output = await execFilePromise('npx', ['ccusage', 'blocks', '--json'], { timeout: 30_000 });
    const parsed = JSON.parse(output.stdout);
    const activeBlock = parsed.blocks.find(b => b.isActive && !b.isGap);
    // 直接展示 ccusage 给的数据，不做换算
    claudeCache = {
      platform: 'claude',
      activeBlock: activeBlock ?? null,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    claudeCache = { ...claudeCache, error: `ccusage failed: ${err.message}` };
  }
  return { claude: claudeCache };
});
```

**Step 3: 跑测试，确认绿灯**

**Step 4: Commit**

```bash
git commit -m "feat(F051): claude quota refresh via ccusage CLI"
```

---

## Task 3: 后端 — Codex 额度推送端点

**目标**: `PATCH /api/quota/codex` 接收从浏览器抓取到的 Codex usage 数据。

**设计**: Codex 数据通过浏览器（`claude-in-chrome` MCP）抓取，抓取方是 AI 猫自己。猫抓到数据后通过 PATCH 端点推送到缓存。

**Files:**
- Modify: `packages/api/src/routes/quota.ts`
- Test: `packages/api/test/quota-codex-patch.test.js`

**Step 1: 写失败测试**

```typescript
describe('PATCH /api/quota/codex', () => {
  it('stores codex usage data', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/quota/codex',
      payload: {
        usageItems: [
          { label: 'Current week', usedPercent: 100, resetsAt: '2026-03-05T19:00:00Z' },
        ],
        pageText: 'raw page content for audit',
      },
    });
    assert.equal(res.statusCode, 200);

    // 验证 GET 返回更新后的数据
    const get = await app.inject({ method: 'GET', url: '/api/quota' });
    const body = JSON.parse(get.body);
    assert.equal(body.codex.usageItems[0].usedPercent, 100);
  });
});
```

**Step 2: 实现 PATCH 端点**

**Step 3: 测试绿灯 + Commit**

```bash
git commit -m "feat(F051): codex quota PATCH endpoint"
```

---

## Task 4: 前端 — 重写 HubQuotaBoardTab

**目标**: 用 Pencil 设计稿 + React 重写 `HubQuotaBoardTab.tsx`，展示官方额度数据。

**Files:**
- Rewrite: `packages/web/src/components/HubQuotaBoardTab.tsx`
- Modify: `packages/web/src/components/hub-quota-board.helpers.ts` (可能简化或删除旧逻辑)
- Test: `packages/web/src/components/__tests__/cat-cafe-hub-quota-tab.test.ts`

**Step 1: 写失败测试**

```typescript
describe('HubQuotaBoardTab — 官方额度展示', () => {
  it('renders Claude card with ccusage billing data', () => {
    // mock apiFetch to return claude quota with activeBlock
    const html = renderToStaticMarkup(<HubQuotaBoardTab />);
    assert(html.includes('布偶猫'));
    assert(html.includes('$')); // cost display
  });

  it('renders Codex card as single shared quota (not split by model)', () => {
    const html = renderToStaticMarkup(<HubQuotaBoardTab />);
    assert(html.includes('缅因猫'));
    // 不应该有 GPT-5.2 单独卡片
  });

  it('shows "抓取失败" when fetch fails, not estimated values', () => {
    // mock apiFetch to return error
    const html = renderToStaticMarkup(<HubQuotaBoardTab />);
    assert(html.includes('抓取失败'));
    assert(!html.includes('%')); // 不应该有百分比推导值
  });

  it('shows Antigravity placeholder', () => {
    const html = renderToStaticMarkup(<HubQuotaBoardTab />);
    assert(html.includes('待接入'));
  });

  it('has manual refresh button', () => {
    const html = renderToStaticMarkup(<HubQuotaBoardTab />);
    assert(html.includes('刷新'));
  });
});
```

**Step 2: 根据 Pencil 设计稿实现组件**

- Claude 卡片：当前窗口 cost + burn rate + projection + 模型列表 + 窗口时间
- Codex 卡片（"缅因猫共享额度"）：进度条 + 百分比 + 重置时间
- Antigravity 卡片：占位文案
- 顶部：手动刷新按钮 + "最后检查" 时间戳
- 底部：保留路由策略子模块（现有 `HubRoutingPolicyTab` 内容）

**Step 3: 删除旧的 telemetry 聚合逻辑**

`hub-quota-board.helpers.ts` 中的 `collectLatestQuotaByCat` 等逻辑不再需要（那是 telemetry 聚合，不是官方数据）。简化或移除。

**Step 4: 测试绿灯 + Commit**

```bash
git commit -m "feat(F051): rewrite quota board with official data display"
```

---

## Task 5: 集成 — 浏览器抓取 Codex 数据

**目标**: 用 `claude-in-chrome` MCP 导航到 `chatgpt.com/codex/settings/usage`，读取页面内容，推送到 API。

**这是一个运行时操作，不是代码任务。** 实现方式：

**Step 1: 用 claude-in-chrome 导航到 Codex usage 页面**

```
mcp__claude-in-chrome__tabs_context_mcp  # 获取当前 tabs
mcp__claude-in-chrome__navigate          # 导航到 chatgpt.com/codex/settings/usage
mcp__claude-in-chrome__get_page_text     # 读取页面文本
```

**Step 2: 解析页面文本，提取用量数据**

从页面文本中提取：百分比、重置时间、窗口信息。

**Step 3: 通过 PATCH /api/quota/codex 推送到缓存**

**Step 4: 验证前端看板显示正确**

**注意**: 这个步骤在每次需要刷新 Codex 数据时由猫猫手动执行。未来可以做成定时任务。

---

## Task 6: 端到端验证

**Step 1: 跑全量后端测试**

```bash
cd packages/api && node --test test/quota-*.test.js
```

**Step 2: 跑全量前端测试**

```bash
pnpm --filter @cat-cafe/web test
```

**Step 3: Build 检查**

```bash
pnpm lint && pnpm -r --if-present run build
```

**Step 4: 手动验证**

1. 打开 Hub → 猫粮看板 tab
2. 点击刷新按钮
3. 确认 Claude 卡片显示 ccusage 计费数据
4. 确认 Codex 卡片显示浏览器抓取的官方数据（或"未获取"状态）
5. 确认 Antigravity 显示"待接入"
6. 截图对照铲屎官原始截图

**Step 5: Final Commit**

```bash
git commit -m "feat(F051): real quota dashboard — official data sources"
```

---

## 任务依赖图

```
Task 0 (UX 设计) ─────────────────────┐
                                        ↓
Task 1 (API skeleton) → Task 2 (Claude) → Task 4 (Frontend) → Task 6 (验证)
                      → Task 3 (Codex)  ↗                   → Task 5 (浏览器抓取)
```

Task 0 和 Task 1~3 可以并行。Task 4 依赖 Task 0 的设计稿和 Task 1~3 的 API。Task 5 和 6 在最后。
