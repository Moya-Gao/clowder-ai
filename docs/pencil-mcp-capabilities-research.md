---
topics: [pencil, mcp, presentation, research]
doc_kind: research
created: 2026-03-27
---

# Pencil MCP Capabilities and Limitations for Presentation Generation

## Executive Summary

**Current Status:** Pencil MCP does NOT support PPTX/presentation export. It is **exclusively a single-page UI design tool** with no native support for multi-slide presentations.

---

## 1. Pencil MCP Current Capabilities

### Core Tools Available
1. **`get_editor_state()`** - Check canvas/editor status
2. **`open_document(path or "new")`** - Create/open .pen files
3. **`batch_design()`** - Create/modify design elements (max 25 ops/call)
4. **`batch_get()`** - Read layer/component properties
5. **`get_style_guide_tags()`** - List available design themes
6. **`get_style_guide()`** - Fetch style system (colors, fonts, etc.)
7. **`get_variables()`** - Read design tokens
8. **`get_screenshot()`** - Capture frame as PNG image

### Supported Export Formats
- **Screenshots only**: PNG via `get_screenshot()`
- **React/Tailwind code**: Via `pencil-to-code` skill (converts design → component code)
- **Design file storage**: `.pen` (proprietary encrypted format, MCP-read-only)

**NO native support for:**
- PPTX/PowerPoint
- HTML export
- SVG export
- PDF export
- Multi-slide/presentation format

---

## 2. What .pen Files Can Represent

### Supported Node Types
- **Frames** - Layout containers (flex/grid)
- **Text** - Typography (headings, body, labels)
- **Shapes** - Rectangles, ellipses, polygons
- **Images** - Raster images (stock, generated, or uploaded)
- **Components** - Reusable design elements with slots
- **Instances** - Component references with customization
- **Groups** - Logical node grouping
- **Binding references** - Cross-references within document

### Design Capabilities
- **Layouts**: Vertical, horizontal, grid with gaps/padding
- **Styling**: Fills (solid/gradient), strokes, corner radius
- **Typography**: Font family/size/weight, line-height, text color
- **Spacing**: 8-point grid system
- **Constraints**: Content sizing (fixed, fill_container)
- **Design tokens**: CSS variables via `get_variables()`

### .pen File Structure Limitation
- **Single document** - One .pen = one design file
- **Multiple frames** - Can contain many frames but NO concept of "slides"
- **No slide sequencing** - Frames are independent, no slide order/transitions
- **No presentation metadata** - No speaker notes, timing, slide numbers, etc.
- **No export to other formats** - Only readable via Pencil MCP

---

## 3. Presentation Generation Workarounds (What's NOT Possible Yet)

### Approach 1: Screenshot-Based PPTX (Hacky)
```
.pen design → get_screenshot() → PNG images → Python pptx library
```
**Limitation**: Would need external tool (not Pencil MCP)

### Approach 2: React Export → HTML Presentation
```
.pen design → pencil-to-code → React components → (Reveal.js/deck.js) → Presentation
```
**Limitation**: Would need to manually add presentation framework layer

### Approach 3: Multi-Frame Export as Slide Deck
```
.pen file with multiple frames → batch_get all frames → 
Map frames to PPTX slides → Export
```
**Limitation**: Pencil MCP has NO tool to export frames as PPTX. Would need custom implementation.

---

## 4. Codebase Search Results

### No Presentation/PPTX Discussion Found
- **Files searched**: 87 directories, 10 `.pen` design files
- **Keywords checked**: "pptx", "powerpoint", "presentation", "slides", "export-nodes"
- **Result**: Zero mentions in Cat Café codebase

### Existing .pen Files (All Single-Page Designs)
- F097-cli-output-collapsible-ux.pen
- f056-connector-icons.pen
- f101-werewolf-game-ui.pen
- F102-knowledge-emergence-feed.pen
- F108-side-dispatch-ux.pen
- ... (all UI components, no presentation designs)

