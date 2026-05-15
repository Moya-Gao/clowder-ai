import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/utils/api-client';
import { SettingsContent } from '../settings/SettingsContent';
import { SkillsContent } from '../settings/SkillsContent';

const mockFetch = apiFetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const skillsPayload = {
  skills: [
    {
      name: 'cross-cat-handoff',
      category: '协作',
      trigger: '交接工作给其他猫',
      mounts: { claude: true, codex: true, gemini: false, kimi: true },
      requiresMcp: [],
    },
    {
      name: 'browser-preview',
      category: '前端',
      trigger: '看页面效果',
      mounts: { claude: true, codex: true, gemini: true, kimi: true },
      requiresMcp: [
        { id: 'playwright', status: 'ready' },
        { id: 'missing-browser', status: 'missing' },
      ],
    },
  ],
  summary: { total: 2, allMounted: false, registrationConsistent: true },
  staleness: {
    stale: true,
    currentHash: 'new',
    recordedHash: 'old',
    newSkills: ['browser-preview'],
    removedSkills: [],
  },
  conflicts: [
    {
      skillName: 'cross-cat-handoff',
      projectTarget: '/repo/cat-cafe-skills/cross-cat-handoff',
      userTarget: '/Users/me/.codex/skills/cross-cat-handoff',
      activeLayer: 'project',
    },
  ],
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SkillsContent', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { React?: typeof React }).React = React;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockFetch.mockReset();
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/rules/skill/')) {
        return Promise.resolve(
          jsonResponse({
            content: '# browser-preview\n\nLocal preview instructions',
            path: '/repo/cat-cafe-skills/browser-preview/SKILL.md',
          }),
        );
      }
      return Promise.resolve(jsonResponse(skillsPayload));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  async function render(element: React.ReactElement) {
    await act(async () => {
      root.render(element);
    });
    await flushEffects();
  }

  it('renders the read-mostly skill list with category filters and no write actions', async () => {
    await render(React.createElement(SkillsContent));

    expect(mockFetch.mock.calls[0][0]).toBe('/api/skills');
    expect(container.textContent).toContain('Skill 管理');
    expect(container.textContent).toContain('2 skills');
    expect(container.textContent).toContain('cross-cat-handoff');
    expect(container.textContent).toContain('browser-preview');
    expect(container.textContent).toContain('missing-browser:missing');
    expect(container.textContent).toContain('Skills 有更新');
    expect(container.textContent).toContain('Skill 来源冲突');

    const frontendFilter = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '前端',
    );
    expect(frontendFilter).toBeTruthy();

    await act(async () => {
      frontendFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const skillsList = container.querySelector('[data-testid="skills-list"]');
    expect(skillsList?.textContent).toContain('browser-preview');
    expect(skillsList?.textContent).not.toContain('cross-cat-handoff');

    const text = container.textContent ?? '';
    expect(text).not.toContain('立即同步');
    expect(text).not.toContain('补齐');
    expect(text).not.toContain('用官方版本');
    expect(text).not.toContain('用我的版本');
    expect(text).not.toContain('卸载');
  });

  it('opens a read-only SKILL.md preview from the card', async () => {
    await render(React.createElement(SkillsContent));

    const previewButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('browser-preview'),
    );
    expect(previewButton).toBeTruthy();

    await act(async () => {
      previewButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushEffects();

    expect(mockFetch).toHaveBeenCalledWith('/api/rules/skill/browser-preview');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Local preview instructions');
  });

  it('filters the skill list with the search input', async () => {
    await render(React.createElement(SkillsContent));

    const input = container.querySelector('input[placeholder="筛选 Skill"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    await act(async () => {
      setInputValue(input!, 'handoff');
    });

    expect(container.textContent).toContain('cross-cat-handoff');
    expect(container.textContent).not.toContain('browser-preview');
  });

  it('renders an empty state when filters match no skills', async () => {
    await render(React.createElement(SkillsContent));

    const input = container.querySelector('input[placeholder="筛选 Skill"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    await act(async () => {
      setInputValue(input!, 'not-a-skill');
    });

    expect(container.textContent).toContain('暂无匹配的 Skill');
    expect(container.textContent).toContain('调整分类或搜索条件后再试。');
  });

  it('renders API errors without exposing write actions', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503));

    await render(React.createElement(SkillsContent));

    expect(container.textContent).toContain('Skills 数据加载失败 (503)');
    expect(container.textContent).not.toContain('立即同步');
    expect(container.textContent).not.toContain('卸载');
  });

  it('wires the settings skills section to the read-mostly SkillsContent surface', async () => {
    await render(React.createElement(SettingsContent, { section: 'skills' }));

    expect(container.textContent).toContain('Skill 管理');
    expect(container.textContent).toContain('browser-preview');
    expect(container.textContent).not.toContain('Claude');
    expect(container.textContent).not.toContain('Kimi');
    expect(container.textContent).not.toContain('立即同步');
  });
});
