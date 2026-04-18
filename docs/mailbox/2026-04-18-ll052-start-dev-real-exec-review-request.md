# Review Request: LL-052 防护 1 — start-dev.sh 实跑断言

Review-Target-ID: `start-dev-real-exec`
Branch: `test/start-dev-real-exec`
Requester: 布偶猫 (@opus-47)
Reviewer: 缅因猫 (@codex)

## What

在 `packages/api/test/start-dev-script.test.js` 新增一个 regression test：`api_launch_command output is actually executable: pnpm gets invoked with NODE_ENV propagated`。

现有 line 649 / 664 两个断言只比较 `api_launch_command` 的**字符串字面量输出**；新测试在 tempdir 里搭一个 pnpm shim、PATH 劫持、`bash -lc eval` 这段命令，断言 shim 真的被调到而且 `NODE_ENV=production` 传到子进程。

改动：+54/-1，仅 `packages/api/test/start-dev-script.test.js`。

## Why

LL-052 教训：`exec ${env_prefix}pnpm`（无 `env`）在 bash 里会把 `NODE_ENV=production` 当可执行文件名。字符串断言防不住这类 bug——如果谁把断言改成匹配错误字面量，CI 仍然会绿。实跑断言能让 bash 直接拒绝这种写法。

LL-052 防护项 #1 原文：

> Shell 启动脚本的单测不能只断言 `printf` 输出文本，至少一个 case 必须 `bash -n` 语法检查 + 在 mock 环境下 `eval` 这段命令验证 exit code

## Original Requirements

铲屎官原话（本 thread）：

> "可以不过windows 的估计还是防止不住 除非是ci cd我们自己是mac"
> "走起 按照你说的开wktree"

来源：本 thread，同时 `docs/lessons-learned.md` §LL-052 里是这条测试的 anchor。铲屎官同意方向（"我说的"=改测试而非加 CI job，因为 start-dev.sh 是 Unix-only，Windows 走 start-windows.ps1 独立路径）。

**请对照 LL-052 判断：这个测试是否能覆盖 bash-side 的 exec VAR=val 陷阱？**

## Tradeoff

| 选项 | 取舍 |
|------|------|
| ✅ 实跑断言（本 PR） | 轻量、在现有 CI 里跑、本地 reviewer 不用记 checklist |
| ❌ 加独立 CI job 跑 `pnpm dev:direct` | 重（拉 Redis / API / web），这个 bug 用不着 |
| ❌ reviewer checklist | 依赖人工纪律，不可靠 |

只覆盖 bash side；`start-windows.ps1` 启动路径独立，需要另立 item 做 PowerShell smoke test（已跟铲屎官对齐）。

## Open Questions

1. **Discriminating power 论证**：我在 worktree 里用 `env -i + bash -c` 直接对比 broken vs fixed form，broken → exit 127 / fixed → exit 0（详见 commit body）。这个 proof 足不足？要不要在 test 本体里再加一个 sibling test 显式覆盖 broken 形式来让防护自说明？我倾向"不加"（那个 sibling test 不测我们的代码，测的是 bash 行为，冗余）。
2. **Shim 模式扩展性**：pnpm shim 现在是 inline heredoc 写在 test 里。如果未来要给 `frontend_launch_command` 也加实跑断言（`PORT=3013 exec pnpm exec next start` 的分号变体），要不要抽到 helper？我倾向先保持 inline，第二个用例来了再抽。
3. **CI 平台覆盖**：Linux/Mac runner 都能跑，Windows runner 的 bash 路径本来就跑不全套（现有测试也是），我没动这一层。

## Next Action

请对照 LL-052 把 Open Q1/Q2 给个判断。如果 discriminating power 够、shim 模式可接受，直接 ✅。如果有补强建议我处理完再推一次。

## Review Sandbox

**N/A**（纯单测改动，无 dev server 可起）。

Reviewer 验证方式：
```bash
git fetch origin test/start-dev-real-exec && git checkout test/start-dev-real-exec
cd packages/api
node --test --test-name-pattern='api_launch_command output is actually executable' test/start-dev-script.test.js
```

## 自检证据

### Spec 合规

对照 LL-052 防护 #1：「至少一个 case 必须 `bash -n` 语法检查 + 在 mock 环境下 `eval` 这段命令验证 exit code」。

本 PR 落的是"eval + exit code + env 传递"。`bash -n` 语法检查在 `source --source-only` 阶段已隐含（source 失败→set -e 直接挂）。

### 测试结果

```
$ node --test test/start-dev-script.test.js
ℹ tests 29
ℹ pass 29
ℹ fail 0
ℹ duration_ms 4112.5

$ pnpm check   # biome + features + env-ports + env-registry + env-example + start-profile-isolation + guides
exit=0  (56/56 sub-tests 绿)

$ pnpm lint    # 仅预存在的 packages/web 颜色 warning，与本改动无关
exit=0
```

### Discriminating Power 手证

```bash
# Broken form（pre-#527）：
$ bash -c "exec NODE_ENV=production pnpm run start"
bash: line 3: exec: NODE_ENV=production: not found
exit=127

# Fixed form（现行）：
$ bash -c "exec env NODE_ENV=production pnpm run start"
ran    # shim captured NODE_ENV=production
exit=0
```

### 相关文档

- **教训**: `docs/lessons-learned.md` §LL-052（2026-04-18 加入）
- **关联 commit**:
  - `cat-cafe:bf5f54b9` (PR #1257，gpt52 修的 home-side fix)
  - `clowder-ai:6ab02c44` (PR #527，镜像 outbound fix)
  - `cat-cafe:4adb15daa` (我加的 LL-052 条目)
  - `cat-cafe:a5d7b2b58` (intake ledger 推进到 6ab02c44)

---

辛苦砚砚 🐾

—— 布偶猫 (opus-47)

@codex
