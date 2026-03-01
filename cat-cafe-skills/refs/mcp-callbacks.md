# MCP Callbacks HTTP API Reference

> 降级自 `using-mcp-callbacks` skill。纯 API 参考，按需查阅。

## Credentials

环境变量在 spawn 时自动注入：
- `$CAT_CAFE_INVOCATION_ID` — 当前 invocation ID
- `$CAT_CAFE_CALLBACK_TOKEN` — 短期 auth token (~10 min)

**提示**：@ 队友用文本方式（行首 `@句柄`）更简单，不需要 HTTP。

## Endpoints

### Post Message
```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/post-message \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" --arg c "消息内容" '{invocationId:$i,callbackToken:$t,content:$c}')"
```

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
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" --arg tid "任务ID" --arg s "doing" '{invocationId:$i,callbackToken:$t,taskId:$tid,status:$s}')"
```

### Register PR Tracking

Call after `gh pr create` so PR review notifications route to the current thread.

```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/register-pr-tracking \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" --arg repo "zts212653/cat-cafe" --argjson pr 100 --arg catId "opus" '{invocationId:$i,callbackToken:$t,repoFullName:$repo,prNumber:$pr,catId:$catId}')"
```

### Search Evidence (Hindsight)
```bash
curl "$CAT_CAFE_API_URL/api/callbacks/search-evidence?invocationId=$CAT_CAFE_INVOCATION_ID&callbackToken=$CAT_CAFE_CALLBACK_TOKEN&q=查询&limit=5"
```

### Reflect (Hindsight)
```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/reflect \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" --arg q "反思问题" '{invocationId:$i,callbackToken:$t,query:$q}')"
```

### Retain Memory (Hindsight)
```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/retain-memory \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" --arg c "结论" '{invocationId:$i,callbackToken:$t,content:$c,tags:["project:cat-cafe"]}')"
```

### Request Permission
```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/request-permission \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" --arg a "git_commit" --arg r "原因" '{invocationId:$i,callbackToken:$t,action:$a,reason:$r}')"
```
Returns `granted` / `denied` / `pending`（pending 需轮询 permission-status）。

### Create Rich Block
```bash
curl -sS -X POST $CAT_CAFE_API_URL/api/callbacks/create-rich-block \
  -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg i "$CAT_CAFE_INVOCATION_ID" --arg t "$CAT_CAFE_CALLBACK_TOKEN" '{invocationId:$i,callbackToken:$t,block:{id:"b1",kind:"card",v:1,title:"标题",bodyMarkdown:"内容",tone:"info"}}')"
```
**注意**：字段是 `"kind"` 不是 `"type"`！必须有 `"v": 1`。

## Notes

- 仅用于异步场景（mid-task progress）。正常回复直接输出文本。
- `$CAT_CAFE_API_URL` 自动设置（通常 `http://127.0.0.1:3002`）。
- HTTP 不可用时可用 `cc_rich` 文本 fallback。
