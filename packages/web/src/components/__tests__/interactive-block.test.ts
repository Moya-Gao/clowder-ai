/**
 * F096: InteractiveBlock — buildSelectionMessage pure function tests
 */
import { describe, expect, it } from 'vitest';
import { buildSelectionMessage } from '@/components/rich/InteractiveBlock';

describe('F096: buildSelectionMessage', () => {
  it('select — default template', () => {
    const result = buildSelectionMessage(
      'select',
      [
        { id: 'a', label: '方案 A' },
        { id: 'b', label: '方案 B' },
      ],
      ['a'],
    );
    expect(result).toBe('我选了：方案 A');
  });

  it('multi-select — multiple items', () => {
    const result = buildSelectionMessage(
      'multi-select',
      [
        { id: 'a', label: 'Node.js' },
        { id: 'b', label: 'pnpm' },
      ],
      ['a', 'b'],
    );
    expect(result).toBe('我选了：Node.js, pnpm');
  });

  it('card-grid — with emoji', () => {
    const result = buildSelectionMessage('card-grid', [{ id: 'a', label: '猫猫盲盒', emoji: '🎲' }], ['a']);
    expect(result).toBe('我选了：🎲 猫猫盲盒');
  });

  it('confirm — confirm action', () => {
    const result = buildSelectionMessage('confirm', [], ['__confirm__']);
    expect(result).toBe('确认');
  });

  it('confirm — cancel action', () => {
    const result = buildSelectionMessage('confirm', [], ['__cancel__']);
    expect(result).toBe('取消');
  });

  it('custom messageTemplate', () => {
    const result = buildSelectionMessage(
      'select',
      [{ id: 'a', label: '宪宪' }],
      ['a'],
      '我选了 {selection} 作为引导猫',
    );
    expect(result).toBe('我选了 宪宪 作为引导猫');
  });

  it('multi-select — respects selection order', () => {
    const result = buildSelectionMessage(
      'multi-select',
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      ['c', 'a'],
    );
    expect(result).toBe('我选了：C, A');
  });
});
