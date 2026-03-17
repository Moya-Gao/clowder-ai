/**
 * LimbRegistry — F126 四肢节点注册表
 *
 * 管理四肢节点的注册/注销/查询。内存中的 live registry，
 * 与 capabilities.json（静态配置真相源）职责分离。
 *
 * 同时持有 ILimbNode 实例（用于 invoke/healthCheck）和
 * LimbNodeRecord 元数据（用于查询/序列化），避免 Phase B
 * 需要 invoke 时返工 registry 形状。
 */

import type { ILimbNode, LimbInvokeResult, LimbNodeRecord, LimbNodeStatus } from '@cat-cafe/shared';

interface RegistryEntry {
  node: ILimbNode;
  record: LimbNodeRecord;
}

export class LimbRegistry {
  private readonly entries = new Map<string, RegistryEntry>();

  /** 注册一个四肢节点 */
  async register(node: ILimbNode): Promise<LimbNodeRecord> {
    if (this.entries.has(node.nodeId)) {
      throw new Error(`Limb node already registered: ${node.nodeId}`);
    }

    const now = Date.now();
    const record: LimbNodeRecord = {
      nodeId: node.nodeId,
      displayName: node.displayName,
      platform: node.platform,
      capabilities: [...node.capabilities],
      status: 'online',
      registeredAt: now,
      lastHeartbeatAt: now,
    };

    this.entries.set(node.nodeId, { node, record });
    return record;
  }

  /** 注销一个四肢节点 */
  deregister(nodeId: string): void {
    this.entries.delete(nodeId);
  }

  /** 按 ID 获取节点元数据 */
  getNode(nodeId: string): LimbNodeRecord | undefined {
    return this.entries.get(nodeId)?.record;
  }

  /** 按 ID 获取节点实例（用于 invoke/healthCheck） */
  getNodeHandle(nodeId: string): ILimbNode | undefined {
    return this.entries.get(nodeId)?.node;
  }

  /** 调用节点能力（委派到 ILimbNode.invoke） */
  async invoke(nodeId: string, command: string, params: Record<string, unknown>): Promise<LimbInvokeResult> {
    const entry = this.entries.get(nodeId);
    if (!entry) {
      return { success: false, error: `Unknown node: ${nodeId}` };
    }
    if (entry.record.status === 'offline') {
      return { success: false, error: `Node is offline: ${nodeId}` };
    }
    return entry.node.invoke(command, params);
  }

  /** 列出所有在线/可用节点（排除 offline） */
  listAvailable(): LimbNodeRecord[] {
    return [...this.entries.values()].filter((e) => e.record.status !== 'offline').map((e) => e.record);
  }

  /** 列出所有节点（含 offline） */
  listAll(): LimbNodeRecord[] {
    return [...this.entries.values()].map((e) => e.record);
  }

  /** 按能力类别查找节点（仅在线/可用） */
  findByCapability(cap: string): LimbNodeRecord[] {
    return this.listAvailable().filter((n) => n.capabilities.some((c) => c.cap === cap));
  }

  /** 更新节点状态 */
  updateStatus(nodeId: string, status: LimbNodeStatus): void {
    const entry = this.entries.get(nodeId);
    if (entry) {
      entry.record.status = status;
    }
  }

  /** 更新心跳时间 */
  recordHeartbeat(nodeId: string): void {
    const entry = this.entries.get(nodeId);
    if (entry) {
      entry.record.lastHeartbeatAt = Date.now();
      if (entry.record.status === 'offline') {
        entry.record.status = 'online';
      }
    }
  }

  /** 节点数 */
  get size(): number {
    return this.entries.size;
  }
}
