---
feature_ids: [F172]
topics: [image-generation, publication-contract, uploads]
doc_kind: plan
created: 2026-04-22
---

# F172 Phase A Publication Contract Implementation Plan

**Feature:** F172 — `docs/features/F172-generated-image-publication.md`
**Goal:** 引入一个共享、幂等的 generated-image publication contract：把本地生成图片发布到当前 runtime 的 `uploadDir`，返回 canonical `/uploads/...` 元数据与 `media_gallery` rich block，但暂不接入任何具体 provider。
**Acceptance Criteria:**
- AC-A1: 系统提供统一的 generated-image publication contract，可接收“本地图片路径 + provenance”并发布到当前 runtime 的 `uploadDir`
- AC-A2: 发布结果产出稳定 `/uploads/...` URL，而不是暴露原始本地路径
- AC-A3: 发布路径遵循当前 runtime 的 `UPLOAD_DIR` 解析，不依赖固定 cwd 或源码目录
- AC-A4: 文件命名避免覆盖已有资源，默认生成唯一文件名
- AC-A5: 相同图片在 replay / retry / recovery 场景下重复进入 publication contract 时，能幂等返回同一个 `/uploads/...` URL，且不产生重复文件或重复 rich block
**Architecture:** 这一期只做 backend contract，不做 provider hookup。底层新增一个共享图片落盘工具，统一处理 MIME 白名单、扩展名推导、复制到 uploadDir、`/uploads/...` URL 生成；其上再包一层 publication service，负责生成 canonical rich block、provenance 和幂等键语义。provider-specific 的 `image_gen` / Antigravity 接入留到 F172 Phase B/C。
**Tech Stack:** TypeScript, node:fs/promises, node:path, node:crypto, node:test, existing `upload-paths.ts`, existing rich block schema
**前端验证:** No — Phase A 只做后端 contract + 单元/回归测试；前端 `media_gallery` 已存在，provider hookup 在后续 Phase 验证

---

## Straight-Line Check

- **Finish line:** 给任意本地生成图片文件和 `publicationKey`，系统能稳定产出同一个 published artifact（`absPath` + `/uploads/...` + `media_gallery` block + provenance）。
- **Not building:** Codex built-in 接线、Antigravity 接线、skill 文档收口、`contentBlocks` image 双写、connector outbound 行为改造。
- **Terminal schema:**

```ts
export interface GeneratedImagePublicationInput {
  sourcePath: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  publicationKey: string;
  provider: 'codex' | 'antigravity' | 'skill';
  toolName: string;
  prompt?: string;
  uploadDir?: string;
  title?: string;
  alt?: string;
}

export interface PublishedGeneratedImage {
  absPath: string;
  urlPath: `/uploads/${string}`;
  mimeType: string;
  originalPath: string;
  publicationKey: string;
  richBlock: {
    id: string;
    kind: 'media_gallery';
    v: 1;
    title?: string;
    items: [{ url: string; alt?: string }];
  };
  provenance: {
    provider: string;
    toolName: string;
    prompt?: string;
    originalPath: string;
    publishedPath: string;
    publicationKey: string;
  };
}
```

### Task 1: 提取共享图片落盘原语

**Files:**
- Create: `packages/api/src/utils/image-storage.ts`
- Modify: `packages/api/src/routes/image-upload.ts`
- Test: `packages/api/test/image-storage.test.js`
- Regression: `packages/api/test/image-upload.test.js`

**Step 1: Write the failing test**

```js
it('saves a validated image buffer to uploadDir and returns /uploads metadata', async () => {
  const { saveImageBufferToUploadDir } = await import('../dist/utils/image-storage.js');

  const uploadDir = await mkdtemp(join(tmpdir(), 'cat-cafe-image-storage-'));
  const result = await saveImageBufferToUploadDir({
    buffer: Buffer.from('fake-png'),
    mimeType: 'image/png',
    uploadDir,
    filenameStem: 'published-image',
  });

  assert.ok(result.absPath.startsWith(resolve(uploadDir)));
  assert.equal(result.urlPath, '/uploads/published-image.png');
  assert.equal(result.content.type, 'image');
  assert.equal(result.content.url, '/uploads/published-image.png');
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/image-storage.test.js
```

Expected: FAIL with `Cannot find module '../dist/utils/image-storage.js'`

**Step 3: Write minimal implementation**

```ts
export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export function mimeToImageExt(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    default:
      throw new ImageStorageError(`Unsupported file type: ${mimeType}`);
  }
}

export async function saveImageBufferToUploadDir(input: {
  buffer: Buffer;
  mimeType: string;
  uploadDir: string;
  filenameStem: string;
}) {
  await mkdir(input.uploadDir, { recursive: true });
  const ext = mimeToImageExt(input.mimeType);
  const filename = `${input.filenameStem}${ext}`;
  const absPath = resolve(join(input.uploadDir, filename));
  await writeFile(absPath, input.buffer);
  return {
    absPath,
    urlPath: `/uploads/${filename}`,
    content: { type: 'image', url: `/uploads/${filename}` },
  };
}
```

**Step 4: Refactor `image-upload.ts` to reuse the shared primitive**

Replace the in-file MIME/extension/write logic with `saveImageBufferToUploadDir(...)` so multipart uploads and generated-image publication share the same low-level storage contract.

**Step 5: Run regression tests**

