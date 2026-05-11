---
doc_kind: harness-feedback
feedback_type: tool-eval
feature_id: F192
tools: [search-evidence, post-message, browser-tools, rich-block, shell-exec]
created: 2026-05-11
---

# Top-5 Tool Eval Contracts (AC-D5)

Non-A2A tools with highest daily usage. Each follows the v1 4-item template.

---

## search_evidence (F102)

### 1. Primary Users + Activation Signal

- **Users**: All cats (pre-task recall)
- **Activation signal**: `cat_cafe_search_evidence` MCP call

### 2. Friction Metric

- **Empty result rate**: Queries returning 0 results (vocab mismatch or index stale)
- **Latency P95**: Response time > 3s suggests index corruption or large corpus
- **False recall**: User manually finds a doc that search missed (reported as lesson)

### 3. Regression Fixture

- Evidence index rebuild on startup (verified by `GET /api/health`)
- Known doc IDs should be retrievable: `search_evidence("F042")` → non-empty

### 4. Sunset Signal

- Cats stop calling search_evidence before tasks → CLAUDE.md recall rule not followed
- Replaced by external RAG or IDE-integrated search

---

## post_message (F042)

### 1. Primary Users + Activation Signal

- **Users**: All cats (primary communication tool)
- **Activation signal**: `cat_cafe_post_message` MCP call

### 2. Friction Metric

- **Delivery failure rate**: Message stored but WebSocket broadcast fails
- **Thread mismatch**: Message posted to wrong thread (routing bug)
- **Truncation**: Content exceeds storage limit and is silently clipped

### 3. Regression Fixture

- Integration test: post + read-back content match
- WebSocket broadcast smoke test

### 4. Sunset Signal

- N/A — core communication primitive, no sunset expected

---

## browser-tools (Chrome MCP)

### 1. Primary Users + Activation Signal

- **Users**: All cats (UI verification, web research)
- **Activation signal**: `mcp__claude-in-chrome__*` tool calls

### 2. Friction Metric

- **Session zombie rate**: Browser sessions that hang or lose connection (LL-056)
- **Navigation failure rate**: `navigate` calls that timeout or error
- **Screenshot failure**: `screenshot` returns empty/corrupt image

### 3. Regression Fixture

- Startup stale-by-user-data-dir cleanup (LL-056 / #1620)
- Tab context retrieval before any action

### 4. Sunset Signal

- Replaced by Playwright MCP or native browser automation
- Zero usage for 30+ days

---

## rich-block (F115)

### 1. Primary Users + Activation Signal

- **Users**: All cats (structured content: expert panels, media, cards)
- **Activation signal**: `cat_cafe_create_rich_block` MCP call

### 2. Friction Metric

- **Validation failure rate**: Block rejected by schema validator
- **Render mismatch**: Block created but frontend renders incorrectly (requires visual verification)
- **Stale rules**: `get_rich_block_rules` returns outdated schema

### 3. Regression Fixture

- Schema validation unit tests per block type
- Visual regression: browser screenshot comparison

### 4. Sunset Signal

- Block types with zero usage for 60+ days → candidate for removal
- Frontend stops rendering a block type

---

## shell_exec (F061)

### 1. Primary Users + Activation Signal

- **Users**: All cats (git, build, test commands)
- **Activation signal**: `cat_cafe_shell_exec` MCP call

### 2. Friction Metric

- **Timeout rate**: Commands exceeding the configured timeout
- **Error rate**: Non-zero exit codes (expected for test runners, unexpected for git)
- **Zombie process rate**: Commands that don't terminate cleanly

### 3. Regression Fixture

- Simple echo command round-trip test
- Timeout enforcement test

### 4. Sunset Signal

- Replaced by direct Claude Code Bash tool integration
- Zero MCP-routed shell_exec for 30+ days
