# F190 Phase G Post-Merge UI/UX Audit — 三猫综合（完整版）

> **日期**: 2026-05-16 | **基线**: clowder-ai `8d78c1c0` vs cat-cafe `ea5d6e32` (Phase G merged)
> **参与**: Opus-46 (全量组件/token/route/hook 对比) + Opus-47 (dark variant + 组件数量化 + trade-off 定性) + Codex GPT-5.5 (量化 + audit 方法论 + 同步策略)
> **结论**: **家里已是视觉系统的 source of truth。同步方向反转：家→开源覆盖。**

---

## 一、三猫共识

1. **Token 体系已收敛** — Phase G 把 globals.css 从 623→334 行，cocreator-* 全删（家里残留 2 处业务字符串 vs 开源 37 处 CSS 引用），`console-shell.css` / `console-controls.css` 两仓 identical。
2. **"开源更清爽"不是学习路径** — 开源天然简约是因为功能少（574 组件 vs 家里 616），不是设计上的领先。CVO 拍板"能力保留，视觉降噪"，路线正确。
3. **同步方向已反转** — 之前是"从社区学"，现在应该是"家里的 Phase G token 纪律同步出去覆盖社区旧 token"。

---

## 二、Trade-off（双方不同但各有道理）

两仓在以下维度存在设计分歧——不是 bug 也不是 gap，是产品方向选择。全量同步时需**显式保留**家里做法，不被开源覆盖。

| # | 维度 | 开源做法 | 家里做法 | 为什么分歧合理 |
|---|------|---------|---------|--------------|
| T-1 | **Header 复杂度** | 极简 3 按钮（Export + Voice + PanelToggle） | 品牌 Logo + DaemonIndicator + ThreadCatPill + LiveAudioToggle + VoiceCompanion + Export + PanelToggle | 家里是多猫产品，DaemonIndicator（后台进程状态）和 ThreadCatPill（当前猫身份）是核心信息密度；开源追求"打开就是聊天"极简 |
| T-2 | **右面板模态** | 二态（开/关，只有 workspace） | 三态循环（status / workspace / transcript） | 家里有 LiveAudio 会议副驾驶，需要第三态显示实时转录 |
| T-3 | **导航实现** | Next.js 标准 `router.push()` | 自定义 `assignDocumentRoute()` + 路由历史栈 | 家里需在 Electron/嵌入场景保持 route history stack；标准 pushState 在 webview 行为不一致 |
| T-4 | **Sidebar 宽度** | 固定 260px | 可拖拽调整 + localStorage 持久化 | power-user friendly；开源追求视觉统一，家里追求灵活性 |
| T-5 | **Settings 响应式** | 仅桌面（flex-row only，无 mobile 支持） | 完整 mobile 响应（flex-col + max-h-[42vh] + touch scroll） | **家里领先**——开源 Settings 在移动端完全不可用 |
| T-6 | **Thread 管理** | 基础搜索 + pin/archive | 完整标签系统 + AI 自动分类 + ThreadOrganizer + LabelFilterBar | 差异化护城河；开源用户少没有 thread 管理负担 |
| T-7 | **Token 文件组织** | `theme-tokens.css`(色板原语) + `console-shell.css` + `console-controls.css` + `globals.css`(工具) | `globals.css`(原语+工具) + `console-shell.css` + `console-controls.css` + `connector-tokens.css` + `werewolf-theme.css` | 开源把色板抽独立文件更干净；家里多了 `conn-*` 语义色（Phase G 新增）和游戏主题 |
| T-8 | **Hub 系统** | 无独立 Hub，Settings shell 包办 | CatCafeHub（多 tab accordion）+ HubListModal + Mission Hub | 家里功能面更大（agent sessions / strategy / governance），需要独立入口不被 Settings 淹没 |
| T-9 | **MCP 配置** | 单一 McpConfigModal | 分栏：read-only capability board / external MCP / managed MCP / env secret | 家里 MCP 生态更成熟，需要区分安全等级（read-only vs write-capable） |
| T-10 | **Dark mode 颗粒度** | 34 处 `dark:` variant，依赖 CSS var 自动切 | 114 处 `dark:` variant，fine-grained 控制 | 开源方式更优雅（待收敛 → L-1），但部分家里 `dark:` 是真实需要（组件嵌套/overlay 场景 CSS var 无法覆盖） |

