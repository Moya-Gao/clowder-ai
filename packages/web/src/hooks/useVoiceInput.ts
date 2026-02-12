'use client';

import { useState, useCallback, useRef } from 'react';
import { correctTranscription } from '@/utils/transcription-corrector';

const WHISPER_URL = process.env.NEXT_PUBLIC_WHISPER_URL || 'http://localhost:9876';

const INITIAL_PROMPT =
  'Cat Cafe 项目对话。常见术语：MCP, Redis, Fastify, Whisper, worktree, ' +
  'rebase, InvocationRecord, Hindsight, 布偶猫, 缅因猫, 暹罗猫, NDJSON, ' +
  'Zustand, TypeScript, WebSocket, Codex, Gemini, Claude, API, CLI, ' +
  'Opus, ADR, Lua, CAS, 宪宪, 砚砚';

/** Minimum recording duration (ms) to avoid accidental taps. */
const MIN_RECORDING_MS = 500;

export type VoiceState = 'idle' | 'recording' | 'transcribing';

export function useVoiceInput() {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let recorder: MediaRecorder;
      try {
        const preferredMime = 'audio/webm;codecs=opus';
        const mimeType = MediaRecorder.isTypeSupported(preferredMime)
          ? preferredMime
          : undefined;
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      } catch (recErr) {
        stream.getTracks().forEach((t) => t.stop());
        throw recErr;
      }
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener('dataavailable', (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener('stop', async () => {
        // Release mic immediately
        stream.getTracks().forEach((t) => t.stop());

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Ignore accidental taps shorter than MIN_RECORDING_MS
        if (Date.now() - startTimeRef.current < MIN_RECORDING_MS) {
          setState('idle');
          return;
        }

        setState('transcribing');

        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('initial_prompt', INITIAL_PROMPT);
          formData.append('language', 'zh');

          const res = await fetch(`${WHISPER_URL}/v1/audio/transcriptions`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error(`Whisper service error: ${res.status}`);

          const data: { text?: string } = await res.json();
          const raw = data.text || '';
          const corrected = correctTranscription(raw);
          setTranscript(corrected);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Transcription failed',
          );
        } finally {
          setState('idle');
        }
      });

      recorder.start();
      startTimeRef.current = Date.now();
      setState('recording');

      timerRef.current = setInterval(() => {
        setDuration(
          Math.floor((Date.now() - startTimeRef.current) / 1000),
        );
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Microphone access denied',
      );
      setState('idle');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { state, transcript, error, duration, startRecording, stopRecording };
}
