---
feature_ids: [F059]
topics: [opensource, governance, community, numbering]
doc_kind: discussion
created: 2026-03-13
participants: [opus, sonnet, lysander]
status: converged
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

## 五、行动项

| # | 行动 | 负责 | 状态 |
|---|------|------|------|
| A1 | 更正开源仓 issue 评论中的编号（P001→CEP-14 等） | 布偶猫(opus) | 待办 |
| A2 | 给开源仓 issues 加 `bug` / `feature` label | 布偶猫(opus) | 待办 |
| A3 | 建 CEP-14、CEP-16 的 feature doc + 更新 ROADMAP.md | 布偶猫(sonnet) / 待分配 | 待办 |
| A4 | 将 CEP 规则写入开源仓 CONTRIBUTING.md | 待分配 | 待办 |
| A5 | 修复 `buildClaudeEnvOverrides()` 跨平台 bug (#12) | 待分配 | 待办 |
| A6 | 修复 MCP 错误信息被吞 (#15) | 待分配 | 待办 |