---

## 三、已知 Gap 仍未修（Phase F 审计已列，今天确认仍在）

以下是 F190 Phase F 审计已记录、Phase G 未涉及（G 只做 token/CSS）、全量同步前需要**明确标注状态**的 gap。

### P0 — 功能丢失（家里有文件但功能断线）

| # | 区域 | 问题 | 具体缺失 | 同步影响 |
|---|------|------|----------|----------|
| F-1 | IM 配置页 (`/settings?s=im`) | 权限管理断线 | `HubPermissionsTab` 文件存在但未 lazy/Suspense 接入 SettingsContent；飞书/企微/钉钉权限 UI 不可达 | 同步出去后开源也是断线状态——但开源本来就有这个组件完整接入，说明**家里 Phase A intake 时漏接了** |
| F-2 | IM 配置页 | 连接状态监控丢失 | `connectionState`/`lastHeartbeat`/`category` 字段、connStatePill、formatHeartbeat 全缺 | 开源有完整连接状态 pill + heartbeat 显示 |
| F-3 | IM 配置页 | 连接测试丢失 | `handleTestConnection()` 未实现，`/api/connector/{id}/test` 未接 | 开源有完整测试按钮 + loading 状态 |
| F-4 | 成员管理页 (`/settings?s=members`) | 降级为只读 | HubCatEditor / HubCoCreatorEditor / useConfirm import 缺失；编辑/删除/切换可用性不可用 | 开源有完整 CRUD |
| F-5 | Signal 详情页 | Content Enrichment 丢失 | 后端 `enrich-article.ts` service + route `/api/signals/articles/{id}/enrich` + 前端 enrichedContent 状态全缺 | 开源有完整全文抓取 + 渲染 |
| F-6 | Signal 详情页 | Thread 讨论导航丢失 | `useRouter` + `getThreadHref` 从 Signal 文章跳转关联 thread 的链接缺失 | 开源有 |

### P1 — 入口重复（ActivityBar 是唯一全局导航入口的原则未贯彻）

| # | 位置 | 重复入口 | 应删/改 | 同步影响 |
|---|------|---------|---------|----------|
| D-1 | ChatContainerHeader（🔴 红区） | ThemeToggle | 删除（ActivityBar 已有） | 同步出去时开源没有这个重复——**家里多出来的** |
| D-2 | ChatContainerHeader（🔴 红区） | HubButton | 删除（ActivityBar 已有） | 同上 |
| D-3 | ChatContainerHeader（🔴 红区） | Signal Inbox bell 🔔 | 删除（ActivityBar 已有旗帜图标） | 同上 |
| D-4 | ThreadSidebar | Memory Hub 按钮 | 删除（ActivityBar 已有） | 同上 |
| D-5 | ThreadSidebar | IM Hub 按钮 | 删除（ActivityBar 已有） | 同上 |
| D-6 | RightStatusPanel | Hub 齿轮图标 | 删除或改为非入口状态展示 | 同上 |
| D-7 | AppShell / ChatContainer（🔴 红区） | 桌面 sidebar owner 错位 | AppShell 接管桌面 ThreadSidebar，ChatContainer 仅保留 mobile overlay | 同步出去会暴露 owner 差异 |
| D-8 | ThreadSidebar 训练营按钮 | 入口语义丢失 | 恢复 BootcampListModal 列表入口（当前直接 createBootcampThread） | 开源有列表入口 |

### P2 — 参数/样式/兼容性

| # | 区域 | 问题 | 修改内容 | 同步影响 |
|---|------|------|----------|----------|
| S-1 | 系统配置页 | connector env 暴露 | 补回 `excludeCategories={['connector']}` | 安全问题，同步前建议修 |
| S-2 | Hub/Settings 重复内容 | IM/Env/Governance 三处完整 UI 重复 | Hub 改为摘要 + deep-link 到 Settings | 大改，可后置 |
| S-3 | Mission route 兼容 | `/mission` alias 缺失 | 补 redirect 到 `/mission-hub` | 小改，顺手补 |

