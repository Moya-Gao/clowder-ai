import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CatId, StudyArtifact } from '@cat-cafe/shared';
import type { AgentRouter } from '../../cats/services/agents/routing/AgentRouter.js';
import type { InvocationTracker } from '../../cats/services/index.js';
import { ClaudeAgentService } from '../../cats/services/agents/providers/ClaudeAgentService.js';
import type { AnyMessageStore } from '../../cats/services/stores/factories/MessageStoreFactory.js';
import type { IInvocationRecordStore } from '../../cats/services/stores/ports/InvocationRecordStore.js';
import { getVoiceBlockSynthesizer } from '../../cats/services/tts/VoiceBlockSynthesizer.js';
import { StudyMetaService } from './study-meta-service.js';

export interface PodcastSegment {
  readonly speaker: string;
  readonly text: string;
  readonly durationEstimate: number;
  readonly audioUrl?: string;
}

export interface PodcastScript {
  readonly mode: 'essence' | 'deep';
  readonly segments: readonly PodcastSegment[];
  readonly totalDuration: number;
}

/** Dependencies for invoking a cat via the existing message pipeline. */
export interface ThreadInvokeDeps {
  readonly messageStore: AnyMessageStore;
  readonly router: AgentRouter;
  readonly invocationRecordStore: IInvocationRecordStore;
  readonly invocationTracker: InvocationTracker;
}

export interface PodcastRequest {
  readonly articleId: string;
  readonly articleFilePath: string;
  readonly articleTitle: string;
  readonly articleContent: string;
  readonly mode: 'essence' | 'deep';
  readonly requestedBy: string;
  readonly threadContext?: string | undefined;
  /** AC-P6-1/P6-2: Thread-based generation (reuses existing study thread). */
  readonly threadId?: string;
  readonly threadDeps?: ThreadInvokeDeps;
}

const ESSENCE_SEGMENT_RANGE = { min: 5, max: 8 };
const DEEP_SEGMENT_RANGE = { min: 15, max: 25 };

