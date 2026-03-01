---
feature_ids: [F040]
topics: [features, index, tooling]
doc_kind: discussion
created: 2026-03-01
---

# 修复：Feature Index 出现重复 ID（F040）

## 背景

云端 Codex review 指出：`docs/features/` 新增了一个 `F040-*.md` 的别名文件后，`scripts/generate-feature-index.mjs` 会在 `index.json` 里生成两个 `F040` 记录（同 ID 不同 file），导致消费者按 ID 解析时产生歧义。

## 复现（确定性）

```bash
node scripts/generate-feature-index.mjs --output /tmp/feature-index.json
jq -r '.features[].id' /tmp/feature-index.json | sort | uniq -d
```

期望：无输出  
实际：输出 `F040`

## 结论

`docs/features/` 里每个 Feature ID 必须只有一个聚合文件入口。别名文件会破坏 “ID → file” 的单射关系。