---

## 四、还能学的（三猫汇总，仍值得从开源吸收的模式）

| # | 学什么 | 来源 | 规模 | 优先级 | 说明 |
|---|--------|------|------|--------|------|
| L-1 | **内联 `dark:` variant 收敛** | Opus-47 | ~80 处替换 | P2 | 家里 114 处 `dark:bg-*`/`dark:text-*` vs 开源 34。组件不写 `dark:`，让 CSS var 在 `:root.dark` 统一切，实现 token 单源纪律的最后一公里 |
| L-2 | **Color audit 测试基建** | Codex | 新测试文件 | P2 | 开源有 `f056-color-audit.test.ts` 扫硬编码色；家里 646 处残留（功能多），需 allowlist/budget 防回归 |
| L-3 | **Token 文件拆分** (`theme-tokens.css`) | Opus-46 | ~50 行搬迁 | P3 | 开源把色板原语从 globals.css 抽到独立文件；纯整理，不影响运行 |
| L-4 | **`useVoiceServicesAvailable`** hook | Opus-46 | 36 行 | P3 | voice 服务未启动时隐藏按钮入口，减少"点了没反应"的场景 |
| L-5 | **Workspace file editing hooks** | Opus-46 | 3 hooks/274 行 | P3 | `useFileEditing`(110L) + `useTreeNavigation`(109L) + `useWorkspaceSearch`(55L)；如后续做 workspace 内文件编辑是好参考 |

---

## 五、显式不学的（deliberate divergence）

| # | 开源做法 | 为什么不学 |
|---|---------|-----------|
| N-1 | 极简 header（无品牌/无监控指示器） | 多猫产品，DaemonIndicator + ThreadCatPill 是核心 UX 信号 |
| N-2 | 固定 260px sidebar 无 resize | power-user 需要调宽度 |
| N-3 | 桌面才能用 Settings | 我们已有完整 mobile 响应，**我们领先** |
| N-4 | 无 label/AI organization | 标签系统是差异化护城河 |
| N-5 | 无 transcript panel | LiveAudio/会议副驾驶是家里独有能力 |
| N-6 | `cocreator-*` token 名 | Phase G 已全删，`cafe-*` + `console-*` + `conn-*` 三级体系 |
| N-7 | Mission Hub = Coming Soon stub | 家里有完整 MissionControl + HubAgentSessions + Strategy |
| N-8 | 单一 McpConfigModal | 家里需要区分 read-only / external / managed / secret 安全等级 |
| N-9 | 社区旧 token (37 处 cocreator 残留) | 应由同步覆盖出去，不是反向学 |
| N-10 | 无 HubAgentSessions / HubStrategy | 多猫并行 session + 策略管理是 F101/F167 核心 |
| N-11 | 无 IdeateHeader / 头脑风暴入口 | 创意协作功能，产品需要 |
| N-12 | 无 hub-cat-editor-voice | refAudio + 猫人格编辑，F195 范围 |

---

## 六、量化对比快照

| 维度 | 家里 (cat-cafe) | 开源 (clowder-ai) | 判定 |
|------|---:|---:|------|
| 组件总数 | 616 | 574 | 家里多 42 个（功能多） |
| CSS/token 文件总行数 | 1442 | 1472 | 持平（家里略少） |
| globals.css 行数 | 334 | 300 | 接近（差 34 行 = 原语定义位置差异） |
| `cocreator-*` 残留 | 2 (业务字符串) | 37 (CSS 引用) | **家里更干净** |
| overlay `bg-black/30+` | 0 | 0 | 持平（Phase G 已清） |
| 内联 `dark:` variant | 114 | 34 | 家里更多（待收敛 L-1） |
| Tailwind 硬编码原色 | 646 | 4 | 开源少（功能少）；家里需 audit/budget |
| 线分隔 border-b | 71 | 54 | 家里更多（功能更复杂） |
| console-shell.css | identical | identical | ✅ |
| console-controls.css | identical | identical | ✅ |
| 独有 hooks（开源有家里无） | — | 4 (fileEditing/treeNav/workspaceSearch/voiceAvailable) | 待评估是否吸收 |
| 独有 hooks（家里有开源无） | 20+ (signals/mission/labels/transcript/...) | — | 功能差异化 |

