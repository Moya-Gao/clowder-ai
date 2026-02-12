'use client';

import { type RefObject } from 'react';
import { CAT_OPTIONS, MODE_OPTIONS, type CatOption } from './chat-input-options';

interface ChatInputMenusProps {
  showMentions: boolean;
  showModeMenu: boolean;
  selectedIdx: number;
  onSelectIdx: (i: number) => void;
  onInsertMention: (opt: CatOption) => void;
  onInsertOption: (text: string) => void;
  menuRef: RefObject<HTMLDivElement | null>;
}

export function ChatInputMenus({
  showMentions, showModeMenu, selectedIdx,
  onSelectIdx, onInsertMention, onInsertOption, menuRef,
}: ChatInputMenusProps) {
  return (
    <>
      {showMentions && (
        <div ref={menuRef} className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-64 z-10">
          {CAT_OPTIONS.map((opt, i) => (
            <button key={opt.id} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${i === selectedIdx ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => onSelectIdx(i)} onMouseDown={(e) => { e.preventDefault(); onInsertMention(opt); }}>
              <img src={`/avatars/${opt.id}.png`} alt={opt.label} className="w-7 h-7 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <div className={`text-sm font-semibold ${opt.color}`}>{opt.label}</div>
                <div className="text-xs text-gray-400">{opt.desc}</div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-xs text-gray-300 border-t border-gray-100">{'\u2191\u2193 \u9009\u62E9 \u00B7 Enter \u786E\u8BA4 \u00B7 Esc \u5173\u95ED'}</div>
        </div>
      )}

      {showModeMenu && (
        <div ref={menuRef} className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-72 z-10">
          {MODE_OPTIONS.map((opt, i) => (
            <button key={opt.id} className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${i === selectedIdx ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => onSelectIdx(i)} onMouseDown={(e) => { e.preventDefault(); onInsertOption(opt.insert); }}>
              <span className="text-lg w-7 text-center">{opt.icon}</span>
              <div>
                <div className="text-sm font-semibold text-gray-700">{opt.label}</div>
                <div className="text-xs text-gray-400 font-mono">{opt.desc}</div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-xs text-gray-300 border-t border-gray-100">{'\u2191\u2193 \u9009\u62E9 \u00B7 Enter \u786E\u8BA4 \u00B7 Esc \u5173\u95ED'}</div>
        </div>
      )}
    </>
  );
}
