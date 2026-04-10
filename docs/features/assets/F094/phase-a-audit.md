---
feature_ids: [F094]
related_features: [F058, F086, F088]
topics: [documentation, audit, feature-docs, quality]
doc_kind: note
created: 2026-04-10
---

# F094 Phase A 审计报告（模板合规度）

- 生成时间：2026-04-10T09:29:47.372Z
- 审计范围：`docs/features/F*.md`
- 分档规则：Green >= 80%，Yellow 50%-79.99%，Red < 50%
- 机器明细：`phase-a-audit.json`

## Summary

| 总文档数 | Green | Yellow | Red | 平均分 |
| --- | --- | --- | --- | --- |
| 161 | 154 | 5 | 2 | 97.71% |

## 缺失项频次（Top）

| 缺失项 | 文档数 |
| --- | --- |
| AC format (`- [ ] AC-A1: ...`) | 12 |
| Dependency tags (`Evolved from/Blocked by/Related`) | 8 |
| ## Acceptance Criteria | 7 |
| ## Risk | 7 |
| ## Dependencies | 5 |
| Status line (`> **Status**: ... | **Owner**: ...`) | 4 |
| ## What | 2 |
| ## Why | 1 |
| frontmatter.related_features | 1 |
| frontmatter.topics | 1 |

## 重复 Feature ID

- F055: F055-a2a-mcp-structured-routing.md, F055-plan-board.md
- F061: F061-antigravity-bengal-cat.md, F061-cdp-integration-retrospective.md
- F081: F081-bubble-continuity-observability.md, F081-write-path-audit.md
- F124: F124-apple-ecosystem-voice-interaction.md, F124-voice-comfort-callout.md

## 分档清单

### GREEN (154)

