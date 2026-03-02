import type { CatId, ThreadPhase } from '@cat-cafe/shared';

export interface MutableBacklogSuggestion {
  catId: CatId;
  why: string;
  plan: string;
  requestedPhase: ThreadPhase;
  status: 'pending' | 'approved' | 'rejected';
  suggestedAt: number;
  decidedAt?: number;
  decidedBy?: string;
  note?: string;
}

export interface MutableBacklogAuditEntry {
  id: string;
  action: 'created' | 'suggested' | 'approved' | 'rejected' | 'dispatched';
  actor: { kind: 'cat' | 'user'; id: string };
  timestamp: number;
  detail?: string;
}

export interface MutableBacklogItem {
  id: string;
  userId: string;
  title: string;
  summary: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  tags: string[];
  status: 'open' | 'suggested' | 'approved' | 'dispatched';
  createdBy: 'user' | CatId;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  dispatchedAt?: number;
  audit: MutableBacklogAuditEntry[];
  suggestion?: MutableBacklogSuggestion;
  dispatchedThreadId?: string;
  dispatchedThreadPhase?: ThreadPhase;
}

export function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

export function cloneItem(item: MutableBacklogItem): MutableBacklogItem {
  return {
    ...item,
    tags: [...item.tags],
    audit: item.audit.map((entry) => ({
      ...entry,
      actor: { ...entry.actor },
    })),
    ...(item.suggestion ? { suggestion: { ...item.suggestion } } : {}),
  };
}

export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
  descriptor?.set?.call(element, value);
}

export async function flush(act: (callback: () => Promise<void>) => Promise<void>): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

interface CreateItemBody {
  title: string;
  summary: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  tags: string[];
}

interface SuggestClaimBody {
  catId: CatId;
  why: string;
  plan: string;
  requestedPhase: ThreadPhase;
}

interface DecideClaimBody {
  decision: 'approve' | 'reject';
  threadPhase?: ThreadPhase;
  note?: string;
}

export interface MissionControlMockBackend {
  setItems(nextItems: MutableBacklogItem[]): void;
  getItems(): MutableBacklogItem[];
  handleRequest(path: string, init?: RequestInit): Promise<Response>;
}

export function createMissionControlMockBackend(): MissionControlMockBackend {
  let items: MutableBacklogItem[] = [];
  let itemSeq = 1;
  let threadSeq = 1;

  const setItems = (nextItems: MutableBacklogItem[]) => {
    items = nextItems.map((item) => cloneItem(item));
  };

  const getItems = () => items;

  const handleRequest = async (path: string, init?: RequestInit): Promise<Response> => {
    if (path === '/api/cats') {
      return mockResponse(200, {
        cats: [
          {
            id: 'codex',
            displayName: '缅因猫',
            nickname: '砚砚',
            color: { primary: '#4B5563', secondary: '#E5E7EB' },
            mentionPatterns: ['@codex'],
            provider: 'openai',
            defaultModel: 'gpt-5.3-codex',
            avatar: '/avatars/codex.png',
            roleDescription: 'review',
            personality: 'rigorous',
          },
        ],
      });
    }

    if (path === '/api/backlog/items' && (!init?.method || init.method === 'GET')) {
      return mockResponse(200, { items: items.map((item) => cloneItem(item)) });
    }

    if (path === '/api/backlog/items' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as CreateItemBody;
      const now = Date.now();
      const item: MutableBacklogItem = {
        id: `b-${itemSeq++}`,
        userId: 'u_test',
        title: body.title,
        summary: body.summary,
        priority: body.priority,
        tags: body.tags ?? [],
        status: 'open',
        createdBy: 'user',
        createdAt: now,
        updatedAt: now,
        audit: [{
          id: `a-${now}`,
          action: 'created',
          actor: { kind: 'user', id: 'u_test' },
          timestamp: now,
        }],
      };
      items = [item, ...items];
      return mockResponse(201, item);
    }

    const suggestMatch = path.match(/^\/api\/backlog\/items\/([^/]+)\/suggest-claim$/);
    if (suggestMatch && init?.method === 'POST') {
      const id = decodeURIComponent(suggestMatch[1] ?? '');
      const body = JSON.parse(String(init.body)) as SuggestClaimBody;
      const target = items.find((item) => item.id === id);
      if (!target) return mockResponse(404, { error: 'not found' });
      const updated: MutableBacklogItem = {
        ...target,
        status: 'suggested',
        suggestion: {
          catId: body.catId,
          why: body.why,
          plan: body.plan,
          requestedPhase: body.requestedPhase,
          status: 'pending',
          suggestedAt: Date.now(),
        },
        updatedAt: Date.now(),
      };
      items = items.map((item) => (item.id === id ? updated : item));
      return mockResponse(200, cloneItem(updated));
    }

    const decideMatch = path.match(/^\/api\/backlog\/items\/([^/]+)\/decide-claim$/);
    if (decideMatch && init?.method === 'POST') {
      const id = decodeURIComponent(decideMatch[1] ?? '');
      const body = JSON.parse(String(init.body)) as DecideClaimBody;
      const target = items.find((item) => item.id === id);
      if (!target) return mockResponse(404, { error: 'not found' });

      if (body.decision === 'reject') {
        const updated: MutableBacklogItem = {
          ...target,
          status: 'open',
          suggestion: target.suggestion
            ? {
              ...target.suggestion,
              status: 'rejected',
              decidedAt: Date.now(),
              decidedBy: 'u_test',
              ...(body.note ? { note: body.note } : {}),
            }
            : undefined,
          updatedAt: Date.now(),
        };
        items = items.map((item) => (item.id === id ? updated : item));
        return mockResponse(200, { item: cloneItem(updated) });
      }

      const updated: MutableBacklogItem = {
        ...target,
        status: 'dispatched',
        dispatchedThreadId: `thread-${threadSeq++}`,
        dispatchedThreadPhase: body.threadPhase ?? 'coding',
        suggestion: target.suggestion
          ? {
            ...target.suggestion,
            status: 'approved',
            decidedAt: Date.now(),
            decidedBy: 'u_test',
          }
          : undefined,
        updatedAt: Date.now(),
      };
      items = items.map((item) => (item.id === id ? updated : item));
      return mockResponse(200, {
        item: cloneItem(updated),
        thread: { id: updated.dispatchedThreadId },
      });
    }

    return mockResponse(500, { error: `unexpected path: ${path}` });
  };

  return {
    setItems,
    getItems,
    handleRequest,
  };
}
