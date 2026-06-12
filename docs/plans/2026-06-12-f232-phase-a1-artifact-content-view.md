# F232 Phase A.1 — 产物点击看内容 + 视觉补强 实施计划

**Feature:** F232 — `docs/features/F232-thread-artifacts-panel.md`
**Goal:** 在 thread 产物面板里点击任一产物，按类型在 panel 内直接看到内容（docs/md/log/文本看正文、图看图、语音播放、代码/PR 打开），并补上产物项的相对时间 + 猫昵称显示。
**Acceptance Criteria（从 feat doc 抄录，本 plan 覆盖 AC-A7 + AC-A5 视觉缺口；AC-A8 拆下一个 PR）:**
- **AC-A7（愿景核心）**: 点击产物**按类型直接查看内容**——docs/md/log/文本复用底层渲染器在 panel 内看正文、图看图、代码看 diff/正文、语音播放、PR 打开。（trace: 铲屎官 2026-06-12 "我点击看不了他的内容"）
- **AC-A5 视觉缺口（opus-47 守护发现）**: ① `createdAt` 渲染相对时间（"刚刚/1小时前/昨天"）；② `catId` 复用项目昵称映射（"opus-47"→"宪宪"），不显示原始字符串。
- （AC-A8 panel tab 收敛 + 小屏入口 = 独立第二 PR，不在本 plan）

**Architecture cell:** hub-action-surface
**Map delta:** none
**Map delta why:** Phase A 已把 F232 登记进 `hub-action-surface`（新增 `/api/threads/:threadId/artifacts` endpoint + 抽屉面板）。A.1 是同 cell 内纯前端增量——给 `ArtifactsPanel` 加 master-detail 内容查看，**复用既有** `GET /api/workspace/file`（F063）+ `MarkdownContent`/`CodeViewer`（F063）渲染器，不新增 endpoint、不新增扩展点、不改架构图。
**Architecture:** ArtifactsPanel 从纯列表升级为 master-detail——点击产物 → 进入详情视图。详情按「产物类型 × 数据可用性」分发渲染：媒体（image/audio 有 url）直接 `<img>`/`<audio>`；文本类有 url 的 fetch url 取正文；repo 文件（file ledger/diff，只有 `ref`=相对路径无 url，如 backlog）走 `/api/workspace/file` 读正文（需 ensure worktreeId）；PR 构造 GitHub url 外开。**核心分发逻辑抽成纯函数**（`classifyArtifactView`）穷举单测，对齐 F099 `rightPanelToggleTransition` / F232 aggregator 的"逻辑抽纯函数"家规。渲染层**复用** `MarkdownContent`/`CodeViewer`（FileContentRenderer 的底层渲染器），不整体套 `FileContentRenderer`（它紧耦合 workspace `FileData` + 一堆 props，套不进 thread 产物）。
**Tech Stack:** React + Tailwind (web) / TypeScript / node:test + React Testing Library (.test.tsx) / 复用 F063 workspace API + 渲染器。
**前端验证:** Yes — reviewer 必须用 Playwright/browser-preview 实测点击各类型产物看内容 + 相对时间/昵称渲染；尤其 docs 类（backlog）正文渲染（砚砚/opus47/我 Phase A 都只看代码没实操点击 → 漏了"点不开内容"，本 PR reviewer 必须实际点一遍）。

---

## Straight-Line Check (A→B, No Detour)

**终点 B（一句话）**：用户在产物面板点任一产物，按类型在 panel 内看到内容（正文/图/播放/外开），列表项显示相对时间 + 猫昵称。

**终态 schema（steps 围绕它建，非脚手架）** — 新建 `packages/web/src/components/artifacts/artifact-view.ts`：

```ts
import type { ThreadArtifactDTO } from '@cat-cafe/shared';

/** 产物详情视图的渲染模式（按 type × 数据可用性分发）。 */
export type ArtifactView =
  | { mode: 'image'; url: string }        // image + url → <img>
  | { mode: 'audio'; url: string }        // audio + url → <audio>
  | { mode: 'url-text'; url: string; name: string }   // file/code 有 url 且文本类 → fetch url 渲染
  | { mode: 'url-binary'; url: string }   // file 有 url 但二进制（pdf/docx）→ 外部打开
  | { mode: 'repo-file'; ref: string; name: string }  // file/code 无 url 有 ref（repo 文件）→ /api/workspace/file 读
  | { mode: 'external'; url: string }     // pr → GitHub url 外开
  | { mode: 'unavailable' };              // 无 url 无 ref 兜底 → 提示跳回原消息

/** 纯函数：产物 → 详情渲染模式。穷举可测，无副作用。 */
export function classifyArtifactView(a: ThreadArtifactDTO): ArtifactView;

/** PR ref `org/repo#123` → `https://github.com/org/repo/pull/123`；不匹配返回 null。 */
export function prRefToUrl(ref: string): string | null;

