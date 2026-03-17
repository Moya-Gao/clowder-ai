import type { VoiceChunkEvent, VoiceStreamEndEvent, VoiceStreamStartEvent } from '@cat-cafe/shared';

export type PlaybackManagerState = 'idle' | 'playing' | 'paused';

export interface PlaybackManagerCallbacks {
  onStateChange: (state: PlaybackManagerState) => void;
}

let domAudio: HTMLAudioElement | null = null;

function getDomAudio(): HTMLAudioElement {
  if (domAudio) return domAudio;
  const el = document.createElement('audio');
  el.id = 'voice-stream-audio';
  el.style.display = 'none';
  el.preload = 'auto';
  document.body.appendChild(el);
  domAudio = el;
  return el;
}

export class PlaybackManager {
  private queue: string[] = [];
  private blobUrls: string[] = [];
  private state: PlaybackManagerState = 'idle';
  private activeInvocationId: string | null = null;
  private streamDone = false;
  private firstChunkPlayed = false;
  private callbacks: PlaybackManagerCallbacks;

  constructor(callbacks: PlaybackManagerCallbacks) {
    this.callbacks = callbacks;
  }

  handleStreamStart(event: VoiceStreamStartEvent): void {
    if (this.activeInvocationId && this.activeInvocationId !== event.invocationId) {
      this.interrupt();
    }
    this.activeInvocationId = event.invocationId;
    this.streamDone = false;
    this.firstChunkPlayed = false;
  }

  handleChunk(event: VoiceChunkEvent): void {
    if (event.invocationId !== this.activeInvocationId) return;

    const mimeType = event.format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const binary = atob(event.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrls.push(blobUrl);

    if (!this.firstChunkPlayed && this.state !== 'paused') {
      this.firstChunkPlayed = true;
      this.playUrl(blobUrl);
    } else if (this.state === 'idle') {
      this.playUrl(blobUrl);
    } else {
      this.queue.push(blobUrl);
      const audio = getDomAudio();
      if (audio.ended && this.state === 'playing') {
        this.playNext();
      }
    }
  }

  handleStreamEnd(event: VoiceStreamEndEvent): void {
    if (event.invocationId !== this.activeInvocationId) return;
    this.streamDone = true;

    if (event.totalChunks === -1) {
      this.interrupt();
      return;
    }

    const audio = getDomAudio();
    if (this.queue.length === 0 && (!this.firstChunkPlayed || audio.ended)) {
      this.setState('idle');
    }
  }

  pause(): void {
    if (this.state !== 'playing') return;
    const audio = getDomAudio();
    audio.pause();
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    const audio = getDomAudio();
    if (audio.src) {
      audio.play().catch(() => this.setState('idle'));
      this.setState('playing');
    } else if (this.queue.length > 0) {
      this.playNext();
    } else {
      this.setState('idle');
    }
  }

  skip(): void {
    const audio = getDomAudio();
    audio.pause();
    audio.removeAttribute('src');
    audio.onended = null;
    if (this.queue.length > 0) {
      this.playNext();
    } else if (this.streamDone) {
      this.setState('idle');
    } else {
      // Stream still going, no next chunk yet — enter idle to wait.
      // handleChunk() will auto-resume when a new chunk arrives.
      this.setState('idle');
    }
  }

  interrupt(): void {
    const audio = getDomAudio();
    audio.pause();
    audio.removeAttribute('src');
    audio.onended = null;
    audio.onerror = null;
    this.queue = [];
    this.cleanupBlobUrls();
    this.activeInvocationId = null;
    this.streamDone = false;
    this.firstChunkPlayed = false;
    this.setState('idle');
  }

  destroy(): void {
    this.interrupt();
  }

  getState(): PlaybackManagerState {
    return this.state;
  }

  getActiveInvocationId(): string | null {
    return this.activeInvocationId;
  }

  private playUrl(url: string): void {
    const audio = getDomAudio();
    audio.src = url;
    audio.onended = () => this.playNext();
    audio.onerror = () => {
      console.error('[PlaybackManager] Audio playback error');
      this.playNext();
    };
    this.setState('playing');
    audio.play().catch(() => {
      console.error('[PlaybackManager] play() rejected');
      this.setState('idle');
    });
  }

  private playNext(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.playUrl(next);
    } else if (this.streamDone) {
      this.setState('idle');
    }
  }

  private setState(newState: PlaybackManagerState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  private cleanupBlobUrls(): void {
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls = [];
  }
}
