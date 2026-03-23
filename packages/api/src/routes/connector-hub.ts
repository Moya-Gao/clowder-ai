import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { DEFAULT_THREAD_ID, type IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

interface ConnectorHubRoutesOptions {
  threadStore: IThreadStore;
}

function requireTrustedHubIdentity(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = resolveHeaderUserId(request);
  if (!userId) {
    reply.status(401);
    return null;
  }
  return userId;
}

// ── Connector platform config definitions ──

interface ConnectorFieldDef {
  envName: string;
  label: string;
  sensitive: boolean;
}

interface PlatformDef {
  id: string;
  name: string;
  nameEn: string;
  fields: ConnectorFieldDef[];
  docsUrl: string;
  /** Steps displayed in the guided wizard */
  steps: string[];
}

export const CONNECTOR_PLATFORMS: PlatformDef[] = [
  {
    id: 'feishu',
    name: '飞书',
    nameEn: 'Feishu / Lark',
    fields: [
      { envName: 'FEISHU_APP_ID', label: 'App ID', sensitive: false },
      { envName: 'FEISHU_APP_SECRET', label: 'App Secret', sensitive: true },
      { envName: 'FEISHU_VERIFICATION_TOKEN', label: 'Verification Token', sensitive: true },
    ],
    docsUrl:
      'https://open.feishu.cn/document/home/introduction-to-custom-app-development/self-built-application-development-process',
    steps: [
      '在飞书开放平台创建企业自建应用，获取 App ID 和 App Secret',
      '在「事件订阅」中配置请求地址并获取 Verification Token',
      '填写以下配置并保存，重启 API 服务后生效',
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    nameEn: 'Telegram',
    fields: [{ envName: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', sensitive: true }],
    docsUrl: 'https://core.telegram.org/bots/tutorial',
    steps: [
      '在 Telegram 中找到 @BotFather，发送 /newbot 创建机器人',
      '复制生成的 Bot Token',
      '填写以下配置并保存，重启 API 服务后生效',
    ],
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    nameEn: 'DingTalk',
    fields: [
      { envName: 'DINGTALK_APP_KEY', label: 'App Key', sensitive: false },
      { envName: 'DINGTALK_APP_SECRET', label: 'App Secret', sensitive: true },
    ],
    docsUrl: 'https://open.dingtalk.com/document/orgapp/create-an-enterprise-internal-application',
    steps: [
      '在钉钉开放平台创建企业内部应用，获取 App Key 和 App Secret',
      '在「机器人与消息推送」中开启机器人能力',
      '填写以下配置并保存，重启 API 服务后生效',
    ],
  },
];

/** Mask a sensitive value: show only that it is set, no suffix. Aligns with env-registry *** policy. */
function maskSensitiveValue(_value: string): string {
  return '••••••••';
}

export interface PlatformFieldStatus {
  envName: string;
  label: string;
  sensitive: boolean;
  /** null = not set, masked string = set (sensitive fields show last 4 chars) */
  currentValue: string | null;
}

export interface PlatformStatus {
  id: string;
  name: string;
  nameEn: string;
  configured: boolean;
  fields: PlatformFieldStatus[];
  docsUrl: string;
  steps: string[];
}

/** Read current env vars and build per-platform status. Pure function for testability. */
export function buildConnectorStatus(env: Record<string, string | undefined> = process.env): PlatformStatus[] {
  return CONNECTOR_PLATFORMS.map((platform) => {
    const fields: PlatformFieldStatus[] = platform.fields.map((f) => {
      const raw = env[f.envName];
      const isSet = raw != null && raw !== '' && !raw.startsWith('(未设置');
      return {
        envName: f.envName,
        label: f.label,
        sensitive: f.sensitive,
        currentValue: isSet ? (f.sensitive ? maskSensitiveValue(raw) : raw) : null,
      };
    });
    const configured = fields.every((f) => f.currentValue !== null);
    return {
      id: platform.id,
      name: platform.name,
      nameEn: platform.nameEn,
      configured,
      fields,
      docsUrl: platform.docsUrl,
      steps: platform.steps,
    };
  });
}

export const connectorHubRoutes: FastifyPluginAsync<ConnectorHubRoutesOptions> = async (app, opts) => {
  const { threadStore } = opts;

  // ── Existing: list Hub threads ──

  app.get('/api/connector/hub-threads', async (request, reply) => {
    const userId = requireTrustedHubIdentity(request, reply);
    if (!userId) {
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }
    const allThreads = await threadStore.list(userId);
    const hubThreads = allThreads
      .filter((t) => t.connectorHubState && t.id !== DEFAULT_THREAD_ID)
      .sort((a, b) => (b.connectorHubState?.createdAt ?? 0) - (a.connectorHubState?.createdAt ?? 0));
    return {
      threads: hubThreads.map((t) => ({
        id: t.id,
        title: t.title,
        connectorId: t.connectorHubState?.connectorId,
        externalChatId: t.connectorHubState?.externalChatId,
        createdAt: t.connectorHubState?.createdAt,
        lastCommandAt: t.connectorHubState?.lastCommandAt,
      })),
    };
  });

  // ── New: connector platform status ──

  app.get('/api/connector/status', async (request, reply) => {
    const userId = requireTrustedHubIdentity(request, reply);
    if (!userId) {
      return { error: 'Identity required (X-Cat-Cafe-User header)' };
    }
    return { platforms: buildConnectorStatus() };
  });
};
