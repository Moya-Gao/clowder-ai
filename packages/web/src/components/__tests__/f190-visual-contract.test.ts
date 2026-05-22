// @vitest-environment node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
function readSrc(relativePath: string): string {
  return readFileSync(resolve(testDir, '..', relativePath), 'utf8');
}

describe('F190 visual contract — no hard borders in card/panel components', () => {
  it('SessionChainPanel uses settingsResourceCardClass, not border-[var(--console-border-soft)]', () => {
    const src = readSrc('SessionChainPanel.tsx');
    expect(src).toContain('settingsResourceCardClass');
    expect(src).not.toMatch(/className="rounded-lg border border-\[var\(--console-border-soft\)\]/);
  });

  it('AuditExplorerPanel uses settingsResourceCardClass, not border-[var(--console-border-soft)]', () => {
    const src = readSrc('audit/AuditExplorerPanel.tsx');
    expect(src).toContain('settingsResourceCardClass');
    expect(src).not.toMatch(/className="rounded-lg border border-\[var\(--console-border-soft\)\]/);
  });

  it('ChatMessage bubble has no literal border class or borderColor style', () => {
    const src = readSrc('ChatMessage.tsx');
    expect(src).not.toMatch(/className=\{`border px-4/);
    expect(src).not.toContain('borderColor: catStyle.borderColor');
  });

  it('SectionCard uses rounded-[18px] shadow, not rounded-2xl border', () => {
    const src = readSrc('hub-cat-editor-fields.tsx');
    expect(src).toMatch(/rounded-\[18px\].*p-\[18px\]/);
    expect(src).not.toMatch(/className=\{`rounded-2xl border p-\[18px\]/);
  });

  it('editor inputs use rounded-[10px] border-transparent, not rounded-xl border-[var(--console-border-soft)]', () => {
    const src = readSrc('hub-cat-editor-fields.tsx');
    expect(src).toContain('rounded-[10px]');
    expect(src).toContain('border-transparent');
    expect(src).not.toMatch(/rounded-xl border.*border-\[var\(--console-border-soft\)\].*bg-\[var\(--console-card-bg\)\]/);
  });

  it('PersistenceBanner uses shadow, not field-persist-border', () => {
    const src = readSrc('hub-cat-editor-fields.tsx');
    expect(src).not.toContain('field-persist-border');
    expect(src).toMatch(/PersistenceBanner[\s\S]*?shadow-\[0_8px_22px/);
  });

  it('VoiceConfigSection uses shadow, not dashed border', () => {
    const src = readSrc('hub-cat-editor-voice.tsx');
    expect(src).not.toMatch(/border-dashed/);
    expect(src).toMatch(/rounded-\[18px\].*shadow-\[0_8px_22px/);
  });

  it('SessionChainPanel active/sealed cards use console-list-card shadow, not border+borderColor style', () => {
    const src = readSrc('SessionChainPanel.tsx');
    expect(src).toMatch(/data-testid="session-card-active"[\s\S]*?console-list-card/);
    expect(src).toMatch(/data-testid="session-card-sealed"[\s\S]*?console-list-card/);
    expect(src).not.toMatch(/border-\[1\.5px\]/);
    expect(src).not.toContain('borderColor:');
  });

  it('SettingsShell nav uses --console-panel-bg, not border-r', () => {
    const src = readSrc('settings/SettingsShell.tsx');
    expect(src).toContain('bg-[var(--console-panel-bg)]');
    expect(src).not.toMatch(/md:border-r/);
  });

  it('DefaultCatSelector uses console-card-bg shadow, not border-cafe', () => {
    const src = readSrc('DefaultCatSelector.tsx');
    expect(src).toContain('bg-[var(--console-card-bg)]');
    expect(src).toContain('shadow-[0_12px_30px_rgba(43,33,26,0.08)]');
    expect(src).not.toMatch(/border border-cafe bg-cafe-surface/);
  });

  it('BrakeSettingsPanel uses console-list-card shadow, not border-cafe', () => {
    const src = readSrc('BrakeSettingsPanel.tsx');
    expect(src).toContain('console-list-card');
    expect(src).toContain('shadow-[0_8px_22px_rgba(43,33,26,0.04)]');
    expect(src).not.toMatch(/border border-cafe bg-cafe-surface-elevated/);
    expect(src).not.toMatch(/border border-indigo-100/);
  });

  it('HubToolUsageTab selects use border-transparent, sections use shadow not border', () => {
    const src = readSrc('HubToolUsageTab.tsx');
    expect(src).not.toMatch(/border border-\[var\(--hub-border\)\]/);
    expect(src).not.toMatch(/border-dashed/);
  });

  it('HubConnectorConfigTab uses explicit shadow, not --hub-shadow var', () => {
    const src = readSrc('HubConnectorConfigTab.tsx');
    expect(src).not.toContain('var(--hub-shadow)');
    expect(src).toContain('shadow-[0_12px_30px_rgba(43,33,26,0.08)]');
  });

  it('SignalInboxView title is text-2xl, list pane has no border-r', () => {
    const src = readSrc('signals/SignalInboxView.tsx');
    expect(src).toMatch(/text-2xl font-bold/);
    expect(src).not.toMatch(/border-r border-\[var\(--console-border-soft\)\]/);
  });

  it('SignalSourcesView title is "信号源" text-2xl', () => {
    const src = readSrc('signals/SignalSourcesView.tsx');
    expect(src).toContain('text-2xl font-bold');
    expect(src).toMatch(/>信号源</);
  });

  it('ResizeHandle has no accent hover/drag colors, keeps cursor-col-resize', () => {
    const src = readSrc('workspace/ResizeHandle.tsx');
    expect(src).not.toContain('cafe-accent');
    expect(src).not.toContain('console-hover-bg');
    expect(src).not.toContain('console-active-bg');
    expect(src).toContain('cursor-col-resize');
    expect(src).toContain('cursor-row-resize');
    expect(src).toContain('console-border-soft');
  });
});
