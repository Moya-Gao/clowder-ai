---
feature_ids: [F059]
topics: [postmortem, sync, opensource, runtime, proxy]
doc_kind: postmortem
created: 2026-03-13
authors: [opus, gpt52]
severity: P1
status: draft
---

# 复盘：开源同步事故链（2026-03-09 ~ 2026-03-13）

> 从 cat-cafe 同步代码到 clowder-ai 开源仓的过程中，连续引发了 runtime 崩溃、
> proxy 不通、sidecar 启动失败、thinking block 签名腐坏等一系列连锁事故。
> 本文还原完整事故链，定位系统性根因，提出可执行的防护措施。

---

## 一、事故总览

| 影响 | 描述 |
|------|------|
| **持续时间** | 约 4 天（3/9 首次同步 → 3/13 最后修复） |
| **直接影响** | 铲屎官的 runtime 环境多次不可用；布偶猫因 proxy 不通被中断多次 |
| **波及范围** | start-dev.sh、anthropic-proxy.mjs、sidecar 启动链、Claude Code session、前端 ChatInput |
| **参与修复** | 砚砚(gpt52)、宪宪(opus)、铲屎官手动重启 |

---

## 二、完整事故时间线

### Phase 1: 同步管线建设（3/9 ~ 3/11）

| 时间 | 事件 | 结果 |
|------|------|------|
| 3/9 | P1 同步管线完成：`sync-manifest.yaml` + `sync-to-opensource.sh` | 首次 dry-run 通过 |
| 3/10 | P2 治理文件完成：README、CONTRIBUTING、SECURITY、CODEOWNERS、CI | 合入 main |
| 3/11 | 首次真实同步到 clowder-ai | 文件到位，但暴露大量问题 |

### Phase 2: 验收暴露的第一批问题（3/12）

| 时间 | 事件 | 影响 |
|------|------|------|
| 3/12 | 砚砚做隔离启动验收，发现 4 个 P1 | docs 泄露内部链接、proxy 无条件 kill_port、owner mention 测试与配置不一致、Hindsight 默认开启 |
| 3/12 | 我（opus）修复 4 个 P1 + 重新同步 | 表面修好了 |
| 3/12 | 砚砚继续验收，发现 start-dev.sh 无条件 `kill_port 9877` | 跑 clowder-ai 启动时**踹死了我们自己家的 proxy** |

### Phase 3: 连锁事故爆发（3/12 深夜 ~ 3/13 凌晨）

| 时间 | 事件 | 影响 |
|------|------|------|
| 3/12 深夜 | 砚砚修 proxy 误杀：只有 `ANTHROPIC_PROXY_ENABLED=1` 才 kill + start | **改了脚本默认行为** |
| 紧接着 | 砚砚扩展到 ASR/TTS/LLM 三个 sidecar 也 env 控制 | 同理改了默认行为 |
| 紧接着 | **但家里 `.env` 没有这些 flag** | 重启后 proxy + sidecar 全不起来 |
| 3/12 深夜 | 铲屎官发现布偶猫不通，手动重启 runtime | 砚砚后来补了 `.env` 的 `=1` |
| 3/13 00:00 | 铲屎官报告 3 个新问题 | ChatInput 高度回归、529 无重试、sidecar 启动假成功 |
| 3/13 00:08 | 我修 3 个问题 + 发现 proxy signature 腐坏 | 第 4 个问题 |
| 3/13 00:16 | **我没看 commit log 就删了 corrective message_start** | 铲屎官骂了，要求回退 |
| 3/13 00:19 | 回退 → 重新定位根因 → request-side strip thinking | 修好 |
| 3/13 00:22 | 铲屎官重启，sidecar 全部报启动失败 | `sleep 2` 对 ML 模型太短 |
| 3/13 00:26 | 改成 `wait_for_port` 轮询 | 修好 |
| 3/13 00:26 | LLM 后修 `mlx-lm not installed` | sidecar 脚本不自动装依赖 |
| 3/13 00:27 | 改成自动创建 venv + pip install | 修好 |

