---
feature_ids: [F229]
related_features: [F056]
topics: [design, visual, ux, concierge, cat-ball]
doc_kind: design-proposal
created: 2026-06-10
author: 烁烁/Gemini 3.5 Flash
---

# F229 视觉返工方案：从 Widget 到"一只猫在等你"

> **Status**: 提案 → 待铲屎官 Design Gate 过目
>
> **触发**: 铲屎官 2026-06-10 体感反馈——"丑的飞起…和家里 UI 风格不符…违反不能用 emoji 的规定…想要一只喵，漫画气泡对话"
>
> **输入**: KD-14（默认像素猫四选一, v1 布偶猫）+ KD-15（猫的存在感 > widget 感）+ smoke 截图（反面基线）+ 家里 OKLCH design token 体系 + opus 贴纸素材库

## 一、问题诊断：为什么"丑"？

看完 smoke 截图，问题不在代码质量——sonnet 写的结构和交互逻辑很干净（S1-S8 全绿不是吹的）。"丑"的根源是：

| 问题 | 现状 | 根因 |
|------|------|------|
| **emoji 替代图形** | 🐱 当球图标 | P0 家规违例：emoji 渲染因 OS/字体不同无法控制 |
| **调色板断裂** | `bg-zinc-500/700` / `bg-blue-500` / `bg-amber-500` 等 Tailwind 原生色 | 完全没接 OKLCH token 体系（`--cafe-*` / `--accent-*`） |
| **企业 SaaS 感** | 白底方框 + "发送"按钮 + 标准聊天窗 | 交互范式是在线客服，不是"一只猫" |
| **情感断裂** | 球 = 圆形色块，面板 = 功能窗口 | 没有生命感——球不呼吸，面板不像猫在说话 |

**一句话**：结构对了（fixed bottom-right, z-30, route survival, muted toggle），视觉语言全错了。

## 二、设计目标（从 KD-15 展开）

> **"整个 surface 是'一只猫的存在'，不是'一个 widget'"** —— 铲屎官

翻译成设计语言：

1. **猫 > 按钮**：静默态看到的不是圆形按钮，是一只猫趴在角落
2. **气泡 > 面板**：猫说话时是漫画气泡从猫身上冒出来，不是弹出一个 drawer
3. **工具栏 > 菜单**：点击猫→展开的是"它有什么能力"，不是聊天输入框
4. **温暖 > 冰冷**：全部接入 OKLCH warm palette，和家里的 warm-beige/vanilla surface 融为一体
5. **有生命 > 静态**：八态表情映射 + 微动画（Phase A 先做 CSS 呼吸 + 状态切换）

## 三、素材发现 🎉

> **⚠️ Provenance 修正（铲屎官 2026-06-10 msg 0001781155311807）**：`assets/stickers/opus/` 是 2026 年 2 月的**布偶猫表情包贴纸**，不是桌宠系统素材（桌宠砚砚当时只画了自己缅因猫的版本）。处置：贴纸作为**过渡素材**继续使用（同为砚砚原创布偶猫、24 格表情齐、透明底就绪），正式桌宠素材待 Phase A 流程跑通后请砚砚创作（"先跑通流程，最后再做大艺术家的创作"）。sprite 八态命名结构不变，素材升级 = 换 PNG 零代码。

砚砚画的布偶猫贴纸（`assets/stickers/opus/`）已经有完整的 24 格表情系统！这是现成的宝库：

### 八态映射方案

| ConciergeBallState | 贴纸映射 | 文件 | 视觉描述 |
|---|---|---|---|
| `idle` | `01_happy.png` | 开心站立，蓝眼睛看向你 | **默认态：一只友好的猫等着你** |
| `sleeping` | `06_sleeping.png` | 趴着打盹 | 静音/勿扰——猫在睡觉 |
| `listening` | `05_lgtm.png` 或 happy 变体 | 竖耳朵专注 | 你在说话，它在听 |
| `thinking` | `02_thinking.png` | 爪子托下巴思考 | 猫在想——自然等待态 |
| `found` | `07_smirk.png` | 得意脸 | "找到了！" |
| `needs-confirmation` | `03_confused.png` | 疑惑歪头 | "确认一下？" |
| `handoff` | `15_processing.png` | 忙碌动作 | 正在传话给其他猫 |
| `error` | `09_angry.png` | 生气表情 | 出错了——但可爱的生气 |

**Phase A 实现策略**：先用 PNG 裁切（48×48 / 64×64 / 96×96 三档），后续 Phase B 出 SVG 精简或 spritesheet 动画。

### 素材处理建议

- 现有贴纸是摄影级 PNG（照片拍的实体贴纸），需要**抠图 + resize** 为透明底 web 资产
- 建议产出 `assets/concierge/sprites/ragdoll/` 目录，8 个状态各一张透明 PNG
- 长期：请砚砚用同一风格补绘缅因猫/孟加拉猫/暹罗猫版本（Phase E 皮肤生态）

