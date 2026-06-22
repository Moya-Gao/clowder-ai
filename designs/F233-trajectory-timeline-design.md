# F233 Feat Trajectory Timeline UI 设计规格说明书
**ID:** F233-C3-UI-DESIGN  
**Feature:** F233 — Ball Custody Observability (球权可观测性)  
**Phase:** C  
**Designer:** 烁烁 [Gemini 3.5 Flash (High)🐾]  
**Implementer:** Opus 4.8 (@opus-48)  

---

## 1. 视觉效果图 (Concept Mockup)

Mockup 概念图已生成并存放在项目根目录的 `designs/images/f233_feat_trajectory_timeline.jpg` 中。

![F233 Feat Trajectory Timeline Mockup](file:///Users/lysander/projects/relay-station/cat-cafe/designs/images/f233_feat_trajectory_timeline.jpg)

### 视觉特征与色系 (Dark Neon Palette)
为了符合 CVO (铲屎官) 要求的**暗色霓虹传播资产**气质，我们为该面板定制了一套高还原度的玻璃拟态 (Glassmorphism) 与霓虹边缘发光 (Neon Glow) 的夜色主题风格。

- **面板背景 (Panel Background):** `#0a0d14` / `oklch(12% 0.02 240)`。深邃的曜石黑底色，确保高对比度的霓虹色彩得以完美呈现。
- **卡片底色 (Card Surface):** `rgba(22, 27, 34, 0.6)` / `oklch(20% 0.03 240 / 60%)` 配合 `backdrop-blur-md`。
- **霓虹色系分组 (13 Kinds Visual Grouping):**
  - **球权事件流 (Ball-shaped - Solid Glow):**
    - `launched` / `phase_transition` / `thread_split` / `thread_merge`: **霓虹紫/品红** (`#d300ff` / `oklch(70% 0.25 320)`), 象征流程启动与跃迁。
    - `pr_merged` / `verdict` / `closed`: **霓虹翠绿** (`#00ff66` / `oklch(85% 0.22 140)`), 象征成功合并、裁决与归档。
    - `reopened`: **霓虹天蓝** (`#00f0ff` / `oklch(80% 0.18 200)`), 象征重新激活。
  - **Git 巡检轨 (Git-shaped):**
    - `branch_pushed` / `pr_opened` / `branch_merged_to_main`: **霓虹青** (`#00e5ff` / `oklch(82% 0.16 195)`)，象征开发活跃。
    - `branch_stale_unmerged` **「提包球」高亮**: **霓虹警示橙/琥珀黄** (`#ffaa00` / `oklch(75% 0.18 70)`) 伴随呼吸灯动画，象征滞留警告。
  - **历史考古轨 (Historical Stitched):**
    - `historical_stitched`: **半透明虚线哑灰** (`#484f58` / `oklch(40% 0.02 240)`), 降低视觉噪点，明示考古非实时账本。

---

## 2. 布局架构与组件设计 (Layout & Component Structure)

面板将作为 WorkspacePanel 的一个新 mode（`workspaceMode === 'trajectory'`）在 Hub 右侧/左侧工作区展开，支持全宽与窄宽响应式。

```
+---------------------------------------------------------+
|  [路径: 轨迹 / Trajectory]                               |
+---------------------------------------------------------+
|  [🔍 搜素并选择 Feat... (e.g. F188)            [x] [v]  |
+---------------------------------------------------------+
|                                                         |
|  * [launched] 2026-04-15 09:00  (event-stream)          |
|    |                                                    |
|    +------------------------------------------+         |
|    | 紫色卡片: launched - Feat initialized    |         |
|    +------------------------------------------+         |
|    :                                                    |
|    : (考古虚线连接线)                                    |
|    :                                                    |
|  * [historical_stitched] 2026-05-02 (stitched)          |
|    +------------------------------------------+         |
|    | 灰虚线卡片: F192 Verdict 考古回填        |         |
|    +------------------------------------------+         |
|    |                                                    |
|    | (实线连接线)                                       |
|    |                                                    |
|  * [branch_stale_unmerged] 2026-06-16 (git-ref)         |
|    +------------------------------------------+         |
|    | 🔴 提包球卡片: 7d stale, cat carrying bag|         |
|    | 关联 Thread: thread_mqcb399k...         |         |
|    +------------------------------------------+         |
|                                                         |
+---------------------------------------------------------+
```

### 2.1 顶部 Feat 选择器 (Top Feat Picker)
- **实现方案:** 采用带有过滤功能的 Combobox。
- **数据源:** 
  - 通过 `GET /api/feat-trajectory/feats` 获取已知 `featId` 列表（例如 `['F188', 'F192', 'F233']`）。
  - 支持键盘上下选择和模糊过滤。
- **状态:** 空状态 (Empty State) 下，居中显示霓虹微光猫爪图标，文案为：“请选择或输入 Feat 编号以载入轨迹流水账”。

### 2.2 垂直时间轴主区 (Vertical Timeline)
- **轴线设计 (Timeline Line):**
  - 使用一个相对定位的左侧轴线 `before:absolute before:left-4 before:top-0 before:bottom-0 before:w-0.5`。
  - **动态连接线:** 如果下一个 Entry 是 `historical_stitched`，则连接线渲染为 `border-dashed border-cafe-interactive/20`；如果是 `event-stream` 或 `git-ref`，则渲染为 `bg-gradient-to-b from-purple-500 to-emerald-500`（或相应 kind 的主色渐变）并带微弱阴影 `shadow-[0_0_8px_...]`。
- **节点圆圈 (Timeline Node Dot):**
  - 每个事件卡片左侧对齐的轴线上放置一个发光圆圈。
  - 外圈大半透明，内圈高亮。例如「提包球」的圆圈：`ring-4 ring-conn-amber-bg/30 bg-conn-amber-text animate-pulse`。

### 2.3 事件卡片组件 (Event Entry Card)
卡片结构包含四层：
1. **Header (头部行):**
   - 左侧：事件类型 Kind 徽章（带图标）。
   - 右侧：多源标签 (Multi-source Label) — `event-stream` (徽章)、`git-ref-snapshot` (徽章)、`stitched` (徽章)。
2. **Meta Info (元数据行):**
   - 触发时间 `at` (格式化为 `YYYY-MM-DD HH:mm`)。
   - 作者 / 执行猫 `author` / `by`（带猫咪小头像或对应猫咪专属主题色小圆点）。
3. **Payload Summary (主要载荷简述):**
   - 例如：`Phase 跃迁: A → B`、`分支已推送: fix/f188-phase-k`。
4. **Interactive Action (下钻/折叠):**
   - 默认折叠，点击卡片展开详情面板。
   - 展现 Provenance (置信度 `confidence` 与推导链 `derivedFrom` 数组)。
   - 展示原始 Payload 数据的 JSON 树或美化键值对。

---

## 3. 核心交互与“提包球”高亮 (Core Interactions)

### 3.1 「提包球」(Carrying the Bag) 特殊高亮
- **判定条件:** `kind === 'branch_stale_unmerged'` 并且 `lastThreadMessageAt < headCommitAt`（表明执行猫完成代码 push 且离开 thread 后，该 thread 没有新的讨论或心跳，球处于“被猫提着包带走了”的挂起状态）。
- **视觉呈现:**
  - 卡片边框使用警示霓虹橙 `#ffaa00` 配合 `shadow-[0_0_12px_rgba(255,170,0,0.35)]` 发光。
  - 卡片内部出现闪烁警告 Banner：`⚠️ Warning: 猫咪已提包离线 [stale: 7d]`。
  - 提供一键跳转到 `associatedThreadIds[0]` 的快捷按钮，方便铲屎官“一键催醒”。

### 3.2 历史考古 (Historical Stitch) 视觉区分
- 虚线边框 (`border-dashed border-cafe-subtle/50`)，卡片透明度为 `opacity-75`。
- 卡片右上角显示明显的“🔍 历史考古”水印，悬浮提示：“此条目为 Phase B 上线前的历史考古拼接记录，置信度: [High/Medium/Low]”。

### 3.3 悬浮与下钻 (Hover & Click Actions)
- **Hover:** 卡片轻微上浮（`hover:-translate-y-0.5 transition-transform`），对应时间轴节点发光范围扩大。
- **Click:**
  - 展开卡片底部折叠区，异步载入 provenance 溯源链路（如：`['feat_index', 'git_log', 'thread:thread_xxx']`）。
  - 若关联了 `prNumber`，渲染点击跳转 GitHub PR 的链接。

---

## 4. API 接入规格 (API Integration Contract)

### 4.1 获取 Feat 列表
```ts
// 组件挂载时调用
const fetchFeatIds = async (): Promise<string[]> => {
  const res = await apiFetch('/api/feat-trajectory/feats');
  return res.json();
};
```

### 4.2 获取 Feat 轨迹数据
```ts
// 当选择 featId 时调用
const fetchTrajectory = async (featId: string): Promise<FeatTrajectoryProjection> => {
  const res = await apiFetch(`/api/feat-trajectory/${featId}`);
  return res.json();
};
```

### 4.3 轨迹数据 DTO 数据结构参考 (TS Types)
```ts
export interface FeatTrajectoryProjection {
  featId: string;
  entries: FeatTrajectoryEntry[];
  countsBySource: Record<FeatTrajectorySource, number>;
  countsByKind: Partial<Record<FeatTrajectoryKind, number>>;
  appliedEntryCount: number;
  createdAt: number;
  updatedAt: number;
}
```

---

## 5. 样式参考实现代码 (Style Implementation Hints for Tailwind)

```tsx
// 仅供 Opus 4.8 参考的结构化样式模板，不含业务逻辑
export function TrajectoryCard({ entry }: { entry: FeatTrajectoryEntry }) {
  const isStale = entry.kind === 'branch_stale_unmerged';
  const isStitched = entry.source === 'historical-stitched';
  
  return (
    <div className={`relative pl-8 pb-6 transition-all duration-300 group`}>
      {/* 1. 左侧时间轴连接线与节点 */}
      <div className={`absolute left-4 top-2 bottom-0 w-0.5 -translate-x-1/2 
        ${isStitched ? 'border-l border-dashed border-neutral-600' : 'bg-neutral-700'}`} 
      />
      <div className={`absolute left-4 top-2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 
        ${isStale ? 'bg-amber-500 border-amber-400 animate-pulse ring-4 ring-amber-500/20' : 
          isStitched ? 'bg-neutral-800 border-neutral-600' : 'bg-purple-500 border-purple-400'}`} 
      />

      {/* 2. 主卡片容器 (暗色霓虹玻璃拟态) */}
      <div className={`rounded-xl p-4 border bg-neutral-900/60 backdrop-blur-md transition-all duration-300
        ${isStale ? 'border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:border-amber-400' : 
          isStitched ? 'border-neutral-800 opacity-80 hover:opacity-100' : 
          'border-neutral-800 hover:border-purple-500/50 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)]'}`}>
        
        {/* 卡片头部 */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-micro font-bold px-2 py-0.5 rounded-full uppercase
            ${isStale ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
              isStitched ? 'bg-neutral-800 text-neutral-400' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
            {entry.kind}
          </span>
          <span className="text-micro text-neutral-500 font-mono">
            {entry.source}
          </span>
        </div>

        {/* 提包球特别警示区 */}
        {isStale && (
          <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
            <span>⚠️ Warning: 猫咪已提包离线 [Stale Branch]</span>
          </div>
        )}

        {/* 卡片正文 */}
        <p className="text-xs text-neutral-300 leading-relaxed">
          {/* 渲染 payload 中的描述信息 */}
          {JSON.stringify(entry.payload)}
        </p>

        {/* 时间戳 */}
        <div className="mt-3 flex items-center justify-between text-micro text-neutral-500">
          <span>{new Date(entry.at).toLocaleString()}</span>
          {entry.provenance && (
            <span className="text-neutral-600">置信度: {entry.provenance.confidence}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

---
[烁烁/Gemini 3.5 Flash (High)🐾]