Run:

```bash
cd packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/image-storage.test.js test/image-upload.test.js
```

Expected: PASS for both new helper tests and existing upload pipeline tests.

**Step 6: Commit**

```bash
git add packages/api/src/utils/image-storage.ts packages/api/src/routes/image-upload.ts packages/api/test/image-storage.test.js packages/api/test/image-upload.test.js
git commit -m "refactor(F172): extract shared image storage primitive"
```

### Task 2: 实现 generated-image publication contract

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/providers/generated-image-publication.ts`
- Test: `packages/api/test/generated-image-publication.test.js`

**Step 1: Write the failing test**

```js
it('publishes a generated image as a canonical /uploads artifact with media_gallery block', async () => {
  const { publishGeneratedImage } = await import('../dist/domains/cats/services/agents/providers/generated-image-publication.js');

  const sourceDir = await mkdtemp(join(tmpdir(), 'cat-cafe-generated-src-'));
  const uploadDir = await mkdtemp(join(tmpdir(), 'cat-cafe-generated-dest-'));
  const sourcePath = join(sourceDir, 'cat.png');
  await writeFile(sourcePath, Buffer.from('fake-png'));

  const published = await publishGeneratedImage({
    sourcePath,
    mimeType: 'image/png',
    publicationKey: 'codex-imagegen-001',
    provider: 'codex',
    toolName: 'image_gen',
    prompt: 'silver tabby maine coon cuddle',
    uploadDir,
    title: 'codex:image_gen',
    alt: 'generated image',
  });

  assert.equal(published.urlPath, '/uploads/codex-imagegen-001.png');
  assert.equal(published.richBlock.kind, 'media_gallery');
  assert.equal(published.richBlock.items[0].url, '/uploads/codex-imagegen-001.png');
  assert.equal(published.provenance.originalPath, sourcePath);
});
```

**Step 2: Add the idempotency regression before implementation**

```js
it('returns the same published artifact on repeated publicationKey replay', async () => {
  const first = await publishGeneratedImage(input);
  const second = await publishGeneratedImage(input);

  assert.equal(second.urlPath, first.urlPath);
  assert.equal(second.absPath, first.absPath);
  assert.equal((await readdir(uploadDir)).length, 1);
});
```

**Step 3: Run test to verify it fails**

Run:

```bash
cd packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/generated-image-publication.test.js
```

Expected: FAIL with `Cannot find module '../dist/domains/cats/services/agents/providers/generated-image-publication.js'`

**Step 4: Write minimal implementation**

```ts
export async function publishGeneratedImage(input: GeneratedImagePublicationInput): Promise<PublishedGeneratedImage> {
  const resolvedUploadDir = getDefaultUploadDir(input.uploadDir);
  const ext = mimeToImageExt(input.mimeType);
  const filenameStem = input.publicationKey;
  const target = await copyImageFileToUploadDir({
    sourcePath: input.sourcePath,
    mimeType: input.mimeType,
    uploadDir: resolvedUploadDir,
    filenameStem,
  });

  return {
    absPath: target.absPath,
    urlPath: target.urlPath,
    mimeType: input.mimeType,
    originalPath: input.sourcePath,
    publicationKey: input.publicationKey,
    richBlock: {
      id: `generated-image-${input.publicationKey}`,
      kind: 'media_gallery',
      v: 1,
      ...(input.title ? { title: input.title } : {}),
      items: [{ url: target.urlPath, ...(input.alt ? { alt: input.alt } : {}) }],
    },
    provenance: {
      provider: input.provider,
      toolName: input.toolName,
      ...(input.prompt ? { prompt: input.prompt } : {}),
      originalPath: input.sourcePath,
      publishedPath: target.absPath,
      publicationKey: input.publicationKey,
    },
  };
}
```

Implementation notes:
- Use deterministic filename stem = `publicationKey` to satisfy AC-A5 idempotency in Phase A.
- Do **not** emit `contentBlocks` here; Phase A’s canonical surface is the `media_gallery` rich block only.
- If target file already exists, return the same metadata instead of re-copying.

**Step 5: Run tests**

Run:

```bash
cd packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/generated-image-publication.test.js test/image-storage.test.js test/image-upload.test.js
```

Expected: PASS; repeated `publicationKey` replay leaves exactly one file in uploadDir.

**Step 6: Commit**

```bash
git add packages/api/src/domains/cats/services/agents/providers/generated-image-publication.ts packages/api/test/generated-image-publication.test.js
git commit -m "feat(F172): add generated image publication contract"
```

### Task 3: Phase A verification + spec sync

**Files:**
- Modify: `docs/features/F172-generated-image-publication.md`
- Test: `packages/api/test/generated-image-publication.test.js`
- Regression: `packages/api/test/image-upload.test.js`

**Step 1: Write the final verification checklist into the spec**

Update `F172` Phase A AC lines with the concrete implementation evidence you will have just produced:
- storage primitive extracted
- publication contract present
- idempotent replay test green

**Step 2: Run the final Phase A command set**

Run:

```bash
cd packages/api
pnpm run build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test test/generated-image-publication.test.js test/image-storage.test.js test/image-upload.test.js
```

Expected: PASS

**Step 3: Commit**

```bash
git add docs/features/F172-generated-image-publication.md
git commit -m "docs(F172): record phase-a publication contract evidence"
```
