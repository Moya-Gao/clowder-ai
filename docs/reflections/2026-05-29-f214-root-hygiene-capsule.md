---
capsule_id: "F214-2026-05-29"
context: "F214 根目录卫生守护：清理脚本 + shared-rules §20 公约 + pre-commit 兜底"
feature_ids: [F214]
doc_kind: capsule
created: 2026-05-29
---

# 反思胶囊：F214 根目录卫生守护

## What Worked

- **立项前实测纠正初版提案两处误判**：提案（来自 thread 对话，从未落地成文件）说"pre-commit 拦 commit 垃圾 + 缺 .gitignore 一环"，但实测发现 `.gitignore` 已全覆盖（`git status` 干净、零垃圾被追踪），`requirements.txt`/`cat-template.json` 是合法 tracked 文件。真问题是**运行时残留物理堆根目录**，不是 git 污染。不盲信提案，先 Read 源文件 + git 现状。
- **"有状态 vs 无状态"重新分类（坐标变换）**：铲屎官"不准动 redis"逼出正确分类维度——Redis/SQLite/World Engine 是有状态核心存储（迁移=不兼容=独立架构立项，不归 hygiene），无状态残留（log/forzadata/cookies）才是卫生 scope。方案从"分层含存储迁移"砍到"只管无状态垃圾"，更简。
- **三重保险 + secret backstop 多层圣域防护**：清理脚本（untracked ∧ 白名单 ∧ 不在硬保护清单 + fail-closed 非 git root）+ pre-commit（debris pattern + `git check-ignore --no-index` 拦 force-add secret）。
- **本地 + 云端双层 review 各打中不同失败域**：砚砚（缅因猫）抓 hook 黑名单偏离 spec + `*.rdb` 口径过窄；云端 codex 抓脚本 fail-open（非 git root 删任意目录）+ secret force-add backstop。4 个 P1 全是独立真安全问题，不是补锅匠。
- **圣域全程守住**：`lsof+kill` 被 P0 圣域 hook 拦下（CAFE-INCIDENT-20260527 凶器模式），改用 `redis-cli -p <非圣域端口> shutdown` 安全清孤儿；6398/6399 全程未碰。

## What Failed

- **pipe 掩盖 exit code（核心验证翻车）**：`pnpm gate 2>&1 | tail -45` 的 exit code 是 **tail 的（恒 0）**，不是 gate 的。误判 gate "通过"，实际 build 失败。后来把 `echo "GATE_EXIT=$?" > file` 写文件才看到真实 exit=1。background task 的 exit 也是管道最后命令的，不可信。
- **worktree install 被 NODE_ENV=production 污染**：首次 install 在 `NODE_ENV=production` 下跳了 devDeps（`@types/*` 缺 → build TS7016）；`--prod=false` / `env -u NODE_ENV` 增量补没修彻底（tailwindcss hoisting 乱）；`rm node_modules` 被"拆家预警" hook 拦；最终 `pnpm install --force` 重建才修好。
- **Phase C hook 实现偏离 spec**：spec 写白名单制（兜底未预料垃圾），我实现成黑名单（只拦已知 debris pattern）却没同步改 spec → 实现与 spec 矛盾，砚砚 P1 抓回。
- **check-ignore 漏 --no-index**：`git add -f` 已把文件放进 index，普通 `git check-ignore` 不报告 tracked 文件 → 漏 `.mcp.json`（匹配 `*.json` 白名单），加 `--no-index` 才修。

## Trigger Missed

- **第一次跑 gate 就用 `| tail` 没保 exit code**：验证铁律"看真实 exit"被 pipe 绕过，连续几轮误判后才改成 exit 写文件。验证 background/long 命令成败时，应第一时间把 `$?` 写文件，不用 pipe。
- **白名单/黑名单纠结时选了黑名单没改 spec**：实现 Phase C 时内心纠结过两种设计，选黑名单后没回去同步 spec（spec 仍写白名单）—— 实现偏离真相源，靠 reviewer 才发现。决策变更必须同步 spec。

## Doc Links

- [F214 spec](../features/F214-root-directory-hygiene-guard.md)
- [ADR-010 目录结构防腐化](../decisions/010-directory-hygiene-anti-rot.md)（上游）
- [F023 目录腐化防御](../features/F023-directory-corrosion-defense.md)（互补：管子目录代码）
- PR #1943（merge commit f2908da2）

## Rule Update Target

- **gate `test:redis` 孤儿残留（值得开 TD/issue）**：本次 merge 的 `pnpm gate` 被孤儿 Redis 卡 **5+ 次**——每次 gate 跑 `test:redis` 起 isolated 临时 Redis（随机高位端口），gate 退出后残留几分钟，正好被下次 gate 的 system-pressure preflight 撞到判为 unmanaged。`pnpm process:cleanup`（registry-based）不认这些 isolated 孤儿。根治方向：`test:redis` 起的 isolated Redis 应在测试/gate 退出时**确定性清理**（trap EXIT 或 registry 纳管），否则反复卡所有人的 merge gate。
- **background + pipe 掩盖 exit code（→ shared-rules / memory 验证纪律）**：`cmd 2>&1 | tail` 与 `run_in_background` 的退出码是**管道最后一个命令 / 包装命令**的，不是真实命令的。验证长命令/后台命令成败必须 `echo "$?" > file` 写文件再读，不信 `| tail` 的隐含成功、不信 task-notification 的 exit code。