### No Export Tools in Pencil MCP
Strings extracted from Pencil binary show:
- `batch_design`, `batch_get` - Design ops only
- `get_screenshot` - PNG capture only
- `get_style_guide`, `get_variables` - Metadata reading only
- **NO**: `export_nodes`, `export_pptx`, `export_html`, `export_svg`

---

## 5. Design Workflow SOP in Cat Café

Current Pencil MCP is designed for:

```
Feature Spec → Design Gate (pencil-design)
  ↓
Sketch UI in .pen (single page)
  ↓
Get style feedback via screenshots
  ↓
Export React/Tailwind code (pencil-to-code)
  ↓
Implement in worktree/tdd
```

**Not designed for**: Presentation/multi-slide workflows

---

## 6. Technical Constraints

### Pencil MCP Limitations
| Aspect | Status | Note |
|--------|--------|------|
| Single page design | ✅ Fully supported | One .pen = one design canvas |
| Multi-slide support | ❌ No | Frames ≠ slides |
| Presentation export | ❌ No | No PPTX/presentation tools |
| Screenshot export | ✅ PNG only | Via `get_screenshot()` |
| Code export | ✅ React/Tailwind | Via `pencil-to-code` skill |
| HTML export | ❌ No | Would need custom tool |
| SVG export | ❌ No | Would need custom tool |
| PDF export | ❌ No | Would need custom tool |
| Speaker notes | ❌ No | No metadata support |
| Animations/transitions | ❌ No | Static designs only |

### .pen File Format
- **Encryption**: Proprietary binary format, only readable via MCP
- **Version**: Pencil 0.6.36 (Antigravity IDE extension)
- **Storage**: Git-trackable files (can be versioned)
- **Size**: 20-260 KB per design file

---

## 7. Conclusions & Recommendations

### What Pencil MCP CAN Do for Presentations
1. ✅ Design individual slides as separate `.pen` files
2. ✅ Screenshot each slide as PNG
3. ✅ Export React components (for web-based presentations)
4. ✅ Maintain design consistency via style guides

### What Pencil MCP CANNOT Do
1. ❌ Generate PPTX directly
2. ❌ Create multi-slide presentations natively
3. ❌ Handle slide transitions/animations
4. ❌ Export to traditional presentation formats
5. ❌ Batch export multiple frames to presentation

### To Enable Presentation Generation

Would need to:
1. **Extend Pencil MCP** with new tools:
   - `export_pptx(nodeIds, options)` 
   - `export_html_slides(nodeIds, options)`
   - `export_pdf_presentation(nodeIds, options)`

2. **Or build external adapter**:
   - Read .pen designs via batch_get
   - Screenshot frames
   - Use python-pptx / LibreOffice to assemble into presentation

3. **Or use Pencil for design-only**:
   - Design presentation slides in Pencil (visual consistency)
   - Screenshot → manual import to PowerPoint/Google Slides
   - Or export React → embed in Reveal.js presentation

### Recommended Path Forward
**If PPT generation is critical requirement:**
- Pencil MCP ≠ solution for this use case
- Better tools: Figma (has presentation export), Slides API (Google Slides), or LibreOffice UNO API
- Alternative: Use Pencil for slide design assets, export PNG → feed to python-pptx automation

---

## Files Analyzed
- `/cat-cafe-skills/pencil-design/SKILL.md` - Core design workflow
- `/.agents/skills/pencil-renderer/SKILL.md` - DNA-to-design rendering
- `/.agents/skills/pencil-to-code/SKILL.md` - Design-to-code export
- `/.agents/skills/pencil-renderer/references/batch-design-patterns.md` - Design patterns
- `/.agents/skills/pencil-to-code/references/node-mapping.md` - Node export rules
- `.mcp.json` - MCP server configuration
- `designs/` directory - 10+ existing .pen files (all single-page)