| Feature | 文件 | 分数 | 缺失项数 |
| --- | --- | --- | --- |
| F001 | `F001-config-visibility.md` | 100% | 0 |
| F002 | `F002-agent-to-agent.md` | 100% | 0 |
| F003 | `F003-hindsight-lite.md` | 100% | 0 |
| F004 | `F004-runtime-config.md` | 100% | 0 |
| F005 | `F005-a2a-follow-up.md` | 100% | 0 |
| F006 | `F006-thread-title-editor.md` | 100% | 0 |
| F007 | `F007-thread-title-search.md` | 100% | 0 |
| F008 | `F008-token-budget-observability.md` | 100% | 0 |
| F009 | `F009-tool-use-tool-result.md` | 100% | 0 |
| F010 | `F010-mobile-cat.md` | 100% | 0 |
| F011 | `F011-mode-system.md` | 100% | 0 |
| F012 | `F012-feature-discoverability.md` | 100% | 0 |
| F013 | `F013-audit-log-v2.md` | 100% | 0 |
| F014 | `F014-svg-cat-animation.md` | 100% | 0 |
| F015 | `F015-backlog-management.md` | 100% | 0 |
| F016 | `F016-codex-oauth-memory-loop.md` | 100% | 0 |
| F017 | `F017-export-dialog-image.md` | 100% | 0 |
| F018 | `F018-toolbar-collapse.md` | 100% | 0 |
| F019 | `F019-dynamic-elapsed-timer.md` | 100% | 0 |
| F020 | `F020-voice-input-suite.md` | 100% | 0 |
| F021 | `F021-signal-study-mode.md` | 100% | 0 |
| F022 | `F022-rich-blocks.md` | 100% | 0 |
| F023 | `F023-directory-corrosion-defense.md` | 100% | 0 |
| F024 | `F024-context-monitoring.md` | 100% | 0 |
| F025 | `F025-reliability-engineering.md` | 100% | 0 |
| F026 | `F026-ui-dashboard-upgrade.md` | 100% | 0 |
| F027 | `F027-a2a-path-unification.md` | 100% | 0 |
| F028 | `F028-cross-channel-authorization.md` | 100% | 0 |
| F029 | `F029-task-summary-right-panel-cleanup.md` | 100% | 0 |
| F030 | `F030-copy-button-paths.md` | 100% | 0 |
| F031 | `F031-review-two-layer-process.md` | 100% | 0 |
| F032 | `F032-agent-plugin-architecture.md` | 100% | 0 |
| F033 | `F033-session-strategy-configurability.md` | 100% | 0 |
| F034 | `F034-voice-message.md` | 100% | 0 |
| F035 | `F035-whisper-visibility.md` | 100% | 0 |
| F036 | `F036-logo-stroke-animation.md` | 100% | 0 |
| F037 | `F037-agent-swarm.md` | 100% | 0 |
| F038 | `F038-skills-discovery.md` | 100% | 0 |
| F039 | `F039-message-queue-delivery.md` | 100% | 0 |
| F040 | `F040-backlog-reorganization.md` | 100% | 0 |
| F041 | `F041-capability-dashboard.md` | 100% | 0 |
| F042 | `F042-prompt-engineering-audit.md` | 100% | 0 |
| F043 | `F043-mcp-unification.md` | 100% | 0 |
| F044 | `F044-channel-activity-system.md` | 100% | 0 |
| F045 | `F045-ndjson-observability.md` | 100% | 0 |
| F046 | `F046-anti-drift-protocol.md` | 100% | 0 |
| F047 | `F047-queue-steer.md` | 100% | 0 |
| F048 | `F048-restart-recovery.md` | 100% | 0 |
| F049 | `F049-mission-control-backlog-center.md` | 100% | 0 |
| F050 | `F050-a2a-external-agent-onboarding.md` | 100% | 0 |
| F051 | `F051-real-quota-dashboard.md` | 100% | 0 |
| F052 | `F052-cross-thread-identity-isolation.md` | 100% | 0 |
| F053 | `F053-gemini-resume-session-parity.md` | 100% | 0 |
| F054 | `F054-hci-preheat-infra.md` | 100% | 0 |
| F055 | `F055-a2a-mcp-structured-routing.md` | 100% | 0 |
| F055 | `F055-plan-board.md` | 100% | 0 |
| F056 | `F056-cat-cafe-design-language.md` | 100% | 0 |
| F057 | `F057-thread-discoverability.md` | 100% | 0 |
| F058 | `F058-mission-control-enhancements.md` | 100% | 0 |
| F059 | `F059-open-source-plan.md` | 100% | 0 |
| F060 | `F060-output-image-rich-block.md` | 100% | 0 |
| F061 | `F061-antigravity-bengal-cat.md` | 100% | 0 |
| F061 | `F061-cdp-integration-retrospective.md` | 100% | 0 |
| F062 | `F062-ragdoll-provider-profile-hub.md` | 100% | 0 |
| F063 | `F063-hub-workspace-explorer.md` | 100% | 0 |
| F064 | `F064-a2a-exit-check.md` | 100% | 0 |
| F065 | `F065-session-continuity.md` | 100% | 0 |
| F066 | `F066-voice-pipeline-upgrade.md` | 100% | 0 |
| F067 | `F067-cold-start-verifier.md` | 100% | 0 |
| F068 | `F068-new-thread-dialog-ux.md` | 100% | 0 |
| F069 | `F069-thread-read-state.md` | 100% | 0 |
| F070 | `F070-portable-governance.md` | 100% | 0 |
| F071 | `F071-ux-debt-batch.md` | 100% | 0 |
| F072 | `F072-mark-all-read.md` | 100% | 0 |
| F073 | `F073-sop-auto-guardian.md` | 100% | 0 |
| F074 | `F074-mount-directory-support.md` | 100% | 0 |
| F075 | `F075-cat-leaderboard.md` | 100% | 0 |
| F076 | `F076-mission-hub-cross-project.md` | 100% | 0 |
| F077 | `F077-multi-user-secure-collab.md` | 100% | 0 |
| F078 | `F078-smart-routing-group-mentions.md` | 100% | 0 |
| F079 | `F079-voting-system.md` | 100% | 0 |
| F080 | `F080-input-history-completion.md` | 100% | 0 |
| F081 | `F081-bubble-continuity-observability.md` | 100% | 0 |
| F081 | `F081-write-path-audit.md` | 100% | 0 |
| F082 | `F082-git-health-panel.md` | 100% | 0 |
| F083 | `F083-design-gate-sop.md` | 100% | 0 |
| F084 | `F084-ragdoll-rescue-hub.md` | 100% | 0 |
| F085 | `F085-hyperfocus-brake.md` | 100% | 0 |
| F086 | `F086-cat-orchestration-multi-mention.md` | 100% | 0 |
| F087 | `F087-cvo-bootcamp.md` | 100% | 0 |
| F088 | `F088-multi-platform-chat-gateway.md` | 100% | 0 |
| F089 | `F089-hub-terminal-tmux.md` | 100% | 0 |
| F090 | `F090-pixel-cat-brawl.md` | 100% | 0 |
| F091 | `F091-signal-study-mode.md` | 100% | 0 |
| F092 | `F092-voice-companion-experience.md` | 100% | 0 |
| F093 | `F093-cats-and-u-world-engine.md` | 100% | 0 |
| F094 | `F094-feature-doc-debt-cleanup.md` | 100% | 0 |
| F095 | `F095-sidebar-collapse-memory.md` | 100% | 0 |
| F096 | `F096-interactive-rich-blocks.md` | 100% | 0 |
| F097 | `F097-cli-output-collapsible-ux.md` | 100% | 0 |
| F098 | `F098-callback-message-ux.md` | 100% | 0 |
| F099 | `F099-hub-navigation-scalability.md` | 100% | 0 |
| F101 | `F101-mode-v2-game-engine.md` | 100% | 0 |
| F102 | `F102-memory-adapter-refactor.md` | 100% | 0 |
| F103 | `F103-per-cat-voice-identity.md` | 84.62% | 2 |
| F104 | `F104-local-omni-perception.md` | 100% | 0 |
| F105 | `F105-opencode-golden-chinchilla.md` | 84.62% | 2 |
| F106 | `F106-multi-bootcamp.md` | 100% | 0 |
| F107 | `F107-headband-guess-game.md` | 100% | 0 |
| F108 | `F108-side-dispatch-concurrent-invocation.md` | 100% | 0 |
| F109 | `F109-message-actions-overhaul.md` | 100% | 0 |
| F110 | `F110-bootcamp-vision-elicitation.md` | 100% | 0 |
| F111 | `F111-streaming-tts-chunker.md` | 100% | 0 |
| F112 | `F112-voice-playback-queue.md` | 100% | 0 |
| F114 | `F114-governance-magic-words.md` | 92.31% | 1 |
| F115 | `F115-runtime-startup-optimization.md` | 100% | 0 |
| F116 | `F116-opensource-ops.md` | 100% | 0 |
| F117 | `F117-message-delivery-lifecycle.md` | 100% | 0 |
| F118 | `F118-cli-liveness-watchdog.md` | 100% | 0 |
| F119 | `F119-who-is-spy-game.md` | 100% | 0 |
| F120 | `F120-hub-embedded-browser.md` | 100% | 0 |
| F121 | `F121-community-frontend-ux-triage.md` | 84.62% | 2 |
| F122 | `F122-unified-dispatch-queue.md` | 100% | 0 |
| F123 | `F123-bubble-runtime-correctness.md` | 100% | 0 |
| F124 | `F124-apple-ecosystem-voice-interaction.md` | 100% | 0 |
| F125 | `F125-alpha-test-channel.md` | 100% | 0 |
| F126 | `F126-limb-control-plane.md` | 100% | 0 |
| F127 | `F127-cat-instance-management.md` | 100% | 0 |
| F129 | `F129-pack-system-multi-agent-mod.md` | 100% | 0 |
| F130 | `F130-api-log-governance.md` | 100% | 0 |
| F131 | `F131-workspace-navigator.md` | 92.31% | 1 |
| F132 | `F132-dingtalk-wecom-gateway.md` | 100% | 0 |
| F133 | `F133-cicd-tracking.md` | 100% | 0 |
| F134 | `F134-feishu-group-chat.md` | 100% | 0 |
| F137 | `F137-weixin-personal-gateway.md` | 100% | 0 |
| F138 | `F138-video-studio.md` | 92.31% | 1 |
| F139 | `F139-unified-schedule-abstraction.md` | 100% | 0 |
| F140 | `F140-github-pr-automation.md` | 100% | 0 |
| F141 | `F141-github-repo-inbox.md` | 100% | 0 |
| F142 | `F142-connector-slash-commands.md` | 100% | 0 |
| F143 | `F143-hostable-agent-runtime.md` | 100% | 0 |
| F144 | `F144-ppt-forge.md` | 100% | 0 |
| F145 | `F145-mcp-portable-provisioning.md` | 100% | 0 |
| F146 | `F146-mcp-marketplace-control-plane.md` | 100% | 0 |
| F147 | `F147-i18n-hub-locale-switch.md` | 92.31% | 1 |
| F148 | `F148-hierarchical-context-transport.md` | 100% | 0 |
| F149 | `F149-acp-runtime-operations.md` | 100% | 0 |
| F150 | `F150-tool-usage-stats.md` | 100% | 0 |
| F151 | `F151-xiaoyi-channel-gateway.md` | 100% | 0 |
| F152 | `F152-expedition-memory.md` | 100% | 0 |
| F153 | `F153-observability-infra.md` | 100% | 0 |
| F154 | `F154-cat-routing-personalization.md` | 100% | 0 |
| F156 | `F156-websocket-security-hardening.md` | 100% | 0 |
| F157 | `F157-feishu-receipt-ack.md` | 100% | 0 |

