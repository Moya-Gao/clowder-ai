import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryPickerModal } from '../DirectoryPickerModal';

// ── Mock apiFetch ──────────────────────────────────────────────
const mockApiFetch = vi.fn();
vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// ── Helpers ────────────────────────────────────────────────────
function jsonOk(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}
function jsonFail(status = 500, error = 'fail') {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({ error }) });
}

const CWD_PATH = '/Users/test/projects/cat-cafe';
const BROWSE_ROOT = {
  current: CWD_PATH,
  name: 'cat-cafe',
  parent: '/Users/test/projects',
  entries: [
    { name: 'packages', path: `${CWD_PATH}/packages`, isDirectory: true },
    { name: 'docs', path: `${CWD_PATH}/docs`, isDirectory: true },
  ],
};
const BROWSE_PARENT = {
  current: '/Users/test/projects',
  name: 'projects',
  parent: '/Users/test',
  entries: [
    { name: 'cat-cafe', path: CWD_PATH, isDirectory: true },
    { name: 'other-project', path: '/Users/test/projects/other-project', isDirectory: true },
  ],
};

describe('DirectoryPickerModal', () => {
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
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    delete (globalThis as { React?: typeof React }).React;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  function render(props: Partial<React.ComponentProps<typeof DirectoryPickerModal>> = {}) {
    const defaults = {
      existingProjects: [] as string[],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
      ...props,
    };
    act(() => { root.render(React.createElement(DirectoryPickerModal, defaults)); });
    return defaults;
  }

  /** Set up mocks for the standard happy-path cwd + browse flow */
  function setupCwdSuccess() {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path.startsWith('/api/projects/browse')) return jsonOk(BROWSE_ROOT);
      return jsonFail();
    });
  }

  /** Flush all pending microtasks (async useEffect + fetch chains) */
  async function flush() {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }

  // ── cwd fetch ──────────────────────────────────────────────

  it('fetches cwd on mount and displays recommended quick pick', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    // cwd quick pick should show with "推荐" badge
    expect(container.textContent).toContain('cat-cafe');
    expect(container.textContent).toContain('推荐');
    expect(container.textContent).toContain(CWD_PATH);
    // Should have called cwd endpoint then browse
    expect(mockApiFetch).toHaveBeenCalledWith('/api/projects/cwd');
    expect(fns.onSelect).not.toHaveBeenCalled();
  });

  it('falls back to browseTo() without path when cwd fetch fails', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonFail(500, 'no cwd');
      if (path === '/api/projects/browse') return jsonOk({
        current: '/', name: '/', parent: null,
        entries: [{ name: 'Users', path: '/Users', isDirectory: true }],
      });
      return jsonFail();
    });
    render();
    await flush();
    // No cwd → no "推荐" badge, but browse should load root
    expect(container.textContent).not.toContain('推荐');
    // Browse should have been called without path param
    expect(mockApiFetch).toHaveBeenCalledWith('/api/projects/browse');
  });

  it('falls back to browseTo() when cwd fetch throws', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return Promise.reject(new Error('network'));
      if (path === '/api/projects/browse') return jsonOk({
        current: '/', name: '/', parent: null, entries: [],
      });
      return jsonFail();
    });
    render();
    await flush();
    expect(container.textContent).not.toContain('推荐');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/projects/browse');
  });

  // ── Quick pick selection ───────────────────────────────────

  it('calls onSelect with cwd path when recommended quick pick is clicked', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    const cwdBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('推荐'),
    );
    expect(cwdBtn).toBeTruthy();
    act(() => { cwdBtn!.click(); });
    expect(fns.onSelect).toHaveBeenCalledWith(CWD_PATH);
  });

  it('calls onSelect with existing project path when existing project is clicked', async () => {
    const existingPath = '/Users/test/projects/other';
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path.startsWith('/api/projects/browse')) return jsonOk(BROWSE_ROOT);
      return jsonFail();
    });
    const fns = render({ existingProjects: [existingPath] });
    await flush();
    const projectBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('other'),
    );
    expect(projectBtn).toBeTruthy();
    act(() => { projectBtn!.click(); });
    expect(fns.onSelect).toHaveBeenCalledWith(existingPath);
  });

  it('does not show cwd in quick picks when it already exists in existingProjects', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path.startsWith('/api/projects/browse')) return jsonOk(BROWSE_ROOT);
      return jsonFail();
    });
    render({ existingProjects: [CWD_PATH] });
    await flush();
    // "推荐" badge should NOT appear (cwd is already in existingProjects)
    expect(container.textContent).not.toContain('推荐');
  });

  // ── Lobby selection ────────────────────────────────────────

  it('calls onSelect(undefined) when lobby is clicked', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    const lobbyBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('大厅'),
    );
    expect(lobbyBtn).toBeTruthy();
    act(() => { lobbyBtn!.click(); });
    expect(fns.onSelect).toHaveBeenCalledWith(undefined);
  });

  // ── Browse expand / collapse ───────────────────────────────

  it('directory browser is collapsed by default', async () => {
    setupCwdSuccess();
    render();
    await flush();
    // Browse toggle button should exist
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('浏览其他目录'),
    );
    expect(toggleBtn).toBeTruthy();
    // Browse entries should NOT be visible
    expect(container.textContent).not.toContain('packages');
    expect(container.textContent).not.toContain('选择此目录');
  });

  it('expands directory browser when toggle is clicked', async () => {
    setupCwdSuccess();
    render();
    await flush();
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('浏览其他目录'),
    )!;
    act(() => { toggleBtn.click(); });
    // Browse entries should now be visible
    expect(container.textContent).toContain('packages');
    expect(container.textContent).toContain('docs');
    expect(container.textContent).toContain('选择此目录');
  });

  it('collapses directory browser when toggle is clicked again', async () => {
    setupCwdSuccess();
    render();
    await flush();
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('浏览其他目录'),
    )!;
    // Open
    act(() => { toggleBtn.click(); });
    expect(container.textContent).toContain('packages');
    // Close
    act(() => { toggleBtn.click(); });
    expect(container.textContent).not.toContain('packages');
  });

  // ── Parent directory navigation ────────────────────────────

  it('navigates to parent directory when ".." is clicked', async () => {
    setupCwdSuccess();
    render();
    await flush();
    // Open browser
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('浏览其他目录'),
    )!;
    act(() => { toggleBtn.click(); });
    // Set up parent browse response
    mockApiFetch.mockImplementation((path: string) => {
      if (path.includes(encodeURIComponent('/Users/test/projects'))) return jsonOk(BROWSE_PARENT);
      return jsonFail();
    });
    const parentBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('上级目录'),
    )!;
    expect(parentBtn).toBeTruthy();
    await act(async () => { parentBtn.click(); await new Promise((r) => setTimeout(r, 0)); });
    // Should now show parent directory contents
    expect(container.textContent).toContain('other-project');
  });

  // ── "选择此目录" in browse view ────────────────────────────

  it('calls onSelect with current browse path when "选择此目录" is clicked', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    // Open browser
    const toggleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('浏览其他目录'),
    )!;
    act(() => { toggleBtn.click(); });
    const selectBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('选择此目录'),
    )!;
    expect(selectBtn).toBeTruthy();
    act(() => { selectBtn.click(); });
    expect(fns.onSelect).toHaveBeenCalledWith(CWD_PATH);
  });

  // ── Escape key / backdrop ──────────────────────────────────

  it('calls onCancel when Escape key is pressed', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(fns.onCancel).toHaveBeenCalledTimes(1);
  });
});
