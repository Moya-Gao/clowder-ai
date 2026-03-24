# Review Request: F088 Phase J2 — Pandoc document generation service + auto-install

## What

Pandoc-based document generation: cats can now generate PDF/DOCX/MD from Markdown via MCP tool `cat_cafe_generate_document`.

9 files, +490/-5:
- `PandocService.ts`: pandoc detection + MD→PDF/DOCX conversion + graceful degradation (PDF→DOCX→MD)
- `callback-document-routes.ts`: `POST /api/callbacks/generate-document` — generates file, saves to uploads/, attaches file RichBlock
- `callback-tools.ts`: MCP tool `cat_cafe_generate_document` registered
- `SystemPromptBuilder.ts`: tool listed in MCP tools section
- `init-cafe.sh` + `install.sh`: auto-install pandoc (macOS brew / Linux apt)
- 11 new PandocService tests

## Why

CVO wants cats to generate and send documents (PDF/DOCX/MD) through IM platforms. J1 (PR #689) built the delivery pipeline; J2 adds the generation capability. Together they complete the end-to-end flow.

## Original Requirements

> "研究看看飞书支不支持你们传文件？比如我让你生成一份 pdf 能传到飞书吗？"
> "要支持传文件，docx md pdf 等等文件就行"
> "用 Pandoc 还是 pandoc 我记得有个啥？" → confirmed Pandoc
> "你得帮人装好，比如启动脚本引导里，不要让人自己装"
- Source: thread `thread_mn3yrdt2rhk2ckc0` messages #26, #39, #110, #117
- **Please verify: does the generation service + auto-install satisfy CVO's document delivery vision?**

## Tradeoff

- Pandoc CLI over JS libraries (puppeteer/pdf-lib/docx) — CVO confirmed, aligns with Anthropic stack
- Graceful degradation chain: PDF needs LaTeX engine → falls back to DOCX → falls back to MD
- Auto-install in setup scripts, graceful degradation as fallback only

## Open Questions

1. PDF requires a LaTeX engine (tectonic/mactex). Auto-install of LaTeX is heavy (~500MB). Currently we don't auto-install LaTeX — PDF degrades to DOCX. Should we add LaTeX auto-install too?
2. File size limit enforcement (30MB for Feishu) is not yet implemented — should it be in J2 or a follow-up?

## Next Action

Please review code quality + architecture, confirm Pandoc integration is sound.

## Self-check Evidence

### Spec compliance
Quality Gate PASS. 6 functional items verified.

### Test results
```
218 tests passed, 0 failed
build: tsc exit 0
lint: 0 errors
biome: clean
```

### Related docs
- Feature: `docs/features/F088-multi-platform-chat-gateway.md` Phase J2
- J1 PR: #689 (merged)

---

Review-Target-ID: f088-phase-j2
Branch: feat/f088-phase-j2
