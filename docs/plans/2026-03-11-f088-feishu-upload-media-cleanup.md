---
feature_ids: [F088]
doc_kind: plan
created: 2026-03-11
---

# F088 Phase 5b — Feishu 原生媒体上传 + 媒体文件清理

**Feature:** F088 — `docs/features/F088-multi-platform-chat-gateway.md`
**Goal:** Feishu 出站媒体从文本链接 fallback 升级为原生图片/音频发送；connector 下载文件定期清理防磁盘泄漏。
**Acceptance Criteria:**
- AC-F1: Feishu 出站图片 → `/im/v1/images` 上传 → 原生图片消息（不再是文本链接）
- AC-F2: Feishu 出站音频 → `/im/v1/files` 上传 → 原生音频消息（不再是文本链接）
- AC-F3: tenant_access_token 自动获取 + 缓存（2h TTL，Feishu 默认有效期）
- AC-C1: ConnectorMediaService 定期清理超过 TTL 的文件（默认 24h）
- AC-C2: 清理不影响正在使用的文件（仅删除超龄文件）
**Architecture:** FeishuTokenManager 负责 tenant_access_token 获取+缓存；FeishuAdapter.sendMedia 上传文件获取 platform key 后走现有 native 路径；MediaCleanupJob 基于文件 mtime 的定时清理。
**Tech Stack:** node:fs, node:path, Feishu Open API v2, setInterval
**前端验证:** No

---

## Not Building

- Feishu 入站媒体下载改进（已在 Phase 5 用 feishuDownloadFn 解决）
- Telegram 侧任何改动（已原生 InputFile）
- 媒体文件压缩/缩略图
- 可配置 UI 的清理策略

## Terminal Schema

```typescript
// FeishuTokenManager — 新文件
interface IFeishuTokenManager {
  getTenantAccessToken(): Promise<string>;
}

// FeishuAdapter.sendMedia — 改造后
// imageKey/fileKey 走现有路径
// url + absPath → 上传 /im/v1/images 获取 image_key → 走 native 路径
// 不再 fallback 到文本链接（有 absPath 时）

// MediaCleanupJob — 新文件
interface MediaCleanupJobOptions {
  mediaDir: string;
  ttlMs: number;           // default 24 * 60 * 60 * 1000
  intervalMs: number;       // default 60 * 60 * 1000 (1h)
  log: FastifyBaseLogger;
}
```

---

## Task 1: FeishuTokenManager — tenant_access_token 获取+缓存

**Files:**
- Create: `packages/api/src/infrastructure/connectors/adapters/FeishuTokenManager.ts`
- Test: `packages/api/test/feishu-token-manager.test.js`

**Step 1: Write failing test — token fetch**

```javascript
// feishu-token-manager.test.js
test('fetches tenant_access_token from Feishu API', async () => {
  const mockFetch = mock.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ tenant_access_token: 'tok-123', expire: 7200 }),
  }));
  const mgr = new FeishuTokenManager({ appId: 'app1', appSecret: 'sec1', fetchFn: mockFetch });
  const token = await mgr.getTenantAccessToken();
  assert.equal(token, 'tok-123');
  assert.equal(mockFetch.mock.calls.length, 1);
  const [url, opts] = mockFetch.mock.calls[0].arguments;
  assert.ok(url.includes('/auth/v3/tenant_access_token/internal'));
});
```

**Step 2: Run test → FAIL**

**Step 3: Implement FeishuTokenManager**

```typescript
// FeishuTokenManager.ts
export interface FeishuTokenManagerOptions {
  readonly appId: string;
  readonly appSecret: string;
  readonly fetchFn?: typeof fetch;
}

export class FeishuTokenManager {
  private cachedToken: string | undefined;
  private expiresAt = 0;
  private readonly opts: Required<FeishuTokenManagerOptions>;

  constructor(opts: FeishuTokenManagerOptions) {
    this.opts = { fetchFn: globalThis.fetch, ...opts };
  }

  async getTenantAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.expiresAt) return this.cachedToken;
    const res = await this.opts.fetchFn(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ app_id: this.opts.appId, app_secret: this.opts.appSecret }),
      },
    );
    if (!res.ok) throw new Error(`Feishu token API ${res.status}`);
    const data = (await res.json()) as { tenant_access_token: string; expire: number };
    this.cachedToken = data.tenant_access_token;
    // 提前 5 分钟刷新
    this.expiresAt = Date.now() + (data.expire - 300) * 1000;
    return this.cachedToken;
  }
}
```