/** 按文件名后缀判断是否文本类（可在 panel 内渲染正文）。 */
export function isTextLikeName(name: string): boolean;
```

**分发规则（classifyArtifactView）**：
| type | 有 url？ | name 文本类？ | → mode |
|------|---------|--------------|--------|
| image | ✓ | — | image |
| audio | ✓ | — | audio |
| pr | — | — | external（prRefToUrl(ref)）|
| file/code | ✓ | ✓ | url-text |
| file/code | ✓ | ✗ | url-binary |
| file/code | ✗ | （有 ref）| repo-file |
| file/code | ✗ | （无 ref）| unavailable |

**NOT building（A.1 不做）**：
- ❌ AC-A8 panel tab 收敛 + header 收敛 + 小屏 fallback（独立第二 PR）
- ❌ 产物内容**编辑**（只读查看；编辑是 workspace 的事，artifacts 面板不给 editMode）
- ❌ diff 的逐行红绿渲染（diff 产物只有 filePath 无 diff 内容；A.1 读该文件**当前正文** + 保留「跳回原消息」看原始 diff，不重建 diff 视图）
- ❌ 二进制 file（pdf/docx）的 panel 内预览（panel 内渲染不了 → 外部打开，与现状一致）
- ❌ 新 Redis 反向索引 / 后端改动（纯前端，复用现有 API）

**每步三问**：纯函数 + 详情组件 + master-detail 都留在终态（extend-only）；每步可测（纯函数单测/组件测/截图）；删任一步缺一块 AC-A7/A5 覆盖。

---

## Stateful Object Census（F229 Gate — 普查先行）

**普查：本 plan 涉及 1 个组件本地 UI 状态机（master-detail）+ 1 个内容 fetch 生命周期，均为组件本地 state，非持久 lifecycle 对象（无 thread 标记/carrier/session/cache/索引/注册表）。不触发重型三件套，但给轻量状态转移 + 不变量 + 对抗场景（fetch race 是真实坑）。**

### 状态对象 1：`selectedArtifact`（master-detail 视图态）
| 当前 | 事件 | → 下一态 |
|------|------|---------|
| list（selectedArtifact=null）| 点击产物 a | detail（selectedArtifact=a）|
| detail | 点「返回」/ 点 onClose | list（=null）|
| detail（看 a）| 点列表另一产物 b（详情内无列表，N/A）| — |
| 任意 | threadId 变化 | list（重置，见 INV-3）|

- **唯一 owner**：ArtifactsPanel 组件本地 `useState`。无跨组件共享，无持久化。
- **旁路**：无（纯本地态，无 generic restore/delete/list API 触碰）。

### 状态对象 2：内容 fetch 生命周期（useArtifactContent hook）
| 当前 | 事件 | → 下一态 |
|------|------|---------|
| idle | 进 detail（mode∈{url-text,repo-file}）| loading |
| loading | fetch resolve | loaded(content) |
| loading | fetch reject / 非 2xx | error |
| loading/loaded | 切换产物 或 unmount | **取消旧 fetch**（见 INV-2）→ 新一轮 idle/loading |

### 不变量
- **INV-1**：媒体/外开模式（image/audio/url-binary/external/unavailable）**不触发 fetch**——直接由 url/提示渲染。仅 url-text/repo-file 走 fetch。（可测：classifyArtifactView 返回这些 mode 时组件不调 apiFetch）
- **INV-2**：切换选中产物或组件 unmount 时，in-flight fetch 的结果**必须丢弃**（AbortController 或 stale-closure guard），禁止 setState-after-unmount / 把旧产物内容套到新产物。（对抗场景：快速点 A→B，A 的慢响应不得覆盖 B）
- **INV-3**：`threadId` 变化时 `selectedArtifact` 重置为 null（回列表）——旧 thread 的产物不得残留在新 thread 详情。（可测：rerender 换 threadId → 回列表）
- **INV-4**：repo-file 模式 ensure worktreeId 失败（无 projectPath / 无 worktree）→ 进 error 态并提示「无法读取，可跳回原消息」，不 crash、不无限 loading。（对抗场景：system thread 无 projectPath）

### 对抗场景 → 测试
- **fetch race**（点 A 慢、点 B 快）→ 组件测：mock 两次 fetch 不同延迟，断言最终显示 B 内容（INV-2）
- **unmount during fetch** → 组件测：fetch pending 时 unmount，断言无 setState 警告（INV-2）
- **切 thread** → 组件测：detail 态下换 threadId prop，断言回 list（INV-3）
- **worktreeId 缺失** → 组件测：projectPath 空时点 repo-file 产物，断言 error 提示非 crash（INV-4）

---

## Tasks

### Task 1: 纯函数核心（classifyArtifactView / prRefToUrl / isTextLikeName）

**Files:**
- Create: `packages/web/src/components/artifacts/artifact-view.ts`
- Test: `packages/web/src/components/artifacts/__tests__/artifact-view.test.ts`

**Step 1-2: 写失败测试（穷举分发表 + PR url + 后缀）**
覆盖：image+url→image；audio+url→audio；pr+ref→external(github url)；file+url+`.md`→url-text；file+url+`.pdf`→url-binary；file 无url+ref→repo-file；file 无url无ref→unavailable；code(diff)+ref→repo-file。prRefToUrl：`o/r#12`→`https://github.com/o/r/pull/12`、`bad`→null。isTextLikeName：`.md/.txt/.log/.json/.ts`→true、`.png/.pdf/.docx`→false。
Run: `pnpm --filter @cat-cafe/web test -- artifact-view` → 期望 FAIL（模块不存在）。

