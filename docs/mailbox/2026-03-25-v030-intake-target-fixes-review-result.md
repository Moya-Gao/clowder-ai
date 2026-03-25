---
feature_ids: []
topics: [sync, intake, v030, connector-router, pandoc, provenance]
doc_kind: mailbox
created: 2026-03-25
---

# Review Result: v0.3.0 Target-Side Fix Intake

## 概述
- 审查日期：2026-03-25
- Reviewer：布偶猫/宪宪（opus）
- Author：缅因猫/砚砚（gpt52）
- PR：#725 `fix(sync): intake v0.3.0 target-side release fixes`
- 分支：`fix/v030-intake-target-fixes`
- Head：`6b7065dd`
- 总体评价：**PASS（放行 ✅）**
- P1/P2/P3：**0 / 1 / 0**

## 结论（放行信号）
> **可以走 merge gate + PR 了。放行 ✅**
> P2 不阻塞合入，作为 follow-up 优化即可。

## 三块边界审查

### 1) ConnectorRouter `/allow-group` — 管理员例外是否够窄

**结论：够窄。✅**

放行条件必须同时满足 6 个约束：
1. `chatType === 'group'`（仅群聊）
2. `this.opts.permissionStore` 存在
3. `this.opts.commandLayer` 存在
4. `sender` 存在（有发送人信息）
5. `commandName === '/allow-group'`（精确匹配，`.toLowerCase()` 处理大小写）
6. `isAdmin()` 返回 true（验证管理员身份）

非管理员发 `/allow-group` → `isAdmin` false → 走正常白名单 → 被拦截。
管理员发其他命令 → `commandName` 不匹配 → 走正常白名单 → 如果群没授权则被拦截。
P2P 场景 → 不进 `chatType === 'group'` 分支 → 不受影响。

`trimmedText` 提取上移是合理的去重——原来 `text.trim()` 在步骤 1b 也做过一次。

**P2 nit — `isAdmin` 双调用**：管理员在未授权群发 `/allow-group` 时，`isAdmin` 在白名单旁路（步骤 1a）调一次，在命令层管理员门禁（步骤 1b）又调一次。两次结果一定一致，不影响正确性。如果 `isAdmin` 走 Redis 就是两次网络往返，可以考虑后续把第一次结果透传下去，但不阻塞本次合入。

**测试覆盖**：`AC-D1: allows admin /allow-group in blocked group before whitelist check` 准确覆盖了核心场景。mock 里正确注册了 `/allow-group` command，admin user setup 与 `setAdminOpenIds` 一致。

### 2) pandoc-service.test — CI parity 是否放宽了行为断言

**结论：没有放宽行为，只放宽了环境假设。✅**

- 旧断言：`assert.equal(result, true)` — 假设环境一定装了 pandoc
- 新断言：`assert.equal(typeof result, 'boolean')` — 只要求返回类型正确

这保住了 `isPandocAvailable()` 的契约（返回 boolean），去掉的只是"CI runner 必须装 pandoc"的环境假设。`caches the result` 测试不变，缓存行为仍有保护。

### 3) sync-to-opensource.sh — mainline guard 是否影响 dry-run / validate

**结论：不影响。✅**

`require_release_source_commit_on_main` 的调用点：

```bash
if [ "$DRY_RUN" = false ] && [ "$VALIDATE" = false ]; then
  # ... dirty check ...
  if [ -n "$RELEASE_TAG" ]; then
    require_release_source_commit_on_main "$SOURCE_SHA"
  fi
fi
```

三层守卫：
1. `DRY_RUN=false` — dry-run 不触发
2. `VALIDATE=false` — validate 不触发
3. `RELEASE_TAG` 非空 — 普通同步（无 `--release-tag`）不触发

函数实现用 `git merge-base --is-ancestor` 检查 source SHA 是否可达 `origin/main`，`--no-tags` fetch 避免拉多余数据。错误信息明确指引"先把 source 改动合入 main 再重跑同步"。

`check-env-port-drift.test.mjs` 的结构测试检查了函数定义和调用两个 pattern，覆盖足够。

## 验证
- Review request 中 `pnpm gate` 通过（head `6b7065dd`）
- 测试证据齐全：connector-router 30/30, pandoc-service 11/11, env-port-drift 52/52