**Step 4: Run test → PASS**

**Step 5: Write failing test — token caching**

```javascript
test('caches token and reuses on second call', async () => {
  const mockFetch = mock.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ tenant_access_token: 'tok-456', expire: 7200 }),
  }));
  const mgr = new FeishuTokenManager({ appId: 'a', appSecret: 's', fetchFn: mockFetch });
  await mgr.getTenantAccessToken();
  await mgr.getTenantAccessToken();
  assert.equal(mockFetch.mock.calls.length, 1); // only 1 fetch
});
```

**Step 6: Run test → PASS (already implemented caching)**

**Step 7: Commit**

```bash
git add packages/api/src/infrastructure/connectors/adapters/FeishuTokenManager.ts packages/api/test/feishu-token-manager.test.js
git commit -m "feat(F088): add FeishuTokenManager with tenant_access_token caching"
```

---

## Task 2: FeishuAdapter — 原生媒体上传

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts` (sendMedia method)
- Test: `packages/api/test/feishu-adapter-upload.test.js` (新文件，专测上传)

**Step 1: Write failing test — image upload via /im/v1/images**

```javascript
test('sendMedia uploads image via /im/v1/images when absPath provided', async () => {
  // Mock: tokenManager.getTenantAccessToken → 'tok-test'
  // Mock: uploadFn → returns { image_key: 'img_abc' }
  // Mock: sendReply (existing) to capture native API call
  // Assert: sends msg_type='image' with image_key, NOT text link
});
```

**Step 2: Run test → FAIL**

**Step 3: Implement upload in sendMedia**

FeishuAdapter 构造函数新增 `tokenManager?: FeishuTokenManager` 和 `uploadFn?`。
sendMedia 改造：
- 有 imageKey/fileKey → 走现有 native 路径（不变）
- 有 absPath + tokenManager → 上传文件 → 获取 imageKey → 走 native 路径
- 无 absPath → 保留文本链接 fallback（兜底）

```typescript
// sendMedia 内新增 upload 路径
if (absPath && this.tokenManager) {
  const token = await this.tokenManager.getTenantAccessToken();
  const uploaded = await this.uploadToFeishu(token, absPath, payload.type);
  // uploaded = { image_key: 'xxx' } or { file_key: 'xxx' }
  // 走 native API 发送
}
```

`uploadToFeishu` 私有方法：
- image: POST `/im/v1/images` multipart (image_type=message_body, image=file)
- file/audio: POST `/im/v1/files` multipart (file_type=stream/opus, file=file)

**Step 4: Run test → PASS**

**Step 5: Write failing test — audio upload via /im/v1/files**

```javascript
test('sendMedia uploads audio via /im/v1/files when absPath provided', async () => {
  // Similar pattern, assert file_key used
});
```

**Step 6: Run → FAIL → Implement → PASS**

**Step 7: Write failing test — fallback when no tokenManager**

```javascript
test('sendMedia falls back to text link when no tokenManager', async () => {
  // No tokenManager injected → still sends text link (backward compatible)
});
```

**Step 8: Run → PASS (existing behavior)**

**Step 9: Commit**

```bash
git add packages/api/src/infrastructure/connectors/adapters/FeishuAdapter.ts packages/api/test/feishu-adapter-upload.test.js
git commit -m "feat(F088): Feishu native media upload via /im/v1/images + /im/v1/files"
```

---

## Task 3: Bootstrap 接线 — TokenManager 注入

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`
- Test: `packages/api/test/connector-gateway-bootstrap.test.js` (追加)

**Step 1: Write failing test**

```javascript
test('injects FeishuTokenManager into FeishuAdapter when app credentials present', async () => {
  // Set FEISHU_APP_ID + FEISHU_APP_SECRET in env
  // Assert adapter receives tokenManager
});
```

**Step 2: Run → FAIL**

**Step 3: Implement**

```typescript
// bootstrap 里 Feishu adapter 创建时：
const tokenManager = (feishuAppId && feishuAppSecret)
  ? new FeishuTokenManager({ appId: feishuAppId, appSecret: feishuAppSecret })
  : undefined;
// 传入 FeishuAdapter
```

