'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'cat-cafe-voice-settings';

export interface CustomTerm {
  from: string;
  to: string;
}

export interface VoiceSettings {
  customTerms: CustomTerm[];
  customPrompt: string | null; // null = use default
  language: 'zh' | 'en' | '';  // '' = auto-detect
}

const DEFAULT_SETTINGS: VoiceSettings = {
  customTerms: [],
  customPrompt: null,
  language: 'zh',
};

function loadFromStorage(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveToStorage(settings: VoiceSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

interface VoiceSettingsState {
  settings: VoiceSettings;

  addTerm: (from: string, to: string) => void;
  removeTerm: (index: number) => void;
  updateTerm: (index: number, from: string, to: string) => void;
  setCustomPrompt: (prompt: string | null) => void;
  setLanguage: (language: VoiceSettings['language']) => void;
  resetAll: () => void;
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set) => ({
  settings: loadFromStorage(),

  addTerm: (from, to) =>
    set((state) => {
      const next = {
        ...state.settings,
        customTerms: [...state.settings.customTerms, { from, to }],
      };
      saveToStorage(next);
      return { settings: next };
    }),

  removeTerm: (index) =>
    set((state) => {
      const next = {
        ...state.settings,
        customTerms: state.settings.customTerms.filter((_, i) => i !== index),
      };
      saveToStorage(next);
      return { settings: next };
    }),

  updateTerm: (index, from, to) =>
    set((state) => {
      const terms = [...state.settings.customTerms];
      terms[index] = { from, to };
      const next = { ...state.settings, customTerms: terms };
      saveToStorage(next);
      return { settings: next };
    }),

  setCustomPrompt: (prompt) =>
    set((state) => {
      const next = { ...state.settings, customPrompt: prompt };
      saveToStorage(next);
      return { settings: next };
    }),

  setLanguage: (language) =>
    set((state) => {
      const next = { ...state.settings, language };
      saveToStorage(next);
      return { settings: next };
    }),

  resetAll: () => {
    saveToStorage(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));
