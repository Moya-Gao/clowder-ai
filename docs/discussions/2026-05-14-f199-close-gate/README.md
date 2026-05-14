---
feature_ids: [F199]
related_features: [F190, F183, F184, F194, F088, F124]
topics: [console, settings, parity-audit, close-gate, vision-guardian]
doc_kind: proof
created: 2026-05-14
---

# F199 Close Gate Evidence

F199 backfills the F190 Phase D settings parity gap after the CVO found that the
home `/settings` surface had style parity but was missing product capability.

Original CVO anchor:

> 图1是开源的 图2是我们的 这里能证明 你们只是调整了样式 其实很多东西都丢了？

> 走 Phase D 用 -> 完整 backfill 7 个组件

## Slice Status

| Slice | Result | Evidence |
|---|---|---|
| D-1 ServiceStatusPanel | Merged | PR #1662 `0df783473`; proof `../2026-05-13-f199-d1-service-status-panel-proof/README.md` |
| D-2 SkillsContent | Merged | PR #1663 `1e4a96951`; proof `../2026-05-13-f199-d2-skills-content-proof/README.md` |
| D-3a capability hardening | Merged | PR #1664 `be2c406cc`; proof `../2026-05-13-f199-d3a-capability-write-hardening-proof/README.md` |
| D-3b MCP settings UI | Merged | PR #1665 `10dc4e768`; proof `../2026-05-13-f199-d3b-mcp-settings-ui-proof/README.md` |
| D-4 PushServiceConfig | Merged | PR #1668 `50cad313`; proof `../2026-05-14-f199-d4-push-service-config-proof/README.md` |
| D-5 GithubConfigPanel | Merged | PR #1668 `50cad313`; proof `../2026-05-14-f199-d4-push-service-config-proof/README.md` |

PR #1668 passed local reviewer review, full `pnpm gate` on branch HEAD
`df63edbc`, and cloud review before squash merge.

## User Visibility Disclosure

| Surface | User-visible result | Status |
|---|---|---|
| Voice service status | `/settings?s=voice` shows detailed service status above voice settings | Backfilled |
| Service lifecycle controls | Start/stop/install controls remain absent | Explicitly out of F199; D-1 stays read-only |
| Skills list and preview | `/settings?s=skills` shows skill cards, filtering, mount summary, and SKILL.md preview | Backfilled |
| Skills write actions | Sync/resolve/uninstall actions remain absent | Explicitly out of F199; D-2 stays read-mostly |
| MCP settings | `/settings?s=mcp` shows source-style MCP cards, read-only managed modal, external edit modal, and add preview/install flow | Backfilled |
| MCP secret editing | Redacted env/header values are omitted on save instead of being written back | Backfilled on hardened D-3a backend |
| Owner misconfiguration | MCP, VAPID, and GitHub write surfaces show explicit `DEFAULT_OWNER_USER_ID` guidance | Backfilled |
| Push/VAPID config | `/settings?s=notify` lets users configure VAPID keys, generate a keypair, and edit contact email without manual `.env` edits | Backfilled |
| GitHub config | `/settings?s=plugins` lets users configure GitHub token/noise/MCP PAT without manual `.env` edits | Backfilled |
| `InstallPreviewModal.tsx` | Source service lifecycle install modal remains absent in home | Reclassified out of F199 as service lifecycle write |

## Settings List Check

Command:

```bash
comm -3 \
  <(find ../clowder-ai/packages/web/src/components/settings -maxdepth 1 -type f -exec basename {} \; | sort) \
  <(find packages/web/src/components/settings -maxdepth 1 -type f -exec basename {} \; | sort)
```

Output:

```text
InstallPreviewModal.tsx
```

Interpretation: all F199-scoped settings files are now present locally. The only
remaining file-level difference is `InstallPreviewModal.tsx`, which F199 KD-7
reclassified out of scope because it is service lifecycle install/start/stop
write surface, not capability/settings parity.

## Red-Zone Check

Command:

```bash
git show --name-only --format= \
  0df783473 1e4a96951 be2c406cc 10dc4e768 50cad313 |
  sort -u |
  rg 'packages/web/src/components/(ChatMessage|ChatContainer|ChatContainerHeader)\.tsx|packages/web/src/stores/chatStore\.ts|packages/web/src/app/\(chat\)/thread/\[threadId\]/page\.tsx'
```

Output: empty.

F199 did not touch the F183/F184/F194 protected chat rendering paths inherited
from F190 KD-3.

## Transport Boundary Check

Relevant changed runtime/config paths across the five merged implementation
commits:

```text
packages/api/src/config/connector-secret-write-guards.ts
packages/api/src/config/connector-secrets-allowlist.ts
packages/api/src/domains/cats/services/push/PushNotificationService.ts
packages/api/src/infrastructure/connectors/connector-reload-subscriber.ts
packages/api/src/routes/config-secrets.ts
packages/api/src/routes/connector-hub.ts
packages/api/src/routes/push-route-helpers.ts
packages/api/src/routes/push.ts
```

Interpretation:

- F199 changes credential/config write surfaces and push config reload behavior.
- F199 does not change provider adapters, connector router, outbound delivery,
  thread binding, or message routing ownership paths.
- D-4/D-5 explicitly separated connector gateway reload keys from VAPID/GitHub
  keys so VAPID edits do not restart IM connector gateways.

## Guardian Request

Author-side close evidence is ready, but F199 should not be self-closed by the
author or prior reviewer:

- author: Codex/GPT-5.5
- spec author and slice reviewer: Opus 4.7

The next step is independent vision-guardian review by a different cat.
