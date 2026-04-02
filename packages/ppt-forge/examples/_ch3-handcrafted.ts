/**
 * Ch3 Architecture PPT — 手工精排版（7页高密度）
 *
 * 不走 storyline 自动拆页。每页一个核心观点，密排数据支撑。
 * 铲屎官原话："你别只走普通的流水线，你要自己思考"
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDeck } from '../src/slide-builder.js';
import type { DeckBlueprint, DiagramElement, SlideSpec, ThemeTokens } from '../src/types.js';

const theme: ThemeTokens = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../src/themes/huawei-like.json'), 'utf-8'),
);

// ── 手写 Blueprint：7 页，每页有存在理由 ──

const slides: SlideSpec[] = [
  // ══════════════════════════════════════════════
  // Page 1: 封面
  // ══════════════════════════════════════════════
  {
    slideId: 'cover',
    intent: 'cover',
    layoutId: 'layout-cover',
    elements: [
      { type: 'text', slotName: 'title', content: '架构：去中心化判断，结构化执行' },
      { type: 'text', slotName: 'subtitle', content: 'Cat Café 多 AI Agent 协作系统技术架构' },
    ],
    speakerNotes: '核心论点：行业都在用中央编排，我们选择把判断和执行分开。',
  },

  // ══════════════════════════════════════════════
  // Page 2: 行业全是中央编排（密排表格 + 核心结论）
  // ══════════════════════════════════════════════
  {
    slideId: 'industry-central',
    intent: 'content',
    layoutId: 'layout-dense-table',
    elements: [
      {
        type: 'text',
        slotName: 'title',
        content: '2026 年 Multi-Agent 四种主流模式 — 都做了同一个架构选择',
      },
      {
        type: 'table',
        slotName: 'table',
        headers: ['模式', '代表', '核心思路', '中心节点', '生产就绪度'],
        rows: [
          {
            cells: [
              { text: '状态图编排', fontBold: true },
              { text: 'LangGraph' },
              { text: '工作流=状态机\ncheckpoint/resume' },
              { text: '路由逻辑', fontColor: 'C7020E', fontBold: true },
              { text: 'Qodo/Klarna 生产', fontColor: '00B050' },
            ],
          },
          {
            cells: [
              { text: 'Boss+Sub-agent', fontBold: true },
              { text: 'Agent Teams\nOMOC Sisyphus' },
              { text: 'Lead 分配任务\nSub 向上汇报' },
              { text: 'Team Lead', fontColor: 'C7020E', fontBold: true },
              { text: '16-agent 编译器', fontColor: '00B050' },
            ],
          },
          {
            cells: [
              { text: '角色 Pipeline', fontBold: true },
              { text: 'CrewAI' },
              { text: '角色→流程→顺序执行' },
              { text: '预定义流程', fontColor: 'C7020E', fontBold: true },
              { text: 'AWS 官方背书', fontColor: '00B050' },
            ],
          },
          {
            cells: [
              { text: 'Cat Cafe', fontBold: true, bgColor: 'FFF1EF' },
              { text: '三猫协作', bgColor: 'FFF1EF' },
              { text: '对等判断+\n结构化执行', bgColor: 'FFF1EF' },
              { text: '无中心节点', fontColor: '00B050', fontBold: true, bgColor: 'FFF1EF' },
              { text: '63天 149 Features', fontColor: '00B050', bgColor: 'FFF1EF' },
            ],
          },
        ],
      },
    ],
    speakerNotes: '四种模式都有中心节点。我们是唯一没有中心节点的。',
  },

  // ══════════════════════════════════════════════
  // Page 3: 我们的架构（嵌套盒子图 + KPI 数据）
  // ══════════════════════════════════════════════
  {
    slideId: 'our-arch',
    intent: 'content',
    layoutId: 'layout-diagram',
    elements: [
      {
        type: 'text',
        slotName: 'title',
        content: '两层架构：对等判断（上层）+ 结构化执行（下层）— 缺一不可',
      },
      {
        type: 'diagram',
        slotName: 'diagram',
        boxes: [
          {
            id: 'root',
            label: 'Cat Café 多 AI Agent 协作架构',
            bgColor: 'FFFFFF',
            borderColor: 'C7020E',
            children: [
              {
                id: 'judge',
                label: '对等判断层 — 内容判断分布式完成',
                borderColor: '0070C0',
                children: [
                  {
                    id: 'cat-opus',
                    label: '布偶猫 Claude',
                    children: [
                      { id: 'o1', label: '架构设计', description: '系统分层/模块边界/API 设计' },
                      { id: 'o2', label: '后端开发', description: 'TS 全栈，MCP adapter + Worker' },
                      { id: 'o3', label: 'MCP 集成', description: 'Tool 协议适配，多 provider 路由' },
                    ],
                  },
                  {
                    id: 'cat-codex',
                    label: '缅因猫 GPT',
                    children: [
                      { id: 'c1', label: 'Code Review', description: '跨家族盲审，安全/边界/可维护性' },
                      { id: 'c2', label: '安全审计', description: '注入防护、权限校验、依赖扫描' },
                      { id: 'c3', label: '测试守护', description: '红绿循环，覆盖率 ≥80% 门禁' },
                    ],
                  },
                  {
                    id: 'cat-gemini',
                    label: '暹罗猫 Gemini',
                    children: [
                      { id: 'g1', label: '视觉审美', description: '配色/布局一致性，多模态反馈' },
                      { id: 'g2', label: 'UX 设计', description: 'Pencil 原型 → 交互流程验证' },
                      { id: 'g3', label: '创意发散', description: '竞品对标 + 差异化方案探索' },
                    ],
                  },
                  {
                    id: 'cross-review',
                    label: '跨家族 Review',
                    children: [
                      { id: 'cr1', label: '盲点互补', description: '不同训练数据 = 不同盲点，互审消除偏见' },
                      { id: 'cr2', label: '禁止自审', description: '铁律 #2：同一个体不能 review 自己' },
                      { id: 'cr3', label: '愿景守护', description: '第三只猫做最终验收，非作者非 reviewer' },
                    ],
                  },
                ],
              },
              {
                id: 'exec',
                label: '结构化执行层 — 统一管理执行通道',
                borderColor: 'C7020E',
                children: [
                  {
                    id: 'dispatch',
                    label: '统一调度',
                    children: [
                      { id: 'd1', label: 'InvocationQueue', description: '异步消息队列，确保并发安全' },
                      { id: 'd2', label: 'Slot 级并发', description: '每个 agent 独立 slot，互不阻塞' },
                      { id: 'd3', label: '铲屎官 Steer', description: '人类随时可介入调整方向' },
                    ],
                  },
                  {
                    id: 'session',
                    label: 'Session Strategy',
                    children: [
                      { id: 's1', label: 'handoff 交接', description: 'agent 间上下文完整传递' },
                      { id: 's2', label: 'compress 压缩', description: '长对话自动摘要保窗口效率' },
                      { id: 's3', label: 'hybrid 混合', description: 'handoff + compress 动态切换' },
                    ],
                  },
                  {
                    id: 'hooks',
                    label: 'Hooks 护栏层',
                    children: [
                      { id: 'h1', label: 'rm→trash 强制', description: '所有删除降级为回收站' },
                      { id: 'h2', label: 'Redis 6399 圣域', description: '生产 Redis 绝对隔离，dev=6398' },
                      { id: 'h3', label: '共享文档零延迟', description: 'Edit 后同消息 commit+push' },
                    ],
                  },
                  {
                    id: 'truth',
                    label: 'Shared Truth',
                    children: [
                      { id: 't1', label: 'Git 仓库', description: '唯一事实源，全版本化' },
                      { id: 't2', label: 'evidence.sqlite', description: '全文检索 + 向量语义 rerank' },
                      { id: 't3', label: '共享文档', description: 'specs/ADRs/lessons 多猫可见' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as DiagramElement,
    ],
    speakerNotes: '上层对等：任何猫←→任何猫直接通信。下层结构化：统一队列+执行策略+安全护栏。两层缺一不可。',
  },

  // ══════════════════════════════════════════════
  // Page 4: F088 实战数据 + 跨家族 Review 价值
  // ══════════════════════════════════════════════
  {
    slideId: 'f088-evidence',
    intent: 'content',
    layoutId: 'layout-kpi-4col',
    elements: [
      {
        type: 'text',
        slotName: 'title',
        content: 'F088 Chat Gateway — 跨家族 Review 一次发现 3 个 P1，架构对了交付变快',
      },
      {
        type: 'kpi',
        slotName: 'kpi-1',
        number: '3',
        label: 'P1 一次发现\nClaude 自己找不到',
        trend: 'up',
        trendColor: 'C7020E',
      },
      {
        type: 'kpi',
        slotName: 'kpi-2',
        number: '2天',
        label: '飞书接入\n(估计 3-4 天)',
        trend: 'up',
        trendColor: '00B050',
      },
      {
        type: 'kpi',
        slotName: 'kpi-3',
        number: '1.5天',
        label: 'Telegram 接入\n(估计 6-10 周)',
        trend: 'up',
        trendColor: '00B050',
      },
      {
        type: 'kpi',
        slotName: 'kpi-4',
        number: '3',
        label: '每平台仅需\n实现方法数',
        trend: 'up',
        trendColor: '0070C0',
      },
      {
        type: 'text',
        slotName: 'detail',
        content:
          '3 个 P1：① connector 绕过格式化层注入未清洗输入 ② 飞书 webhook 缺签名验证 ③ 多猫消息丢失发送者身份。三层网关架构让每个平台只需 parseEvent() + formatMessage() + sendMessage()。',
      },
    ],
    speakerNotes: '这页证明两件事：跨家族 review 能找到同家族找不到的 bug；好架构让交付变快。',
  },

  // ══════════════════════════════════════════════
  // Page 5: 六维对比大表（最有冲击力的一页）
  // ══════════════════════════════════════════════
  {
    slideId: 'six-dim-compare',
    intent: 'content',
    layoutId: 'layout-dense-table',
    elements: [
      {
        type: 'text',
        slotName: 'title',
        content: '六维对比：Cat Café vs 三种主流编排模式',
      },
      {
        type: 'table',
        slotName: 'table',
        headers: ['维度', 'Boss 模式', '状态图编排', '角色 Pipeline', 'Cat Café'],
        rows: [
          {
            cells: [
              { text: '内容判断', fontBold: true },
              { text: 'Lead 决定' },
              { text: '路由逻辑决定' },
              { text: '角色流程决定' },
              { text: '每只猫独立判断', fontColor: '00B050', fontBold: true },
            ],
          },
          {
            cells: [
              { text: '任务路由', fontBold: true },
              { text: 'Boss 分配' },
              { text: '图的 edge 决定' },
              { text: '上一步→下一步' },
              { text: '猫猫自主 @ 路由', fontColor: '00B050', fontBold: true },
            ],
          },
          {
            cells: [
              { text: '能否质疑', fontBold: true },
              { text: '向上汇报' },
              { text: '节点无权改图' },
              { text: '只能往下传' },
              { text: '任何猫可否决', fontColor: '00B050', fontBold: true },
            ],
          },
          {
            cells: [
              { text: '单点失败', fontBold: true },
              { text: 'Lead 挂→停', fontColor: 'C7020E' },
              { text: '图错→全错', fontColor: 'C7020E' },
              { text: '中间断→停', fontColor: 'C7020E' },
              { text: '降级但不崩', fontColor: '00B050', fontBold: true },
            ],
          },
          {
            cells: [
              { text: '偏见抵消', fontBold: true },
              { text: 'Lead=系统偏见' },
              { text: '图作者=系统偏见' },
              { text: 'SOP=系统偏见' },
              { text: '跨厂商交叉Review', fontColor: '00B050', fontBold: true },
            ],
          },
          {
            cells: [
              { text: '基础设施', fontBold: true },
              { text: '中心 agent 管' },
              { text: 'checkpoint+状态机' },
              { text: '固定流水线' },
              { text: '统一队列+独立槽位+护栏', fontColor: '00B050', fontBold: true },
            ],
          },
        ],
      },
    ],
    speakerNotes: '这页是全 deck 最核心的对比。六个维度全绿，最后一列是我们的差异化。',
  },

  // ══════════════════════════════════════════════
  // Page 6: 群体智能涌现 — 上限不在中心节点
  // ══════════════════════════════════════════════
  {
    slideId: 'emergence',
    intent: 'content',
    layoutId: 'layout-dense-table',
    elements: [
      {
        type: 'text',
        slotName: 'title',
        content: '上限对比：1×判断力 × N×执行力 vs N×判断力 → 涌现',
      },
      {
        type: 'table',
        slotName: 'table',
        headers: ['模式', '判断力', '执行力', '上限', '典型瓶颈'],
        rows: [
          {
            cells: [
              { text: '全人工', fontBold: true },
              { text: '铲屎官 1 人' },
              { text: '铲屎官 1 人' },
              { text: '精力天花板', fontColor: 'C7020E' },
              { text: '一天 8 小时' },
            ],
          },
          {
            cells: [
              { text: '中央编排', fontBold: true },
              { text: '编排器 1 个模型' },
              { text: 'N 个执行者' },
              { text: '编排器判断力', fontColor: 'C7020E' },
              { text: 'Boss 偏见扩散' },
            ],
          },
          {
            cells: [
              { text: '对等碰撞+方向漏斗', fontBold: true, bgColor: 'FFF1EF' },
              { text: 'N 个独立大脑\n交叉校准', bgColor: 'FFF1EF' },
              { text: 'N 个自组织猫\nSkill 协议兜底', bgColor: 'FFF1EF' },
              { text: '群体智能涌现', fontColor: '00B050', fontBold: true, bgColor: 'FFF1EF' },
              { text: '产出超越任何\n单个参与者预期', bgColor: 'FFF1EF' },
            ],
          },
        ],
      },
    ],
    speakerNotes: '防御视角：避免偏见。进攻视角：涌现的上限比中央编排更高。',
  },

  // ══════════════════════════════════════════════
  // Page 7: 封底
  // ══════════════════════════════════════════════
  {
    slideId: 'closing',
    intent: 'closing',
    layoutId: 'layout-closing',
    elements: [
      {
        type: 'text',
        slotName: 'title',
        content: '模型能力决定起点，成长决定走多远',
      },
      {
        type: 'text',
        slotName: 'contact',
        content: '63 天 · 149 Features · 40 Lessons Learned · 越磨合越聪明的团队',
      },
    ],
    speakerNotes: '不是越用越旧的工具，是越磨合越聪明的团队。',
  },
];

// Add renderBudget to all slides (required by V1 engine)
for (const s of slides) {
  if (!s.renderBudget) s.renderBudget = { maxWords: 120 };
}

const blueprint: DeckBlueprint = {
  meta: {
    title: '架构：去中心化判断，结构化执行',
    subtitle: 'Cat Café 多 AI Agent 协作系统',
    author: 'Cat Café 三猫团队',
    targetAudience: 'corporate-executive' as const,
  },
  slides,
};

const outputPath = resolve(process.env.HOME ?? '~', 'Desktop', 'ch3-handcrafted.pptx');

const pres = buildDeck(blueprint, theme);
pres
  .writeFile({ fileName: outputPath })
  .then(() => {
    console.log(`[handcrafted] Done: ${slides.length} slides → ${outputPath}`);
  })
  .catch((err: Error) => {
    console.error('[handcrafted] Fatal:', err);
    process.exit(1);
  });