## 四、交互范式转型

### 现状（❌ 企业 SaaS）
```
[圆形按钮 🐱] → 点击 → [方框面板：标题 + 聊天窗 + 输入框 + 发送按钮]
```

### 目标（✅ 一只猫在等你）
```
[猫坐在角落] → 点击 → [猫身上冒出漫画气泡 💬]
                       [气泡下方：能力工具栏 / 快捷入口]
                       [底部：输入条（可选，点"对话"才出现）]
```

### 详细交互分层

**Layer 1：猫本体（常驻）**
- 64×64px 猫图标，坐在右下角
- 不是 `rounded-full` 圆形——是猫的轮廓形状（方圆形底座 + 猫图突出）
- idle 态微呼吸动画：`scale(1) → scale(1.03) → scale(1)` 循环 4s
- 状态切换时平滑过渡（crossfade 300ms）
- 有未读时：猫旁边出小红点（延续现有 badge 逻辑）

**Layer 2：猫的工具栏（点击猫展开）**
- 从猫身上向上/向左展开**弧形或纵向**快捷操作气泡
- 3-4 个核心能力按钮，每个是一个小圆形图标：
  - 🔍 → "找找看"（记忆检索）— 用 SVG search icon
  - 💡 → "新功能"（功能发现）— 用 SVG lightbulb icon
  - 📮 → "传话"（分诊/relay）— 用 SVG mail icon
  - 💬 → "聊聊"（展开对话气泡）— 用 SVG chat icon
- 每个按钮接 `--cafe-accent` / `--cafe-surface-elevated` token
- 展开/收起动画：弹簧式 stagger（第一个按钮先出，0→100ms→200ms→300ms）

**Layer 3：漫画气泡（点"聊聊"或直接对话）**
- 从猫头部位置弹出的**尖角气泡**（comic bubble），尖角指向猫
- 气泡背景：`var(--cafe-surface-canvas)` + `var(--shadow-elevation-2)`
- 气泡内：消息流（复用现有 ChatMessage）+ 底部输入条
- 气泡尺寸：`max-w-80 max-h-[60vh]`（延续现有 panel 尺寸）
- **关键差异**：不是一个方方正正的 drawer，而是带圆角 + 气泡尖角的有机形状

### z-index 层级（不变）
```
猫本体   z-30（与现有一致）
工具栏   z-30（同层）
气泡     z-30（同层）
F226     z-[35]（在上）
```

## 五、调色板接入规则

**硬规则：猫猫球的每一个颜色都从 token 来，零 Tailwind 原生色。**

| 组件 | Token | Light 实际值 | Dark 实际值 |
|------|-------|-------------|-------------|
| 猫底座背景 | `--cafe-surface-elevated` | warm white | deep warm |
| 气泡背景 | `--cafe-surface-canvas` | vanilla white | muted warm |
| 气泡边框 | `--cafe-border-subtle` | neutral-200 | neutral-100 |
| 工具栏按钮底 | `--accent-100` | warm gold tint | deep warm |
| 工具栏按钮 hover | `--accent-200` | slightly richer | slightly lighter |
| 文字 | `--cafe-text` | near black | near white |
| 次要文字 | `--cafe-text-secondary` | warm gray | light warm |
| badge 红点 | `--semantic-critical` | L=0.57 warm red | L=0.68 bright red |
| found 状态色 | `--semantic-success` | L=0.57 green | L=0.68 green |
| thinking 状态色 | `--accent-400` | warm gold | warm amber |
| 气泡阴影 | `--shadow-elevation-2` | subtle black | inset glow |

### 状态色映射（替换 Tailwind 硬编码）

```css
/* 替换现有 STATE_COLORS */
--concierge-idle:       var(--accent-300);        /* 温暖待机 */
--concierge-sleeping:   var(--neutral-400);        /* 安静灰 */
--concierge-listening:  var(--accent-500);         /* 品牌金 */
--concierge-thinking:   var(--accent-400);         /* 暖琥珀 */
--concierge-found:      var(--semantic-success);   /* 成功绿 */
--concierge-confirm:    var(--semantic-warning);   /* 注意橙 */
--concierge-handoff:    var(--semantic-info);       /* 传话蓝 */
--concierge-error:      var(--semantic-critical);   /* 错误红 */
```

## 六、动画方向（Phase A 范围内）

### 必做（CSS only，零 JS 动画库）

1. **呼吸** — `idle` 态微缩放 + opacity 微变
   ```css
   @keyframes concierge-breathe {
     0%, 100% { transform: scale(1); opacity: 1; }
     50% { transform: scale(1.04); opacity: 0.92; }
   }
   /* duration 4s 慢呼吸，不是 1s 心跳 */
   ```

2. **状态切换** — crossfade 图片
   ```css
   .concierge-sprite {
     transition: opacity 300ms ease-in-out;
   }
   ```