function buildScriptPrompt(request: PodcastRequest): string {
  const range = request.mode === 'essence' ? ESSENCE_SEGMENT_RANGE : DEEP_SEGMENT_RANGE;
  const duration = request.mode === 'essence' ? '2-3 分钟' : '10 分钟';

  return `你是一个播客脚本生成器。请根据以下文章生成一段两人对话播客脚本。

## 要求
- 模式: ${request.mode === 'essence' ? '精华版' : '深度版'}（${duration}）
- 段落数: ${range.min}-${range.max} 段
- 说话人: 宪宪（主持，布偶猫）和 砚砚（嘉宾，缅因猫）
- 风格: 自然对话，像两只猫在讨论文章。不要太正式，要有互动感。
- 每段 durationEstimate 用秒（根据文字量估算，中文约 3 字/秒）
- 精华版：聚焦核心观点和 takeaway
- 深度版：深入讨论技术细节、实践经验、开放问题

## 文章
标题: ${request.articleTitle}
内容:
${request.articleContent.slice(0, 12000)}

## 输出格式（严格 JSON，不要 markdown 代码块）
{"segments":[{"speaker":"宪宪","text":"...","durationEstimate":5},{"speaker":"砚砚","text":"...","durationEstimate":8}],"totalDuration":120}${
    request.threadContext
      ? `\n\n## 之前的讨论上下文（可参考但不必全部覆盖）\n${request.threadContext.slice(0, 4000)}`
      : ''
  }`;
}

function parseScriptResponse(raw: string, mode: PodcastRequest['mode']): PodcastScript {
  // Extract JSON from response (might be wrapped in markdown code blocks)
  const jsonMatch = raw.match(/\{[\s\S]*"segments"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from LLM response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    segments: Array<{ speaker: string; text: string; durationEstimate: number }>;
    totalDuration: number;
  };

  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    throw new Error('LLM returned empty segments');
  }

  return {
    mode,
    segments: parsed.segments.map((s) => ({
      speaker: s.speaker,
      text: s.text,
      durationEstimate: s.durationEstimate ?? 5,
    })),
    totalDuration: parsed.totalDuration ?? parsed.segments.reduce((sum, s) => sum + (s.durationEstimate ?? 5), 0),
  };
}

/**
 * AC-P6: Generate script by posting a prompt into the study thread.
 * Reuses the existing message pipeline (same as GitHub/connector triggers).
 */
export async function generateScriptViaThread(
  request: PodcastRequest,
  threadId: string,
  deps: ThreadInvokeDeps,
): Promise<PodcastScript> {
  const prompt = buildScriptPrompt(request);
  const targetCats: CatId[] = ['opus' as CatId];

  // ① Write user message into thread
  const userMsg = await deps.messageStore.append({
    threadId,
    catId: null,
    content: prompt,
    userId: request.requestedBy,
    mentions: ['opus' as CatId],
    timestamp: Date.now(),
  });

  // ② Create invocation record
  const createResult = await deps.invocationRecordStore.create({
    threadId,
    userId: request.requestedBy,
    targetCats,
    intent: 'execute',
    idempotencyKey: `podcast-${request.articleId}-${Date.now()}`,
  });

  // ②b Backfill userMessageId so retry endpoint can find the trigger message
  await deps.invocationRecordStore.update(createResult.invocationId, {
    userMessageId: userMsg.id,
  });

  // ③ Track invocation
  const controller = deps.invocationTracker.start(threadId, request.requestedBy, targetCats);

  // ④ Route execution and collect text response
  const intent = { intent: 'execute' as const, explicit: false, promptTags: [] as string[] };
  let fullText = '';

  try {
    await deps.invocationRecordStore.update(createResult.invocationId, { status: 'running' });

    for await (const msg of deps.router.routeExecution(
      request.requestedBy, prompt, threadId, userMsg.id, targetCats, intent,
      { signal: controller.signal },
    )) {
      if (msg.type === 'text' && msg.content) {
        fullText += msg.content;
      }
    }

    await deps.invocationRecordStore.update(createResult.invocationId, { status: 'succeeded' });
  } catch (err) {
    await deps.invocationRecordStore.update(createResult.invocationId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    deps.invocationTracker.complete(threadId, controller);
  }

  return parseScriptResponse(fullText, request.mode);
}

async function generateScriptViaLLM(request: PodcastRequest): Promise<PodcastScript> {
  const agent = new ClaudeAgentService({
    model: 'claude-opus-4-5-20250514',
    mcpServerPath: '', // No MCP needed for script generation
  });

  const prompt = buildScriptPrompt(request);
  let fullText = '';

  for await (const msg of agent.invoke(prompt)) {
    if (msg.type === 'text' && msg.content) {
      fullText += msg.content;
    }
  }

  return parseScriptResponse(fullText, request.mode);
}

const SPEAKER_TO_CAT: Record<string, string> = {
  宪宪: 'opus',
  砚砚: 'codex',
};

async function synthesizeSegments(segments: readonly PodcastSegment[]): Promise<readonly PodcastSegment[]> {
  const synthesizer = getVoiceBlockSynthesizer();
  if (!synthesizer) {
    console.warn('[podcast] TTS not available, returning text-only script');
    return segments;
  }

  const results: PodcastSegment[] = [];
  for (const segment of segments) {
    const catId = SPEAKER_TO_CAT[segment.speaker] ?? 'opus';
    const blocks = await synthesizer.resolveVoiceBlocks(
      [
        {
          id: `seg-${results.length}`,
          kind: 'audio' as const,
          v: 1 as const,
          url: '',
          text: segment.text,
          speaker: catId,
        },
      ],
      catId,
    );
    const resolved = blocks[0];
    const audioUrl = resolved && 'url' in resolved && typeof resolved.url === 'string' ? resolved.url : undefined;
    results.push({ ...segment, ...(audioUrl ? { audioUrl } : {}) });
  }

  return results;
}

/**
 * Generates a podcast script from article content via LLM,
 * then synthesizes audio via TTS.
 *
 * Same article+mode replaces previous artifact (idempotent).
 */
export async function generatePodcastScript(request: PodcastRequest): Promise<StudyArtifact> {
  const studyMeta = new StudyMetaService();
  const artifactId = `podcast-${request.mode}-${Date.now()}`;
  const matchPrefix = `podcast-${request.mode}-`;

  // Register new artifact as queued WITHOUT replacing old one yet.
  // Old ready version stays intact until generation succeeds (P1-1 safety).
  await studyMeta.addArtifact(request.articleId, request.articleFilePath, {
    id: artifactId,
    kind: 'podcast',
    createdAt: new Date().toISOString(),
    createdBy: request.requestedBy,
    state: 'queued',
    filePath: '',
  });

  try {
    // Update to running
    await studyMeta.updateArtifactState(request.articleId, request.articleFilePath, artifactId, 'running');

    // Generate script: thread-based (P6) or standalone LLM fallback
    const script = request.threadId && request.threadDeps
      ? await generateScriptViaThread(request, request.threadId, request.threadDeps)
      : await generateScriptViaLLM(request);

    // Synthesize audio for each segment
    const segmentsWithAudio = await synthesizeSegments(script.segments);

    const finalScript: PodcastScript = {
      ...script,
      segments: segmentsWithAudio,
    };

    // Store script in sidecar directory
    const podcastDir = await studyMeta.ensureSubDir(request.articleFilePath, 'podcasts');
    const scriptPath = join(podcastDir, `${artifactId}.json`);
    await writeFile(scriptPath, JSON.stringify(finalScript, null, 2), 'utf-8');

    // Generation succeeded — now safe to replace old artifact + clean up files
    const { replaced } = await studyMeta.addOrReplaceArtifact(
      request.articleId,
      request.articleFilePath,
      {
        id: artifactId,
        kind: 'podcast',
        createdAt: new Date().toISOString(),
        createdBy: request.requestedBy,
        state: 'ready',
        filePath: scriptPath,
      },
      matchPrefix,
    );

    for (const old of replaced) {
      if (old.filePath && old.id !== artifactId) {
        unlink(old.filePath).catch(() => {
          /* file already gone */
        });
      }
    }

    const artifact =
      replaced.length > 0
        ? {
            id: artifactId,
            kind: 'podcast' as const,
            createdAt: new Date().toISOString(),
            createdBy: request.requestedBy,
            state: 'ready' as const,
            filePath: scriptPath,
          }
        : (await studyMeta.readMeta(request.articleId, request.articleFilePath)).artifacts.find(
            (a) => a.id === artifactId,
          );

    if (!artifact) throw new Error('Artifact not found after creation');
    return { ...artifact, filePath: scriptPath };
  } catch (error) {
    // Generation failed — remove the queued/running artifact, old ready version untouched
    await studyMeta.removeArtifact(request.articleId, request.articleFilePath, artifactId).catch(() => {});
    throw error;
  }
}
