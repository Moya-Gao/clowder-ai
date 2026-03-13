---
feature_ids: [F059]
topics: [opensource, governance, community, numbering]
doc_kind: discussion
created: 2026-03-13
participants: [opus, sonnet, lysander]
status: reopened
thread: current
---

# F059 开源仓社区治理：CEP 编号体系与 Issue 管理

> 背景：clowder-ai 内测开放后，首批内测小伙伴提交了 6 个 issue。讨论过程中发现编号体系、
> feature 追踪方式、Mission Hub 集成等治理问题需要收敛。

---

## 一、内测反馈总览

2026-03-13 开源仓 `zts212653/clowder-ai` 收到首批内测 issue：

| # | 标题 | 提交人 | 类型 |
|---|------|--------|------|
| #1 | Welcome Beta Testers! Start Here | lysander | 引导帖 |
| #12 | Windows 平台支持：问题与修复报告 | whutzefengxie-ops | bug + feature |
| #14 | Windows & Linux & Mac 平台裸机支持 | mindfn | feature |
| #15 | MCP tool errors show 'Unknown error' | mindfn | bug |
| #16 | Bootcamp guide: improve phase transition UX | mindfn | bug |
| #18 | 全局按钮 hover tooltip — 无障碍体验 | mindfn | bug |

### 关键发现

1. **#12 质量极高**：whutzefengxie-ops 花了一个半小时踩坑，找到了 `buildClaudeEnvOverrides()` 返回 `undefined` 的跨平台 bug（非 Windows 特有）、Windows spawn `.cmd` shim 问题、Git Bash 路径自动检测缺失
2. **#15 影响面广**：MCP 错误信息被吞，所有用户排查问题都受影响
3. **#14 门槛痛点**：手动安装依赖过多，需要一键部署脚本

---

## 二、编号体系讨论

### 问题：开源仓的 feature 用什么编号？

**触发**：bootcamp 期间在 #14 回复中使用了 `F099` 编号，但：
- 内部 cat-cafe BACKLOG 已到 F112+
- 开源仓自身同步出来的 `docs/features/` 已包含 `F099-hub-navigation-scalability.md`
- **三重冲突**：内部编号 vs 开源仓已有 F099 vs bootcamp 新立项

### 迭代过程

| 轮次 | 方案 | 问题 |
|------|------|------|
| 1 | P001、P002... 独立递增 | 需要手动管理编号，谁来分配？ |
| 2 | bug 也用 P 编号？ | 内部 F 只给 feature，bug 从不编号——开源仓应一致 |
| 3 | P + GitHub issue 号（P14, P16） | 跳号——P12、P14、P16 看起来乱 |
| 4 | 跳号有问题吗？ | 调研 K8s KEP / Python PEP / Rust RFC 发现跳号是常态 |
| 5 | 但三大项目都是三字母前缀 | P 只有一个字母，不够正式 |

### 决策：CEP（Clowder Enhancement Proposal）

**CEP = Clowder Enhancement Proposal**，对标业界：

| 项目 | 前缀 | 全称 | 编号来源 |
|------|------|------|---------|
| Kubernetes | KEP | K8s Enhancement Proposal | GitHub Issue 号 |
| Python | PEP | Python Enhancement Proposal | 编辑手动分配 |
| Rust | RFC | Request for Comments | GitHub PR 号 |
| **Clowder** | **CEP** | **Clowder Enhancement Proposal** | **GitHub Issue 号** |

**规则**：
- **CEP 编号 = GitHub Issue 号**，创建 issue 时天然获得，零维护
- **只有 feature / enhancement 用 CEP 前缀**，bug 直接用 issue # 追踪
- **跳号是正常的**（KEP-1591、KEP-1847... K8s 也这样）
- **F 系列**由内部 cat-cafe 分配，sync 脚本单向推出；**CEP 系列**由社区 issue 产生
- Feature doc 命名：`docs/features/CEP-14-multi-platform-deploy.md`

### 当前 CEP 分配

| CEP | Issue | 内容 |
|-----|-------|------|
| CEP-14 | #14 | Multi-Platform One-Click Deploy |
| CEP-16 | #16 | Bootcamp Phase Transition UX |

（#12 同时含 bug 和 feature 需求：`buildClaudeEnvOverrides` bug 直接用 #12 追踪，Windows spawn 适配若独立立项再分配 CEP）

---

## 三、Bug vs Feature 追踪原则

**Sonnet 提出，铲屎官认可**：

| 类型 | 编号方式 | 进 ROADMAP？ | 建 Feature Doc？ |
|------|---------|-------------|-----------------|
| Feature / Enhancement | CEP-{issue号} | ✅ | ✅ `docs/features/CEP-xx-name.md` |
| Bug fix | GitHub issue # | ❌ | ❌ |

理由：内部 cat-cafe 的 F 编号也只给 feature，bug 从不进 BACKLOG（要求立即修）。开源仓保持一致。

---

## 四、Mission Hub 集成

### 问题：内测小伙伴要在 Mission Hub 看进度，不想翻 GitHub

**分析**：开源仓已通过 sync 脚本同步了完整的 `docs/features/F001~F112` + `ROADMAP.md`，Mission Hub 的数据源已经齐全。

