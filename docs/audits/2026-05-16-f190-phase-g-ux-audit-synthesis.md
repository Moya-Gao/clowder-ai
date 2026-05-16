# F190 Phase G Post-Merge UI/UX Audit — 三猫综合

> **日期**: 2026-05-16 | **基线**: clowder-ai `8d78c1c0` vs cat-cafe `ea5d6e32` (Phase G merged)
> **参与**: Opus-46 (全量组件/token/route 对比) + Opus-47 (dark variant + 组件数量化) + Codex GPT-5.5 (量化 + audit 方法论)
> **结论**: **家里已是视觉系统的 source of truth。今天全量同步出去不阻塞。**

---

## 一、三猫共识

1. **Token 体系已收敛** — Phase G 把 globals.css 从 623→334 行，cocreator-* 全删（家里残留 2 处业务字符串 vs 开源 37 处 CSS 引用），`console-shell.css` / `console-controls.css` 两仓 identical。
2. **"开源更清爽"不是学习路径** — 开源天然简约是因为功能少（574 组件 vs 家里 616），不是设计上的领先。CVO 拍板"能力保留，视觉降噪"，路线正确。
3. **同步方向已反转** — 之前是"从社区学"，现在应该是"家里的 Phase G token 纪律同步出去覆盖社区旧 token"。

---

## 二、还能学的（三猫汇总，按优先级排序）

| # | 学什么 | 来源 | 规模 | 优先级 | 说明 |
|---|--------|------|------|--------|------|
| L-1 | **内联 `dark:` variant 收敛** | Opus-47 | ~80 处替换 | P2 | 家里 114 处 `dark:bg-*`/`dark:text-*` vs 开源 34。Phase G 的"最后一公里"——组件不写 `dark:`，让 CSS var 在 `:root.dark` 统一切 |
| L-2 | **Color audit 测试基建** | Codex | 新测试文件 | P2 | 开源有 `f056-color-audit.test.ts` 扫硬编码色；家里 646 处残留（功能多），需 allowlist/budget 防回归 |
| L-3 | **Token 文件拆分** (`theme-tokens.css`) | Opus-46 | ~50 行搬迁 | P3 | 开源把色板原语从 globals.css 抽到独立文件，更干净；纯整理 |
| L-4 | **`useVoiceServicesAvailable`** | Opus-46 | 36 行 hook | P3 | voice 服务未启动时隐藏入口，减少"点了没反应" |
| L-5 | **AppShell 接管 desktop ThreadSidebar** | Opus-46 | 中等重构 | P1 | F190 Phase F D-7 已记录。owner 归位后顶栏/sidebar 责任更清晰——但这已经是功能修复范畴，不纯属"学" |

---

## 三、显式不学的（deliberate trade-off）

| # | 开源做法 | 家里做法 | 为什么不学 |
|---|---------|---------|-----------|
| N-1 | 极简 header（3 按钮） | 品牌 Logo + DaemonIndicator + ThreadCatPill + LiveAudioToggle | 多猫产品，状态指示器是核心 UX 信号 |
| N-2 | 固定 260px sidebar | 可调 + 持久化 | power-user friendly，不退 |
| N-3 | 仅桌面 Settings | 完整 mobile 响应 | **我们领先**，开源 Settings 移动端不可用 |
| N-4 | 无 label/AI 自动分类 | 完整标签系统 + ThreadOrganizer | 差异化护城河 |
| N-5 | 无 transcript panel | 三态右面板（status/workspace/transcript） | LiveAudio/会议副驾驶是家里独有能力 |
| N-6 | `cocreator-*` token 名 | `cafe-*` + `console-*` + `conn-*` 三级 | Phase G 已决定，不开第四轨 |
| N-7 | Mission Hub 占位 stub | 完整 MissionControl + HubAgentSessions + HubStrategy | 多猫协作核心，不砍 |
| N-8 | 单一 McpConfigModal | 细分 read-only/external/managed 各栏 | 家里 MCP 管理更成熟 |
| N-9 | 简单 dark mode (34 处) | 更细粒度 dark mode (114 处) | 部分是 debt 待收（L-1），部分是真实需要 |
| N-10 | 社区旧 token (37 处 cocreator 残留) | 全删 | 应该由我们覆盖出去，不是学回来 |

---

## 四、量化对比快照

| 维度 | 家里 (cat-cafe) | 开源 (clowder-ai) | 判定 |
|------|---:|---:|------|
| 组件总数 | 616 | 574 | 家里多 42 个（功能多） |
| CSS/token 文件总行数 | 1442 | 1472 | 持平（家里略少） |
| globals.css 行数 | 334 | 300 | 接近（差 34 行 = 原语定义位置差异） |
| `cocreator-*` 残留 | 2 (业务字符串) | 37 (CSS 引用) | **家里更干净** |
| overlay `bg-black/30+` | 0 | 0 | 持平（Phase G 已清） |
| 内联 `dark:` variant | 114 | 34 | 家里更多（待收敛） |
| Tailwind 硬编码原色 | 646 | 4 | 开源少（功能少）；家里需 audit/budget |
| 线分隔 border-b | 71 | 54 | 家里更多（功能更复杂） |
| console-shell.css | identical | identical | ✅ |
| console-controls.css | identical | identical | ✅ |

---

## 五、后续建议（不挡今天同步）

三猫一致建议的后续 Phase（H 或 G follow-up）：

1. **H-1**: Color audit 测试 + allowlist/budget（防 646 处回增）
2. **H-2**: `dark:` variant 收敛 ~80 处 → CSS var 单源化
3. **H-3**: Mission Control token 化（硬编码 hex → conn-*/console-*）
4. **H-4**: ChatInputMenus / MobileInputToolbar 残留 indigo/old surface 清理
5. **H-5**: theme-tokens.css 拆分（原语搬出 globals.css）

以上均为 CSS-only 变更，可合 1 PR 或按优先级逐步收。**不阻塞今天全量同步。**

---

## 六、同步策略建议

> **方向**：家里 → 开源（覆盖），不是开源 → 家里（反向合）。

Phase G 让家里成为 token source of truth。同步时：
- `globals.css` / `console-shell.css` / `console-controls.css` / `connector-tokens.css` 以家里为准
- 开源残留的 37 处 `cocreator-*` CSS 引用由同步覆盖清理
- 开源的 `theme-tokens.css` 内容已包含在家里 globals.css 中（拆分是后续 P3 整理）
- 不同步家里的 `werewolf-theme.css`（游戏主题，非通用）
