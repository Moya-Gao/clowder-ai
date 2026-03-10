import type { IConnectorThreadBindingStore } from './ConnectorThreadBindingStore.js';

export interface CommandResult {
  readonly kind: 'new' | 'threads' | 'use' | 'where' | 'not-command';
  readonly response?: string;
  readonly newActiveThreadId?: string;
}

export interface ConnectorCommandLayerDeps {
  readonly bindingStore: IConnectorThreadBindingStore;
  readonly threadStore: {
    create(userId: string, title?: string): { id: string } | Promise<{ id: string }>;
    get(
      id: string,
    ):
      | { id: string; title?: string | null; createdAt?: number }
      | null
      | Promise<{ id: string; title?: string | null; createdAt?: number } | null>;
  };
  readonly frontendBaseUrl: string;
}

export class ConnectorCommandLayer {
  constructor(private readonly deps: ConnectorCommandLayerDeps) {}

  async handle(connectorId: string, externalChatId: string, userId: string, text: string): Promise<CommandResult> {
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return { kind: 'not-command' };

    const [rawCmd, ...args] = trimmed.split(/\s+/);
    const cmd = rawCmd?.toLowerCase();
    switch (cmd) {
      case '/where':
        return this.handleWhere(connectorId, externalChatId);
      case '/new':
        return this.handleNew(connectorId, externalChatId, userId, args.join(' '));
      case '/threads':
        return this.handleThreads(connectorId, userId);
      case '/use':
        return this.handleUse(connectorId, externalChatId, userId, args[0]);
      default:
        return { kind: 'not-command' };
    }
  }

  private async handleWhere(connectorId: string, externalChatId: string): Promise<CommandResult> {
    const binding = await this.deps.bindingStore.getByExternal(connectorId, externalChatId);
    if (!binding) {
      return {
        kind: 'where',
        response: '📍 当前没有绑定的 thread。发送任意消息会自动创建新 thread，或用 /new 手动创建。',
      };
    }
    const thread = await this.deps.threadStore.get(binding.threadId);
    const title = thread?.title ?? '(无标题)';
    const shortId = binding.threadId.slice(0, 8);
    const deepLink = `${this.deps.frontendBaseUrl}/threads/${binding.threadId}`;
    return {
      kind: 'where',
      response: `📍 当前 thread: ${title}\nID: ${shortId}\n🔗 ${deepLink}`,
    };
  }

  private async handleNew(
    connectorId: string,
    externalChatId: string,
    userId: string,
    title?: string,
  ): Promise<CommandResult> {
    const effectiveTitle = title?.trim() ? title.trim() : undefined;
    const thread = await this.deps.threadStore.create(userId, effectiveTitle);
    await this.deps.bindingStore.bind(connectorId, externalChatId, thread.id, userId);
    const shortId = thread.id.slice(0, 8);
    const deepLink = `${this.deps.frontendBaseUrl}/threads/${thread.id}`;
    const titleDisplay = effectiveTitle ? ` "${effectiveTitle}"` : '';
    return {
      kind: 'new',
      newActiveThreadId: thread.id,
      response: `✨ 新 thread${titleDisplay} 已创建\nID: ${shortId}\n🔗 ${deepLink}\n\n现在的消息会发到这个 thread。`,
    };
  }

  private async handleThreads(connectorId: string, userId: string): Promise<CommandResult> {
    const bindings = await this.deps.bindingStore.listByUser(connectorId, userId, 10);
    if (bindings.length === 0) {
      return { kind: 'threads', response: '📋 还没有 thread。发送消息或用 /new 创建一个吧！' };
    }
    const lines = await Promise.all(
      bindings.map(async (b, i) => {
        const thread = await this.deps.threadStore.get(b.threadId);
        const title = thread?.title ?? '(无标题)';
        const shortId = b.threadId.slice(0, 8);
        return `${i + 1}. ${title} [${shortId}]`;
      }),
    );
    return {
      kind: 'threads',
      response: `📋 最近的 threads:\n\n${lines.join('\n')}\n\n用 /use <ID前缀> 切换`,
    };
  }

  private async handleUse(
    connectorId: string,
    externalChatId: string,
    userId: string,
    idPrefix?: string,
  ): Promise<CommandResult> {
    if (!idPrefix) {
      return { kind: 'use', response: '❌ 请指定 thread ID 前缀，例如: /use abc123\n用 /threads 查看可用列表。' };
    }
    const bindings = await this.deps.bindingStore.listByUser(connectorId, userId);
    const match = bindings.find((b) => b.threadId.startsWith(idPrefix));
    if (!match) {
      return { kind: 'use', response: `❌ 找不到以 "${idPrefix}" 开头的 thread。用 /threads 查看可用列表。` };
    }
    await this.deps.bindingStore.bind(connectorId, externalChatId, match.threadId, userId);
    const thread = await this.deps.threadStore.get(match.threadId);
    const title = thread?.title ?? '(无标题)';
    const deepLink = `${this.deps.frontendBaseUrl}/threads/${match.threadId}`;
    return {
      kind: 'use',
      newActiveThreadId: match.threadId,
      response: `🔄 已切换到: ${title}\nID: ${match.threadId.slice(0, 8)}\n🔗 ${deepLink}`,
    };
  }
}
