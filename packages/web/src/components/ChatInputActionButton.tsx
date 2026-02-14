'use client';

import { useEffect } from 'react';
import { SendIcon } from './icons/SendIcon';
import { LoadingIcon } from './icons/LoadingIcon';
import { MicIcon } from './icons/MicIcon';
import { StopRecordingIcon } from './icons/StopRecordingIcon';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface ChatInputActionButtonProps {
  onTranscript: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  sendDisabled?: boolean;
  /** Whether the thread has an active invocation (broader than disabled/isLoading) */
  hasActiveInvocation?: boolean;
  hasText: boolean;
}

/** Renders the 5-state action button (stop generation / stop recording / transcribing / send / mic)
 *  plus voice recording status overlays (REC badge, error).
 *  Keyboard shortcut: Option+V toggles recording. */
export function ChatInputActionButton({
  onTranscript,
  onSend,
  onStop,
  disabled,
  sendDisabled,
  hasActiveInvocation,
  hasText,
}: ChatInputActionButtonProps) {
  const voice = useVoiceInput();
  const isSendDisabled = Boolean(disabled || sendDisabled);

  useEffect(() => {
    if (voice.transcript) onTranscript(voice.transcript);
  }, [voice.transcript, onTranscript]);

  // Global keyboard shortcut: Option+V (Alt+V) toggles voice recording
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        if (voice.state === 'recording') {
          voice.stopRecording();
        } else if (voice.state === 'idle' && !disabled) {
          voice.startRecording();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [voice.state, voice.startRecording, voice.stopRecording, disabled]);

  return (
    <>
      {/* Voice recording status (absolute, attaches to ancestor .relative) */}
      {voice.state === 'recording' && (
        <div className="absolute top-0 right-4 -mt-6 flex items-center gap-2">
          {voice.partialTranscript && (
            <div className="px-2 py-0.5 bg-gray-800 text-white text-xs rounded-lg max-w-[240px] truncate opacity-80">
              {voice.partialTranscript}
            </div>
          )}
          <div className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse whitespace-nowrap">
            REC {Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, '0')}
          </div>
        </div>
      )}
      {voice.error && (
        <div className="absolute top-0 left-4 -mt-6 px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg">
          {voice.error}
        </div>
      )}

      {/* 5-state action button */}
      {(disabled || hasActiveInvocation) && onStop ? (
        <button onClick={() => onStop()} className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors" aria-label="Stop generation">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="4" width="12" height="12" rx="2" /></svg>
        </button>
      ) : voice.state === 'recording' ? (
        <button onClick={voice.stopRecording}
          className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors animate-pulse"
          aria-label="Stop recording">
          <StopRecordingIcon className="w-5 h-5" />
        </button>
      ) : voice.state === 'transcribing' ? (
        <button disabled className="p-3 rounded-xl bg-gray-300 text-white cursor-wait" aria-label="Transcribing">
          <LoadingIcon className="w-5 h-5" />
        </button>
      ) : hasText ? (
        <button onClick={onSend} disabled={isSendDisabled}
          className="p-3 rounded-xl bg-owner-primary text-white hover:bg-owner-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Send message">
          <SendIcon className="w-5 h-5" />
        </button>
      ) : (
        <button onClick={voice.startRecording} disabled={disabled}
          className="p-3 rounded-xl text-gray-400 hover:text-owner-primary hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Start voice input (⌥V)" title="语音输入 (⌥V)">
          <MicIcon className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
