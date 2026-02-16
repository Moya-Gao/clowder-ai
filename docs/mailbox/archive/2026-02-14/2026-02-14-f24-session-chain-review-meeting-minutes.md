# 2026-02-14 F24 Session Chain 三猫会议纪要

> 参与：铲屎官 + 布偶猫（宪宪）+ 缅因猫（砚砚）+ 暹罗猫
> 日期：2026-02-14
> 类型：需求对齐 + 观点碰撞 + 工作分配
> 关联：[BACKLOG F24](../BACKLOG.md)、[F24 计划文档](../plans/2026-02-13-f24-session-chain.md)、[Session Chain 讨论](../discussions/2026-02-13-f24-session-chain-handoff/README.md)

---

## 一、会议背景

铲屎官提出让三猫重新审视 F24，要求：
1. **不要急着动手**，先了解清楚现状
2. 每只猫发表独立观点
3. 确认"铲屎官到底想要什么"

---

## 二、F24 现状共识（三猫一致确认）

### 已完成：Phase A（地基，已合入 main）

| 组件 | 状态 |
|------|------|
| SessionChainStore（内存 + Redis + Lua 原子性） | ✅ |
| ContextHealth 提取（Claude 精确，Codex/Gemini fallback） | ✅ |
| API 路由（GET /threads/:id/sessions, GET /sessions/:id） | ✅ |
| 前端 ContextHealthBar（彩色进度条） | ✅ |
| invoke-single-cat 集成（session_init 创建、done 更新） | ✅ |
| 64 测试 | ✅ |
| 衍生 bug 修复（session 自愈 + context health 偏高） | ✅ |

### 未完成：Phase B→E（有完整设计，0 行代码）

| Phase | 内容 | 核心价值 |
|-------|------|---------|
| **B** | 阈值检测 + SessionSealer + 自动轮换 | context 满了自动切 session |
| **C** | Transcript JSONL 落盘 + Extractive Digest + 稀疏索引 | 旧 session 数据不丢失 |
| **D** | MCP 工具（list/read/detail/search） | 猫猫能按需读取旧 session |
| **E** | Session 2 Bootstrap（digest 注入 + 按需深查 + ThreadMemory） | 新 session 不失忆 |

### 相关待做

- **BACKLOG #72**：手动绑定 CLI Session ID（铲屎官兜底能力）

---

## 三、铲屎官的核心诉求（三猫理解一致）

> "猫的 session 满了就自动换一个，新猫能按需查旧 session，前端能看到完整历史"

三层递进目标：

1. **看得见**（Phase A ✅）— 猫的 context 用了多少，铲屎官能实时看到
2. **自动续命**（Phase B+C）— session 满了自动切换，不依赖铲屎官在线，数据不丢失
3. **满血重生**（Phase D+E）— 新 session 派 sub-agent 按需拉取旧记忆，不是失忆重启

砚砚的总结精准：**"你要的不是显示一个进度条，而是猫猫不在线也能稳定连续工作的长任务机制——不中断、不断片、可追溯。"**

---

## 四、三猫观点碰撞与采纳判断

### 砚砚（缅因猫）

| 观点 | 判断 | 理由 |
|------|------|------|
| "F24 只能算可观测性已上线" | ✅ 采纳 | 精准定位：Phase A 是仪表盘，不是执行能力 |
| 优先顺序：自动切换闭环 → 恢复闭环 → 中途注入 | ✅ 采纳 | 和宪宪判断一致，中途注入三猫差异最大、风险最高 |
| 中途消息注入排最后 | ✅ 采纳 | Claude stream-json 可用但 Codex/Gemini 不支持，先做通用能力 |

### 暹罗猫

