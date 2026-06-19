import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fastapiRoutePlugin } from '../src/extractors/fastapi-route.ts';
import type { SourceFile } from '../src/plugin.ts';

const FASTAPI_FIXTURE: SourceFile[] = [
  {
    path: 'backend/app/gateway/routers/threads.py',
    content: `
from fastapi import APIRouter

router = APIRouter(prefix="/api/threads", tags=["threads"])

@router.post("", response_model=ThreadResponse)
async def create_thread():
    pass

@router.get(
    "/{thread_id}",
    response_model=ThreadResponse,
    summary="Get Thread",
)
@require_permission("threads", "read", owner_check=True)
async def get_thread(thread_id: str):
    pass
`,
  },
];

test('抽取 FastAPI route nodes + router declares edges（Phase B 陌生 repo 骨架）', () => {
  const result = fastapiRoutePlugin.extract({ repo: 'deer-flow', files: FASTAPI_FIXTURE });
  const routes = result.nodes.filter((n) => n.kind === 'fastapi_route');
  assert.deepEqual(routes.map((r) => r.name).sort(), ['GET /api/threads/{thread_id}', 'POST /api/threads']);

  const getRoute = routes.find((r) => r.name === 'GET /api/threads/{thread_id}')!;
  assert.equal(getRoute.metadata?.handler, 'get_thread');
  assert.equal(getRoute.metadata?.method, 'GET');
  assert.equal(getRoute.metadata?.path, '/api/threads/{thread_id}');
  assert.equal(getRoute.startLine, 10);

  const router = result.nodes.find((n) => n.kind === 'fastapi_router' && n.name === 'router')!;
  assert.ok(result.edges.some((e) => e.kind === 'declares' && e.source === router.id && e.target === getRoute.id));
  const edge = result.edges.find((e) => e.target === getRoute.id)!;
  assert.equal(edge.provenance.extractor, 'fastapi-route-extractor');
  assert.equal(edge.provenance.sourceFile, 'backend/app/gateway/routers/threads.py');
  assert.equal(edge.provenance.sourceLine, 10);
});

test('gap：检测到 APIRouter 但没有支持的 route decorator 时不静默 0 命中', () => {
  const result = fastapiRoutePlugin.extract({
    repo: 'deer-flow',
    files: [
      {
        path: 'backend/app/gateway/routers/ws.py',
        content: `
from fastapi import APIRouter
router = APIRouter(prefix="/ws")
`,
      },
    ],
  });
  assert.equal(result.nodes.length, 1);
  assert.equal(result.edges.length, 0);
  assert.equal(result.gaps.length, 1);
  assert.match(result.gaps[0]!.reason, /APIRouter/);
});

test('gap：检测到多行 APIRouter 但暂不支持解析时也不静默 0 命中', () => {
  const result = fastapiRoutePlugin.extract({
    repo: 'deer-flow',
    files: [
      {
        path: 'backend/app/gateway/routers/multiline.py',
        content: `
from fastapi import APIRouter
router = APIRouter(
    prefix="/api/multiline",
    tags=["multiline"],
)
`,
      },
    ],
  });

  assert.equal(result.nodes.length, 0);
  assert.equal(result.edges.length, 0);
  assert.equal(result.gaps.length, 1);
  assert.match(result.gaps[0]!.reason, /APIRouter/);
});

test('decorator 使用 keyword path 时不会把 tags 字符串误当 route path', () => {
  const result = fastapiRoutePlugin.extract({
    repo: 'deer-flow',
    files: [
      {
        path: 'backend/app/gateway/routers/admin.py',
        content: `
from fastapi import APIRouter
router = APIRouter(prefix="/api")

@router.get(tags=["admin"], path="/items")
async def list_items():
    pass
`,
      },
    ],
  });

  const routes = result.nodes.filter((n) => n.kind === 'fastapi_route');
  assert.equal(routes.length, 1);
  assert.equal(routes[0]!.name, 'GET /api/items');
  assert.equal(routes[0]!.metadata?.localPath, '/items');
});

test('scopeKey 使用 repo-relative path，避免同 basename router 混淆', () => {
  const result = fastapiRoutePlugin.extract({
    repo: 'deer-flow',
    files: [
      {
        path: 'backend/admin/routes.py',
        content: `
from fastapi import APIRouter
router = APIRouter(prefix="/admin")

@router.get("/health")
async def admin_health():
    pass
`,
      },
      {
        path: 'backend/api/routes.py',
        content: `
from fastapi import APIRouter
router = APIRouter(prefix="/api")

@router.get("/health")
async def api_health():
    pass
`,
      },
    ],
  });

  const routers = result.nodes.filter((n) => n.kind === 'fastapi_router');
  assert.equal(routers.length, 2);
  assert.equal(new Set(routers.map((n) => n.id)).size, 2);
  assert.ok(routers.some((n) => n.scopeKey.includes('backend/admin/routes.py')));
  assert.ok(routers.some((n) => n.scopeKey.includes('backend/api/routes.py')));

  const adminRoute = result.nodes.find((n) => n.kind === 'fastapi_route' && n.name === 'GET /admin/health')!;
  const apiRoute = result.nodes.find((n) => n.kind === 'fastapi_route' && n.name === 'GET /api/health')!;
  assert.equal(result.edges.find((e) => e.target === adminRoute.id)?.provenance.sourceFile, 'backend/admin/routes.py');
  assert.equal(result.edges.find((e) => e.target === apiRoute.id)?.provenance.sourceFile, 'backend/api/routes.py');
});