**Step 3-4: 最小实现 → 测试转绿。**

**Step 5: Commit** `feat(F232): artifact-view 分发纯函数 + 单测 [宪宪/Opus-4.8🐾]`

### Task 2: AC-A5 列表项视觉补强（相对时间 + catId 昵称）

**Files:**
- Modify: `packages/web/src/components/ArtifactsPanel.tsx`（列表项 meta 行 ~line 230-246）
- Test: `packages/web/src/components/artifacts/__tests__/ArtifactsPanel.meta.test.tsx`

**复用（不重造）**：
- 相对时间：`import { formatRelativeTime } from '@/components/ThreadSidebar/thread-utils'` → `formatRelativeTime(a.createdAt)`
- catId 昵称：`import { useCatData } from '@/hooks/useCatData'` → `getCatById(a.catId)?.nickname ?? getCatById(a.catId)?.displayName ?? a.catId ?? '系统'`

**Step 1-2:** 测试：渲染含 createdAt/catId 的产物，断言出现相对时间文本 + 昵称（mock useCatData 返回 {nickname:'宪宪'}）。FAIL。
**Step 3-4:** 列表项 meta 行加 `<span>{formatRelativeTime(a.createdAt)}</span>` + catId→昵称。catId=null→"系统"。转绿。
**Step 5: Commit** `feat(F232): AC-A5 产物项相对时间 + 猫昵称 [宪宪/Opus-4.8🐾]`

### Task 3: useArtifactContent hook（内容获取 + worktreeId ensure）

**Files:**
- Create: `packages/web/src/components/artifacts/useArtifactContent.ts`
- Test: `packages/web/src/components/artifacts/__tests__/useArtifactContent.test.tsx`

**接口**：
```ts
export interface ArtifactContentState {
  view: ArtifactView;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  content?: string;   // url-text / repo-file 的正文
  mime?: string;      // repo-file 来自 FileData.mime；url-text 由 name 推
}
export function useArtifactContent(
  artifact: ThreadArtifactDTO | null,
  projectPath: string | undefined,
): ArtifactContentState;
```
**逻辑**：classifyArtifactView → 媒体/外开/unavailable 直接 idle（INV-1，不 fetch）；url-text → fetch(resolveUrl(url)) 取 text；repo-file → ensure worktreeId（`chatStore.workspaceWorktreeId` 优先；空则 `GET /api/workspace/worktrees?repoRoot={projectPath}` 取第一个）→ `GET /api/workspace/file?worktreeId&path=ref` → FileData。AbortController 处理切换/unmount（INV-2）。worktreeId 失败 → error（INV-4）。

**Step 1-2:** 测试覆盖 INV-1（媒体不 fetch）、INV-2（race + unmount，mock apiFetch 延迟）、INV-4（projectPath 空→error）。FAIL。
**Step 3-4:** 实现转绿。
**Step 5: Commit** `feat(F232): useArtifactContent 内容获取 hook + worktreeId ensure [宪宪/Opus-4.8🐾]`