| 观点 | 判断 | 理由 |
|------|------|------|
| 咖啡杯视觉隐喻（Context 满 = 咖啡杯倒满） | ✅ 部分采纳 | Cat Café 品牌吻合，让暹罗猫出 2-3 个方案供选择 |
| 猫猫体力值动画（伸懒腰→打哈欠） | ⚠️ 保留 | 有趣但可能太戏剧化，放入方案对比里让铲屎官选 |
| Session 链 UI 设计（session 1→2→3 可视化） | ✅ 采纳 | Phase B 前端展示需要，暹罗猫的 UI 专长正好发挥 |
| "交班仪式"格式化设计 | ❌ 暂缓 | 属于 Phase E Bootstrap 范畴，现在还没到 |
| 海豚同步指示器 | ❌ 驳回 | 和 F24 功能无关，是装饰性想法，不应分散精力 |
| "双轨摘要"建议 | ℹ️ 已有 | GPT Pro R2 已定方案（extractive.json + handoff.md），不需要重新发明 |

### 宪宪（布偶猫）

| 观点 | 自评 |
|------|------|
| Phase B 最急迫 | 三猫一致 |
| C+D 合并推进（存读一体） | 砚砚同意，设计文档也支持 |
| Extractive Digest 在 seal 时同步生成 | GPT Pro R2 已有此设计，方向正确 |
| #72 和 Phase B 一起做 | 数据模型已有，低成本高价值 |

---

## 五、决策与分歧

### 已达成共识

| # | 决策 | 支持者 |
|---|------|--------|
| 1 | Phase B 最高优先级 | 三猫一致 |
| 2 | 中途消息注入排最后 | 三猫一致 |
| 3 | C+D 作为一个交付单元 | 宪宪 + 砚砚 |
| 4 | #72 手动绑定和 Phase B 一起做 | 宪宪 |
| 5 | 暹罗猫负责 Session 链 UI 设计 | 铲屎官提议，宪宪认可 |

### 砚砚 Review 补强（已采纳）

| # | 级别 | 补强内容 | 宪宪判断 |
|---|------|---------|---------|
| 1 | **P1** | Phase A 缺正式 review 放行记录，不能口头默认通过。需补 review report 或明确放行结论，才能启动 #72 | ✅ 采纳。Phase A review 放行是 Phase B 开工的前置条件 |
| 2 | **P1** | Phase B→E 应显式写入 **Red→Green 关卡**：每个 Phase 必须先写失败用例 → 修复 → 回归绿灯，避免"先改后测" | ✅ 采纳。与 CLAUDE.md §7 Redis 测试规则一致，推广到全 Phase |
| 3 | **P2** | Phase D MCP transcript 工具须提前锁定权限边界：thread ownership 校验、分页上限、敏感字段脱敏、路径白名单 | ✅ 采纳。Phase D 实现前需先在设计文档补充安全约束章节 |

### 铲屎官确认（2026-02-14 19:06）

| # | 问题 | 铲屎官答复 | 落地决策 |
|---|------|-----------|---------|
| 1 | Phase A review 状态？ | "技术你们是专业的你们定，a 你们说过了就过" | ✅ Phase A 视为放行。砚砚已确认纪要通过，#72 阻塞解除 |
| 2 | Seal 阈值偏好？ | "codex 官方压缩 90%，claude 97%，似乎 90%-95% 合理" | ✅ 按猫差异化配置（见下方阈值表）。需在 CLI compact 之前抢先 seal |
| 3 | 暹罗猫 UI 设计范围？ | "你之前不是拍板过了吗？at 他让他画完你验收" | ✅ 已拍板。宪宪 at 暹罗猫开工，画完后宪宪验收 |

**额外指示**：B→E 全做完再合入 main，不要分阶段合入。开 worktree 隔离开发。

### Seal 阈值决策（铲屎官确认 + 宪宪技术判断）

原则：**在 CLI 自动 compact 之前抢先 seal**，但不要太早浪费 context。

| 猫猫 | CLI Auto-compact | Seal 阈值 | 预警阈值 | 理由 |
|------|-----------------|-----------|---------|------|
| Claude (Opus) | ~95% | **90%** | 80% | 在 95% compact 前留 5% 缓冲 |
| Codex (GPT) | ~90% | **85%** | 75% | 在 90% compact 前留 5% 缓冲 |
| Gemini | ~70% | **65%** | 55% | 在 70% compress 前留 5% 缓冲 |

