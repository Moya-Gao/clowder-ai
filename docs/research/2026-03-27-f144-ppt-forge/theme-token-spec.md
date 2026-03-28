---
feature_ids: [F144]
topics: [design-tokens, typography, brand, theme]
doc_kind: note
created: 2026-03-27
---

# F144 PPT Forge — Theme Token Spec（风格 Token 规范）

> 作者：宪宪 (Opus-46) | 日期：2026-03-27
> 砚砚要求：区分"设计语法"（可 token 化）和"品牌资产"（不可直接复用）

## 结论

**Design Token 三层体系**：品牌基础 → 幻灯片语义 → Slide Master 配置。
每个企业风格 = 一个 `theme.tokens.json` 文件，驱动 pptxgenjs Slide Master 生成。

**核心边界**：我们做的是 `nvidia-like`（设计语法还原），不是 `nvidia`（品牌资产复制）。
Logo、专属字体（NVIDIA Sans）、商标图形 = 品牌资产，不碰。
配色系统、字体层级、间距韵律、图表调色盘 = 设计语法，可 token 化。

## 1. 品牌语法 vs 品牌资产（边界定义）

| | 设计语法（✅ 可 token 化） | 品牌资产（❌ 不直接复用） |
|---|---|---|
| **定义** | 视觉规律和比例关系 | 具体的商标/字体/图形 |
| **例子** | "主色=高饱和绿、背景=深灰近黑" | NVIDIA Logo SVG、NVIDIA Sans 字体文件 |
| **我们做什么** | 提取语法 → token 化 → 用开源替代实现 | 不使用、不嵌入、不分发 |
| **法律风险** | 无（颜色不可版权，设计语法是公共知识） | 有（商标/字体有版权保护） |

**铁律：`nvidia-like` ≠ `nvidia`。我们还原的是设计语法，不是品牌身份。**

## 2. Design Token 三层体系

