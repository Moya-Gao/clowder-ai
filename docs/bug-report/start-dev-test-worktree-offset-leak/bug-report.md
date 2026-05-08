---
feature_ids: []
topics: [test, worktree, port-offset, fixture]
doc_kind: bug-report
created: 2026-05-08
---

# Bug Report: `start-dev-script.test.js` fixture 跟 worktree `WORKTREE_PORT_OFFSET` 冲突 — `pnpm gate` 在 OFFSET ≠ 0 worktree 里 fail

> 报告人: 布偶猫（Opus 4.7）— `feat/F193-cross-thread-comm` 实施 thread
> 严重程度: P1（block `pnpm gate`，因此 block 任何 worktree-OFFSET ≠ 0 的 PR merge）
> 状态: 已定位根因 + 给出修复方案，等修复 thread 接手
> 发现时机: F193 Phase A merge-gate Step 0 跑 `pnpm gate` 时

---

## 1. 报告来源

F193 Phase A 实施完成 + 砚砚 review 两轮通过后，跑 `pnpm gate`（merge-gate Step 0 强制门禁）失败。失败 test 跟 F193 改动**无关**——`packages/api/test/start-dev-script.test.js` 的 worktree-port-offset 相关 test 在我的 worktree（`.env.local` 设了 `WORKTREE_PORT_OFFSET=-50`，按 worktree skill 的多并发模板）里 fail。

至少 2 个 test 直接 fail，全套 `start-dev-script.test.js` 在 OFFSET ≠ 0 的 worktree 里都跑不通（多 test 受影响因为脚本一旦 source 就会自 cd + source `.env.local`，污染所有 source-only mode）。

---

## 2. 复现步骤（期望 vs 实际）

### 复现

1. 开一个 worktree 并按 worktree skill 的多并发模板配 `.env.local`：
   ```
   WORKTREE_PORT_OFFSET=-50
   PREVIEW_GATEWAY_PORT=0
   ANTHROPIC_PROXY_ENABLED=0
   # ... sidecar 全禁用
   ```
2. 在该 worktree 里跑 `pnpm --filter @cat-cafe/api test start-dev-script` 或 `pnpm gate`
3. 观察 test 输出

### 期望

`start-dev-script.test.js` 的 fixture 测试是 **isolated env 测试**——用 `baseShellEnv()` 显式列举 `PATH/HOME/TERM/<overrides>`，意图是不被 caller env 影响。CLI override（如 `REDIS_PORT=6409`）应该生效，测试应通过。

### 实际

至少以下 test 失败（取自实际 `pnpm gate` 输出）：

```
✖ explicit port env vars override .env values for direct startup
  expected '3023|3024|6409' got '0|0|6348' （6348 = 6398 + (-50) = OFFSET 派生）

✖ redis port override also recomputes isolated redis dirs
  expected 'dev-6409|...' got 'dev-6348|...' （同样 OFFSET 派生压过 CLI）
```

snippet exit 1, stdout/stderr 空（因为 test 内部把 source 输出 redirect 到 `/dev/null`）。

---

## 3. 根因（已定位）

**根因链**（已读源码验证）：

1. **`scripts/start-dev.sh:49-52`** 脚本启动时**自己** `cd $PROJECT_DIR`：
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
   ...
   cd "$PROJECT_DIR"
   ```
   不管 caller 当前 cwd（即使 `spawnSync({ cwd: tempHome })` 也无效——脚本 cd 走）。

2. **`scripts/start-dev.sh:124-126`** 自 cd 后 source `.env.local`：
   ```bash
   if [ -f .env.local ]; then
     source .env.local
   fi
   ```
   `PROJECT_DIR` = worktree → 找到 worktree 的 `.env.local` → `WORKTREE_PORT_OFFSET=-50` 进 env。

3. **`scripts/start-dev.sh:153-189`** OFFSET 派生模式触发，**设计上压过 CLI override**（line 186 有显式注释 `LL-015 防回归`）：
   ```bash
   # 派生值压过 .env.local 任何残留（LL-015 防回归）
   ```
   也就是 OFFSET 派生覆盖 CLI 的 `REDIS_PORT=6409`，得到 OFFSET=-50 派生的 `REDIS_PORT=6348`。

4. **`packages/api/test/start-dev-script.test.js`** fixture 没法绕过：
   - `cwd: tempHome` 没用——脚本自 cd 走（步骤 1）
   - `env: baseShellEnv()` 显式列举 env 也没用——`source .env.local` 注入 OFFSET（步骤 2）
   - `WORKTREE_PORT_OFFSET=0` env override 也没用——`source .env.local` 后被 worktree 值覆盖

实测 isolated 环境复现：
```bash
$ tempHome=$(mktemp -d)
$ env -i PATH=$PATH HOME=$tempHome TERM=xterm REDIS_PORT=6409 \
    bash -lc "set -e; cd $tempHome; \
    source /path/to/worktree/scripts/start-dev.sh --source-only; \
    printf '%s\n' \"\$REDIS_STORAGE_KEY\""
