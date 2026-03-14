---
feature_ids: [F059, F115]
topics: [sync, runtime, postmortem, startup-chain]
doc_kind: discussion
created: 2026-03-13
participants: [opus, gpt52]
status: converged
thread: current
---

# F059 同步 Runtime 事故复盘

> 背景：2026-03-13 下午，在 clowder-ai 同步验收期间发生了一连串 runtime 事故。
> 本文综合布偶猫和缅因猫的独立复盘，提炼教训和优化方向。

---

## 一、事故时间线

| 时间 | 事件 | 根因 |
|------|------|------|
| 16:00 | 同步脚本在 target repo 上挂 15+ 分钟 | bash while-read 处理 48K 行 rsync 输出 |
| 16:05 | awk 多字节文件名报错 | node_modules 含 CJK 文件名，awk 默认 locale 不支持 |
| 16:35 | push clowder-ai 被 branch protection 拒绝 | 需要 PR + 4 CI checks |
| 16:41 | 发现同步会覆盖 12 个社区 PR 贡献 | rsync --delete + 无入站保护 |
| ~17:00 | 砚砚跑 clowder-ai 启动验收 | 正常流程 |
| ~17:10 | 砚砚的启动链无条件 kill_port 9877 | start-dev.sh 未在 kill 前检查 PROXY_ENABLED |
| ~17:15 | 我们家的 proxy 被踹死，布偶猫 ConnectionRefused | 同一个 start-dev.sh 管两个仓 |
| ~17:20 | 砚砚从 CLI 手动拉起 proxy | 子进程绑定在 CLI session 上 |
| ~17:25 | CLI session 结束，proxy 再次死亡 | nohup 方式不正确 / CLI 退出 |
| ~17:30 | 铲屎官重启 runtime，proxy 恢复 | start-dev.sh 有 PROXY_ENABLED 门禁了 |
| ~17:35 | 529 Overloaded 错误 | upstream Anthropic API 过载，proxy 原样透传 |
| ~17:40 | LLM 后修启动失败 | mlx-lm 未安装 |
| ~17:45 | ASR/TTS 报 "启动失败" 但实际启动成功 | wait_for_port 超时 < 模型 warmup 时间 |
| ~17:50 | 聊天框大小 bug | 前端依赖数组 regression |

---

## 二、两猫独立分析

### 布偶猫（opus）的分析

**核心问题：一个脚本不能安全地服务两个仓**

1. **共享脚本的副作用**：`start-dev.sh` 同时被自家 runtime 和开源仓使用。为开源仓改默认值（proxy 默认关）→ 家里 runtime 行为漂移
2. **进程生命周期管理**：从 CLI 手动拉起的 proxy 绑定在 CLI session，session 结束 = proxy 死亡
3. **启动验证缺失**：sidecar 启动后只 sleep 2s 就宣告成功，模型类服务 warmup 需要 10-30s
4. **上游错误不处理**：proxy 原样透传 529，未实现 retry/backoff

### 缅因猫（gpt52）的分析

**核心判断：不是脚本有几个 bug，而是把"开源同步"当成文件搬运问题**

1. **真相源没钉死**：公开仓手工精修 vs 源仓另一份，sync 一跑就覆盖
2. **共享脚本没有"内外环境隔离"**：为开源仓安全改默认值 → 家里 `.env` 没补显式值 → 行为漂移
3. **验证的是静态门禁，不是运行链**：pnpm check/lint/test 都跑了，但 `pnpm start` 和真实启动链没验
4. **修 A 炸 B 链条**：修 proxy 默认 OFF → 家里 proxy 没了 → 手动拉起 → CLI 退出又没了

**10 个具体坑**（gpt52 列举）：
1. README/CONTRIBUTING/SETUP 被 sync 覆盖
2. CLA/TRADEMARKS 被 rsync --delete 删掉
3. cat-cafe-skills 同步后残留私有路径
4. docs 导出半自动半手工，残留内部链接
5. 运行脚本 allowlist 太瘦，启动链断
6. 改公开仓默认值 → 改坏家里 runtime
7. start-dev.sh 无条件 kill_port 误伤本机
8. "尝试启动"误当"成功启动"
9. 热修没看 commit 历史就删 corrective patch
10. CI ruleset 与文档 PR 互相打架

---

## 三、共识

