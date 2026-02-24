# F33 Phase 3: Session Strategy 前端配置 UI

> **优先级**: P2
> **作者**: 布偶猫 (宪宪)
> **日期**: 2026-02-24
> **状态**: 设计完成，待铲屎官确认
> **前置**: F33 Phase 1 (PR #71 ✅) + Phase 2 (PR #72 ✅)

---

## 1. 背景

Phase 1+2 完成了 session strategy 的后端基建：三种策略（handoff/compress/hybrid）、Zod 校验、config-driven lookup chain、backward-compat 适配层。但目前**唯一的配置方式是手动编辑 `cat-config.json` + 重启 API**，不符合铲屎官的原始需求：

> "允许我去配置你们到底百分之几进行压缩。"

Phase 3 的目标：**前端设置页面，让铲屎官在浏览器里直接配置每只猫的 session 策略，即时生效。**

### 铲屎官拍板的设计决策（2026-02-24）

| 决策 | 内容 |
|------|------|
| **配置粒度** | Variant 级（opus 和 sonnet 可以不同，因为 Sonnet 是 1M context） |
| **配置入口** | 小齿轮 → Hub 设置 tab → Session Strategy 配置面板 |
| **Thread 级** | 不做（过度设计） |

## 2. 非目标

- 不做 thread 级策略配置
- 不做策略效果可视化/分析仪表盘（属于后续调优阶段）
- 不改 `shouldTakeAction()` 决策逻辑（Phase 1 已完成）
- 不做策略热重载 `cat-config.json`（runtime override 走 Redis，JSON 文件保持 cold start fallback）

## 3. 架构方案

### 3.1 查找链升级

当前（Phase 2）：
```
test override → cat-config.json breed features → STRATEGY_BY_BREED → provider default → global default
```

Phase 3 升级（新增 runtime override 为最高优先级）：
```
test override → ★ Redis runtime override (per-variant) → cat-config.json breed features → STRATEGY_BY_BREED → provider default → global default
```

**Runtime override 存 Redis**（铲屎官 2026-02-24 拍板：直接上 Redis，不搞内存→Redis 多次重构）：key 格式 `cat-cafe:session-strategy:override:{catId}`（带 ioredis `keyPrefix` 后为 `cat-cafe:session-strategy:override:{catId}`），value 为 JSON string（`Partial<SessionStrategyConfig>`）。用 Redis 保证：
- 重启 API 不丢配置
- 多实例一致性（未来）
- 内存 fallback（Redis 不可用时跳过，降级到 cat-config.json 层）

### 3.2 配置粒度变更

Phase 2 的 `getConfigSessionStrategy(catId)` 将 variant catId 映射到 **breed 级** features。Phase 3 需要：

1. **Runtime override** 直接用 `catId` 做 key（variant 级，如 `opus`、`sonnet`、`opus-45` 各自独立）
2. **cat-config.json** 仍为 breed 级 fallback（不改 JSON 结构，保持向后兼容）

查找逻辑：runtime override (variant 级) → JSON config (breed 级) → code override → provider default

### 3.3 后端 API 端点

在现有 `routes/config.ts` 旁新增 `routes/session-strategy-config.ts`：

| Method | Path | 功能 |
|--------|------|------|
| `GET` | `/api/config/session-strategy` | 返回所有已注册 variant 的策略配置（含 effective + override 分层信息） |
| `PATCH` | `/api/config/session-strategy/:catId` | 更新指定 variant 的 runtime override |
| `DELETE` | `/api/config/session-strategy/:catId` | 删除 runtime override（恢复为默认配置） |

#### GET 响应格式

```jsonc
{
  "cats": [
    {
      "catId": "opus",
      "displayName": "布偶猫",
      "provider": "anthropic",
      "breedId": "ragdoll",
      "effective": {
        "strategy": "handoff",
        "thresholds": { "warn": 0.80, "action": 0.90 },
        "turnBudget": 12000,
        "safetyMargin": 4000
      },
      "source": "provider_default",  // "runtime_override" | "config_file" | "breed_code" | "provider_default" | "global_default"
      "hasOverride": false,
      "override": null,              // 当前 runtime override（null = 无 override）
      "hybridCapable": true,         // provider 是否支持 hybrid
      "sessionChainEnabled": true    // session chain 是否开启
    }
    // ...more cats
  ]
}
```

#### PATCH 请求格式

```jsonc
// PATCH /api/config/session-strategy/opus
{
  "strategy": "hybrid",
  "thresholds": { "warn": 0.82, "action": 0.88 },
  "hybrid": { "maxCompressions": 2 }
}
```

Zod 校验复用 Phase 2 的 `sessionStrategySchema`（已有 min/max/int/positive 约束 + warn < action refine）。

PATCH body 是 partial — 未提供的字段保持当前 effective 值。`strategy` 必填（选了策略才有意义）。

#### DELETE 语义

`DELETE /api/config/session-strategy/opus` → 删除 runtime override，opus 回到 cat-config.json / provider default。

### 3.4 前端 UI

#### 入口

在 `CatCafeHub` 新增 tab `'strategy'`：

```typescript
// CatCafeHub.tsx — TABS 数组新增
{ id: 'strategy', label: '策略配置' }
```

`HubTabId` union 新增 `'strategy'`。

#### 面板组件 `HubStrategyTab`

新建 `packages/web/src/components/HubStrategyTab.tsx`：

```
┌─────────────────────────────────────────────────┐
│  Session Strategy 配置                           │
│                                                  │
│  ┌─ 布偶猫 (opus) ───────────────────────────┐  │
│  │  策略: [handoff ▼]  来源: provider_default │  │
│  │  警告阈值: [====●====] 0.80               │  │
│  │  动作阈值: [======●==] 0.90               │  │
│  │  [保存]  [重置为默认]                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ 布偶猫 Sonnet (sonnet) ──────────────────┐  │
│  │  策略: [compress ▼]  来源: runtime_override│  │
│  │  警告阈值: [====●====] 0.80               │  │
│  │  动作阈值: [=======●=] 0.92               │  │
│  │  [保存]  [重置为默认]                      │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ 缅因猫 (codex) ─────────────────────────┐  │
│  │  策略: [handoff ▼]  来源: provider_default │  │
│  │  hybrid 不可用 (provider 无压缩信号)       │  │
│  │  ...                                       │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ⓘ 暹罗猫 — session chain 已关闭，策略不适用    │
└─────────────────────────────────────────────────┘
```

每只 variant 一个折叠卡片（默认展开），包含：

| 控件 | 说明 |
|------|------|
| **策略下拉** | handoff / compress / hybrid（hybrid 对不支持的 provider 禁用 + tooltip） |
| **阈值滑块** | warn (0~1, step=0.01) + action (0~1, step=0.01)，滑块联动确保 warn < action |
| **hybrid 参数** | maxCompressions 数字输入（仅 hybrid 策略显示） |
| **turnBudget / safetyMargin** | 数字输入（高级选项，默认折叠） |
| **来源标签** | 灰色小字，显示当前 effective 配置的来源 |
| **保存按钮** | PATCH 到 API → 即时生效 |
| **重置按钮** | DELETE runtime override → 恢复默认 |

## 4. 文件改动清单

### 4.1 后端 (api)

| 文件 | 改动 |
|------|------|
| `config/session-strategy-keys.ts` | **新建**：Redis key patterns |
| `config/session-strategy-overrides.ts` | **新建**：Runtime override cache (sync read + async Redis write-through) |
| `config/session-strategy.ts` | 新增 `getSessionStrategyWithSource()` + `StrategySource` type |
| `config/cat-config-loader.ts` | export `sessionStrategySchema` for route reuse |
| `routes/session-strategy-config.ts` | **新建**：GET/PATCH/DELETE 端点 (含 X-Cat-Cafe-User 校验) |
| `routes/index.ts` | 导出新 route |
| `index.ts` | `initRuntimeOverrides(redis)` + 注册新 route |

### 4.2 前端 (web)

| 文件 | 改动 |
|------|------|
| `components/hub-strategy-types.ts` | **新建**：共享类型 + i18n labels |
| `components/HubStrategyCard.tsx` | **新建**：Per-variant 编辑卡片 |
| `components/HubStrategyTab.tsx` | **新建**：Hub tab 容器 |
| `components/CatCafeHub.tsx` | TABS + HubTabId 新增 `'strategy'`，渲染 `HubStrategyTab` |

### 4.3 测试

| 文件 | 改动 |
|------|------|
| `test/session-strategy-phase3.test.js` | **新建**：runtime override cache + lookup chain + SCAN hydration + write failure |
| `test/session-strategy-config-route.test.js` | **新建**：API 端点 inject 测试（GET/PATCH/DELETE + 校验 + 身份头） |

## 5. 实施顺序

```
Step 1: 后端 — session-strategy.ts 新增 runtime override 读写（内存实现优先，Redis 后加）
Step 2: 后端 — routes/session-strategy-config.ts（GET/PATCH/DELETE）
Step 3: 后端测试
Step 4: 前端 — HubStrategyTab 组件
Step 5: 前端 — CatCafeHub 集成
Step 6: 集成测试 + build
```

## 6. 验收标准

1. **打开 Hub → 看到"策略配置"tab**
2. **每只已注册 variant 猫都有独立配置卡片**（含来源标签）
3. **session chain 关闭的猫（暹罗猫）显示"不适用"提示**
4. **不支持 hybrid 的 provider（codex/gemini）禁用 hybrid 选项**
5. **修改策略 → 保存 → 即时生效**（不用重启 API）
6. **重置 → 恢复到默认**（DELETE runtime override）
7. **warn < action 约束**：前端滑块联动 + 后端 Zod 校验双保险
8. **刷新页面 / 重启 API 后配置仍在**（持久化到 Redis）

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Redis 不可用 → override 层跳过 | 降级到 cat-config.json 层，行为等同 Phase 2（不影响正常运行） |
| 多 variant 配置 UI 过长 | 卡片默认展开但可折叠；当前最多 7 只猫，不会太长 |
| 前端 warn/action 滑块精度 | step=0.01，用 `<input type="range">` + 数字显示 |

## 8. 已关闭的开放问题

1. ~~**Redis 实现优先级**~~：铲屎官拍板直接上 Redis，不搞内存→Redis 多次重构
2. **cat-config.json 热重载**：不做（runtime override 够用）

---

## 修订记录

### v1 — 2026-02-24
初版。基于铲屎官 2026-02-24 14:29/14:35 对话拍板。
