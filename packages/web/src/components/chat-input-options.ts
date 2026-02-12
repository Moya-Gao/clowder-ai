export const CAT_OPTIONS = [
  { id: 'opus', label: '@\u5E03\u5076\u732B', desc: 'Opus \u00B7 \u67B6\u6784 & \u5F00\u53D1', insert: '@\u5E03\u5076 ', color: 'text-opus-primary' },
  { id: 'codex', label: '@\u7F05\u56E0\u732B', desc: 'Codex \u00B7 \u5BA1\u67E5 & \u6D4B\u8BD5', insert: '@\u7F05\u56E0 ', color: 'text-codex-primary' },
  { id: 'gemini', label: '@\u6684\u7F57\u732B', desc: 'Gemini \u00B7 \u8BBE\u8BA1 & \u521B\u610F', insert: '@\u6684\u7F57 ', color: 'text-gemini-primary' },
] as const;

export const MODE_OPTIONS = [
  { id: 'brainstorm', icon: '\u{1F9E0}', label: '\u5934\u8111\u98CE\u66B4', desc: '/mode brainstorm <\u8BAE\u9898> @\u732B', insert: '/mode brainstorm ' },
  { id: 'debate', icon: '\u2694\uFE0F', label: '\u8FA9\u8BBA', desc: '/mode debate <\u8BAE\u9898> @A @B', insert: '/mode debate ' },
  { id: 'dev-loop', icon: '\uD83D\uDD04', label: '\u5F00\u53D1\u81EA\u95ED\u73AF', desc: '/mode dev-loop @\u5F00\u53D1\u732B @review\u732B <\u9700\u6C42>', insert: '/mode dev-loop ' },
  { id: 'end', icon: '\u23F9', label: '\u7ED3\u675F\u6A21\u5F0F', desc: '/mode end [\u7ED3\u8BBA]', insert: '/mode end ' },
  { id: 'status', icon: '\u{1F4CB}', label: '\u67E5\u770B\u72B6\u6001', desc: '/mode status', insert: '/mode status' },
] as const;

export type CatOption = typeof CAT_OPTIONS[number];
export type ModeOption = typeof MODE_OPTIONS[number];

/** Pure detection — returns menu trigger type from current input, or null. */
export function detectMenuTrigger(val: string, selectionStart: number):
  | { type: 'mode' }
  | { type: 'mention'; start: number }
  | null {
  const trimmed = val.trimStart();
  if (/^\/m(o(d(e( .*)?)?)?)?$/i.test(trimmed) && trimmed.length <= 6) {
    return { type: 'mode' };
  }
  const textBefore = val.slice(0, selectionStart);
  const atIdx = textBefore.lastIndexOf('@');
  if (atIdx >= 0) {
    const fragment = textBefore.slice(atIdx + 1);
    const charBefore = atIdx > 0 ? val[atIdx - 1] : ' ';
    if (/\s/.test(charBefore!) && fragment.length <= 4 && !/\s/.test(fragment)) {
      return { type: 'mention', start: atIdx };
    }
  }
  return null;
}
