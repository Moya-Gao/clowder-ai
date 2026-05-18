---
doc_kind: review-request
created: 2026-05-17
review_target_id: orphan-cleaner-rod-pattern
branch: fix/orphan-cleaner-rod-pattern
pr: 1745
author: opus-47
reviewers: [codex]
topics: [orphan-cleaner, LL-056, chrome-headless, review-request]
related_lessons: [LL-056]
---

# Review Request: fix(orphan-cleaner) extend pattern to rod/playwright/puppeteer (LL-056 ext)

Review-Target-ID: `orphan-cleaner-rod-pattern`
Branch: `fix/orphan-cleaner-rod-pattern`
PR: https://github.com/zts212653/cat-cafe/pull/1745

## What
LL-056 startup cleaner 第 6 次复发触发：xiaohongshu-mcp（github.com/xpzouying/xiaohongshu-mcp，Go binary 用 go-rod）的 chromium user-data-dir 落在 `/var/folders/.../T/rod/user-data/...`，初版只列了 `agent-browser-chrome` 一种 owner pattern，rod profile 漏清。这次：

- 抽出 `TRACKED_USER_DATA_DIR_OWNERS` 数组 `[agent-browser-chrome, rod/user-data, playwright, puppeteer_dev_chrome_profile-]`
- 扩 `isChromeBinary` regex 认 user-local cached Chromium（`/.../Chromium.app/Contents/MacOS/Chromium`，go-rod/puppeteer/playwright 自动下载到用户 cache 时需要）
- 加 3 个测试 fixtures + 3 个 tests（rod / playwright / puppeteer orphans）
- LL-056 防护新增 #4：owner enumeration completeness

## Why
不动 LL-056 的坐标系结论（仍然是 `user-data-dir` 边界），只补 enumeration 完备性。原 `if (!userDataDir.includes('agent-browser-chrome'))` 等于把"是否清理"绑死在单一 owner，新 owner 出现就漏。今天 76 个 rod chromium 僵尸 + fseventsd 95% CPU = API server 启动 20s 超时（与 LL-056 的 5 次复发症状完全一致，但根因是另一种 owner pattern）。

## Original Requirements（必填）
铲屎官 directive（本会话 2026-05-17 22:21）：
> "3️⃣ orphan-chrome-cleaner.ts:89 扩 pattern — LL-056 延续 hotfix，加 rod/playwright/puppeteer 三个 owner（防再泄漏）"

调研背景（4️⃣ 完成）：
- 真凶 = `xiaohongshu-mcp`，依赖 `github.com/go-rod/rod` + go-rod/stealth
- 上游 graceful close 是上游工具 owner，**本 PR 不修上游**

## Tradeoff
- **抽不抽 const 数组**：抽。原 hard-coded string 把 enumeration 隐藏在条件判断里，新 owner 加入需要改 if；改成数组后增删 owner 一行差异
- **`isChromeBinary` 要不要重构 startsWith → 全 regex**：不重构。保留 startsWith 分支（/Applications/...）零行为变化；新加一行 regex 兜底 cached Chromium。最小 diff
- **要不要改 export 符号名（`cleanOrphanAgentBrowserChrome` → `cleanOrphanHeadlessChrome`）**：不改。API 稳定性优先，名字保留 agent-browser 出处但内部行为已泛化（参见 commit message）

## Architecture Ownership（必填）
Architecture cell: `packages/api/src/utils/orphan-chrome-cleaner.ts`（现有 utility，无新 cell）
Map delta: `none`
Why: 扩 pattern 列表 + 扩 binary matcher，不新建 store/queue/router/adapter/dispatcher/binding，不改 owner/boundary/extension point

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致 ✓ 预期：是
- 是否新建了并行 Store/Queue/Router/Adapter/Dispatcher/Binding ✓ 预期：否
- 无 ownership cell 文件改动 ✓

## Open Questions

### 技术 OQ（给 reviewer）
1. **`isChromeBinary` 新 regex 是否过宽？**
   - 新加 `/^\/\S*\/Chromium\.app\/Contents\/MacOS\/Chromium\b/`
   - 要求：args 从 `/` 开始 + 路径无空格 + 必须以 `/Chromium.app/Contents/MacOS/Chromium` 结尾
   - 双层 gate：还需要 user-data-dir 命中白名单才会清。请验证 false positive risk
2. **`playwright` pattern 是否过宽？**
   - 当前匹配任何含 `playwright` 字样的 user-data-dir
   - 担心：用户手动开 Playwright 调试时被误清
   - 缓解：stale=1h 阈值给短任务缓冲
   - 是否应该收紧成 `playwright_chromium` / `playwright-chromium`？
3. **回归风险**：原 19 个测试是否仍全绿？我跑出 22/22 pass。请独立验证。

### 价值 OQ（给 CVO）
无。这是 LL-056 防护完备性补丁，不涉及方向/scope/价值观选择。

## Next Action
请 @codex 在 review 沙盒里启动 + 跑 `node --test test/orphan-chrome-cleaner.test.js` 复现 22/22 全绿 + 扫 `orphan-chrome-cleaner.ts` 的 regex 边界。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/orphan-cleaner-rod-pattern/codex`
- Start Command: `pnpm review:start`（此 PR 改的是 startup-only utility，沙盒启动非必需；可纯 static review + 单测验证）
- Ports: `web=<分配自动>`, `api=<分配自动>`（禁止 3001/3002）

## 自检证据

### Spec 合规
- 铲屎官 directive：扩 pattern + 加 rod/playwright/puppeteer 三个 owner ✓
- LL-056 防护原则（user-data-dir 是坐标系）保留 ✓
- 不留 follow-up tails：`pnpm check:followup-tails` 全绿 ✓

### 测试结果
```
node --test test/orphan-chrome-cleaner.test.js
ℹ tests 22 / pass 22 / fail 0 / duration_ms 145
```

### Quality-gate
```
pnpm check packages/api/src/utils/orphan-chrome-cleaner.ts \
            packages/api/test/orphan-chrome-cleaner.test.js \
            docs/lessons-learned.md
✓ biome / followup-tails / 全套 green

pnpm lint
packages/api lint: Done (no error)
packages/web lint: Done (only pre-existing hardcoded-color warnings, unrelated)
```

### 根目录工件闸门
```
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' → 无
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(...)$' → 无
```

### 相关文档
- Lesson: `docs/lessons-learned.md` → LL-056（防护 #4 新增）
- Feature predecessor: F145（MCP Portable Provisioning，PR #1407 / #1620）

---

[宪宪/Opus-47🐾] 2026-05-17