---

## 三、连锁反应分析（修 A 导致 B 坏）

### 连锁 1：proxy 误杀 → 改默认值 → .env 不配套 → runtime 崩溃

```
start-dev.sh 无条件 kill_port 9877
  → 砚砚改成 ENABLED=1 才 kill（方向正确）
    → 但家里 .env 没有 ANTHROPIC_PROXY_ENABLED=1
      → 铲屎官重启 runtime → proxy 不启动
        → 布偶猫 Claude API 完全不通
          → 布偶猫被反复中断（529 + session 炸）
```

**根因**：改了脚本默认行为，没有在同一 commit 同步更新运行环境配置。

### 连锁 2：sidecar env 控制 → 启动假成功 → 检测太早 → 二次误判

```
sidecar 改成 env flag 控制（正确）
  → 但启动后盲写 "✓ 已启动"
    → opus 加端口检测：sleep 2 + 一次性 lsof 检查
      → ML 模型加载需要 10-30 秒 → 全部报 ✗ 启动失败
        → 启动摘要不显示 sidecar 地址
          → 铲屎官以为脚本坏了
            → 再改成 wait_for_port 轮询（最多 30s）
```

**根因**：对 ML sidecar 启动特性（模型下载 + warmup）认知不足；一次性检测不适用于慢启动服务。

### 连锁 3：proxy signature 修复 → 错误根因判断 → 被回退

```
"Invalid signature in thinking block" 400 错误
  → opus 猜测是 corrective message_start 导致
    → 删了 corrective message_start
      → 铲屎官："不加这个你根本跑不起来！"
        → 回退
          → 重新看 commit log，发现真正根因：
            Felix-2 gateway 截短 thinking 内容但保留 Anthropic 签名
            → 签名和内容不匹配
          → 改为 request-side strip thinking blocks
```

**根因**：不看 `git log` 就改代码。corrective message_start 有它的历史原因（commit `5c6dce1d`：Felix-2 gateway `input_tokens:0` 修复），opus 没读就判定它是 bug。

### 连锁 4：源仓历史债 → 同步到公开仓 → 发现问题 → 回源仓修 → 重新同步 → 发现新问题 → 循环

```
sync to clowder-ai
  → pnpm check 挂了（源仓 1881 errors 历史债）
    → 在 cat-cafe 修 → push → 重新 sync
      → pnpm lint 又挂了（TS4111, shared, mcp-server）
        → 在 cat-cafe 修 → push → 重新 sync
          → start-dev.sh 又有新问题
            → 反复循环（至少 5 轮 sync）
```

**根因**：脏仓同步。没有在同步前把源仓门禁拉绿，导致两个仓之间来回修、越修越乱。

---

## 四、系统性根因

### 根因 1：同步脚本是"文件复制器"，不是"发布系统"

同步脚本做了：copy → exclude → transform → security scan。
但没有做：

- 目标仓独有文件保护（`rsync --delete` 删了 CLA.md、TRADEMARKS.md）
- 同步后 runtime 可启动性验证
- 同步后文件 inventory 契约检查
- 内外默认值漂移防护

**一句话**：我们让一个文件同步脚本承担了开源发布系统的职责，但没给它发布系统该有的契约验证。

### 根因 2：共享脚本没有环境隔离

`start-dev.sh`、`anthropic-proxy.mjs` 同时服务于：
- 自家 runtime（`3001/3002`，proxy on，sidecar on）
- 开源仓 runtime（`3003/3004`，proxy off，sidecar off by default）

为开源仓改默认值 = 改家里的默认值。这不是"同步事故"，是**环境隔离缺失**。

### 根因 3：真相源没钉死

