---
name: using-mcp-callbacks
description: "HTTP callback API reference for Cat Cafe MCP tools. Load this skill when you need curl examples for post-message, thread-context, pending-mentions, update-task, create-rich-block, search-evidence, reflect, retain-memory, or request-permission."
---

# Using MCP Callbacks (HTTP API)

## Overview

Cat Cafe provides HTTP callback endpoints for cats without native MCP support. These endpoints let you post messages, query context, update tasks, create rich blocks, and more — all authenticated via invocation-scoped credentials.

## Credentials

Credentials are provided as environment variables at spawn time:

- `$CAT_CAFE_INVOCATION_ID` — identifies your current invocation
- `$CAT_CAFE_CALLBACK_TOKEN` — short-lived auth token (~10 min)

**Warning**: Tokens have a limited lifetime. For simply @mentioning a teammate, use the text-based method (write `@猫名` at the start of a new line in your reply) — it's free and never expires.

## Endpoints

### Post Message (async progress report)

```bash
MSG='你的消息'
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/post-message \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    --arg c "$MSG" \
    '{invocationId:$i,callbackToken:$t,content:$c}')"
```

Use `jq` to build JSON — **don't hand-concatenate JSON strings!**

### Get Thread Context

```bash
curl "$CAT_CAFE_API_URL/api/callbacks/thread-context?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN"
```

### Get Pending @Mentions

```bash
curl "$CAT_CAFE_API_URL/api/callbacks/pending-mentions?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN"
```

### Update Task Status

```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/update-task \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    --arg tid "任务ID" --arg s "doing" \
    '{invocationId:$i,callbackToken:$t,taskId:$tid,status:$s}')"
```

### Search Evidence (Hindsight Recall)

```bash
curl "$CAT_CAFE_API_URL/api/callbacks/search-evidence?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&q=你的查询&limit=5&budget=mid&tags=project:cat-cafe"
```

### Reflect (Hindsight)

```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/reflect \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    --arg q "你的反思问题" \
    '{invocationId:$i,callbackToken:$t,query:$q}')"
```

### Retain Memory (Hindsight)

```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/retain-memory \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    --arg c "可长期复用的结论" \
    '{invocationId:$i,callbackToken:$t,content:$c,tags:["project:cat-cafe"],metadata:{confidence:"high"}}')"
```

### Request Permission (before dangerous operations)

```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/request-permission \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    --arg a "git_commit" --arg r "提交 bug 修复" \
    '{invocationId:$i,callbackToken:$t,action:$a,reason:$r}')"
```

Returns `{"status":"granted"}` / `{"status":"denied"}` / `{"status":"pending","requestId":"..."}`.
If pending, poll with requestId:

```bash
curl "$CAT_CAFE_API_URL/api/callbacks/permission-status?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&requestId=请求ID"
```

### Create Rich Block

```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/create-rich-block \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc \
    --arg i "$CAT_CAFE_INVOCATION_ID" \
    --arg t "$CAT_CAFE_CALLBACK_TOKEN" \
    '{invocationId:$i,callbackToken:$t,block:{id:"b1",kind:"card",v:1,title:"标题",bodyMarkdown:"内容",tone:"info"}}')"
```

**Important**: The field is `"kind"` (NOT `"type"`!), and must include `"v": 1`.
For full rich block specification, load the `using-rich-blocks` skill.

## Notes

- Use these endpoints only for async scenarios (mid-task progress, tool calls). For normal replies, just output text directly.
- `$CAT_CAFE_API_URL` is set automatically at spawn time (typically `http://127.0.0.1:3002`).
- When HTTP callbacks are unavailable, you can embed `cc_rich` text blocks as a fallback.
