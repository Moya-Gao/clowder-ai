---
name: using-rich-blocks
description: "Reference guide for creating Cat Cafe rich message blocks (card/diff/checklist/media_gallery/audio). Load this skill before creating your first rich block."
---

# Using Rich Blocks

## Overview

Cat Cafe supports rich message blocks for structured information. This skill contains the complete specification — system prompts only include a short reference to save tokens.

## When to Use Rich Blocks (B Style: Balanced)

**Core principle**: Structured info defaults to rich blocks; casual conversation stays plain text. Always write 1-2 sentences of natural language summary BEFORE sending a rich block.

### Default triggers (use rich blocks):

- **card** (tone: info/success/warning/danger)
  - Review conclusions (P1/P2 list + pass/block decision)
  - Task/phase status reports (progress, key metrics)
  - Decision summaries (What/Why/Tradeoff)
  - Game state panels (character info, turn state)
- **diff**
  - Code change suggestions (concrete patches)
  - Before/after refactoring comparisons
- **checklist**
  - To-do items / next actions
  - Review point checklists
  - Verification steps / test plans
- **media_gallery**
  - Screenshots, design mockups
  - Multi-image comparisons
- **audio** (voice messages — things you "say out loud")
  - Greetings, emotions, celebrations, encouragement
  - Just fill `text`; the system synthesizes speech automatically
  - Don't send voice on every message — only when "saying it" feels better than typing

### Keep plain text (don't use rich blocks):

- Casual chat, greetings
- Short answers (1-2 sentences)
- Technical discussions, long-form replies
- Questions and discussions (unless structured options are needed)
- When unsure which kind → don't use one

## Field Requirements

**CRITICAL: The field is `"kind"`, NOT `"type"`!** Every block must have `"v": 1` and a unique `id`.

### card
- `title` (required)
- `bodyMarkdown` / `tone` / `fields` (optional)
- Tones: `info`, `success`, `warning`, `danger`

### diff
- `filePath` + `diff` (required)
- `languageHint` (optional)

### checklist
- `items` (required) — each item needs `id` + `text`
- `title` (optional)

### media_gallery
- `items` (required) — each item needs `url`
- `title` / `alt` / `caption` (optional)

### audio
- `text` (required) — what you want to say, keep it short and conversational (1-2 sentences)

## Creating Rich Blocks

### Via HTTP Callback (preferred — more reliable)

```bash
curl -sS -X POST $API_URL/api/callbacks/create-rich-block \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    '{invocationId:$i,callbackToken:$t,block:{id:"b1",kind:"card",v:1,title:"Title",bodyMarkdown:"Content",tone:"info"}}')"
```

### Via MCP Tool

Use `cat_cafe_create_rich_block` with the block payload.

### Via Inline Text (fallback when HTTP is unavailable)

````
```cc_rich
{"v":1,"blocks":[{"id":"b1","kind":"card","v":1,"title":"Title","tone":"info"}]}
```
````

**Prefer HTTP callback** for reliability. Use `cc_rich` text fallback only when HTTP is unavailable.