3. **工具栏弹出** — stagger scale
   ```css
   .concierge-tool:nth-child(1) { transition-delay: 0ms; }
   .concierge-tool:nth-child(2) { transition-delay: 80ms; }
   .concierge-tool:nth-child(3) { transition-delay: 160ms; }
   .concierge-tool:nth-child(4) { transition-delay: 240ms; }
   ```

4. **气泡弹出** — 从猫头位置 scale origin
   ```css
   .concierge-bubble {
     transform-origin: bottom right;
     transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms;
   }
   ```

### 不做（Phase B+）
- Spritesheet 帧动画（猫走路、甩尾巴等）
- 物理弹簧引擎
- 粒子效果

### reduced-motion 降级
```css
@media (prefers-reduced-motion: reduce) {
  .concierge-breathe { animation: none; }
  .concierge-sprite { transition-duration: 0ms; }
  .concierge-bubble { transition-duration: 0ms; }
}
```

## 七、布局标注（sonnet 实现参照）

```
  视口右下角
  ┌──────────────────────────────────────┐
  │                                      │
  │   ┌─────────────────────────┐        │
  │   │                         │        │
  │   │    漫画气泡              │←── max-w-80, max-h-[60vh]
  │   │    (消息流+输入条)        │    bg: --cafe-surface-canvas
  │   │                         │    border: --cafe-border-subtle
  │   │                         │    shadow: --shadow-elevation-2
  │   │                         │    border-radius: 16px
  │   └─────────────────┐      │
  │                      │  ◄── 气泡尖角（8px CSS triangle）
  │                      │      指向猫头
  │            ┌─ ─ ─ ─ ┘
  │   ⊕ ⊕ ⊕ ⊕ │ ←── 工具栏（4个能力按钮，纵向排列）
  │            │      间距 8px, 按钮 36×36, border-radius: 50%
  │     ┌──────┘      bg: --accent-100, hover: --accent-200
  │     │
  │   [猫图]  ←── 64×64 猫 sprite
  │     │         padding: 6px 底座
  │     │         底座: 72×72, border-radius: 16px
  │     │         bg: --cafe-surface-elevated
  │     │         shadow: --shadow-elevation-1
  │     │
  └─────┘───── bottom: 24px, right: 24px (延续现有 bottom-6 right-6)
```

## 八、Phase A 视觉返工清单

以下替换给 sonnet 实现，**按优先级排序**：

### P0（阻塞合入 / 家规违例）
- [ ] **V1**: 替换 🐱 emoji → 布偶猫 idle 态 PNG（透明底）
- [ ] **V2**: 全部 Tailwind 硬编码色 → OKLCH token

### P1（KD-15 猫的存在感）
- [ ] **V3**: 球底座 → 方圆形 + 猫 sprite + 呼吸动画
- [ ] **V4**: 面板 → 漫画气泡（圆角 + 尖角 + canvas bg）
- [ ] **V5**: 八态 sprite 映射（状态切换 crossfade）

### P2（工具栏交互升级）
- [ ] **V6**: 点击猫 → 展开纵向工具栏（能力按钮）
- [ ] **V7**: 工具栏 stagger 动画

### P3（打磨）
- [ ] **V8**: reduced-motion 降级
- [ ] **V9**: Dark mode 验证（token 自动适配）

## 九、素材准备任务

**前置（需要砚砚或手工处理）**：
1. 从 `assets/stickers/opus/sheet.png` 抠出 8 张透明底 PNG（idle / sleeping / thinking / found / confused / angry / processing / happy-lgtm）
2. 每张 resize 为 128×128（2x retina）+ 64×64（1x）
3. 放入 `assets/concierge/sprites/ragdoll/`
4. 命名规范：`idle.png` / `sleeping.png` / `thinking.png` / `found.png` / `confirm.png` / `error.png` / `handoff.png` / `listening.png`

**如果铲屎官等不及抠图**：可以先用 `01_happy.png` 整张缩小当全态占位（比 emoji 好 100 倍），等砚砚空了再精切。

## 十、铲屎官过目清单

> 以下每条回"行"或"改"即可：

1. **猫图选择**：v1 用布偶猫（opus 贴纸风格），行？
2. **交互范式**：猫→工具栏→气泡三层展开（不是直接弹聊天窗），行？
3. **工具栏内容**：找找看 / 新功能 / 传话 / 聊聊，四个够？多了？少了？
4. **气泡 vs drawer**：漫画气泡风格（带尖角指向猫），还是保留方框但换皮？
5. **底座**：方圆形（squircle）+ 微阴影 + 呼吸动画，行？
6. **素材**：先用整张贴纸缩小占位→后续砚砚精切，还是等精切完再换？

---

> **下一步**：铲屎官过目后 → sonnet 按本文档实现 V1-V9 → 每个 PR 合入后起 alpha 铲屎官 30 秒体感验收

[烁烁/Gemini 3.5 Flash🐾]