### Task 4: ArtifactContentView 详情组件（复用底层渲染器）

**Files:**
- Create: `packages/web/src/components/artifacts/ArtifactContentView.tsx`
- Test: `packages/web/src/components/artifacts/__tests__/ArtifactContentView.test.tsx`

**渲染（按 useArtifactContent 结果）**：
- image → `<img src={view.url}>`；audio → `<audio controls src={view.url}>`
- url-text/repo-file + loaded：`isTextLikeName && .md` → `<MarkdownContent content disableCommandPrefix />`；否则 `<CodeViewer content mime={mime} path={name} scrollToLine={null} />`
- url-binary/external → 「在新窗口打开」按钮（`<a target=_blank rel=noreferrer>`）
- unavailable → 「该产物无法在面板内预览，可跳回原消息」+ 跳转按钮
- loading → 骨架/「加载中…」；error → 错误提示 + 跳回原消息
- 顶部：返回按钮 + 产物名 + 相对时间 + 昵称 + （repo-file 可选「在 workspace 打开」深链）

**Step 1-2:** 测试：各 mode 渲染正确元素（md→markdown 容器、image→img[src]、external→a[href,target=_blank]、loading/error 文案）。FAIL。
**Step 3-4:** 实现转绿。
**Step 5: Commit** `feat(F232): ArtifactContentView 按类型渲染产物内容 [宪宪/Opus-4.8🐾]`

### Task 5: ArtifactsPanel master-detail 集成

**Files:**
- Modify: `packages/web/src/components/ArtifactsPanel.tsx`（加 selectedArtifact state + list/detail 切换）
- Test: `packages/web/src/components/artifacts/__tests__/ArtifactsPanel.masterdetail.test.tsx`

**改动**：
- 加 `const [selected, setSelected] = useState<ThreadArtifactDTO | null>(null)`
- 列表项整行点击 → `setSelected(a)`（保留「跳转」按钮 stopPropagation 仍走 teleport）
- `selected` 非空 → 渲染 `<ArtifactContentView artifact={selected} projectPath={...} onBack={() => setSelected(null)} onJump={handleJump} />`，否则渲染现有列表
- `threadId` 变化 useEffect → `setSelected(null)`（INV-3）
- projectPath：`useChatStore(s => s.threads.find(t => t.id === s.currentThreadId)?.projectPath)`

**Step 1-2:** 测试：点列表项→进详情（出现返回按钮）；点返回→回列表；换 threadId→回列表（INV-3）；race/unmount（INV-2 已在 hook 测，这里测集成）。FAIL。
**Step 3-4:** 实现转绿。
**Step 5: Commit** `feat(F232): ArtifactsPanel master-detail 点击看内容（AC-A7）[宪宪/Opus-4.8🐾]`

### Task 6: 前端实测 + 截图（quality-gate 前）

- `pnpm alpha:start` 或 worktree dev server → browser-preview/Playwright
- 实操点击：① docs 类（backlog，repo-file）→ panel 内看 md 正文 ✓；② 图（image）→ 看图 ✓；③ 语音（audio）→ 播放 ✓；④ PR → 外开 ✓；⑤ 列表项相对时间 + 昵称 ✓
- ≤3 张截图 + 「需求→截图」映射表（补 AC-A5 的截图债 + AC-A7 证据）
- `pnpm gate`（biome + check + test，项目工具链，禁 npx — LL feedback_verify_with_repo_toolchain）

---

## Open Questions（技术 OQ，实现中自决）
- **OQ-A1（技术）**：repo-file 的 worktreeId——优先用 `chatStore.workspaceWorktreeId`（用户开过 workspace 则已初始化）；为空则按 thread `projectPath` 取第一个 worktree。主仓 thread 的 projectPath 指向主 repo。system thread 无 projectPath → unavailable/error 提示（INV-4）。实现时验证主 thread 的 projectPath 实际值。
- **OQ-A2（技术）**：url-text 的 uploads 文件 fetch——`/uploads/` 经 `resolveUrl` 加 API_URL 前缀；CORS/同源由现有 API 静态服务保证（与现状「打开」用同款 url）。实现时验证 fetch text 可行。
- **OQ-A3（技术）**：MarkdownContent 对 thread 产物 md（不在 workspace）裸渲染——不传 basePath/worktreeId（相对链接/图不解析，但正文渲染 OK）。可接受（产物正文查看，非完整 workspace 编辑）。
