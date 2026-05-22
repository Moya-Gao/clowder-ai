// @vitest-environment node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
function readSrc(relativePath: string): string {
  return readFileSync(resolve(testDir, '..', relativePath), 'utf8');
}

function collectSourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = resolve(root, entry);
    if (full.includes('/__tests__/')) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
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
    expect(src).not.toMatch(
      /rounded-xl border.*border-\[var\(--console-border-soft\)\].*bg-\[var\(--console-card-bg\)\]/,
    );
  });

  it('editor fields use console-runtime-* tokens, not field-success-*', () => {
    const src = readSrc('hub-cat-editor-fields.tsx');
    expect(src).not.toContain('field-success');
    expect(src).not.toContain('field-persist');
    expect(src).toContain('console-runtime-label');
    expect(src).toContain('console-runtime-field-bg');
    expect(src).toContain('console-persistence-bg');
  });

  it('PersistenceBanner uses console-persistence-bg, not field-persist-*', () => {
    const src = readSrc('hub-cat-editor-fields.tsx');
    expect(src).toMatch(/PersistenceBanner[\s\S]*?console-persistence-bg/);
    expect(src).toMatch(/PersistenceBanner[\s\S]*?shadow-\[0_6px_18px/);
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

  it('HubToolUsageTab uses console/cafe tokens, no hub-* CSS vars', () => {
    const src = readSrc('HubToolUsageTab.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('console-list-card');
    expect(src).toContain('console-form-input');
    expect(src).toContain('console-button-emphasis');
  });

  it('HubConnectorConfigTab uses explicit shadow, not --hub-shadow var', () => {
    const src = readSrc('HubConnectorConfigTab.tsx');
    expect(src).not.toContain('var(--hub-shadow)');
    expect(src).toContain('shadow-[0_12px_30px_rgba(43,33,26,0.08)]');
  });

  it('SignalInboxView title is text-xl, list pane has no border-r', () => {
    const src = readSrc('signals/SignalInboxView.tsx');
    expect(src).toMatch(/text-xl font-bold/);
    expect(src).not.toMatch(/border-r border-\[var\(--console-border-soft\)\]/);
  });

  it('SignalSourcesView title is "信号源" text-xl', () => {
    const src = readSrc('signals/SignalSourcesView.tsx');
    expect(src).toContain('text-xl font-bold');
    expect(src).toMatch(/>信号源</);
  });

  it('ResizeHandle uses full-height line with hover feedback', () => {
    const src = readSrc('workspace/ResizeHandle.tsx');
    expect(src).toContain('inset-y-0');
    expect(src).toContain('cafe-accent/60');
    expect(src).toContain('group-hover');
    expect(src).toContain('cursor-col-resize');
    expect(src).toContain('cursor-row-resize');
    expect(src).toContain('console-border-soft');
  });

  it('HubQuotaBoardTab uses console-list-card shadow, no hub-* CSS vars', () => {
    const src = readSrc('HubQuotaBoardTab.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).not.toContain('field-success');
    expect(src).toContain('console-list-card');
    expect(src).toContain('text-cafe');
    expect(src).toContain('console-button-emphasis');
    expect(src).toContain('conn-red-ring');
  });

  it('hub-cat-editor-advanced uses console-runtime-* tokens, no hub-* CSS vars', () => {
    const src = readSrc('hub-cat-editor-advanced.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('console-runtime-hint');
    expect(src).toContain('console-runtime-group-bg');
    expect(src).toContain('console-runtime-field-bg');
    expect(src).toContain('console-field-bg');
    expect(src).toMatch(/rounded-\[14px\].*console-runtime-group-bg/);
  });

  it('HubRoutingPolicyTab uses console-list-card shadow, not border-cafe', () => {
    const src = readSrc('HubRoutingPolicyTab.tsx');
    expect(src).not.toMatch(/border border-cafe/);
    expect(src).toContain('console-list-card');
  });

  it('DailyUsageSection uses console-list-card shadow, not border-cafe', () => {
    const src = readSrc('DailyUsageSection.tsx');
    expect(src).not.toMatch(/border border-cafe/);
    expect(src).toContain('console-list-card');
  });

  it('leaderboard-cards uses cafe/console tokens, no hub-lb-* CSS vars', () => {
    const src = readSrc('leaderboard-cards.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('cafe-text-primary');
    expect(src).toContain('cafe-accent');
    expect(src).toContain('console-pill-bg');
  });

  it('leaderboard-phase-bc uses cafe/console tokens, no hub-lb-* CSS vars', () => {
    const src = readSrc('leaderboard-phase-bc.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('cafe-text-primary');
    expect(src).toContain('cafe-accent');
  });

  it('HubLeaderboardTab uses cafe/console tokens, no hub-lb-* CSS vars', () => {
    const src = readSrc('HubLeaderboardTab.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('cafe-text-primary');
    expect(src).toContain('console-pill-bg');
    expect(src).toContain('cafe-accent');
  });

  it('HubCoCreatorEditor uses console-modal-* tokens, no hub-* CSS vars', () => {
    const src = readSrc('HubCoCreatorEditor.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('console-card-bg');
    expect(src).toContain('console-modal-title');
    expect(src).toContain('console-modal-close-bg');
  });

  it('HubPermissionsTab uses explicit shadow, no hub-* CSS vars', () => {
    const src = readSrc('HubPermissionsTab.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).toContain('shadow-[0_12px_30px_rgba(43,33,26,0.08)]');
  });

  it('MemoryNav uses underline tabs matching MissionHub, not soft pills', () => {
    const src = readSrc('memory/MemoryNav.tsx');
    expect(src).toContain('console-divider-b');
    expect(src).toContain('border-b-2 border-[var(--console-button-emphasis)]');
    expect(src).toContain('text-sm font-semibold');
    expect(src).not.toContain('rounded-md');
    expect(src).not.toContain('console-active-bg');
  });

  it('SignalNav uses underline tabs matching MissionHub, not soft pills', () => {
    const src = readSrc('signals/SignalNav.tsx');
    expect(src).toContain('console-divider-b');
    expect(src).toContain('border-b-2 border-[var(--console-button-emphasis)]');
    expect(src).toContain('text-sm font-semibold');
    expect(src).not.toContain('rounded-md');
    expect(src).not.toContain('console-active-bg');
  });

  it('MemoryHub has h1 title header at text-xl', () => {
    const src = readSrc('memory/MemoryHub.tsx');
    expect(src).toMatch(/<h1.*text-xl font-bold/);
  });

  it('DefaultCatSelector has no fixed height, uses shadow', () => {
    const src = readSrc('DefaultCatSelector.tsx');
    expect(src).not.toContain('h-[72px]');
    expect(src).toContain('shadow-[0_12px_30px_rgba(43,33,26,0.08)]');
  });

  it('SettingsRow has default shadow', () => {
    const src = readSrc('settings/primitives/SettingsRow.tsx');
    expect(src).toContain('shadow-[0_8px_22px_rgba(43,33,26,0.04)]');
  });

  it('SettingsCard has default shadow', () => {
    const src = readSrc('settings/primitives/SettingsCard.tsx');
    expect(src).toContain('shadow-[0_8px_22px_rgba(43,33,26,0.04)]');
  });

  it('SettingsSection has default shadow', () => {
    const src = readSrc('settings/primitives/SettingsSection.tsx');
    expect(src).toContain('shadow-[0_8px_22px_rgba(43,33,26,0.04)]');
  });

  it('ChatInput default border is console-border-soft, focus uses console-input-stroke', () => {
    const src = readSrc('ChatInput.tsx');
    expect(src).not.toMatch(/border-t border-cafe-subtle/);
    expect(src).toContain('border-[var(--console-border-soft)]');
    expect(src).toContain('focus:border-[var(--console-input-stroke)]');
    expect(src).toContain('focus:ring-[var(--console-input-stroke)]');
  });

  it('PluginsContent shows only GitHub, no service-ui-adapter', () => {
    const src = readSrc('settings/PluginsContent.tsx');
    expect(src).toContain('GitHub');
    expect(src).not.toContain('adaptServiceToPlugin');
    expect(src).not.toContain('/api/services');
  });

  it('SettingsDeleteButton uses HubIcon trash, not inline SVG', () => {
    const src = readSrc('settings/primitives/SettingsDeleteButton.tsx');
    expect(src).toContain('HubIcon');
    expect(src).toContain('name="trash"');
    expect(src).not.toContain('<path');
  });

  it('hub-tag-editor pills have no border, no hub-* CSS vars', () => {
    const src = readSrc('hub-tag-editor.tsx');
    expect(src).not.toMatch(/var\(--hub-/);
    expect(src).not.toMatch(/rounded-full border px/);
    expect(src).toContain('console-runtime-field-bg');
    expect(src).toContain('console-pill-bg');
    expect(src).toContain('conn-purple-bg');
  });

  it('WorkspacePanel aside: no border-l, uses console-panel-bg', () => {
    const src = readSrc('WorkspacePanel.tsx');
    expect(src).not.toMatch(/border-l border-cafe-subtle/);
    expect(src).toMatch(/<aside[\s\S]{0,200}bg-\[var\(--console-panel-bg\)\]/);
  });

  it('SettingsNav item text uses text-xs token, no hardcoded size', () => {
    const src = readSrc('settings/SettingsNav.tsx');
    expect(src).toContain('text-xs');
    expect(src).not.toMatch(/text-\[\d+px\]/);
  });

  it('SettingsDeleteButton: muted default, cafe-accent hover with bg', () => {
    const src = readSrc('settings/primitives/SettingsDeleteButton.tsx');
    expect(src).toContain('text-cafe-muted');
    expect(src).toContain('hover:text-[var(--cafe-accent)]');
    expect(src).toContain('hover:bg-[var(--console-hover-bg)]');
    expect(src).not.toContain('#D08068');
  });

  it('SettingsResourceIconButton danger tone: muted → cafe-accent hover with bg', () => {
    const src = readSrc('SettingsResourceCard.tsx');
    expect(src).toContain("tone === 'danger'");
    expect(src).toMatch(/danger[\s\S]*?hover:text-\[var\(--cafe-accent\)\]/);
    expect(src).toMatch(/danger[\s\S]*?hover:bg-\[var\(--console-hover-bg\)\]/);
    expect(src).not.toContain('#D08068');
  });

  it('HubAccountItem: click-to-edit only, no inline expand/TagEditor', () => {
    const src = readSrc('HubAccountItem.tsx');
    expect(src).not.toContain('TagEditor');
    expect(src).not.toContain('useState');
    expect(src).not.toContain('expanded');
    expect(src).toContain('onEdit');
  });

  it('MissionControlPage h1 has no SVG grid icon', () => {
    const src = readSrc('mission-control/MissionControlPage.tsx');
    expect(src).toMatch(/<h1.*Mission Hub/);
    expect(src).not.toMatch(/<svg[\s\S]*?<rect[\s\S]*?Mission Hub/);
  });

  it('SignalNav is below title, not inline (both views)', () => {
    const inbox = readSrc('signals/SignalInboxView.tsx');
    const sources = readSrc('signals/SignalSourcesView.tsx');
    for (const src of [inbox, sources]) {
      expect(src).not.toMatch(/<h1[\s\S]*?<SignalNav[^>]*\/>\s*<\/div>/);
    }
  });

  it('typography: tokens defined once in JSON, wired into tailwind config + CSS vars via plugin', () => {
    const tokens = JSON.parse(
      readFileSync(resolve(testDir, '..', '..', 'styles', 'typography-tokens.json'), 'utf8'),
    ) as {
      fontSize: Record<string, unknown>;
      fontSizePx: Record<string, unknown>;
    };
    const config = readFileSync(resolve(testDir, '..', '..', '..', 'tailwind.config.js'), 'utf8');
    expect(tokens.fontSize).toHaveProperty('compact');
    expect(tokens.fontSize).toHaveProperty('label');
    expect(tokens.fontSize).toHaveProperty('micro');
    expect(tokens.fontSizePx).toHaveProperty('compact');
    expect(tokens.fontSizePx).toHaveProperty('label');
    expect(config).toContain("require('./src/styles/typography-tokens.json')");
    expect(config).toContain('fontSize: typographyTokens.fontSize');
    expect(config).toContain('--console-font-');
    expect(config).toContain('fontSizePx');
    const css = readFileSync(resolve(testDir, '..', '..', 'app', 'console-shell.css'), 'utf8');
    expect(css).not.toMatch(/--console-font-\w+:\s*\d+px/);
  });

  it('console page titles use text-xl font-bold, not text-2xl', () => {
    for (const [file, tag] of [
      ['memory/MemoryHub.tsx', '记忆'],
      ['signals/SignalInboxView.tsx', '信号'],
      ['signals/SignalSourcesView.tsx', '信号源'],
      ['mission-control/MissionControlPage.tsx', 'Mission Hub'],
    ] as const) {
      const src = readSrc(file);
      expect(src).toContain('text-xl font-bold');
      expect(src).toContain(tag);
    }
  });

  it('Settings hierarchy: page header text-xl, section text-base, no font-extrabold', () => {
    const header = readSrc('settings/SettingsPageHeader.tsx');
    expect(header).toContain('text-xl font-bold');
    expect(header).not.toContain('font-extrabold');
    const section = readSrc('settings/primitives/SettingsSection.tsx');
    expect(section).toContain('text-base font-semibold');
    expect(section).not.toContain('text-lg font-bold');
  });

  it('divider primitives defined in console-shell.css', () => {
    const css = readFileSync(resolve(testDir, '..', '..', 'app', 'console-shell.css'), 'utf8');
    expect(css).toContain('.console-divider-t');
    expect(css).toContain('.console-divider-b');
    expect(css).toContain('.console-divider-r');
    expect(css).toContain('.console-divider-l');
    expect(css).toMatch(/console-divider-t[\s\S]*?border-top[\s\S]*?var\(--console-border-soft\)/);
  });

  it('MemoryNav + SignalNav use console-divider-b, not raw border pattern', () => {
    for (const file of ['memory/MemoryNav.tsx', 'signals/SignalNav.tsx']) {
      const src = readSrc(file);
      expect(src).toContain('console-divider-b');
      expect(src).not.toMatch(/border-b border-\[var\(--console-border-soft\)\]/);
    }
  });

  it('MissionControlPage tabs use console-divider-b, not raw border pattern', () => {
    const src = readSrc('mission-control/MissionControlPage.tsx');
    expect(src).toContain('console-divider-b');
    expect(src).not.toMatch(/border-b border-\[var\(--console-border-soft\)\]/);
  });
});

describe('F190 typography guard — no hardcoded font sizes in console scope', () => {
  const CONSOLE_SCOPE = [
    'settings/SettingsNav.tsx',
    'settings/primitives/SettingsRow.tsx',
    'settings/primitives/SettingsSection.tsx',
    'settings/primitives/SettingsCard.tsx',
    'settings/SettingsPageHeader.tsx',
    'settings/RulesPromptsContent.tsx',
    'settings/SkillPreviewModal.tsx',
    'settings/InstallPreviewModal.tsx',
    'settings/GithubConfigPanel.tsx',
    'settings/PushServiceConfig.tsx',
    'hub-cat-editor-fields.tsx',
    'hub-cat-editor-voice.tsx',
    'hub-cat-editor-advanced.tsx',
    'hub-cat-editor.sections.tsx',
    'hub-tag-editor.tsx',
    'HubCatEditor.tsx',
    'HubCoCreatorEditor.tsx',
    'HubQuotaBoardTab.tsx',
    'HubToolUsageTab.tsx',
    'HubLeaderboardTab.tsx',
    'HubMemberOverviewCard.tsx',
    'RightStatusPanel.tsx',
    'DefaultCatSelector.tsx',
    'memory/MemoryHub.tsx',
    'signals/SignalInboxView.tsx',
    'signals/SignalSourcesView.tsx',
    'mission-control/MissionControlPage.tsx',
    'mission-control/SliceLadder.tsx',
    'mission-control/dag-graph-utils.ts',
    'leaderboard-cards.tsx',
    'leaderboard-phase-bc.tsx',
    'workspace/TerminalTab.tsx',
    'workspace/AgentPaneViewer.tsx',
    'workspace/AgentPaneList.tsx',
    'workspace/JsxPreview.tsx',
    'memory/CollectionGraph.tsx',
    'memory/CollectionGraphParts.tsx',
    'cli-output/CliOutputBlock.tsx',
  ];

  for (const file of CONSOLE_SCOPE) {
    it(`${file}: no hardcoded text-[Xpx] (use tokens: text-micro/label/xs/compact/sm/base/lg/xl)`, () => {
      const src = readSrc(file);
      const matches = src.match(/text-\[\d+px\]/g) ?? [];
      expect(matches).toEqual([]);
    });
  }

  for (const file of CONSOLE_SCOPE) {
    it(`${file}: no inline fontSize in style objects`, () => {
      const src = readSrc(file);
      expect(src).not.toMatch(/fontSize:\s*['"]\d/);
    });
  }

  it('src-wide guard: no raw pixel font definitions outside typography tokens', () => {
    const srcRoot = resolve(testDir, '..', '..');
    const violations = collectSourceFiles(srcRoot).flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      const matches = [
        ...(src.match(/text-\[\d+(?:\.\d+)?px\]/g) ?? []),
        ...(src.match(/fontSize:\s*['"]?\d/g) ?? []),
        ...(src.match(/fontSize=\{\d/g) ?? []),
        ...(src.match(/font-size:\s*(?:\d|0\.)/g) ?? []),
      ];
      return matches.map((match) => `${file.replace(srcRoot, 'src')}: ${match}`);
    });
    expect(violations).toEqual([]);
  });
});

describe('F190 divider guard — console-scope dividers use semantic class', () => {
  const DIVIDER_SCOPE = [
    'memory/MemoryNav.tsx',
    'signals/SignalNav.tsx',
    'mission-control/MissionControlPage.tsx',
    'settings/primitives/SettingsRow.tsx',
    'settings/primitives/SettingsCollapsibleCard.tsx',
    'settings/capability-settings-ui.tsx',
    'UnifiedAuthModal.tsx',
    'PushSettingsPanel.tsx',
    'ThreadExecutionBar.tsx',
    'ParallelStatusBar.tsx',
    'audit/AuditExplorerPanel.tsx',
    'mission-control/WorkflowSopPanel.tsx',
    'mission-control/FeatureRowList.tsx',
    'workspace/WorldPanel.tsx',
    'PlanBoardPanel.tsx',
    'workspace/ConsolePanel.tsx',
    'workspace/BrowserToolbar.tsx',
    'workspace/BrowserPanel.tsx',
    'workspace/DiffViewer.tsx',
    'rich/DiffBlock.tsx',
    'mission-control/ExternalProjectTab.tsx',
    'mission-control/SliceLadder.tsx',
    'mission-control/ThreadSituationPanel.tsx',
    'memory/CollectionGraphParts.tsx',
    'memory/RecallFeed.tsx',
    'memory/ToolUsageMetricsPanel.tsx',
    'ThreadSidebar/ThreadSidebar.tsx',
    'ThreadSidebar/DirectoryBrowser.tsx',
  ];

  for (const file of DIVIDER_SCOPE) {
    it(`${file}: uses console-divider-* class, no clean raw border-[var(--console-border-soft)]`, () => {
      const src = readSrc(file);
      const rawDividers = src.match(/border-[tbrl] border-\[var\(--console-border-soft\)\]/g) ?? [];
      expect(rawDividers).toEqual([]);
    });
  }
});