| # | 共识 | 来源 |
|---|------|------|
| C1 | 共享脚本改默认值必须同 commit 补家里 `.env` 显式值 | 事故 6 |
| C2 | sidecar 启动必须验证端口真实监听，不只 sleep | 事故 8 |
| C3 | 不从 CLI 手动拉起持久服务 | 事故 proxy |
| C4 | 同步后验收必须包含真实启动（`pnpm start`），不只静态检查 | gpt52 核心观点 |
| C5 | proxy 应实现 upstream 529/503 retry with backoff | 事故 529 |
| C6 | 热修前必须 `git log` 看原 patch 动机 | 事故 9 |

---

## 四、待讨论：优化方向

### 4.1 脚本默认值隔离

**问题**：一个 `start-dev.sh` 不能安全地同时服务两个仓。

**方案候选**：
- A. Profile 化：`start-dev.sh --profile=dev|opensource`，不同 profile 不同默认值
- B. 分叉脚本：clowder-ai 有自己的 `start-dev.sh`，sync 时 transform
- C. 环境感知：脚本读 `.env` 后再决定行为（当前方案，但需要保证 `.env` 显式值齐全）

### 4.2 sidecar 启动可靠性

**问题**：模型类服务 warmup 慢，固定 sleep 不够。

**方案**：
- 用 `wait_for_port` + 合理超时（ASR/TTS 30s, LLM 60s）
- 启动失败时明确报告而不是静默跳过
- summary 只列实际成功启动的服务

### 4.3 Proxy 弹性

**问题**：upstream 529/503 原样透传给 Claude Code，可能破坏 session。

**方案候选**：
- A. Proxy 层实现 retry with exponential backoff（最多 3 次）
- B. 对 5xx 返回标准化错误，不透传 upstream 的 non-standard body
- C. 特殊保护 thinking/signature 相关事件，避免 JSON round-trip 破坏签名

### 4.4 开源仓可选依赖的处理

**问题**：LLM 后修需要 mlx-lm，TTS/ASR 需要特定 Python 环境。

**方案**：
- `start-dev.sh` 检测到 ENABLED=1 但依赖缺失时，自动安装到 venv
- 或提供交互式 setup 脚本让用户选择可选依赖

---

## 五、"修 A 炸 B" 链条记录

```
修 public README 覆盖
  → 用 exclude → 治标不治本
  → 回头搬 .opensource.md → 制度化真相源 ✓

修 proxy 默认 OFF（保护开源仓）
  → 没补家里 .env
  → 家里 runtime 重启后 proxy 没了
  → 手动拉起 → CLI 退出 → 又死了
  → 铲屎官重启 runtime → start-dev.sh 正确拉起 ✓

修 sidecar 端口 kill 门禁
  → 4 个 sidecar 都改成 ENABLED 门禁 ✓
  → 但 startup readiness 验证还是假阳性
  → summary 报"已启动"但实际没起来

修 529 retry
  → 与 thinking block signature bug 交叉
  → 险些删掉 corrective message_start patch
  → 及时止住，先查 commit 历史 ✓
```

---

## 六、决策（两猫收敛 2026-03-13）

| # | 方向 | 决策 | 否决项 | 补充 |
|---|------|------|--------|------|
| 4.1 | 脚本默认值隔离 | **A. Profile 化** `start-dev.sh --profile=dev\|opensource` | B. 分叉脚本（两份真相源会漂）; C. 纯 `.env` 感知（事故证明不够） | `.env` 只做显式 override，不负责定义环境身份 |
| 4.2 | sidecar 启动可靠性 | **全做** | — | `wait_for_port` + 超时（ASR/TTS 30s, LLM 60s）+ 状态分层 `disabled/launching/ready/failed` + summary 只报 ready |
| 4.3 | Proxy 弹性 | **A + C**（retry with backoff + thinking/signature 保护） | B. 标准化 5xx body（吃掉排障信息，可能破坏流式协议） | 非流式非事件路径可做最薄包装 |
| 4.4 | 可选依赖 | **交互式 setup / 显式 installer** | `start-dev.sh` 静默自动安装（启动脚本必须可预测） | `--install-missing` 可选显式触发；默认只检查+报错+给命令 |

**砚砚补充的遗漏点**：启动摘要必须标注每个配置值的来源（`profile default` vs `.env override`），让行为漂移可被一眼看出。

### 三件套沉淀

- [x] ADR-016：4 条否决（双向 sync / 通用 reverse transform / 分叉脚本 / 静默自动安装）
- [x] LL-030：共享脚本改默认值教训
- [x] 操作规则：启动脚本必须有 profile / ready gate / 状态分层（纳入 ADR-016）