**Step 4: Run → PASS**

**Step 5: Commit**

```bash
git add packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts packages/api/test/connector-gateway-bootstrap.test.js
git commit -m "feat(F088): wire FeishuTokenManager into bootstrap"
```

---

## Task 4: MediaCleanupJob — 定时清理

**Files:**
- Create: `packages/api/src/infrastructure/connectors/media/MediaCleanupJob.ts`
- Test: `packages/api/test/media-cleanup-job.test.js`

**Step 1: Write failing test — deletes files older than TTL**

```javascript
test('removes files older than TTL', async () => {
  // Create temp dir with 2 files:
  //   old.jpg (mtime = now - 25h)
  //   new.jpg (mtime = now - 1h)
  // Run cleanup with ttlMs = 24h
  // Assert: old.jpg deleted, new.jpg still exists
});
```

**Step 2: Run → FAIL**

**Step 3: Implement MediaCleanupJob**

```typescript
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface MediaCleanupJobOptions {
  readonly mediaDir: string;
  readonly ttlMs: number;
  readonly intervalMs: number;
  readonly log: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

export class MediaCleanupJob {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly opts: MediaCleanupJobOptions) {}

  start(): void {
    this.timer = setInterval(() => void this.sweep(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const cutoff = Date.now() - this.opts.ttlMs;
    let removed = 0;
    const entries = await readdir(this.opts.mediaDir).catch(() => [] as string[]);
    for (const name of entries) {
      const filePath = join(this.opts.mediaDir, name);
      const s = await stat(filePath).catch(() => undefined);
      if (s && s.isFile() && s.mtimeMs < cutoff) {
        await unlink(filePath).catch(() => {});
        removed++;
      }
    }
    if (removed > 0) this.opts.log.info({ removed }, 'media cleanup sweep');
    return removed;
  }
}
```

**Step 4: Run → PASS**

**Step 5: Write failing test — preserves recent files**

```javascript
test('preserves files newer than TTL', async () => {
  // All files recent → 0 removed
});
```

**Step 6: Run → PASS**

**Step 7: Commit**

```bash
git add packages/api/src/infrastructure/connectors/media/MediaCleanupJob.ts packages/api/test/media-cleanup-job.test.js
git commit -m "feat(F088): add MediaCleanupJob with TTL-based file removal"
```

---

## Task 5: Bootstrap — 启动 cleanup job

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`

**Step 1: Implement**

```typescript
// bootstrap 末尾：
const cleanupJob = new MediaCleanupJob({
  mediaDir: resolvedMediaDir,
  ttlMs: 24 * 60 * 60 * 1000,
  intervalMs: 60 * 60 * 1000,
  log,
});
cleanupJob.start();
// 注册 shutdown hook
server.addHook('onClose', () => cleanupJob.stop());
```

**Step 2: Commit**

```bash
git add packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts
git commit -m "feat(F088): wire MediaCleanupJob into bootstrap with 24h TTL"
```

---

## Task 6: AC 更新 + 类型检查 + 最终验证

**Step 1:** Update `docs/features/assets/F088/acceptance-criteria.md` — AC-21/23 去掉 ⚠️ follow-up 标记

**Step 2:** `pnpm lint` + `pnpm check` 全绿

**Step 3:** 全量 F088 测试跑通

**Step 4:** Commit

```bash
git commit -m "docs(F088): mark Feishu native upload as done in AC"
```

---

## 直线检查

| Step | 留在终态？ | 完成后可验证？ | 删掉的代价？ |
|------|-----------|--------------|-------------|
| Task 1 TokenManager | ✅ 复用 | test: token fetch + cache | 无法获取 upload 权限 |
| Task 2 Upload | ✅ 替代 fallback | test: native image msg | Feishu 永远是文本链接 |
| Task 3 Bootstrap wire | ✅ 生产接线 | test: DI 验证 | TokenManager 不生效 |
| Task 4 CleanupJob | ✅ 独立组件 | test: 删旧保新 | 磁盘泄漏 |
| Task 5 Bootstrap wire | ✅ 生产接线 | server 启停 | 清理不运行 |
| Task 6 AC sync | ✅ 文档 | grep AC | 真相源过时 |
