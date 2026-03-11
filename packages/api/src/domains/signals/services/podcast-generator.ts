import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StudyArtifact } from '@cat-cafe/shared';
import { StudyMetaService } from './study-meta-service.js';

export interface PodcastSegment {
  readonly speaker: string;
  readonly text: string;
  readonly durationEstimate: number;
}

export interface PodcastScript {
  readonly mode: 'essence' | 'deep';
  readonly segments: readonly PodcastSegment[];
  readonly totalDuration: number;
}

export interface PodcastRequest {
  readonly articleId: string;
  readonly articleFilePath: string;
  readonly articleTitle: string;
  readonly articleContent: string;
  readonly mode: 'essence' | 'deep';
  readonly requestedBy: string;
}

/**
 * Generates a podcast script from article content.
 *
 * Essence mode: 2-3 minute overview with 2 speakers.
 * Deep mode: 10 minute deep dive with 3 speakers.
 *
 * NOTE: TTS synthesis is not yet implemented.
 * This creates the script and stores it as a JSON artifact.
 */
export async function generatePodcastScript(request: PodcastRequest): Promise<StudyArtifact> {
  const studyMeta = new StudyMetaService();
  const artifactId = `podcast-${request.mode}-${Date.now()}`;

  // Register artifact as queued
  await studyMeta.addArtifact(request.articleId, request.articleFilePath, {
    id: artifactId,
    kind: 'podcast',
    createdAt: new Date().toISOString(),
    createdBy: request.requestedBy,
    state: 'queued',
    filePath: '',
  });

  try {
    // Generate script (placeholder — real implementation would call LLM)
    const script: PodcastScript = {
      mode: request.mode,
      segments: [
        {
          speaker: '宪宪',
          text: `今天我们来聊聊「${request.articleTitle}」这篇文章。`,
          durationEstimate: 5,
        },
        {
          speaker: '砚砚',
          text: `嗯，这篇文章主要讲了...`,
          durationEstimate: 10,
        },
      ],
      totalDuration: 15,
    };

    // Store script in sidecar directory
    const podcastDir = await studyMeta.ensureSubDir(request.articleFilePath, 'podcasts');
    const scriptPath = join(podcastDir, `${artifactId}.json`);
    await writeFile(scriptPath, JSON.stringify(script, null, 2), 'utf-8');

    // Update artifact state to ready + persist filePath
    const meta = await studyMeta.updateArtifactState(
      request.articleId,
      request.articleFilePath,
      artifactId,
      'ready',
      scriptPath,
    );

    const artifact = meta.artifacts.find((a) => a.id === artifactId);
    if (!artifact) throw new Error('Artifact not found after creation');
    return { ...artifact, filePath: scriptPath };
  } catch (error) {
    await studyMeta.updateArtifactState(request.articleId, request.articleFilePath, artifactId, 'failed');
    throw error;
  }
}