**方案**：
- CEP feature doc（`docs/features/CEP-xx-name.md`）和 F 系列 doc 放在同一目录
- `ROADMAP.md` 中 F 系列（sync 来的）和 CEP 系列（社区发起的）共存
- Mission Hub 无需改动，直接读取渲染

---

## 五、反对意见：不需要 CEP，统一用 F 编号

> 布偶猫(opus) 2026-03-13 03:05，铲屎官暂时认同

### 反对理由

**CEP 引入的成本远大于收益：**

1. **15+ 处工具链改造**：`generate-feature-index.mjs`、`feat-index-doc-import.ts`、`FeatureBirdEyePanel.tsx` 等所有 feature 发现/索引/渲染逻辑都硬编码了 `F\d+` 正则。CEP 要并存，每处都要改，每处都是 bug 风险
2. **双编号认知负担**：贡献者需要搞清楚"我该用 F 还是 CEP？"——答案本应是"你不需要关心编号"
3. **生命周期断裂**：社区 issue 立了 CEP-14，内部实现时又要关联 F113？同一个 feature 两个编号，追踪成本翻倍
4. **CEP 号是 issue 号的马甲**：CEP-14 = issue #14，加了个前缀没有增加信息量

### 替代方案：统一 F 编号，GitHub Issue 回归讨论入口

**流程：**

```
社区开 issue #14 "Multi-Platform Deploy"
    ↓ 讨论收敛，maintainer approve
    ↓
内部 BACKLOG.md 立项 → 分配下一个可用 F 号（如 F113）
    ↓ 写 feature doc → 实现 → review
    ↓
sync 推送 → 开源仓出现 docs/features/F113-multi-platform-deploy.md
    ↓
issue #14 标记 label: feature:F113 → close with "Shipped in F113"
```

**好处：**

| 对比项 | CEP 方案 | 统一 F 方案 |
|--------|---------|------------|
| 工具链改动 | 15+ 处正则 | **零** |
| 贡献者心智负担 | 要学 CEP 规则 | **只需开 issue** |
| Mission Hub 兼容 | 需要改前后端 | **天然兼容** |
| 编号分配 | 自动(issue号)但跳号 | maintainer 分配，连续 |
| Feature 追踪 | F + CEP 双轨 | **单轨** |

### Fork 用户撞号问题

> 铲屎官追问：fork 用户自己立项的 F 号和我们推送的会不会撞？

**不会成为系统性问题：**

- 开源仓通过 sync 已包含完整的 `docs/features/F001~F112+`
- fork 用户看到的起点是当前最大 F 号，自然递增
- 如果 fork 用户和上游同时分配了同一个 F 号 → 标准的 Git merge conflict，和编号体系无关
- K8s fork 也不会因为 KEP 号冲突而引入第二套编号

### 修订后的行动项

| # | 行动 | 负责 | 状态 |
|---|------|------|------|
| A1 | ~~更正 issue 评论中的编号~~ → 不需要 CEP 前缀，直接用 issue # 讨论 | — | 取消 |
| A2 | 给开源仓 issues 加 `bug` / `feature` label | 布偶猫(opus) | 待办 |
| A3 | 社区 feature 由 maintainer 立项到 BACKLOG → 分配 F 号 → sync 推送 | maintainer | 流程(非一次性) |
| A4 | CONTRIBUTING.md 写清楚立项流程：开 issue → 讨论 → maintainer 分配 F 号 | 待分配 | 待办 |
| A5 | 修复 `buildClaudeEnvOverrides()` 跨平台 bug (#12) | 待分配 | 待办 |
| A6 | 修复 MCP 错误信息被吞 (#15) | 待分配 | 待办 |

### Bug vs Feature 追踪原则（不变）

| 类型 | 编号方式 | 进 ROADMAP？ | 建 Feature Doc？ |
|------|---------|-------------|-----------------|
| Feature / Enhancement | F{nnn}（maintainer 分配）| ✅ | ✅ `docs/features/F0xx-name.md` |
| Bug fix | GitHub issue # | ❌ | ❌ |

---

## 六、首批社区 Feature 立项（2026-03-13）

铲屎官拍板后，对开源仓 issues 完成分类。

### 立项的 Feature

| F 号 | Issue | 标题 | 提交人 |
|------|-------|------|--------|
| F113 | #14 | Multi-Platform One-Click Deploy | mindfn |

Feature doc：`docs/features/F113-multi-platform-one-click-deploy.md`。

### 撤销立项（2026-03-13 修订）

以下三个 issue 最初被错误分配了独立 F 编号，经铲屎官审核后撤销：

| 原 F 号 | Issue | 原因 | 处置 |
|---------|-------|------|------|
| ~~F114~~ | #16 | Bootcamp UX 改善属于 F110 范畴，不需要独立立项 | 标签移除，关联 F110 |
| ~~F115~~ | #28 | 纯 UI enhancement，不够 feature 级别 | 标签移除，保留 enhancement |
| ~~F116~~ | #29 | 摘要数据源不完整（仅 sealed session 有），可行性存疑 | 标签移除，保留 enhancement，未来可挂 F095 |

**教训**：社区 issue 分配 F 编号前，必须逐个审核是否达到 feature 级别。批量打标签 ≠ 审核通过。

### Bug issues

直接用 issue # 追踪，不分配 F 号：#12, #15, #18, #20, #21, #22, #23, #24, #27, #30, #31

BACKLOG.md 暂不更新（铲屎官指示）。
