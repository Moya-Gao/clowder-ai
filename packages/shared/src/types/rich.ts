/**
 * F22: Rich Blocks 富消息系统 — 类型定义
 *
 * 富块是派生的交互组件（card / diff / checklist / media_gallery），
 * 与 contentBlocks（LLM 原始输出）语义不同，存储在 extra.rich 中。
 */

// ── Block Kinds ─────────────────────────────────────────────

export type RichBlockKind = 'card' | 'diff' | 'checklist' | 'media_gallery';

// ── Base ────────────────────────────────────────────────────

export interface RichBlockBase {
  /** Message-local stable id (e.g. "b1") */
  id: string;
  kind: RichBlockKind;
  /** Schema version — always 1 for now */
  v: 1;
}

// ── Concrete Blocks ─────────────────────────────────────────

export interface RichCardBlock extends RichBlockBase {
  kind: 'card';
  title: string;
  bodyMarkdown?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  fields?: Array<{ label: string; value: string }>;
}

export interface RichDiffBlock extends RichBlockBase {
  kind: 'diff';
  filePath: string;
  /** Unified diff text */
  diff: string;
  languageHint?: string;
}

export interface RichChecklistBlock extends RichBlockBase {
  kind: 'checklist';
  title?: string;
  items: Array<{ id: string; text: string; checked?: boolean }>;
}

export interface RichMediaGalleryBlock extends RichBlockBase {
  kind: 'media_gallery';
  title?: string;
  items: Array<{ url: string; alt?: string; caption?: string }>;
}

// ── Union ───────────────────────────────────────────────────

export type RichBlock =
  | RichCardBlock
  | RichDiffBlock
  | RichChecklistBlock
  | RichMediaGalleryBlock;

// ── Container (stored in StoredMessage.extra.rich) ──────────

export interface RichMessageExtra {
  v: 1;
  blocks: RichBlock[];
}
