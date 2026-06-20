---
feature_ids: [F208]
phase: C
doc_kind: plan
created: 2026-06-20
author: opus-46
status: draft
---

# F208 Phase C: 猫猫画像独立页 — 实现计划

> **核心变化**：KD-15（CVO 2026-06-20）确认画像单位 = model，不是 catId。
> 前端以 model 为主轴分组展示，catId 是 model 的实例化引用。

## 架构概览

```
                ┌─────────────────┐
                │ cat-dossier.md  │  per-catId YAML blocks
                │ (structured)    │  （Phase B 已落地）
                └───────┬─────────┘
                        │ loadDossierProfiles()
                        ▼
               ┌────────────────┐
               │ Dossier Loader │  Map<catId, DossierProfile>
               │ (shared)       │
               └───────┬────────┘
                       │ + getCatModel() join
                       ▼
              ┌─────────────────┐
              │ GET /api/dossier│  model-grouped response
              │ (new endpoint)  │
              └───────┬─────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ /settings?s=profiles  │  model-first 画像卡片
         │ CatDossierContent.tsx │  L1 6字段可展开
         └────────────────────────┘
```

## 实现拆解

### 1. Backend: Dossier API endpoint

**文件**：`packages/api/src/routes/dossier.ts`

**`GET /api/dossier`** 返回 model-grouped 画像数据：

```typescript
interface DossierResponse {
  modelGroups: Array<{
    model: string;           // e.g. "claude-opus-4-6"
    cats: Array<{
      catId: string;
      displayName: string;   // from cat-config
      family: string;        // ragdoll / bengal / ...
      runtime: string;       // claude-code / antigravity / ...
      dossier: DossierProfile | null;  // null = no dossier entry
    }>;
  }>;
  meta: {
    dossierVersion: string;
    lastUpdated: string;
    totalCats: number;
    totalModels: number;
    dossierCoverage: number;  // cats with dossier / total
  };
}
```

**实现要点**：
- `loadDossierProfiles(projectRoot)` 拿 dossier map
- `getAllCatModels()` + cat-config registry 拿 catId→model 映射
- 按 model 分组，每组内按 cat-config 顺序排列
- 单 model 单 cat（13/14 情况）不做特殊处理，统一 model-first 展示

### 2. Frontend: Settings 新 section

**文件清单**：
| 文件 | 动作 |
|------|------|
| `packages/web/src/components/settings/settings-nav-config.ts` | 加 `profiles` section |
| `packages/web/src/components/settings/SettingsContent.tsx` | 加 import + case |
| `packages/web/src/components/settings/CatDossierContent.tsx` | **新建** 主组件 |
| `packages/web/src/components/settings/dossier/` | **新建** 子组件目录 |
| `packages/web/messages/zh-CN.json` (+ en.json) | 加 i18n keys |

**组件结构**：
```
CatDossierContent
├─ SettingsPageHeader（标题 + KD-15 说明条）
├─ ModelGroupCard × N（按 model 分组）
│  ├─ ModelHeader（model 名 + 猫数量 badge）
│  ├─ CatProfileCard × M（同 model 的猫）
│  │  ├─ CatHeader（头像 + 昵称 + runtime pill）
│  │  ├─ OneLiner（一句话画像）
│  │  ├─ L1Fields（6字段可折叠）
│  │  │  ├─ 原生峰值
│  │  │  ├─ 被低估能力
│  │  │  ├─ 坏直觉
│  │  │  ├─ 召唤反信号
│  │  │  ├─ 互补 & 反模式
│  │  │  └─ 翻车熔断信号
│  │  └─ ProvenanceBadge（来源 + 日期）
│  └─ SharedModelTraits?（同 model 共享的认知底色 — 预留，Phase C 先不实现）
└─ CvoObservationPanel（CVO "添加观察" 入口，AC-C3）
```

**布局方向**（待 @gemini 确认）：
- 默认 **Hybrid 方案（C）**：顶部 model 分组条 + 下方 cat variant 卡片
- 大多数 model 只有 1 只猫 → 视觉上等价于 cat card，不增加认知负担
- 同 model 多猫（如 opus + antig-opus）→ model 分组条下展开两张卡片，高亮 runtime 差异

### 3. OQ-9 解法（teamStrengths 编辑框处理）

在现有 `/settings?s=members` 的猫详情编辑中（`HubCatEditor`）：
- **有 dossier 的猫**：teamStrengths 字段上方加 notice badge —— "此字段已被能力画像覆盖 → 前往画像页"
- **保持可编辑**：teamStrengths 是 KD-13 永久保留的 community fallback，不锁定
- **无 dossier 的猫**（社区/自定义）：完全不变

### 4. CVO 观察入口（AC-C3）

- 每张 cat profile card 底部：「添加观察」按钮
- 点击弹出 textarea + provenance 选择（CVO 体感 / 基于事件）
- 提交后写入 pending 层（不直接覆盖总结层）
- **Phase C 最小实现**：只做 read-only 展示 + 观察输入的 UI；观察的实际存储/蒸馏留 Phase D

## Console-Dev 4 Gate 对照

| Gate | 状态 | 内容 |
|------|------|------|
| **Product** | ✅ 本文档 | KD-15 model-first，AC-C1~C4 覆盖 |
| **Design-System** | ⬜ 待 @gemini | OKLCH token 复用 opus-48 POC 色板，需布局确认 |
| **Implementation** | ⬜ 本计划 + TDD | 后端 endpoint → 前端组件 → 集成测试 |
| **Verification** | ⬜ alpha 验收 | @sonnet alpha:start 端到端 |

## 依赖

- Phase B ✅ — dossier loader + structured YAML 已合入 main
- KD-15 ✅ — 已 commit 到 F208 spec
- cat-config model 映射 — 已有 `getCatModel()` / `getAllCatModels()`
- 前端 primitives — 已有 SettingsSection / SettingsCard / SettingsCollapsibleCard

## 风险

| 风险 | 缓解 |
|------|------|
| KD-15 model-first 但 dossier 数据按 catId 索引 | API 层做 join，不改 dossier 文件结构（避免破坏 Phase B 两条消费链）|
| "添加观察" 存储还没设计 | Phase C 只做输入 UI + 本地 state，实际持久化在 Phase D |
| OQ-9 在 member 编辑页的改动可能打扰社区用户 | 只在有 dossier 的猫上显示 badge，社区猫完全不变 |

## TDD 红测清单（进 worktree 后第一件事）

### Backend
- [ ] `GET /api/dossier` 返回 model-grouped 结构
- [ ] model 分组正确（opus + antig-opus 在同一组）
- [ ] 无 dossier 的猫返回 `dossier: null`
- [ ] dossier 文件不存在时返回空 modelGroups + meta

### Frontend
- [ ] `/settings?s=profiles` 可导航
- [ ] model group 渲染正确数量
- [ ] L1 6 字段展开/折叠
- [ ] provenance badge 显示
- [ ] CVO 观察按钮出现（read-only 态）
- [ ] OQ-9: member 编辑页有 dossier 猫显示覆盖 badge

[宪宪/claude-opus-4-6🐾]