[start-dev] WORKTREE_PORT_OFFSET=-50 → REDIS_PORT=6348 ...
dev-6348   ← OFFSET 压过 CLI REDIS_PORT=6409
```

---

## 4. 影响面

- **任何 OFFSET ≠ 0 的 worktree 都跑不通 `pnpm gate`**——`pnpm gate` 是 merge-gate Step 0 硬门禁
- 阻塞所有按 worktree skill 多并发模板（OFFSET=-10/-20/.../-60）开发的 feature PR 合入
- 当前已知受影响：F193 Phase A（OFFSET=-50），潜在影响 F182 大赛多 worktree（每个都设了不同 OFFSET）

---

## 5. 修复方案（建议选 A）

### 选项 A：测试用 `createTempProject()` 模式，独立 PROJECT_DIR（推荐）

参考 [`packages/api/test/start-dev-script.test.js:155-164`](../../../packages/api/test/start-dev-script.test.js) `createTempProject()`——它已经支持把 script copy 到临时项目目录，只是当前**只**用于 `.env.local` 测试 (line 167+) 和 `.env` 测试，**没用在** OFFSET 受影响的 test。

修法：把 line 270 (`explicit port env vars override`) 和 line 442 (`redis port override also recomputes`) 改成 `createTempProject()` 模式：

```js
test('explicit port env vars override .env values for direct startup', () => {
  const tmp = createTempProject();  // 临时 PROJECT_DIR，无 .env.local
  try {
    const scriptPath = join(tmp, 'scripts', 'start-dev.sh');
    const result = spawnSync('bash', [...], {
      encoding: 'utf8',
      env: baseShellEnv({
        FRONTEND_PORT: '3023',
        API_SERVER_PORT: '3024',
        REDIS_PORT: '6409',
      }),
    });
    assert.equal(result.stdout.trim(), '3023|3024|6409');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

预估工作量：30 min（改 2 个 test，跑 verify）

### 选项 B：`scripts/start-dev.sh` 加 `--source-only` 模式跳过 `source .env.local`

```bash
# scripts/start-dev.sh:124
if [ -f .env.local ] && [ "$1" != "--source-only" ]; then
  source .env.local
fi
```

但这改变了 script 行为，可能破坏其他依赖 `--source-only` 但又想读 `.env.local` 的场景。**不推荐**——影响面大。

### 选项 C：worktree skill 改 `.env.local` 模板不放 `WORKTREE_PORT_OFFSET`

让 worktree env 通过其他方式（命令行 / 另一个 file）传 OFFSET。**违反 worktree skill 设计意图**。**不推荐**。

---

## 6. 不在 F193 Phase A scope

F193 Phase A 只动 MCP / API callback 路径，**没碰** `start-dev-script.test.js` 也没碰 `start-dev.sh`：

```bash
$ git diff --name-only origin/main...HEAD | grep -E 'start-dev|port-offset'
(no F193 touch)
```

这是 pre-existing bug——F193 之前就存在。修复**不应混入** F193 PR（违反 scope）。建议单独开一个小 PR 修。

---

## 7. 修复后回流

修复 PR merge 进 main 后，F193 Phase A 的实施 thread (`feat/F193-cross-thread-comm`) **rebase 重跑 `pnpm gate`** 应该全绿，可以继续 merge-gate Step 1+。

修复 thread 完成后，建议用 F193 自己设计的机制喊 F193 实施 thread——**dogfood**：

```
cat_cafe_cross_post_message({
  threadId: '<F193 实施 thread>',
  targetCats: ['opus-47'],
  content: '@opus-47 fixture fix merged. F193 Phase A 可以 rebase 重跑 pnpm gate。'
})
```

（注：F193 还没 merge，runtime MCP 还是旧版本，cross_post_message 没 targetCats 字段；用 content 行首 `@opus-47` 就够了。）

---

## Links

- F193 Phase A 实施 thread / branch `feat/F193-cross-thread-comm`，HEAD `9692c6744`
- 受影响测试: [`packages/api/test/start-dev-script.test.js:270`](../../../packages/api/test/start-dev-script.test.js) + `:442`
- 根因脚本: [`scripts/start-dev.sh:49-189`](../../../scripts/start-dev.sh)
- 设计参考: [`packages/api/test/start-dev-script.test.js:155-164`](../../../packages/api/test/start-dev-script.test.js) `createTempProject()` helper（已存在但只在部分 test 用）
- LL-015 防回归注释: `scripts/start-dev.sh:186`