### YELLOW (5)

| Feature | 文件 | 分数 | 缺失项数 |
| --- | --- | --- | --- |
| F100 | `F100-self-evolution.md` | 61.54% | 5 |
| F113 | `F113-multi-platform-one-click-deploy.md` | 61.54% | 5 |
| F128 | `F128-cat-create-thread.md` | 53.85% | 6 |
| F135 | `F135-dare-ootb.md` | 76.92% | 3 |
| F136 | `F136-unified-config-hot-reload.md` | 76.92% | 3 |

### RED (2)

| Feature | 文件 | 分数 | 缺失项数 |
| --- | --- | --- | --- |
| F124 | `F124-voice-comfort-callout.md` | 30.77% | 9 |
| F155 | `F155-scene-guidance-engine.md` | 46.15% | 7 |

## Red 文档缺失详情

### F124 `F124-voice-comfort-callout.md`
- 分数：30.77% (4/13)
- 缺失：frontmatter.topics；Status line (`> **Status**: ... | **Owner**: ...`)；## Why；## What；## Acceptance Criteria；## Dependencies；AC format (`- [ ] AC-A1: ...`)；Dependency tags (`Evolved from/Blocked by/Related`)；## Risk

### F155 `F155-scene-guidance-engine.md`
- 分数：46.15% (6/13)
- 缺失：Status line (`> **Status**: ... | **Owner**: ...`)；## What；## Acceptance Criteria；## Dependencies；AC format (`- [ ] AC-A1: ...`)；Dependency tags (`Evolved from/Blocked by/Related`)；## Risk

