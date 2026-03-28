/**
 * Demo script: generates a full PPT from research + storyline using the pipeline.
 * Usage: tsx output/generate-demo.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateBlueprint } from '../src/blueprint-gen.js';
import { runPipeline } from '../src/pipeline.js';
import type { DeckBlueprint, ResearchOutput, SlideSpec, StorylineOutput } from '../src/types.js';

const DIR = import.meta.dirname;
const research: ResearchOutput = JSON.parse(readFileSync(resolve(DIR, 'demo-research.json'), 'utf-8'));
const storyline: StorylineOutput = JSON.parse(readFileSync(resolve(DIR, 'demo-storyline.json'), 'utf-8'));
const themePath = resolve(DIR, '../src/themes/huawei-like.json');

// Step 1: Generate blueprint skeleton from storyline
const blueprint = generateBlueprint(storyline, {
  title: 'AI Agent 2026：市场格局与技术趋势',
  subtitle: '从实验到生产的转折年',
  author: 'Cat Café PPT Forge',
  targetAudience: 'corporate-executive',
});

// Step 2: Enrich specific slides with real data (chart, KPI, table)
function enrichSlide(slide: SlideSpec): void {
  switch (slide.slideId) {
    // Market KPI slide — 3 big numbers
    case 'slide-market-kpi':
      slide.layoutId = 'layout-kpi';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '2026 全球 AI Agent 市场概览' },
        { type: 'kpi', slotName: 'kpi-1', number: '$10.9B', label: '2026 市场规模', trend: 'up', trendColor: '00B050' },
        {
          type: 'kpi',
          slotName: 'kpi-2',
          number: '49.6%',
          label: 'CAGR (2026-2033)',
          trend: 'up',
          trendColor: '00B050',
        },
        { type: 'kpi', slotName: 'kpi-3', number: '$183B', label: '2033 预测规模', trend: 'up', trendColor: '00B050' },
        {
          type: 'text',
          slotName: 'detail',
          content: '数据来源：Grand View Research, Fortune Business Insights, Precedence Research 综合',
        },
      ];
      break;

    // Adoption chart — bar chart
    case 'slide-market-chart':
      slide.layoutId = 'layout-chart-insight';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '企业 AI Agent 采用率已跨越拐点' },
        {
          type: 'chart',
          slotName: 'chart',
          chartType: 'bar',
          data: {
            chartProfile: 'categorical' as const,
            categories: ['Global 2000\n生产部署', '整体\n采用率', '年底企业应用\n集成预测', '2025\n集成率'],
            series: [{ name: '占比 (%)', values: [72, 79, 40, 5] }],
          },
        },
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**关键洞察**\n\n• 72% Global 2000 企业已进入生产\n• 年底 40% 企业应用将集成 Agent\n• 相比 2025 年（<5%）是 **8 倍跃升**\n\n来源：OpenClaw, Gartner, Warmly',
        },
      ];
      break;

    // Players comparison table
    case 'slide-players-table':
      slide.layoutId = 'layout-dense-table';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '大厂 vs 创业公司：两条赛道并行' },
        {
          type: 'table',
          slotName: 'table',
          headers: ['公司', '类型', '核心产品', '定价/估值', '战略定位'],
          rows: [
            {
              cells: [
                { text: 'Google' },
                { text: '大厂' },
                { text: 'Gemini + Vertex AI Agent Builder' },
                { text: '按 API 调用计费' },
                { text: '搜索+Android 生态网络效应', fontColor: '00B050', fontBold: true },
              ],
            },
            {
              cells: [
                { text: 'Microsoft' },
                { text: '大厂' },
                { text: '365 Copilot + Work IQ' },
                { text: '$30/user/month' },
                { text: 'Office 生态锁定', fontColor: '0070C0', fontBold: true },
              ],
            },
            {
              cells: [
                { text: 'Salesforce' },
                { text: '大厂' },
                { text: 'Agentforce' },
                { text: '$2/conversation' },
                { text: 'CRM 原生 Agent', fontColor: '7030A0', fontBold: true },
              ],
            },
            {
              cells: [
                { text: 'Cursor', bgColor: 'FFF2CC' },
                { text: '创业', bgColor: 'FFF2CC' },
                { text: 'AI 代码编辑器', bgColor: 'FFF2CC' },
                { text: '$29B 估值', bgColor: 'FFF2CC', fontColor: 'CF0A2C', fontBold: true },
                { text: '开发者工具', bgColor: 'FFF2CC' },
              ],
            },
            {
              cells: [
                { text: 'Sierra', bgColor: 'FFF2CC' },
                { text: '创业', bgColor: 'FFF2CC' },
                { text: 'AI 客服 Agent', bgColor: 'FFF2CC' },
                { text: '$10B 估值', bgColor: 'FFF2CC', fontColor: 'CF0A2C', fontBold: true },
                { text: '企业客服', bgColor: 'FFF2CC' },
              ],
            },
            {
              cells: [
                { text: 'Glean', bgColor: 'FFF2CC' },
                { text: '创业', bgColor: 'FFF2CC' },
                { text: '企业搜索 Agent', bgColor: 'FFF2CC' },
                { text: '$7.2B 估值', bgColor: 'FFF2CC', fontColor: 'CF0A2C', fontBold: true },
                { text: '企业知识管理', bgColor: 'FFF2CC' },
              ],
            },
          ],
        },
      ];
      break;

    // Startup KPI — 4 col
    case 'slide-players-kpi':
      slide.layoutId = 'layout-kpi-4col';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '头部 AI Agent 创业公司估值' },
        {
          type: 'kpi',
          slotName: 'kpi-1',
          number: '$29B',
          label: 'Cursor\n代码 Agent',
          trend: 'up',
          trendColor: 'CF0A2C',
        },
        {
          type: 'kpi',
          slotName: 'kpi-2',
          number: '$10B',
          label: 'Sierra\n客服 Agent',
          trend: 'up',
          trendColor: 'CF0A2C',
        },
        {
          type: 'kpi',
          slotName: 'kpi-3',
          number: '$7.2B',
          label: 'Glean\n搜索 Agent',
          trend: 'up',
          trendColor: 'CF0A2C',
        },
        {
          type: 'kpi',
          slotName: 'kpi-4',
          number: '$2B',
          label: 'Cognition AI\nDevIn',
          trend: 'up',
          trendColor: 'CF0A2C',
        },
        {
          type: 'text',
          slotName: 'detail',
          content:
            '创业公司估值已达天文数字。Cursor 一年内估值翻 14 倍（$2B→$29B）。AI Agent 赛道是 2026 年融资最活跃的领域。',
        },
      ];
      break;

    // Industry adoption chart — bar
    case 'slide-industry-chart':
      slide.layoutId = 'layout-chart-insight';
      slide.elements = [
        { type: 'text', slotName: 'title', content: '行业渗透率：电信与零售领跑' },
        {
          type: 'chart',
          slotName: 'chart',
          chartType: 'bar',
          data: {
            chartProfile: 'categorical' as const,
            categories: ['电信', '零售/CPG', '金融服务', '医疗健康', '制造业'],
            series: [{ name: '采用率 (%)', values: [48, 47, 40, 30, 25] }],
          },
        },
        {
          type: 'text',
          slotName: 'insight',
          content:
            '**行业分析**\n\n• 电信 48%：客服自动化+网络运维\n• 零售 47%：个性化推荐+库存优化\n• 金融 ~40%：风控+合规自动化\n• 医疗 ~30%：辅助诊断+文档生成\n\n来源：Warmly AI Agents Statistics 2026',
        },
      ];
      break;
  }
}

for (const slide of blueprint.slides) {
  enrichSlide(slide);
}

// Step 3: Save enriched blueprint
const blueprintPath = resolve(DIR, '../output/demo-blueprint-enriched.json');
writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2));
console.log(`[demo] Blueprint saved: ${blueprintPath}`);

// Step 4: Run pipeline
const outputPath = resolve(DIR, '../output/ai-agent-2026-report.pptx');
const desktopPath = resolve(process.env.HOME ?? '~', 'Desktop', 'ai-agent-2026-report.pptx');

async function main() {
  const result = await runPipeline({
    research,
    storyline,
    blueprint,
    themePath,
    outputPath,
  });

  console.log(`[demo] Pipeline complete: ${result.slidesCount} slides`);
  console.log(
    `[demo] Gates: R=${result.gateResults.research} N=${result.gateResults.narrative} B=${result.gateResults.blueprint}`,
  );

  // Copy to Desktop
  writeFileSync(desktopPath, result.buffer);
  console.log(`[demo] ✓ Copied to Desktop: ${desktopPath}`);
}

main().catch((err) => {
  console.error('[demo] Fatal:', err);
  process.exit(1);
});
