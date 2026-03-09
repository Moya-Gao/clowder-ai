---
feature_ids: [F086]
topics: [reflection, knowledge-engineering, documentation]
doc_kind: plan
created: 2026-03-09
---

# F086 M3: 反思胶囊 + 文档关系索引 — 实施计划

## 目标

把 F086 最后一块拼图补上：反思胶囊（结构化经验沉淀）+ 文档关系索引（知识网络可检索化）。

## Scope

7 个 AC 分两组：

### Part A: 反思胶囊 (AC 1-4)

1. **胶囊 YAML schema 定义** — 6 固定字段模板
2. **`docs/reflections/` 目录 + README** — 命名规范 + 示例
3. **feat-lifecycle completion 集成** — Step 0.5（愿景对照后、AC 打勾前）
4. **`rule_update_target` 字段** — 强制指定回写目标

### Part B: 文档关系索引 (AC 5-7)

5. **`scripts/build-doc-index.js`** — 扫描 docs/ frontmatter → 生成 `docs/.doc-index.json`
6. **CI/check 脚本** — `pnpm check:doc-index`（一致性检查：broken links, missing frontmatter）
7. **跨猫可检索** — 所有猫通过 `cat_cafe_search_evidence` 或 grep 都能查到索引

## TDD 执行顺序

### Red Phase

**Task 0**: Guard test `packages/api/test/reflection-capsule-m3.test.js`
- Capsule schema template exists in `docs/reflections/README.md`
- Template has all 6 fields (capsule_id, context, what_worked, what_failed, trigger_missed, doc_links, rule_update_target)
- feat-lifecycle mentions 反思胶囊 in completion section
- `scripts/build-doc-index.js` exists and is executable
- Script output `docs/.doc-index.json` has expected schema (title, summary, edges, backlinks)

### Green Phase

**Task 1**: Create `docs/reflections/README.md` with:
- YAML frontmatter template (6 fields)
- Naming convention: `YYYY-MM-DD-{topic}-capsule.md`
- Usage instructions

**Task 2**: Update `feat-lifecycle/SKILL.md` completion section:
- Insert Step 0.5 "反思胶囊" between 愿景对照 (Step 0) and AC 打勾 (Step 1)
- Reference `docs/reflections/README.md` for template

**Task 3**: Create `scripts/build-doc-index.js`:
- Scan `docs/**/*.md` for YAML frontmatter
- Extract: title (from H1), feature_ids, related_features, topics, doc_kind
- Build edges: feature_ids → related_features, backlinks
- Output: `docs/.doc-index.json`
- Add to package.json: `"check:doc-index": "node scripts/build-doc-index.js --check"`

**Task 4**: Write first reflection capsule as proof-of-concept:
- `docs/reflections/2026-03-09-f086-m1-multi-mention-capsule.md`
- Real reflection on M1 implementation experience

**Task 5**: Check off M3 ACs in F086 spec

## Commit Strategy

Single commit per logical group:
1. Reflection capsule infrastructure (Tasks 0-2 + 4)
2. Doc index script (Task 3)
3. AC checkoff (Task 5)