附加保险丝：`turnBudget` (12k tokens) + `safetyMargin` (4k tokens)，防止单轮突然暴涨。

所有阈值配置化可调（`ContextHealthConfig`），不硬编码。

---

## 六、推进顺序

```
Phase B (自动 Seal + 轮换 + #72 手动绑定)
  ↓
Phase C+D (Transcript 落盘 + MCP 工具，一个交付单元)
  ↓
Phase E (Bootstrap 注入 + Sub-agent 交接 + ThreadMemory)
  ↓
(远期) 中途消息注入
```

---

## 七、质量关卡（砚砚补强，全 Phase 适用）

每个 Phase 交付必须满足 **Red→Green** 流程：

1. **先写失败用例**（Red）：新功能/改动先有会失败的测试
2. **实现功能**：让测试通过
3. **回归验证**（Green）：`pnpm test` + `pnpm --filter @cat-cafe/api test:redis`（如涉及 Redis）全绿
4. **Review 提交**：附测试结果，标注 Red→Green 转换点

Phase D 额外要求（MCP 工具安全约束）：
- thread ownership 校验（只能读自己 thread 的 transcript）
- 分页上限（单次最多 200 events）
- 敏感字段脱敏（如有 token/credential 出现在工具输出中需过滤）
- 文件路径白名单（transcript 只能从指定目录读取）

---

## 八、工作分配

### 布偶猫（宪宪）— 主开发

| 任务 | Phase | 说明 |
|------|-------|------|
| SessionSealer 实现（requestSeal + finalize） | B | CAS Lua 原子改状态 + 清 active 指针 |
| invoke-single-cat 阈值触发集成 | B | done 分支检测 fillRatio → 调用 requestSeal |
| #72 手动绑定 API | B | `PATCH /api/threads/:threadId/sessions/:catId/bind` |
| 前端 session 状态变化展示 | B | session_status_changed websocket 事件 + UI |
| Transcript JSONL 落盘 + 稀疏索引 | C | events.jsonl + index.json |
| Extractive Digest 生成 | C | seal finalize 时同步生成 digest.extractive.json |
| MCP 工具实现（list/read/detail/search） | D | 接口一次定住，search 先用全文实现，含安全约束 |
| Phase D 安全约束设计文档 | D | 实现前先在计划文档补充权限边界章节 |
| Session 2 Bootstrap 注入 | E | ContextAssembler 扩展 + 系统提示注入 |

### 缅因猫（砚砚）— Review + 安全

| 任务 | Phase | 说明 |
|------|-------|------|
| Phase A 正式 review（若未放行） | A | 补放行记录，解除 #72 阻塞 |
| Phase B 代码 review | B | 重点关注：Lua 原子性、Redis 竞态、阈值边界、Red→Green 覆盖 |
| Phase C+D 代码 review | C+D | 重点关注：transcript 数据安全、MCP 工具权限边界 |
| Phase E 代码 review | E | 重点关注：bootstrap 注入安全、token 预算控制 |

### 暹罗猫 — UI 设计

| 任务 | Phase | 说明 |
|------|-------|------|
| ContextHealthBar 视觉升级方案（2-3 个方案） | B | 包含当前进度条 vs 咖啡杯隐喻 vs 其他创意，供铲屎官选择 |
| Session 链可视化设计 | B | session 1→2→3 时间线展示，含状态（active/sealing/sealed） |
| Seal 状态提示设计 | B | "正在封存 Session 3..."的 UI 表达 |

---

## 九、下一步（铲屎官已确认，可开工）

1. ~~铲屎官确认~~ ✅ 三个问题已确认（2026-02-14 19:06）
2. **暹罗猫开工**：ContextHealthBar 升级 + Session 链 UI 设计稿（宪宪验收）
3. **宪宪开 worktree**：Phase B→E 全部在 worktree 开发，做完再合入 main
4. **砚砚待命**：Phase B 首版完成后立即做第一轮 review
5. **合入策略**：B→E 全做完 + 砚砚 review 通过 → 一次性合入 main

---

*纪要由布偶猫/宪宪整理 — 2026-02-14*
