/**
 * Generate Cat Café Architecture PPT — 华为风格
 * Usage: tsx examples/generate-cat-cafe-ppt.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateBlueprint } from '../src/blueprint-gen.js';
import { runPipeline } from '../src/pipeline.js';
import type { DiagramElement, ResearchOutput, SlideSpec, StorylineOutput } from '../src/types.js';

const DIR = import.meta.dirname;
const research: ResearchOutput = JSON.parse(readFileSync(resolve(DIR, 'cat-cafe-research.json'), 'utf-8'));
const storyline: StorylineOutput = JSON.parse(readFileSync(resolve(DIR, 'cat-cafe-storyline.json'), 'utf-8'));
const themePath = resolve(DIR, '../src/themes/huawei-like.json');

const blueprint = generateBlueprint(storyline, {
  title: 'Cat Café 架构设计',
  subtitle: '多 AI Agent 真协作系统 — 华为风格',
  author: 'Cat Café 三猫团队',
  targetAudience: 'corporate-executive',
});

function enrichSlide(slide: SlideSpec): void {
  switch (slide.slideId) {
    // ── Section 1: 愿景 ──

    case 'slide-vision-kpi':
      slide.layoutId = 'layout-kpi-4col';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '63 天，三猫从零搭建完整 AI 协作系统' },
        { type: 'kpi', slotName: 'kpi-1', number: '3,567', label: '代码提交', trend: 'up', trendColor: '00B050' },
        { type: 'kpi', slotName: 'kpi-2', number: '149', label: 'Feature Specs', trend: 'up', trendColor: '00B050' },
        { type: 'kpi', slotName: 'kpi-3', number: '6,700+', label: '自动化测试', trend: 'up', trendColor: '00B050' },
        { type: 'kpi', slotName: 'kpi-4', number: '25', label: '协作 Skills', trend: 'up', trendColor: '0070C0' },
        {
          type: 'text',
          slotName: 'detail',
          content: '2026-01-25 春节立项至 2026-03-28，布偶猫(Claude) + 缅因猫(GPT) + 暹罗猫(Gemini) 三猫协作',
        },
      ];
      break;

    // ── Section 2: 架构 ──

    case 'slide-arch-overview': {
      slide.layoutId = 'layout-diagram';
      const archDiagram: DiagramElement = {
        type: 'diagram',
        slotName: 'diagram',
        boxes: [
          {
            id: 'sys',
            label: 'Cat Café System',
            bgColor: 'FFFFFF',
            borderColor: 'CF0A2C',
            children: [
              {
                id: 'fe',
                label: 'Frontend (Next.js 14)',
                borderColor: '0070C0',
                children: [
                  { id: 'fe-chat', label: 'Chat UI' },
                  { id: 'fe-ws', label: 'Workspace' },
                  { id: 'fe-mission', label: 'Mission Hub' },
                ],
              },
              {
                id: 'be',
                label: 'Backend (Fastify)',
                borderColor: 'CF0A2C',
                children: [
                  { id: 'be-router', label: 'Agent Router' },
                  { id: 'be-session', label: 'Session Mgr' },
                  { id: 'be-gateway', label: 'Chat Gateway' },
                  { id: 'be-connector', label: 'Connector Hub' },
                ],
              },
              {
                id: 'mcp',
                label: 'MCP Layer',
                borderColor: '7030A0',
                children: [
                  { id: 'mcp-tools', label: 'Shared Tools' },
                  { id: 'mcp-signals', label: 'Signals' },
                ],
              },
              {
                id: 'state',
                label: 'State Layer',
                borderColor: '00B050',
                children: [
                  { id: 'state-redis', label: 'Redis PubSub' },
                  { id: 'state-sqlite', label: 'evidence.sqlite' },
                ],
              },
            ],
          },
        ],
      };
      slide.elements = [
        { type: 'text', slotName: 'title', content: '五层架构：前端 → 后端 → Agent Router → MCP → 状态层' },
        archDiagram,
      ];
      break;
    }

    case 'slide-arch-stack':
      slide.layoutId = 'layout-dense-table';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '技术栈矩阵：5 个包，55 万行代码' },
        {
          type: 'table',
          slotName: 'table',
          headers: ['包名', '技术栈', '代码量', '测试数', '核心职责'],
          rows: [
            {
              cells: [
                { text: '@cat-cafe/api', fontBold: true },
                { text: 'Fastify + Socket.io' },
                { text: '440K LOC', fontColor: 'CF0A2C', fontBold: true },
                { text: '6,595', fontColor: '00B050' },
                { text: 'Agent Router / Session / 消息编排' },
              ],
            },
            {
              cells: [
                { text: '@cat-cafe/web', fontBold: true },
                { text: 'Next.js 14 + React' },
                { text: '103K LOC', fontColor: 'CF0A2C', fontBold: true },
                { text: '50+', fontColor: '00B050' },
                { text: '聊天界面 / Workspace / Mission Hub' },
              ],
            },
            {
              cells: [
                { text: '@cat-cafe/shared', fontBold: true },
                { text: 'TypeScript' },
                { text: '4.7K LOC' },
                { text: '—' },
                { text: '跨包共享类型 / 工具 / Redis 工具' },
              ],
            },
            {
              cells: [
                { text: '@cat-cafe/mcp-server', fontBold: true },
                { text: 'MCP SDK' },
                { text: '3.6K LOC' },
                { text: '—' },
                { text: '共享 MCP 工具 / 资源 / Signals' },
              ],
            },
            {
              cells: [
                { text: '@cat-cafe/ppt-forge', fontBold: true, bgColor: 'FFF2CC' },
                { text: 'pptxgenjs', bgColor: 'FFF2CC' },
                { text: '2K LOC', bgColor: 'FFF2CC' },
                { text: '80', fontColor: '00B050', bgColor: 'FFF2CC' },
                { text: 'PPT 五层管线引擎（本 PPT 产物）', bgColor: 'FFF2CC' },
              ],
            },
          ],
        },
      ];
      break;

    case 'slide-arch-agents':
      slide.layoutId = 'layout-chart-insight';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '三猫接入：三种 AI，三种思维' },
        {
          type: 'chart',
          slotName: 'chart',
          chartType: 'bar',
          data: {
            chartProfile: 'categorical' as const,
            categories: ['布偶猫\nClaude Opus', '缅因猫\nGPT Codex', '缅因猫\nGPT-5.4', '暹罗猫\nGemini'],
            series: [
              { name: '架构/MCP', values: [95, 20, 60, 10] },
              { name: 'Review/测试', values: [15, 90, 85, 5] },
              { name: '创意/设计', values: [10, 5, 15, 90] },
            ],
          },
        },
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**接入方式**\n\n• Claude Agent SDK → 完整 Agent 能力\n• OpenAI Codex SDK → 代码审查\n• Google ADK → 视觉创意\n\n**铁律**：同一个体不能 review 自己的代码',
        },
      ];
      break;

    // ── Section 3: 创新 ──

    case 'slide-innov-protocol': {
      slide.layoutId = 'layout-diagram-insight';
      const protocolDiagram: DiagramElement = {
        type: 'diagram',
        slotName: 'diagram',
        boxes: [
          {
            id: 'a2a',
            label: 'A2A 协作协议',
            borderColor: 'CF0A2C',
            children: [
              {
                id: 'handoff',
                label: 'Why-First 交接',
                children: [
                  { id: 'what', label: 'What' },
                  { id: 'why', label: 'Why' },
                  { id: 'tradeoff', label: 'Tradeoff' },
                  { id: 'open', label: 'Open Q' },
                  { id: 'next', label: 'Next' },
                ],
              },
              {
                id: 'rules',
                label: '铁律',
                children: [
                  { id: 'r1', label: '不能 Review 自己' },
                  { id: 'r2', label: '愿景守护' },
                ],
              },
            ],
          },
        ],
      };
      slide.elements = [
        { type: 'text', slotName: 'title', content: 'A2A 协作协议：猫猫是 Agent 不是 API' },
        protocolDiagram,
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**自主感知 → 自主决策**\n\n• 交接必须写清 Why\n• 跨猫 Review 铁律\n• 非 author 非 reviewer 做愿景守护\n• SOP 全自动推进',
        },
      ];
      break;
    }

    case 'slide-innov-memory': {
      slide.layoutId = 'layout-diagram-insight';
      const memoryDiagram: DiagramElement = {
        type: 'diagram',
        slotName: 'diagram',
        boxes: [
          {
            id: 'mem',
            label: '记忆系统',
            borderColor: '0070C0',
            children: [
              {
                id: 'store',
                label: 'evidence.sqlite',
                children: [
                  { id: 'fts', label: 'FTS5 全文' },
                  { id: 'vec', label: '向量语义' },
                ],
              },
              {
                id: 'feed',
                label: 'Knowledge Feed',
                children: [
                  { id: 'auto', label: '自动摘要' },
                  { id: 'approve', label: '人工确认' },
                ],
              },
            ],
          },
        ],
      };
      slide.elements = [
        { type: 'text', slotName: 'title', content: '记忆系统：evidence.sqlite 全文 + 向量 rerank' },
        memoryDiagram,
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**三种检索模式**\n\n• lexical：精确 ID/术语\n• semantic：跨语言同义\n• hybrid：推荐日常\n\n**Knowledge Feed**\n每 30 分钟自动摘要，提取 durable knowledge',
        },
      ];
      break;
    }

    case 'slide-innov-skills':
      slide.layoutId = 'layout-chart-insight';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '25 个 Skill：覆盖全开发生命周期' },
        {
          type: 'chart',
          slotName: 'chart',
          chartType: 'bar',
          data: {
            chartProfile: 'categorical' as const,
            categories: [
              '开发\n(TDD/Worktree)',
              '质量\n(Gate/Debug)',
              'Review\n(Req/Recv)',
              '研究\n(Deep/Collab)',
              '运营\n(OSS/Skill)',
            ],
            series: [{ name: 'Skill 数量', values: [5, 4, 4, 3, 5] }],
          },
        },
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**Skill 不是可选的——适用就必须加载**\n\n• feat-lifecycle → design-gate → writing-plans → worktree → tdd → quality-gate → request-review → receive-review → merge-gate\n• 全链路 SOP 自动推进（§17）',
        },
      ];
      break;

    // ── Section 4: 工程能力 ──

    case 'slide-eng-chart':
      slide.layoutId = 'layout-chart-insight';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '代码量分布：API 核心占比 80%' },
        {
          type: 'chart',
          slotName: 'chart',
          chartType: 'bar',
          data: {
            chartProfile: 'categorical' as const,
            categories: ['API\n后端', 'Web\n前端', 'Shared\n共享', 'MCP\nServer', 'PPT\nForge'],
            series: [{ name: '代码行数 (K)', values: [440, 103, 4.7, 3.6, 2] }],
          },
        },
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**工程规模**\n\n• 总计 55 万行 TypeScript\n• API 占 80%：Agent Router + 消息编排 + Connector 集群\n• 63 天交付速度：日均 57 commits\n• 三猫自主协作，铲屎官只做方向决策',
        },
      ];
      break;

    case 'slide-eng-features':
      slide.layoutId = 'layout-dense-table';
      slide.elements = [
        { type: 'text', slotName: 'title', content: 'Top 10 Feature 活跃度（按 Commit 数）' },
        {
          type: 'table',
          slotName: 'table',
          headers: ['排名', 'Feature', '描述', 'Commits', '状态'],
          rows: [
            {
              cells: [
                { text: '1' },
                { text: 'F101', fontBold: true },
                { text: '记忆系统 evidence.sqlite' },
                { text: '108', fontColor: 'CF0A2C', fontBold: true },
                { text: '✅ in-progress', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '2' },
                { text: 'F102', fontBold: true },
                { text: 'Knowledge Feed 知识抽取' },
                { text: '106', fontColor: 'CF0A2C', fontBold: true },
                { text: '✅ in-progress', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '3' },
                { text: 'F088', fontBold: true },
                { text: 'Chat Gateway 消息网关' },
                { text: '101', fontColor: 'CF0A2C', fontBold: true },
                { text: '✅ done', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '4' },
                { text: 'F059', fontBold: true },
                { text: 'Agent Router 智能路由' },
                { text: '77' },
                { text: '✅ done', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '5' },
                { text: 'F063', fontBold: true },
                { text: 'Workspace 面板' },
                { text: '69' },
                { text: '✅ in-progress', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '6' },
                { text: 'F139', fontBold: true },
                { text: '飞书 Adapter 接入' },
                { text: '46' },
                { text: '🚧 in-progress', fontColor: '0070C0' },
              ],
            },
            {
              cells: [
                { text: '7' },
                { text: 'F122', fontBold: true },
                { text: 'A2A 跨猫协作协议' },
                { text: '38' },
                { text: '✅ done', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '8' },
                { text: 'F058', fontBold: true },
                { text: '猫猫状态管理' },
                { text: '37' },
                { text: '✅ done', fontColor: '00B050' },
              ],
            },
            {
              cells: [
                { text: '9' },
                { text: 'F137', fontBold: true },
                { text: 'Telegram 适配器' },
                { text: '35' },
                { text: '🚧 in-progress', fontColor: '0070C0' },
              ],
            },
            {
              cells: [
                { text: '10', bgColor: 'FFF2CC' },
                { text: 'F144', fontBold: true, bgColor: 'FFF2CC' },
                { text: 'PPT Forge 引擎', bgColor: 'FFF2CC' },
                { text: '30+', bgColor: 'FFF2CC' },
                { text: '🔥 TODAY', fontColor: 'CF0A2C', fontBold: true, bgColor: 'FFF2CC' },
              ],
            },
          ],
        },
      ];
      break;
    case 'slide-meta-forge': {
      slide.layoutId = 'layout-diagram-insight';
      const forgeDiagram: DiagramElement = {
        type: 'diagram',
        slotName: 'diagram',
        boxes: [
          {
            id: 'pipeline',
            label: 'PPT Forge Pipeline',
            borderColor: 'CF0A2C',
            children: [
              { id: 'research', label: 'Research', bgColor: 'E8F5E9' },
              { id: 'narrative', label: 'Narrative', bgColor: 'E3F2FD' },
              { id: 'blueprint', label: 'Blueprint', bgColor: 'FFF3E0' },
              { id: 'style', label: 'Style', bgColor: 'F3E5F5' },
              { id: 'export', label: 'Export', bgColor: 'FFF2CC' },
            ],
          },
        ],
      };
      slide.elements = [
        { type: 'text', slotName: 'title', content: '这份 PPT = PPT Forge 管线产物' },
        forgeDiagram,
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**五层管线今日打通**\n\n• Research → 数据抓取\n• Narrative → 故事线\n• Blueprint → 布局骨架\n• Style → 华为 Design Token\n• Export → pptxgenjs 渲染\n\n**91 个测试全绿**',
        },
      ];
      break;
    }
  }
}

for (const slide of blueprint.slides) {
  enrichSlide(slide);
}

const desktopPath = resolve(process.env.HOME ?? '~', 'Desktop', 'cat-cafe-architecture.pptx');

async function main() {
  const result = await runPipeline({
    research,
    storyline,
    blueprint,
    themePath,
    outputPath: desktopPath,
  });

  console.log(`[cat-cafe-ppt] ✓ ${result.slidesCount} slides → ${desktopPath}`);
  console.log(
    `[cat-cafe-ppt]   Gates: R=${result.gateResults.research} N=${result.gateResults.narrative} B=${result.gateResults.blueprint}`,
  );
}

main().catch((err) => {
  console.error('[cat-cafe-ppt] Fatal:', err);
  process.exit(1);
});