---

## 七、全量同步收口检查表

全量同步前需要对每一项做**显式决策**（修/不修/标注 deliberate）：

### 必须在同步前修的（否则同步出去会暴露问题）

| # | 问题 | 原因 | 状态 |
|---|------|------|------|
| S-1 | `excludeCategories={['connector']}` 补回 | 安全：connector env 暴露在 system 页面 | 🔲 TODO |
| S-3 | `/mission` redirect alias | 兼容：开源有，同步后旧链接断 | 🔲 TODO |

### 建议同步前修的（否则开源用户明显感知退化）

| # | 问题 | 原因 | 状态 |
|---|------|------|------|
| F-1~F-3 | IM 配置页功能断线 | 开源原本有完整 IM 配置，同步后反而变只读 | 🔲 TODO |
| F-4 | 成员管理只读 | 同上，开源原本有 CRUD | 🔲 TODO |
| D-1~D-6 | 入口重复 | 同步后开源用户看到多余按钮 | 🔲 TODO |

### 可以同步后再修的（不阻塞，但需标注 known）

| # | 问题 | 原因 | 状态 |
|---|------|------|------|
| F-5/F-6 | Signal enrichment + thread nav | 家里 Signal 本身比开源丰富很多，缺 2 项不致命 | 🔲 后续 |
| D-7 | AppShell sidebar ownership | 大重构，需要单独 Phase | 🔲 后续 |
| D-8 | 训练营入口语义 | 小改但需 UX 验证 | 🔲 后续 |
| L-1~L-5 | 还能学的 5 项 | 纯优化，不影响功能 | 🔲 后续 |
| S-2 | Hub/Settings 内容去重 | 大改，可后置 | 🔲 后续 |

### 不需要修的（deliberate divergence，同步时保留家里做法）

所有 T-1~T-10 的 trade-off + N-1~N-12 的不学项。这些在同步时以家里为准覆盖出去，不需要向开源对齐。

---

## 八、后续建议（Phase H 或 follow-up PR）

三猫一致建议的后续收敛项：

1. **H-1**: Color audit 测试 + allowlist/budget（防 646 处回增，开源的 `f056-color-audit.test.ts` 为参考）
2. **H-2**: `dark:` variant 收敛 ~80 处 → CSS var 单源化
3. **H-3**: Mission Control token 化（硬编码 hex → conn-*/console-*）
4. **H-4**: ChatInputMenus / MobileInputToolbar 残留 indigo/old surface 清理
5. **H-5**: theme-tokens.css 拆分（原语搬出 globals.css）

---

## 九、同步策略

> **方向**：家里 → 开源（覆盖），不是开源 → 家里（反向合）。

Phase G 让家里成为 token source of truth。同步时：
- `globals.css` / `console-shell.css` / `console-controls.css` / `connector-tokens.css` 以家里为准
- 开源残留的 37 处 `cocreator-*` CSS 引用由同步覆盖清理
- 开源的 `theme-tokens.css` 内容已包含在家里 globals.css 中（拆分是后续 P3 整理）
- 不同步家里的 `werewolf-theme.css`（游戏主题，非通用）
- 家里多出的 42 个组件正常同步出去（功能新增）
- Trade-off 项（T-1~T-10）保留家里做法不改

---

## 附录：审计方法

- Opus-46: `find + diff` 全量组件/hook/route/store 枚举对比；`wc -l` + `grep -c` 量化 token 使用；逐文件 CSS class 审计
- Opus-47: `grep -rn 'dark:' --include='*.tsx'` 量化 dark variant；组件总数 `find | wc -l`；`git log --since` 确认开源 3 天无 UI 改动
- Codex GPT-5.5: CSS token 文件 `wc -l` 总量对比；`grep -rn 'cocreator'` 残留扫描；`f056-color-audit.test.ts` 方法论提取
