/**
 * F232 AC-A8 — PanelTabs：右侧 panel 顶部统一 tab（状态/工作区/产物/转录），
 * 收敛 header 的多个 mode 切换按钮。点 tab 切 mode；关闭按钮收起 panel。
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PanelTabs, type RightPanelMode } from '../panel/PanelTabs';

function render(props: Parameters<typeof PanelTabs>[0]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(PanelTabs, props));
  });
  return container;
}

describe('F232 AC-A8 PanelTabs', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('渲染 4 个 tab（状态/工作区/产物/转录）', () => {
    const container = render({ mode: 'status', onSelect: () => {}, onClose: () => {} });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(4);
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toEqual(['状态', '工作区', '产物', '转录']);
  });

  it('当前 mode 对应 tab 标记 aria-selected', () => {
    const container = render({ mode: 'artifacts', onSelect: () => {}, onClose: () => {} });
    const selected = [...container.querySelectorAll('[role="tab"]')].filter(
      (t) => t.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe('产物');
  });

  it('点击 tab → onSelect(对应 mode)', () => {
    const picked: string[] = [];
    const container = render({ mode: 'status', onSelect: (m: RightPanelMode) => picked.push(m), onClose: () => {} });
    const artifactsTab = [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === '产物');
    act(() => {
      artifactsTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(picked).toEqual(['artifacts']);
  });

  it('点击关闭按钮 → onClose', () => {
    let closed = false;
    const container = render({
      mode: 'status',
      onSelect: () => {},
      onClose: () => {
        closed = true;
      },
    });
    const closeBtn = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '收起面板');
    expect(closeBtn, '应有收起面板按钮').toBeTruthy();
    act(() => {
      closeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(closed).toBe(true);
  });
});
