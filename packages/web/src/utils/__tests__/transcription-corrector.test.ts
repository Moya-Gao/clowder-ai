import { describe, expect, it } from 'vitest';
import {
  applyTermDictionary,
  removeFillers,
  correctTranscription,
} from '@/utils/transcription-corrector';

/* ------------------------------------------------------------------ */
/*  applyTermDictionary                                                */
/* ------------------------------------------------------------------ */

describe('applyTermDictionary', () => {
  it('replaces a single known term', () => {
    expect(applyTermDictionary('用 icp 协议')).toBe('用 MCP 协议');
  });

  it('is case-insensitive', () => {
    expect(applyTermDictionary('ICP server')).toBe('MCP server');
    expect(applyTermDictionary('Icp server')).toBe('MCP server');
  });

  it('replaces Chinese misrecognitions', () => {
    expect(applyTermDictionary('法式的很快')).toBe('Fastify很快');
    expect(applyTermDictionary('锐的死连接')).toBe('Redis连接');
    expect(applyTermDictionary('瑞迪斯连接')).toBe('Redis连接');
  });

  it('handles multiple terms in one string', () => {
    const input = '用 icp 和 type script 开发';
    expect(applyTermDictionary(input)).toBe('用 MCP 和 TypeScript 开发');
  });

  it('leaves unknown words unchanged', () => {
    const input = '这是一段正常的文字';
    expect(applyTermDictionary(input)).toBe(input);
  });

  it('returns empty string unchanged', () => {
    expect(applyTermDictionary('')).toBe('');
  });

  it('replaces all dictionary entries correctly', () => {
    expect(applyTermDictionary('为的')).toBe('void');
    expect(applyTermDictionary('那的js')).toBe('Node.js');
    expect(applyTermDictionary('组单的')).toBe('Zustand');
    expect(applyTermDictionary('威士伯')).toBe('Whisper');
    expect(applyTermDictionary('work tree')).toBe('worktree');
    expect(applyTermDictionary('re base')).toBe('rebase');
  });
});

/* ------------------------------------------------------------------ */
/*  removeFillers                                                      */
/* ------------------------------------------------------------------ */

describe('removeFillers', () => {
  it('removes a single filler word', () => {
    expect(removeFillers('嗯我想问一下')).toBe('我想问一下');
  });

  it('removes filler at end of string', () => {
    expect(removeFillers('看看这个啊')).toBe('看看这个');
  });

  it('removes filler between words', () => {
    expect(removeFillers('先那个看一下代码')).toBe('先 看一下代码');
  });

  it('removes multiple different fillers', () => {
    expect(removeFillers('嗯那个就是说帮我看看')).toBe('帮我看看');
  });

  it('removes consecutive identical fillers', () => {
    expect(removeFillers('嗯嗯嗯开始吧')).toBe('开始吧');
  });

  it('collapses resulting whitespace', () => {
    expect(removeFillers('先  嗯  看看')).toBe('先 看看');
  });

  it('preserves content without fillers', () => {
    const clean = '请帮我 review 这段代码';
    expect(removeFillers(clean)).toBe(clean);
  });

  it('returns empty string unchanged', () => {
    expect(removeFillers('')).toBe('');
  });

  it('handles string that is only fillers', () => {
    expect(removeFillers('嗯啊那个')).toBe('');
  });

  it('removes longer fillers before shorter ones', () => {
    // "就是说" should be removed as a whole, not leave "说"
    expect(removeFillers('就是说我觉得')).toBe('我觉得');
    // "就是" within "就是说" should already be consumed
    expect(removeFillers('就是我觉得')).toBe('我觉得');
  });

  it('removes 然后呢 and 对对对', () => {
    expect(removeFillers('然后呢我们继续')).toBe('我们继续');
    expect(removeFillers('对对对没错')).toBe('没错');
  });
});

/* ------------------------------------------------------------------ */
/*  correctTranscription (full pipeline)                               */
/* ------------------------------------------------------------------ */

describe('correctTranscription', () => {
  it('applies both term replacement and filler removal', () => {
    const input = '嗯那个用 icp 和 type script 开发';
    expect(correctTranscription(input)).toBe('用 MCP 和 TypeScript 开发');
  });

  it('handles term replacement that would overlap fillers', () => {
    // Term replacement happens first, so fillers in the result
    // of replacement do not cause issues
    const input = '法式的很快啊';
    expect(correctTranscription(input)).toBe('Fastify很快');
  });

  it('returns empty string unchanged', () => {
    expect(correctTranscription('')).toBe('');
  });

  it('handles input with only fillers', () => {
    expect(correctTranscription('嗯啊那个就是')).toBe('');
  });

  it('handles realistic voice input', () => {
    const input = '嗯那个帮我看看 icp 的 work tree 配置啊就是 锐的死 连接有问题';
    const expected = '帮我看看 MCP 的 worktree 配置 Redis 连接有问题';
    expect(correctTranscription(input)).toBe(expected);
  });
});
