/**
 * Cat Agent Services
 * 导出所有 Agent 服务
 */

export { ClaudeAgentService } from './agents/providers/ClaudeAgentService.js';
export { CodexAgentService } from './agents/providers/CodexAgentService.js';
export { GeminiAgentService } from './agents/providers/GeminiAgentService.js';
export { DareAgentService } from './agents/providers/DareAgentService.js';
export { OpenCodeAgentService } from './agents/providers/OpenCodeAgentService.js';
export { AgentRouter } from './agents/routing/AgentRouter.js';
export type { AgentRouterOptions } from './agents/routing/AgentRouter.js';
export { AgentRegistry } from './agents/registry/AgentRegistry.js';
export { invokeSingleCat } from './agents/invocation/invoke-single-cat.js';
export type { InvocationDeps, InvocationParams } from './agents/invocation/invoke-single-cat.js';
export { InvocationRegistry } from './agents/invocation/InvocationRegistry.js';
export { InvocationTracker } from './agents/invocation/InvocationTracker.js';
export { MessageStore } from './stores/ports/MessageStore.js';
export type { AppendMessageInput, IMessageStore, StoredMessage } from './stores/ports/MessageStore.js';
export { DeliveryCursorStore } from './stores/ports/DeliveryCursorStore.js';
export { RedisMessageStore } from './stores/redis/RedisMessageStore.js';
export { createMessageStore } from './stores/factories/MessageStoreFactory.js';
export type { AnyMessageStore } from './stores/factories/MessageStoreFactory.js';
export { ThreadStore, DEFAULT_THREAD_ID } from './stores/ports/ThreadStore.js';
export type { Thread, IThreadStore } from './stores/ports/ThreadStore.js';
export { RedisThreadStore } from './stores/redis/RedisThreadStore.js';
export { createThreadStore } from './stores/factories/ThreadStoreFactory.js';
export { TaskStore } from './stores/ports/TaskStore.js';
export type { ITaskStore } from './stores/ports/TaskStore.js';
export { RedisTaskStore } from './stores/redis/RedisTaskStore.js';
export { createTaskStore } from './stores/factories/TaskStoreFactory.js';
export { SummaryStore } from './stores/ports/SummaryStore.js';
export type { ISummaryStore } from './stores/ports/SummaryStore.js';
export { RedisSummaryStore } from './stores/redis/RedisSummaryStore.js';
export { createSummaryStore } from './stores/factories/SummaryStoreFactory.js';
export { DraftStore } from './stores/ports/DraftStore.js';
export type { IDraftStore, DraftRecord } from './stores/ports/DraftStore.js';
export { RedisDraftStore } from './stores/redis/RedisDraftStore.js';
export { createDraftStore } from './stores/factories/DraftStoreFactory.js';
export { routeSerial } from './agents/routing/route-serial.js';
export { routeParallel } from './agents/routing/route-parallel.js';
export { needsMcpInjection, buildMcpCallbackInstructions } from './agents/invocation/McpPromptInjector.js';
export type { RouteStrategyDeps, RouteOptions, PersistenceContext } from './agents/routing/route-helpers.js';
export { assembleContext, formatMessage } from './context/ContextAssembler.js';
export type { AssembledContext, ContextAssemblerOptions } from './context/ContextAssembler.js';
export { buildStaticIdentity, buildInvocationContext, buildSystemPrompt } from './context/SystemPromptBuilder.js';
export type { InvocationContext } from './context/SystemPromptBuilder.js';
export { parseIntent, stripIntentTags } from './context/IntentParser.js';
export type { Intent, IntentResult } from './context/IntentParser.js';
export { EventAuditLog, AuditEventTypes, getEventAuditLog } from './orchestration/EventAuditLog.js';
export type { AuditEvent, AuditEventInput } from './orchestration/EventAuditLog.js';
export { HindsightClient, HindsightError, createHindsightClient } from './orchestration/HindsightClient.js';
export type { IHindsightClient, HindsightMemory, RecallOptions, RetainItem, RetainOptions } from './orchestration/HindsightClient.js';
export { MemoryGovernanceStore, GovernanceConflictError, resolveTransition } from './stores/ports/MemoryGovernanceStore.js';
export type { GovernanceStatus, PublishAction, GovernanceEntry, IMemoryGovernanceStore } from './stores/ports/MemoryGovernanceStore.js';
export { InvocationRecordStore } from './stores/ports/InvocationRecordStore.js';
export type { InvocationRecord, InvocationStatus, IInvocationRecordStore, CreateInvocationInput, CreateResult, UpdateInvocationInput } from './stores/ports/InvocationRecordStore.js';
export { RedisInvocationRecordStore } from './stores/redis/RedisInvocationRecordStore.js';
export { isValidTransition, getAllowedTransitions, TERMINAL_STATES, ALL_STATUSES } from './stores/ports/invocation-state-machine.js';
export { createInvocationRecordStore } from './stores/factories/InvocationRecordStoreFactory.js';
export type { AnyInvocationRecordStore } from './stores/factories/InvocationRecordStoreFactory.js';
export { RedisAuthorizationRuleStore } from './stores/redis/RedisAuthorizationRuleStore.js';
export { createAuthorizationRuleStore } from './stores/factories/AuthorizationRuleStoreFactory.js';
export { RedisPendingRequestStore } from './stores/redis/RedisPendingRequestStore.js';
export { createPendingRequestStore } from './stores/factories/PendingRequestStoreFactory.js';
export { RedisAuthorizationAuditStore } from './stores/redis/RedisAuthorizationAuditStore.js';
export { createAuthorizationAuditStore } from './stores/factories/AuthorizationAuditStoreFactory.js';

export { SessionChainStore } from './stores/ports/SessionChainStore.js';
export type { ISessionChainStore, CreateSessionInput, SessionRecordPatch } from './stores/ports/SessionChainStore.js';
export { RedisSessionChainStore } from './stores/redis/RedisSessionChainStore.js';
export { createSessionChainStore } from './stores/factories/SessionChainStoreFactory.js';
export type { AnySessionChainStore } from './stores/factories/SessionChainStoreFactory.js';
// Game engine (F101)
export { GameEngine } from './game/GameEngine.js';
export { GameViewBuilder } from './game/GameViewBuilder.js';
export { GameOrchestrator } from './game/GameOrchestrator.js';
export type { GameOrchestratorDeps, StartGameInput } from './game/GameOrchestrator.js';
export type { IGameStore } from './stores/ports/GameStore.js';
export { RedisGameStore } from './stores/redis/RedisGameStore.js';
export { GameStatsRecorder } from './game/GameStatsRecorder.js';
export type { GameStats, PlayerStats } from './game/GameStatsRecorder.js';
// Werewolf (F101 Phase B)
export { WerewolfEngine } from './game/werewolf/WerewolfEngine.js';
export { WerewolfLobby } from './game/werewolf/WerewolfLobby.js';
export { WerewolfAIPlayer } from './game/werewolf/WerewolfAIPlayer.js';
export type { AIProvider } from './game/werewolf/WerewolfAIPlayer.js';
export { createWerewolfDefinition, WEREWOLF_PRESETS } from './game/werewolf/WerewolfDefinition.js';
export { buildWerewolfPrompt } from './game/werewolf/werewolf-prompts.js';

export * from './types.js';