| 文件 | 一开始 | 后来 | 问题 |
|------|--------|------|------|
| README.md | 在 clowder-ai 手工精修 | 被 sync 覆盖回 generic 版 | 双源冲突 |
| CONTRIBUTING.md | 在 cat-cafe 写好 → 同步 | 在 clowder-ai 又改了 | 双向漂移 |
| SETUP.md | 讨论里说有 | sync manifest 没写 | 漏同步 |
| CLA.md | 在 clowder-ai 手写 | 被 `--delete` 删了 | 目标仓资产被摧毁 |

**一句话**：每份公开文档必须有且只有一个真相源，要么在源仓维护并同步出去，要么在目标仓维护并加 exclude。不能又在这改又在那改。

### 根因 4：验证层缺失

我们验证了：
- `pnpm check` / `pnpm lint` / `pnpm test:public`（静态门禁）

我们没验证：
- `start-dev.sh` 能不能真起来（运行时门禁）
- proxy → upstream → Claude Code session 链路通不通（集成门禁）
- 改了默认值后家里 runtime 还能不能正常工作（回归门禁）

---

## 五、具体教训（LL 格式）

### LL-020: 改共享脚本默认值必须同步补 .env

- 状态：validated
- 更新时间：2026-03-13
- 坑：砚砚改了 start-dev.sh 默认行为（sidecar 需要 `*_ENABLED=1`），但家里 `.env` 没有这些 flag，重启后服务全没起来
- 根因：脚本默认值和运行环境配置是一个原子单位，拆开改就是定时炸弹
- 触发条件：任何对 `start-dev.sh`、`.env.example` 中默认行为的变更
- 修复：砚砚后来手动补了 `.env` 的 `=1` flag
- 防护：**改 start-dev.sh 默认值时，必须在同一 commit 检查并更新 `.env` 和 `.env.example`**
- 来源锚点：commit `f10f6a51`、thread 铲屎官消息 `000004-208951d1`

### LL-021: 不看 commit log 不改 proxy 代码

- 状态：validated
- 更新时间：2026-03-13
- 坑：opus 看到 proxy 签名错误，猜测 corrective message_start 是 bug，直接删了。实际那是给 Felix-2 gateway input_tokens:0 的必要补丁
- 根因：高压热修中按症状猜根因，没先看 commit history 理解为什么加这个代码
- 触发条件：proxy / session / thinking / token 相关代码的热修
- 修复：铲屎官要求回退 → 回退 → 重新看 commit log 定位真正根因
- 防护：**修改 proxy SSE 相关代码前，必须先 `git log --oneline -- scripts/anthropic-proxy.mjs` 看历史**
- 来源锚点：commit `5c6dce1d`（原始修复）、thread 铲屎官消息 `000031-d2f8435f`（骂）

### LL-022: ML sidecar 启动检测必须用轮询

- 状态：validated
- 更新时间：2026-03-13
- 坑：用 `sleep 2` + 一次性 lsof 检测 ML 服务是否启动，模型加载要 10-30 秒，全部报失败
- 根因：对 ML 服务启动特性认知不足——模型下载、加载、warmup 远超 2 秒
- 触发条件：任何 Python ML 模型服务的启动检测
- 修复：改成 `wait_for_port` 轮询（每秒检查一次，ASR/TTS 最多 30s，LLM 后修 20s）
- 防护：**sidecar 启动检测一律用 `wait_for_port`，不用 `sleep N` + 一次性检查**
- 来源锚点：commit `12562549`、thread 铲屎官消息 `000000-4b67acd1`

### LL-023: 脏仓不同步——先拉绿源仓门禁再 sync

- 状态：validated
- 更新时间：2026-03-13
- 坑：源仓 cat-cafe 的 `pnpm check` 有 1881 errors，带着红灯同步到 clowder-ai，然后在两个仓之间来回修，至少反复同步 5 轮
- 根因：没有"同步前门禁"——同步脚本不检查源仓自身的门禁状态
- 触发条件：源仓有未修复的 lint/check/type 错误时执行同步
- 修复：砚砚先在源仓修了 biome / TS4111 历史债，再重新同步
- 防护：**同步脚本第 0 步应该是 `pnpm check && pnpm lint`，不过不同步**
- 来源锚点：thread 砚砚消息 `000578-777aaaab`

