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
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
}
function noContent() {
  return Promise.resolve({ ok: false, status: 204, json: () => Promise.resolve({}) });
}
function jsonFail(status = 500, error = 'fail') {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({ error }) });
}

const CWD_PATH = '/Users/test/projects/cat-cafe';

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

  function setupCwdSuccess() {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      return jsonFail();
    });
  }

  async function flush() {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }

  // ── cwd fetch ──────────────────────────────────────────────

  it('fetches cwd on mount and displays recommended quick pick', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    expect(container.textContent).toContain('cat-cafe');
    expect(container.textContent).toContain('推荐');
    expect(container.textContent).toContain(CWD_PATH);
    expect(mockApiFetch).toHaveBeenCalledWith('/api/projects/cwd');
    expect(fns.onSelect).not.toHaveBeenCalled();
  });

  it('does not show cwd in quick picks when it already exists in existingProjects', async () => {
    setupCwdSuccess();
    render({ existingProjects: [CWD_PATH] });
    await flush();
    expect(container.textContent).not.toContain('推荐');
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
    expect(fns.onSelect).toHaveBeenCalledWith(CWD_PATH, undefined);
  });

  it('calls onSelect with existing project path when existing project is clicked', async () => {
    const existingPath = '/Users/test/projects/other';
    setupCwdSuccess();
    const fns = render({ existingProjects: [existingPath] });
    await flush();
    const projectBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('other'),
    );
    expect(projectBtn).toBeTruthy();
    act(() => { projectBtn!.click(); });
    expect(fns.onSelect).toHaveBeenCalledWith(existingPath, undefined);
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
    expect(fns.onSelect).toHaveBeenCalledWith(undefined, undefined);
  });

  // ── F068: Pick directory button ────────────────────────────

  it('shows "选择文件夹" button', async () => {
    setupCwdSuccess();
    render();
    await flush();
    const pickBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('选择文件夹'),
    );
    expect(pickBtn).toBeTruthy();
  });

  it('calls POST /api/projects/pick-directory and onSelect when user picks a folder', async () => {
    const pickedPath = '/Users/test/projects/new-project';
    mockApiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path === '/api/projects/pick-directory' && opts?.method === 'POST') {
        return jsonOk({ path: pickedPath, name: 'new-project' });
      }
      return jsonFail();
    });
    const fns = render();
    await flush();
    const pickBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('选择文件夹'),
    )!;
    await act(async () => { pickBtn.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/projects/pick-directory', { method: 'POST' });
    expect(fns.onSelect).toHaveBeenCalledWith(pickedPath, undefined);
  });

  it('does not call onSelect when user cancels native picker (204)', async () => {
    mockApiFetch.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path === '/api/projects/pick-directory' && opts?.method === 'POST') return noContent();
      return jsonFail();
    });
    const fns = render();
    await flush();
    const pickBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('选择文件夹'),
    )!;
    await act(async () => { pickBtn.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(fns.onSelect).not.toHaveBeenCalled();
  });

  // ── F068: Path input ──────────────────────────────────────

  it('shows path input field with placeholder', async () => {
    setupCwdSuccess();
    render();
    await flush();
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toContain('输入路径');
  });

  it('validates path via browse API and calls onSelect with canonicalized path', async () => {
    const canonicalPath = '/Users/test/new-path';
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path.startsWith('/api/projects/browse')) return jsonOk({ current: canonicalPath, name: 'new-path', parent: null, entries: [] });
      return jsonFail();
    });
    const fns = render();
    await flush();
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    const goBtn = container.querySelector('button[aria-label="跳转到路径"]') as HTMLButtonElement;
    expect(goBtn).toBeTruthy();
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(input, '/Users/test/new-path');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
    await act(async () => { goBtn.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(fns.onSelect).toHaveBeenCalledWith(canonicalPath, undefined);
  });

  it('shows error when path input validation fails', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/api/projects/cwd') return jsonOk({ path: CWD_PATH });
      if (path.startsWith('/api/projects/browse')) return jsonFail(403, 'Access denied');
      return jsonFail();
    });
    const fns = render();
    await flush();
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    const goBtn = container.querySelector('button[aria-label="跳转到路径"]') as HTMLButtonElement;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(input, '/root/evil');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
    await act(async () => { goBtn.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(fns.onSelect).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Access denied');
  });

  // ── F068: No more browse section ──────────────────────────

  it('does NOT show "浏览其他目录" toggle (removed in F068)', async () => {
    setupCwdSuccess();
    render();
    await flush();
    expect(container.textContent).not.toContain('浏览其他目录');
  });

  // ── Cat selection with preferredCats ──────────────────────

  it('passes selected cats as preferredCats when quick pick is clicked', async () => {
    setupCwdSuccess();
    const fns = render();
    await flush();
    const catChip = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('布偶猫'),
    );
    expect(catChip).toBeTruthy();
    act(() => { catChip!.click(); });
    const cwdBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('推荐'),
    );
    act(() => { cwdBtn!.click(); });
    expect(fns.onSelect).toHaveBeenCalledWith(CWD_PATH, ['opus']);
  });

  // ── Escape key ────────────────────────────────────────────

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
