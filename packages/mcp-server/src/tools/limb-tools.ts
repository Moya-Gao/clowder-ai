/**
 * Limb MCP Tools — F126 四肢控制面
 *
 * limb_list_available: 列出当前在线的四肢节点及其能力
 * limb_invoke: 调用指定四肢节点的能力
 */

import { callbackPost, getCallbackConfig, NO_CONFIG_ERROR } from './callback-tools.js';
import type { ToolResult } from './file-tools.js';
import { errorResult } from './file-tools.js';

// ─── Input Schemas ───────────────────────────────────────────

export const limbListAvailableInputSchema = {
  type: 'object' as const,
  properties: {
    capability: {
      type: 'string',
      description: '按能力类别过滤（可选，如 "camera", "gpu_render"）',
    },
  },
};

export const limbInvokeInputSchema = {
  type: 'object' as const,
  properties: {
    nodeId: {
      type: 'string',
      description: '目标四肢节点 ID',
    },
    command: {
      type: 'string',
      description: '要执行的命令（如 "camera.snap", "exec.run"）',
    },
    params: {
      type: 'object',
      description: '命令参数（可选）',
    },
  },
  required: ['nodeId', 'command'],
};

// ─── Handlers ────────────────────────────────────────────────

export async function handleLimbListAvailable(args: { capability?: string }): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  const body: Record<string, unknown> = {};
  if (args.capability) body.capability = args.capability;

  return callbackPost('/api/callback/limb/list', body);
}

export async function handleLimbInvoke(args: {
  nodeId: string;
  command: string;
  params?: Record<string, unknown>;
}): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  return callbackPost('/api/callback/limb/invoke', {
    nodeId: args.nodeId,
    command: args.command,
    params: args.params ?? {},
  });
}

// ─── Tool Definitions ────────────────────────────────────────

export const limbTools = [
  {
    name: 'limb_list_available',
    description:
      '列出当前在线的四肢节点及其能力。可选按能力类别过滤。' +
      '四肢是外部设备/节点（iPhone, Windows 机, Mac Mini 等），不是猫猫。',
    inputSchema: limbListAvailableInputSchema,
    handler: handleLimbListAvailable,
  },
  {
    name: 'limb_invoke',
    description:
      '调用指定四肢节点的能力。需要 nodeId 和 command。' +
      '例如: limb_invoke(nodeId="iphone-1", command="camera.snap")',
    inputSchema: limbInvokeInputSchema,
    handler: handleLimbInvoke,
  },
] as const;
