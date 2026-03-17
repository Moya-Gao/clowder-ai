import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { LimbRegistry } from '../dist/domains/limb/LimbRegistry.js';

/** Minimal ILimbNode mock for testing */
function mockNode(overrides = {}) {
  return {
    nodeId: 'iphone-1',
    displayName: 'iPhone 15 Pro',
    platform: 'ios',
    capabilities: [
      { cap: 'camera', commands: ['camera.snap', 'camera.record'], authLevel: 'leased' },
      { cap: 'location', commands: ['location.get'], authLevel: 'free' },
    ],
    register: async () => {},
    invoke: async () => ({ success: true }),
    healthCheck: async () => 'online',
    deregister: async () => {},
    ...overrides,
  };
}

describe('LimbRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new LimbRegistry();
  });

  it('register a node and retrieve it', async () => {
    const node = mockNode();
    const record = await registry.register(node);

    assert.equal(record.nodeId, 'iphone-1');
    assert.equal(record.displayName, 'iPhone 15 Pro');
    assert.equal(record.platform, 'ios');
    assert.equal(record.status, 'online');
    assert.equal(record.capabilities.length, 2);

    const retrieved = registry.getNode('iphone-1');
    assert.equal(retrieved.nodeId, 'iphone-1');
  });

  it('getNode returns undefined for unknown', () => {
    assert.equal(registry.getNode('nonexistent'), undefined);
  });

  it('register duplicate nodeId throws', async () => {
    await registry.register(mockNode());
    await assert.rejects(
      () => registry.register(mockNode()),
      { message: 'Limb node already registered: iphone-1' },
    );
  });

  it('deregister removes node', async () => {
    await registry.register(mockNode());
    assert.equal(registry.size, 1);

    registry.deregister('iphone-1');
    assert.equal(registry.size, 0);
    assert.equal(registry.getNode('iphone-1'), undefined);
  });

  it('listAvailable returns only non-offline nodes', async () => {
    await registry.register(mockNode({ nodeId: 'a', displayName: 'A' }));
    await registry.register(mockNode({ nodeId: 'b', displayName: 'B' }));
    await registry.register(mockNode({ nodeId: 'c', displayName: 'C' }));

    registry.updateStatus('b', 'offline');

    const available = registry.listAvailable();
    assert.equal(available.length, 2);
    assert.deepEqual(available.map((n) => n.nodeId).sort(), ['a', 'c']);
  });

  it('listAll returns all nodes including offline', async () => {
    await registry.register(mockNode({ nodeId: 'a', displayName: 'A' }));
    await registry.register(mockNode({ nodeId: 'b', displayName: 'B' }));
    registry.updateStatus('b', 'offline');

    assert.equal(registry.listAll().length, 2);
  });

  it('findByCapability matches cap string', async () => {
    await registry.register(mockNode({
      nodeId: 'phone',
      capabilities: [{ cap: 'camera', commands: ['camera.snap'], authLevel: 'leased' }],
    }));
    await registry.register(mockNode({
      nodeId: 'server',
      capabilities: [{ cap: 'gpu_render', commands: ['render.run'], authLevel: 'free' }],
    }));

    const cameras = registry.findByCapability('camera');
    assert.equal(cameras.length, 1);
    assert.equal(cameras[0].nodeId, 'phone');

    const gpus = registry.findByCapability('gpu_render');
    assert.equal(gpus.length, 1);
    assert.equal(gpus[0].nodeId, 'server');

    const empty = registry.findByCapability('nonexistent');
    assert.equal(empty.length, 0);
  });

  it('findByCapability excludes offline nodes', async () => {
    await registry.register(mockNode({
      nodeId: 'phone',
      capabilities: [{ cap: 'camera', commands: ['camera.snap'], authLevel: 'leased' }],
    }));
    registry.updateStatus('phone', 'offline');

    const cameras = registry.findByCapability('camera');
    assert.equal(cameras.length, 0);
  });

  it('updateStatus changes node state', async () => {
    await registry.register(mockNode());

    registry.updateStatus('iphone-1', 'busy');
    assert.equal(registry.getNode('iphone-1').status, 'busy');

    registry.updateStatus('iphone-1', 'degraded');
    assert.equal(registry.getNode('iphone-1').status, 'degraded');
  });

  it('recordHeartbeat updates timestamp and revives offline node', async () => {
    await registry.register(mockNode());
    const initialHb = registry.getNode('iphone-1').lastHeartbeatAt;

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 10));

    registry.recordHeartbeat('iphone-1');
    assert.ok(registry.getNode('iphone-1').lastHeartbeatAt > initialHb);

    // Revive offline node
    registry.updateStatus('iphone-1', 'offline');
    assert.equal(registry.getNode('iphone-1').status, 'offline');

    registry.recordHeartbeat('iphone-1');
    assert.equal(registry.getNode('iphone-1').status, 'online');
  });

  it('recordHeartbeat is no-op for unknown node', () => {
    // Should not throw
    registry.recordHeartbeat('nonexistent');
  });

  it('getNodeHandle returns the ILimbNode instance', async () => {
    const node = mockNode();
    await registry.register(node);

    const handle = registry.getNodeHandle('iphone-1');
    assert.ok(handle);
    assert.equal(handle.nodeId, 'iphone-1');
    assert.equal(typeof handle.invoke, 'function');
    assert.equal(typeof handle.healthCheck, 'function');
  });

  it('getNodeHandle returns undefined for unknown', () => {
    assert.equal(registry.getNodeHandle('nonexistent'), undefined);
  });

  it('invoke delegates to node.invoke for online node', async () => {
    const invokeArgs = [];
    const node = mockNode({
      invoke: async (cmd, params) => {
        invokeArgs.push({ cmd, params });
        return { success: true, data: 'photo.jpg' };
      },
    });
    await registry.register(node);

    const result = await registry.invoke('iphone-1', 'camera.snap', { quality: 'high' });
    assert.equal(result.success, true);
    assert.equal(result.data, 'photo.jpg');
    assert.equal(invokeArgs.length, 1);
    assert.equal(invokeArgs[0].cmd, 'camera.snap');
    assert.deepEqual(invokeArgs[0].params, { quality: 'high' });
  });

  it('invoke returns error for unknown node', async () => {
    const result = await registry.invoke('nonexistent', 'test', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown node'));
  });

  it('invoke returns error for offline node', async () => {
    await registry.register(mockNode());
    registry.updateStatus('iphone-1', 'offline');

    const result = await registry.invoke('iphone-1', 'camera.snap', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('offline'));
  });
});