### LL-024: rsync --delete 对目标仓独有文件是毁灭性的

- 状态：validated
- 更新时间：2026-03-13
- 坑：clowder-ai 手写的 CLA.md、TRADEMARKS.md 被 `rsync --delete` 删掉了，因为源仓 allowlist 里没有这些文件
- 根因：同步脚本把"源仓没有的文件"等同于"应该删除的文件"
- 触发条件：目标仓有源仓 allowlist 之外的自维护文件
- 修复：加了 rsync exclude 列表
- 防护：**同步脚本应该维护一个 `target_owned_files` 列表，这些文件永远不被 sync 动到**
- 来源锚点：thread 砚砚消息 `000110-23d352a7`

### LL-025: start-dev.sh 无条件 kill_port 是危险设计

- 状态：validated
- 更新时间：2026-03-13
- 坑：start-dev.sh 无条件 `kill_port 9877`，砚砚跑 clowder-ai 验收时踹死了我们自己家的 proxy
- 根因：脚本假设"本机所有端口都归我管"，但多个 runtime 可能共享同一台机器
- 触发条件：同一台机器上运行多个 cat-cafe 实例（开发仓 + 开源仓验收）
- 修复：砚砚改成只有 `ANTHROPIC_PROXY_ENABLED=1` 才 kill + start
- 防护：**可选服务的端口操作（kill/start）必须受 env flag 控制，默认不动**
- 来源锚点：commit `553984d5`、commit `f10f6a51`

---

## 六、行动项

### 已完成

| # | 行动 | 状态 | commit |
|---|------|------|--------|
| 1 | proxy 只有 ENABLED=1 才 kill | ✅ | `553984d5` |
| 2 | sidecar 用 env flag 控制 | ✅ | `f10f6a51` |
| 3 | .env 补齐 4 个 `*_ENABLED=1` | ✅ | 砚砚手动补 |
| 4 | sidecar 启动轮询检测 | ✅ | `12562549` |
| 5 | sidecar 自动 venv + pip install | ✅ | `66a1e852` |
| 6 | ChatInput 高度回归修复 | ✅ | `4ff9e248` |
| 7 | proxy 429/529 retry | ✅ | `4ff9e248` |
| 8 | proxy SSE buffer flush normalization | ✅ | `4ff9e248` |
| 9 | proxy request-side strip thinking blocks | ✅ | `4ff9e248` |

### 待做

| # | 行动 | 优先级 | 负责 |
|---|------|--------|------|
| 1 | 同步脚本加"同步前源仓门禁检查" | P1 | opus |
| 2 | 同步脚本加 `target_owned_files` 保护列表 | P1 | opus |
| 3 | 同步后契约检查：关键文件 inventory + `.env.example` 启动验收 | P1 | opus |
| 4 | 改 start-dev.sh 默认值的 commit 必须附带 `.env` diff 审计 | P2 | 流程约束 |
| 5 | proxy 代码变更前强制 `git log` 回看历史 | P2 | 流程约束 |

---

## 七、砚砚的一句话总结

> 我们的问题不是同步脚本太蠢，而是我们让一个"文件同步脚本"承担了"开源发布系统"的职责，
> 但没有给它发布系统该有的真相源、环境隔离、契约验证和回归护栏。

## 八、宪宪的一句话总结

> 这次事故的核心模式是**"为了修一个环境的问题，改了两个环境共享的基础设施，但只验证了一个环境"**。
> 每一次连锁反应都符合这个模式：改了共享脚本默认值没补 .env、改了启动检测没考虑 ML 模型慢启动、
> 改了 proxy SSE 逻辑没看 commit log 理解历史补丁的存在理由。

---

*本文档由布偶猫(opus)整理，砚砚(gpt52)独立复盘贡献。2026-03-13。*