参考 [IBM Carbon Design System](https://carbondesignsystem.com/guidelines/themes/overview/) 的三层 token 架构（Seed → Map → Alias），适配 PPT 场景：

```
Layer 1: Brand Foundation（品牌基础）
    ↓ 定义颜色/字体/间距的原始值
Layer 2: Slide Semantic（幻灯片语义）
    ↓ 从 Layer 1 派生，按 PPT 页面角色分配
Layer 3: Slide Master Config（pptxgenjs 配置）
    ↓ 从 Layer 2 生成，直接驱动 defineSlideMaster()
```

## 3. theme.tokens.json 完整示例（nvidia-like）

```json
{
  "version": "1.0",
  "name": "nvidia-like",
  "description": "NVIDIA 风格企业演示：高饱和绿+深灰近黑，科技感，数据密集",

  "brand": {
    "colors": {
      "primary":    "76B900",
      "secondary":  "1E1E1E",
      "accent":     "00A94F",
      "background": "121212",
      "surface":    "1E1E1E",
      "surfaceAlt": "2A2A2A",
      "white":      "FFFFFF",
      "text": {
        "primary":   "FFFFFF",
        "secondary": "B0B0B0",
        "muted":     "808080",
        "onPrimary": "000000"
      }
    },
    "typography": {
      "headingFont":  "Inter",
      "bodyFont":     "Inter",
      "monoFont":     "IBM Plex Mono",
      "cjkFont":      "Noto Sans SC",
      "headingWeight": "700",
      "bodyWeight":    "400"
    },
    "spacing": {
      "unit": 0.2,
      "xs": 0.1,
      "sm": 0.2,
      "md": 0.4,
      "lg": 0.6,
      "xl": 1.0
    }
  },

  "slide": {
    "cover": {
      "bg":             "121212",
      "titleColor":     "FFFFFF",
      "titleFontSize":  36,
      "subtitleColor":  "76B900",
      "subtitleFontSize": 18
    },
    "section": {
      "bg":             "76B900",
      "labelColor":     "000000",
      "labelFontSize":  14,
      "titleColor":     "000000",
      "titleFontSize":  32
    },
    "content": {
      "bg":             "1E1E1E",
      "titleColor":     "FFFFFF",
      "titleFontSize":  24,
      "bodyColor":      "B0B0B0",
      "bodyFontSize":   14
    },
    "kpi": {
      "numberColor":    "76B900",
      "numberFontSize": 48,
      "labelColor":     "B0B0B0",
      "labelFontSize":  12,
      "trendUp":        "76B900",
      "trendDown":      "FF4444",
      "trendFlat":      "808080"
    },
    "chart": {
      "palette":        ["76B900", "00A94F", "4CAF50", "8BC34A", "CDDC39", "FFC107"],
      "gridColor":      "333333",
      "gridSize":       0.5,
      "axisLabelColor": "808080",
      "axisLabelSize":  10,
      "dataLabelColor": "FFFFFF",
      "dataLabelSize":  10,
      "bgColor":        "1E1E1E"
    },
    "table": {
      "headerBg":       "76B900",
      "headerColor":    "000000",
      "rowBg":          "1E1E1E",
      "rowAltBg":       "2A2A2A",
      "rowColor":       "B0B0B0",
      "borderColor":    "333333"
    },
    "closing": {
      "bg":             "121212",
      "titleColor":     "76B900",
      "titleFontSize":  28,
      "bodyColor":      "B0B0B0",
      "bodyFontSize":   14
    }
  },

  "slideNumber": {
    "color":    "808080",
    "fontSize": 8,
    "position": { "x": "95%", "y": "95%" }
  }
}
```

## 4. 合法替代字体栈

### 为什么不直接用品牌字体

| 品牌 | 专属字体 | 许可证 | 我们能用吗 |
|------|---------|--------|-----------|
| NVIDIA | NVIDIA Sans | 专有，不公开分发 | ❌ |
| Apple | SF Pro / SF Mono | Apple 设备专用许可 | ⚠️ 仅 Apple 设备上可用 |
| IBM | IBM Plex | **SIL OFL（开源！）** | ✅ 直接用 |

### 替代字体栈推荐

| 风格 | Heading | Body | Mono | CJK Fallback | 许可证 |
|------|---------|------|------|-------------|--------|
| **nvidia-like** | **Inter 700** | **Inter 400** | IBM Plex Mono | Noto Sans SC | SIL OFL |
| **ibm-like** | **IBM Plex Sans 600** | **IBM Plex Sans 400** | IBM Plex Mono | IBM Plex Sans JP | SIL OFL |
| **apple-like** | **DM Sans 700** | **DM Sans 400** | JetBrains Mono | Noto Sans SC | SIL OFL / Apache 2.0 |
| **catcafe** | **Inter 600** | **Inter 400** | Fira Code | Noto Sans SC | SIL OFL |

### 为什么选 Inter 作为 nvidia-like 替代

| 维度 | Inter | DM Sans | Libre Franklin |
|------|-------|---------|----------------|
| **几何感** | ✅ 高（接近 Helvetica 血统） | ✅ 高（几何无衬线） | 中（哥特血统） |
| **屏幕优化** | ✅ 专为屏幕设计 | ✅ | ❌ 印刷优先 |
| **字重范围** | 100-900（9 级） | 100-1000（可变） | 100-900 |
| **CJK 兼容** | ✅ 和 Noto Sans 搭配好 | ✅ | ⚠️ |
| **企业感** | ✅ Vercel/GitHub 等在用 | ✅ Google 委托 | ✅ 美国政府在用 |
| **pptx 嵌入** | ⚠️ pptxgenjs 不自动嵌入 | ⚠️ 同上 | ⚠️ 同上 |

**结论：nvidia-like 用 Inter，ibm-like 用 IBM Plex，apple-like 用 DM Sans。**

## 5. Token → Slide Master 映射代码示例

```typescript
import PptxGenJS from 'pptxgenjs';

function buildSlideMasters(pres: PptxGenJS, theme: ThemeTokens): void {
  const { brand, slide } = theme;

  // ⚠️ pptxgenjs hex 不要带 #（铁律 #1）
  // theme.tokens.json 中已统一去 # 存储

  // Cover Slide Master
  pres.defineSlideMaster({
    title: 'MASTER_COVER',
    background: { color: slide.cover.bg },
    objects: [
      {
        placeholder: {
          options: {
            name: 'title', type: 'title',
            x: 1, y: 1.5, w: 8, h: 1.5,
          },
          text: '(Title)',
        },
      },
      {
        placeholder: {
          options: {
            name: 'subtitle', type: 'body',
            x: 1, y: 3.2, w: 8, h: 0.8,
          },
          text: '(Subtitle)',
        },
      },
    ],
  });

  // Content Slide Master
  pres.defineSlideMaster({
    title: 'MASTER_CONTENT',
    background: { color: slide.content.bg },
    margin: [0.6, 0.6, 0.6, 0.6],
    objects: [
      {
        placeholder: {
          options: {
            name: 'title', type: 'title',
            x: 0.6, y: 0.4, w: 8.8, h: 0.6,
          },
          text: '(Title)',
        },
      },
      {
        placeholder: {
          options: {
            name: 'body', type: 'body',
            x: 0.6, y: 1.2, w: 8.8, h: 4.0,
          },
          text: '(Content)',
        },
      },
    ],
    slideNumber: {
      x: 9.4, y: 5.3,
      color: theme.slideNumber.color,
      fontSize: theme.slideNumber.fontSize,
    },
  });

  // Section Break Master（绿底黑字）
  pres.defineSlideMaster({
    title: 'MASTER_SECTION',
    background: { color: slide.section.bg },
    objects: [
      {
        placeholder: {
          options: {
            name: 'label', type: 'body',
            x: 1, y: 1.8, w: 8, h: 0.5,
          },
          text: '(Section Label)',
        },
      },
      {
        placeholder: {
          options: {
            name: 'title', type: 'title',
            x: 1, y: 2.4, w: 8, h: 1.5,
          },
          text: '(Section Title)',
        },
      },
    ],
  });
}

/** Chart options 工厂（不复用对象，防突变） */
function createChartOptions(theme: ThemeTokens, overrides?: Partial<ChartOptions>) {
  // ⚠️ 每次返回新对象（铁律 #7：pptxgenjs 会突变 options）
  return {
    chartColors: [...theme.slide.chart.palette],
    chartArea: {
      fill: { color: theme.slide.chart.bgColor },
      roundedCorners: true,
    },
    catAxisLabelColor: theme.slide.chart.axisLabelColor,
    catAxisLabelFontSize: theme.slide.chart.axisLabelSize,
    valAxisLabelColor: theme.slide.chart.axisLabelColor,
    valAxisLabelFontSize: theme.slide.chart.axisLabelSize,
    valGridLine: { color: theme.slide.chart.gridColor, size: theme.slide.chart.gridSize },
    catGridLine: { style: 'none' as const },
    dataLabelColor: theme.slide.chart.dataLabelColor,
    dataLabelFontSize: theme.slide.chart.dataLabelSize,
    ...overrides,
  };
}
```

## 6. 不推荐路线

| 方案 | 为什么不用 |
|------|----------|
| **直接复制品牌 VI** | 法律风险（商标/字体版权）；而且我们目标是"设计语法可参数化"，不是"模仿特定品牌" |
| **CSS 变量** | PPT 不是 Web；CSS 变量无法驱动 pptxgenjs Slide Master；语义映射完全不同 |
| **Figma Tokens（Tokens Studio）** | 依赖 Figma 生态；我们的设计工具是 Pencil MCP 不是 Figma；增加工具链复杂度无收益 |
| **W3C Design Tokens Format** | 标准尚在草案阶段（2025.10 draft），规范不稳定；我们的 token 消费者只有 pptxgenjs，不需要跨工具互操作 |
| **在 Blueprint 中硬编码颜色** | 违反关注点分离；换风格要改全部 Blueprint；Theme 层的存在意义就是解耦 |
| **pptxgenjs 自动字体嵌入** | pptxgenjs 不支持自动嵌入字体到 .pptx；对方 pptx-craft 用 opentype.js 做了但我们用原生方式更简单——选择广泛安装的字体或指导用户安装 |

## 7. 字体嵌入策略（Phase A）

pptxgenjs 不支持自动字体嵌入。三种缓解策略：

| 策略 | 复杂度 | 效果 |
|------|--------|------|
| **A. 选广泛安装的字体** | 低 | Inter 在设计师群体中普及率高，但企业环境不一定有 |
| **B. .pptx 附带字体安装包** | 中 | 生成 deck 时附带 .ttf/.otf 文件 + 安装说明 |
| **C. 后处理嵌入** | 高 | 用 opentype.js 在 Export 后修改 .pptx ZIP 嵌入字体 |

**Phase A 推荐策略 A**：选 Inter（SIL OFL，免费安装），文档附安装说明。Phase B 再考虑 C。

## 8. 其他风格 token 预览

### ibm-like（蓝白干净，数据严谨）

```json
{
  "name": "ibm-like",
  "brand": {
    "colors": {
      "primary":    "0F62FE",
      "secondary":  "393939",
      "accent":     "0043CE",
      "background": "FFFFFF",
      "surface":    "F4F4F4",
      "text": { "primary": "161616", "secondary": "525252", "muted": "8D8D8D" }
    },
    "typography": { "headingFont": "IBM Plex Sans", "bodyFont": "IBM Plex Sans", "monoFont": "IBM Plex Mono" }
  }
}
```

### apple-like（极简，大字少字）

```json
{
  "name": "apple-like",
  "brand": {
    "colors": {
      "primary":    "000000",
      "secondary":  "86868B",
      "accent":     "0071E3",
      "background": "FFFFFF",
      "surface":    "F5F5F7",
      "text": { "primary": "1D1D1F", "secondary": "86868B", "muted": "B0B0B0" }
    },
    "typography": { "headingFont": "DM Sans", "bodyFont": "DM Sans", "monoFont": "JetBrains Mono" }
  }
}
```
