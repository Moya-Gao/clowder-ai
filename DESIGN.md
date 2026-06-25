# Design System: Cat Cafe

> **Derived from**: `docs/features/F056-cat-cafe-design-language.md` (truth source)
> **Format**: Follows [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 9-chapter spec
> **Purpose**: Agent-facing projection layer — AI agents read this to produce visually consistent UI
> **Last synced**: 2026-04-05

---

## 1. Visual Theme & Atmosphere

Cat Cafe's interface is a warm, sunlit cat cafe reimagined as a multi-agent workspace. The entire experience is built on a cream canvas (`#fdf8f3`) that evokes handmade paper and afternoon light filtering through cafe windows. Where most AI/dev-tool dashboards lean into cold, clinical aesthetics, Cat Cafe radiates the warmth of a neighborhood coffee shop where cats roam freely.

The design language follows a deliberate formula:

> **Cozy Swiss base + explainable cat metaphors at high-frequency touchpoints.**

The "Cozy Swiss" base means: warm ivory backgrounds, ultra-fine borders, a single accent color discipline, and generous corner radii. The "cat metaphors" are layered sparingly on top — cross-thread messages arrive like postcards from another room, navigation tabs feel like pressing paw pads, progress bars brew like espresso. These metaphors are always *explainable* (not decorative emoji dumps).

**Four Design Charters:**
1. **Warm Touch** — Large border-radius (16–24px) makes every surface feel rounded like a cat's paw pad
2. **Living Details** — Micro-interactions have life (hover lifts, gentle bounces), but are rate-limited to hover/first-appearance/low-frequency triggers only
3. **Cafe Metaphors** — Postmark stamps for cross-posts, paw pads for navigation, steam for loading. Never raw emoji in place of designed icons
4. **Cozy Palette** — Cream white, soft blue, warm brown. Single accent discipline — paw pink (`#ffab91`) is the only "loud" color

**Key Characteristics:**
- Warm cream canvas (`#fdf8f3`) evoking a sunlit cafe, not a screen
- Body font Inter for readability; planned serif Outfit for headings
- Warm brown accents (`#8d6e63`) — earthy, grounded, cafe-like
- Exclusively warm-toned neutrals — every gray has a brown/cream undertone
- Agent identity expressed through subtle persona colors (lavender for Opus, sage for Codex, sky for Gemini)
- Breed-specific message bubble shapes — each cat's corner is chamfered differently, like a personality signature
- Rate-limited animations: bounce, shake, pulse — all under 1s, never constant

**Visual Anchors:**
- Design Truth Source: `docs/features/F056-cat-cafe-design-language.md` §A1 (Postmark Cafe concept — 设计语言公式、四大宪章、三猫打样竞赛结果)
- Token Definitions: `packages/web/src/app/globals.css` `:root` block (all `--cafe-*` and `--cat-*` CSS variables)
- Agent Persona Config: `cat-config.json` (color mappings per agent)
- Component Reference: `packages/web/src/components/ChatMessage.tsx` (breed corner implementation)

> **For Vision-capable agents**: When screenshot baselines exist in `docs/features/assets/F056/`, reference them inline. Until then, build from the token tables and component specs below — they are verified against running code.

---

## 2. Color Palette & Roles

Cat Cafe uses a **three-layer token architecture** — base palette (raw colors), semantic tokens (what components consume), and agent persona colors (identity). Components ONLY use Layer 2 semantic tokens. Layer 1 and 3 are referenced indirectly.

### Layer 1: Base Palette (Cat-Named — Never Used Directly in Components)

| Token | Hex | Role |
|-------|-----|------|
| `--cat-cream-white` | `#fdf8f3` | Background base — warm cream with a yellow-pink tint. *(Note: F056 spec §A2 lists `#FFF9F0` from initial Pencil design; `#fdf8f3` is what shipped in CSS and is the current truth)* |
| `--cat-soft-blue` | `#81d4fa` | Functional accent — cross-posted content isolation |
| `--cat-warm-brown` | `#8d6e63` | Text/borders — earthy cafe warmth |
| `--cat-paw-pink` | `#ffab91` | Important interactions + easter eggs — the single "pop" color |
| `--cat-deep-ink` | `#1e1e24` | Text primary — warm near-black, not pure #000 |
| `--cat-muted-stone` | `#666666` | Text secondary — warm medium gray |
| `--cat-light-sand` | `#f5ede3` | Elevated surfaces — slightly warmer than cream |
| `--cat-border-tan` | `#e0d5c7` | Borders — cream-tinted, gentlest containment |

### Layer 2: Semantic Tokens (What Code Uses)

#### Light Mode (default)

| Token | Maps To | Hex | Usage |
|-------|---------|-----|-------|
| `--cafe-surface` | `--cat-cream-white` | `#fdf8f3` | Page background, main canvas |
| `--cafe-surface-elevated` | `--cat-light-sand` | `#f5ede3` | Cards, panels, elevated containers |
| `--cafe-surface-sunken` | computed | `#f0e8dd` | Depressed/inset areas |
| `--cafe-text` | `--cat-deep-ink` | `#1e1e24` | Primary text |
| `--cafe-text-secondary` | `--cat-muted-stone` | `#666666` | Secondary/description text |
| `--cafe-text-muted` | computed | `#888888` | Disabled, placeholder, timestamps |
| `--cafe-border` | `--cat-border-tan` | `#e0d5c7` | Standard borders |
| `--cafe-border-subtle` | computed | `#ebe3d9` | Subtle dividers, section lines |
| `--cafe-accent` | `--cat-paw-pink` | `#ffab91` | CTAs, important interactive elements |
| `--cafe-accent-hover` | computed | `#ff9a7a` | Accent on hover — slightly warmer |
| `--cafe-crosspost` | `--cat-soft-blue` | `#81d4fa` | Cross-thread message indicators |
| `--cafe-interactive` | computed | `#85655a` | Interactive text (links, clickable) |

#### Dark Mode (`[data-theme="dark"]`)

Dark mode inverts brightness but preserves the "Cozy Swiss" warmth. No pure black, no cool grays.

| Token | Hex | Note |
|-------|-----|------|
| `--cafe-surface` | `#1c1917` | Warm charcoal — stone undertone, not blue-black |
| `--cafe-surface-elevated` | `#292524` | Elevated warm dark |
| `--cafe-surface-sunken` | `#0c0a09` | Deepest — still warm |
| `--cafe-text` | `#faf9f7` | Soft white — cream-tinted, not pure #fff |
| `--cafe-text-secondary` | `#a8a29e` | Warm muted white |
| `--cafe-text-muted` | `#78716c` | Dimmed warm gray |
| `--cafe-border` | `#44403c` | Warm dark border |
| `--cafe-border-subtle` | `#33302c` | Subtle warm divider |
| `--cafe-accent` | `#ffb899` | Slightly brighter peach for dark contrast |
| `--cafe-accent-hover` | `#ffc5aa` | Lighter peach hover |
| `--cafe-crosspost` | `#64b5f6` | Brighter blue for dark background |
| `--cafe-interactive` | `#b0937a` | Warm tan interactive text |

### Layer 3: Agent Persona Colors

Each AI agent has a 4-color identity family. These express personality without competing with the brand palette.

| Agent | Role | Primary | Light | Dark | Background |
|-------|------|---------|-------|------|------------|
| **Opus** | Architect | `#9b7ebd` Lavender | `#d4c1ec` Lilac | `#6d5a8c` Deep Purple | `#f3eaf8` Pale Violet |
| **Codex** | Engineer | `#5b8c5a` Forest | `#8fb98e` Sage | `#3a5f39` Deep Moss | `#eaf6ea` Pale Green |
| **Gemini** | Creative | `#5b9bd5` Sky | `#9cc0e7` Baby Blue | `#3a6fa5` Ocean | `#eaf4fb` Pale Blue |
| **Cocreator** | Owner | `#e29578` Terra Cotta | `#ffddd2` Pale Peach | `#815b5b` Coffee Bean | `#fff5f2` Pale Warm |

Dark mode override: Agent BG colors become `rgba(primary, 0.15)` for contrast on dark surfaces.

### Gradient Policy — Subtle Temperature Gradients Only

Cat Cafe avoids high-contrast or cross-hue gradients. Visual richness comes primarily from the interplay of warm surface tones (cream → sand → tan → ink) and agent persona accents. However, **same-hue micro-gradients are permitted** for warmth transitions — for example, a gentle `from-opus-bg via-codex-bg to-gemini-bg` banner that blends agent persona backgrounds. The rule: gradients must feel like temperature shifts within the same warm family, never like a rainbow or a tech-startup hero section.

---

## 3. Typography Rules

### Font Family
- **Body / UI**: `Inter`, fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Headlines** (planned, not yet loaded): `Outfit`, fallback: `Inter`
- **Code / Monospace**: Tailwind's `font-mono` utility — resolves to system monospace stack. No custom mono font is explicitly loaded; agent bubbles marked `font-mono` (Codex) use system `monospace`
- **CJK** (planned, not yet loaded): `Noto Sans SC` for Chinese character support — currently falls back to system CJK fonts

### Hierarchy

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Page Title | 24px (1.5rem) | 700 | 1.3 | Main headings, page names |
| Section Heading | 20px (1.25rem) | 600 | 1.4 | Section titles, panel headers |
| Card Title | 18px (1.125rem) | 600 | 1.4 | Card headings, feature names |
| Body Large | 16px (1rem) | 400 | 1.6 | Standard body text, messages |
| Body / Nav | 14px (0.875rem) | 400–500 | 1.5 | Navigation, labels, secondary body |
| Caption | 12px (0.75rem) | 400 | 1.4 | Timestamps, metadata, badges |
| Micro | 10px (0.625rem) | 500 | 1.25 | Direction pills, tiny labels |

### Principles
- **Inter everywhere, weight for hierarchy**: No font switching between sections — hierarchy is expressed through size and weight alone
- **Generous line-height for body**: 1.5–1.6 for readability in a chat-heavy interface
- **CJK awareness**: Chinese content (mixed zh/en is common) currently uses system CJK fonts; Noto Sans SC is planned
- **Codex gets monospace**: Engineer cat bubbles use `font-mono` — a personality signature in typography
- **No letterspacing tricks**: Inter's default spacing works at all sizes; small text uses font-weight 500 instead of letterspacing for clarity

---

## 4. Component Stylings

### Message Bubbles (CatBubble)

The signature component — each cat's bubble has a breed-specific chamfered corner.

**Base:**
- Background: Agent's `bg` color (from persona palette)
- Border: 1px solid, agent's `light` color
- Padding: 16px horizontal, 12px vertical (`px-4 py-3`)
- Border-radius: 24px (`rounded-2xl`)
- Hover: `translateY(-2px)` lift, 200ms ease
- Transition: `transition-transform`

**Breed Corners (personality via geometry):**

| Breed | Agent(s) | Base Radius | Chamfered Corner | Font Override | Meaning |
|-------|----------|-------------|-----------------|---------------|---------|
| `ragdoll` | Opus, Sonnet | `rounded-2xl` | `rounded-bl-sm` (4px) | — | Thoughtful pause — grounded |
| `maine-coon` | Codex, GPT | `rounded-2xl` | `rounded-br-sm` (4px) | `font-mono` | Precise execution — sharp end |
| `siamese` | Gemini | `rounded-2xl` | `rounded-tr-sm` (4px) | — | Creative spark — top flourish |
| (default) | Cocreator, others | `rounded-2xl` | none | — | Clean, neutral bubble |

**Sender Name:**
- Font-weight: bold
- Font-size: 0.85em
- Color: Agent's `dark` variant
- Margin-bottom: 4px

### Buttons

**Primary (CTA):**
- Background: `bg-amber-500` (warm gold)
- Text: white
- Padding: 12px 24px (`px-6 py-3`)
- Radius: 12px (`rounded-xl`)
- Hover: `bg-amber-600`
- Transition: `transition-colors` 200ms

**Secondary (Warm Sand):**
- Background: `bg-cafe-surface-elevated`
- Text: `text-cafe`
- Border: 1px `border-cafe`
- Radius: 8px (`rounded-lg`)
- Hover: subtle background shift

**Icon Button:**
- Padding: 8px (`p-2`)
- Radius: 8px (`rounded-lg`)
- Hover: agent's `light` background
- Transition: `transition-colors`

**Pill / Tag:**
- Font: 10px, weight 500
- Padding: 2px 6px (`px-1.5 py-0.5`)
- Radius: 100px (`rounded-full`)
- Background: agent color at 20% opacity

### Cards

**Standard:**
- Background: `bg-cafe-surface`
- Border: 1px `border-cafe`
- Radius: 12–16px (`rounded-xl` to `rounded-2xl`)
- Padding: 12–16px (`p-3` to `p-4`)
- Shadow: `shadow-sm` (subtle)

**Elevated:**
- Background: `bg-cafe-surface-elevated`
- Border-left: 4px solid (tone color for emphasis)
- Radius: right-only `rounded-r-lg`
- Padding: 12px (`p-3`)

### Cross-Post Indicator (Postmark Cafe)

Cross-thread messages use the "postcard from another room" metaphor:
- Indicator color: `#81d4fa` (soft blue — "来自别处")
- Direction pill: `"→ @[cat-names]"` in `text-[10px]` with breed-specific color
- Left border: 3px solid `cafe-crosspost` on quoted content
- Visual: Stamp-like avatar badge + postmark-styled metadata

### Input Fields

- Background: `bg-cafe-surface` or white
- Border: 1px `border-cafe`
- Radius: 8px (`rounded-lg`)
- Padding: 8px 12px
- Focus: ring with `cafe-accent` color
- Placeholder: `text-cafe-muted`

---

## 5. Layout Principles

### Spacing Scale

Base unit: **8px**. All spacing derives from this grid.

| Scale | Value | Usage |
|-------|-------|-------|
| 1 | 4px | Tight internal gaps (icon-to-text) |
| 2 | 8px | Standard gap between related items |
| 3 | 12px | Component internal padding |
| 4 | 16px | Standard section padding |
| 6 | 24px | Section gaps |
| 8 | 32px | Major section separation |
| 12 | 48px | Page-level breathing room |

### Whitespace Philosophy

Cat Cafe uses **generous whitespace** to evoke the unhurried pace of a real cafe. Messages have visible breathing room between them. Panels don't crowd each other. The cream canvas is allowed to "show through" between components — this visible warmth is part of the brand.

### Three-Panel Layout

```
┌───────────┬──────────────────┬───────────┐
│  Sidebar  │    Main Chat     │   Right   │
│ (240px*)  │   (flexible)     │  (288px*) │
│           │                  │           │
│  Thread   │  Message Feed    │  Agent    │
│  List     │  + Input Box     │  State    │
│           │                  │  Tools    │
└───────────┴──────────────────┴───────────┘
* Default width — both panels are drag-to-resize
```

- **Sidebar**: Thread list, navigation. Default 240px, resizable (min 180px, max 480px), collapsible on mobile
- **Main**: Chat feed, scrollable. Messages max-width 85% (mobile) / 75% (desktop)
- **Right Panel**: Agent status, tools, context. Default 288px, resizable, hidden below `lg` breakpoint

### Content Density

- **Chat mode**: Spacious — generous message gaps, visible cream between bubbles
- **Dashboard/Kanban**: Tighter — smaller gaps, more info per viewport
- **Game mode (Werewolf)**: Custom theme with its own density rules

---

## 6. Depth & Elevation

### Shadow System

Cat Cafe uses Tailwind's shadow scale with warm undertones:

| Level | Class | Usage | Feel |
|-------|-------|-------|------|
| 0 | none | Flat surfaces, inline content | Flush |
| 1 | `shadow-sm` | Cards, small panels | Gentle lift |
| 2 | `shadow-md` | Panels, sidebars | Clear separation |
| 3 | `shadow-lg` | Dropdown menus, popovers | Floating |
| 4 | `shadow-xl` | Modals, dialogs | Prominent overlay |
| 5 | `shadow-2xl` | Hub overlay, brake modal | Maximum drama |
| Custom | `shadow-[0_1px_8px_rgba(0,0,0,0.03)]` | Ultra-subtle surface | Barely there |

### Surface Hierarchy

```
┌─ cafe-surface-sunken ─────────── Depressed (#f0e8dd) ─┐
│  ┌─ cafe-surface ──────────────── Canvas (#fdf8f3) ──┐ │
│  │  ┌─ cafe-surface-elevated ──── Cards (#f5ede3) ──┐│ │
│  │  │                                               ││ │
│  │  │  Content lives here                           ││ │
│  │  │                                               ││ │
│  │  └───────────────────────────────────────────────┘│ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

Depth comes from **surface tone variation**, not drop shadows. The three cream tones (sunken → canvas → elevated) create layering through warmth differences alone. Shadows are a secondary signal, used only when surface tones aren't sufficient (modals, dropdowns).

### Dark Mode Depth

Same three-surface principle, inverted:
- Sunken: `#0c0a09` (deepest warm)
- Canvas: `#1c1917` (warm charcoal)
- Elevated: `#292524` (lighter warm)

---

## 7. Do's and Don'ts

### Do

- **Use semantic tokens** (`bg-cafe-surface`, `text-cafe`, `border-cafe`) — never raw hex in components
- **Keep corners warm** — 16px minimum for cards, 24px for bubbles, 100px for pills
- **Let cream breathe** — visible warm canvas between components is a feature, not wasted space
- **Express agent identity subtly** — persona colors in bubbles and badges, not splashed everywhere
- **Rate-limit animations** — hover/first-appearance/low-frequency only, never constant
- **Use `ease-out` curves globally** — all transitions and animations should use `ease-out` (or `cubic-bezier(0.16, 1, 0.3, 1)` for spring-like effects). Avoid `linear` — it feels mechanical. We want "cat paw landing on a cushion", not "robot arm moving to position"
- **Use metaphors that explain themselves** — "postcard from another room" (cross-post), "paw pad" (nav tab)
- **Maintain dark mode warmth** — warm charcoals, cream-tinted whites, never pure black/white

### Don't

- **Don't use emoji as icons** — design SVG or use Apple emoji only where specifically approved (KD-9)
- **Don't add cool-toned grays** — every neutral must have a warm (brown/cream) undertone
- **Don't mix agent persona colors into the brand palette** — Opus lavender is for Opus's bubble, not for a CTA button
- **Don't create constant/looping animations** — bounce and shake are for momentary delight, not persistent decoration
- **Don't crowd components** — if the cream canvas can't breathe between elements, the layout is too tight
- **Don't hardcode hex values** — `cafe/no-hardcoded-colors` ESLint rule flags it as a warning (`warn` level, not blocking — but treat warnings as tech debt to resolve)
- **Don't make it "look like another product"** — no Notion gray, no Discord dark, no Slack purple. Cat Cafe has its own identity

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Behavior |
|------|-------|----------|
| Mobile | < 640px | Single column, sidebar collapsed, right panel hidden |
| Small tablet | 640px (`sm`) | Sidebar as overlay drawer |
| Tablet | 768px (`md`) | Two-panel (sidebar + main), right panel toggleable |
| Desktop | 1024px (`lg`) | Three-panel layout |
| Wide | 1280px (`xl`) | Three-panel with comfortable spacing |

### Adaptation Strategy

- **Mobile-first CSS**: Base styles target mobile, `md:` and `lg:` prefixes add desktop enhancements
- **Message bubbles**: `max-w-[85%]` on mobile, `md:max-w-[75%]` on desktop
- **Touch targets**: Minimum 44px tap area on mobile (iOS HIG)
- **Scrollable regions**: `max-h-[80vh]` for modals, `overflow-y-auto` with momentum scrolling
- **Collapsible panels**: Sidebar and right panel collapse independently on smaller screens

### Font Scaling

No CSS `clamp()` or fluid typography — sizes are fixed per breakpoint to maintain readability and avoid layout shift.

---

## 9. Agent Prompt Guide

### Quick Start

When building UI for Cat Cafe, consume these tokens:

```
Background:    bg-cafe-surface / bg-cafe-surface-elevated
Text:          text-cafe / text-cafe-secondary / text-cafe-muted
Borders:       border-cafe / border-cafe-subtle
Accent:        bg-cafe-accent / text-cafe-interactive
Cross-post:    bg-cafe-crosspost / border-cafe-crosspost
Agent colors:  bg-opus-bg / text-opus-primary (substitute agent name)
```

### Building a New Page

1. **Canvas**: Start with `bg-cafe-surface` as page background
2. **Cards**: Use `bg-cafe-surface-elevated` + `border border-cafe` + `rounded-xl`
3. **Text**: Primary `text-cafe`, secondary `text-cafe-secondary`, muted `text-cafe-muted`
4. **Spacing**: 8px grid — padding `p-3`/`p-4`, gaps `gap-2`/`gap-3`/`gap-4`
5. **CTAs**: `bg-amber-500 text-white rounded-xl px-6 py-3 hover:bg-amber-600`
6. **Borders**: Always `border-cafe`, never `border-gray-*`
7. **Dark mode**: Automatic via CSS variables — no extra work needed

### Building a Message Bubble

> **IMPORTANT**: Tailwind uses static extraction — dynamic class interpolation like `` `bg-${agent}-bg` `` will NOT work. Always use a lookup object with complete, literal class strings.

```jsx
// Breed style lookup — MUST use literal strings, never interpolate
const BREED_STYLES = {
  ragdoll:     { radius: 'rounded-2xl rounded-bl-sm', font: '' },
  'maine-coon': { radius: 'rounded-2xl rounded-br-sm', font: 'font-mono' },
  siamese:     { radius: 'rounded-2xl rounded-tr-sm', font: '' },
};
const DEFAULT_STYLE = { radius: 'rounded-2xl', font: '' };

// Agent color lookup — literal strings only
const AGENT_COLORS = {
  opus:      { bg: 'bg-opus-bg',      border: 'border-opus-light',      name: 'text-opus-dark' },
  codex:     { bg: 'bg-codex-bg',     border: 'border-codex-light',     name: 'text-codex-dark' },
  gemini:    { bg: 'bg-gemini-bg',    border: 'border-gemini-light',    name: 'text-gemini-dark' },
  cocreator: { bg: 'bg-cocreator-bg', border: 'border-cocreator-light', name: 'text-cocreator-dark' },
};

// Usage
const breed = BREED_STYLES[cat.breed] ?? DEFAULT_STYLE;
const colors = AGENT_COLORS[cat.id];

<div className={cn(
  "border px-4 py-3 transition-transform ease-out hover:-translate-y-0.5",
  breed.radius, breed.font,
  colors.bg, colors.border
)}>
  <div className={cn(colors.name, "font-bold text-[0.85em] mb-1")}>
    {senderName}
  </div>
  <div className="text-cafe text-sm leading-relaxed">
    {content}
  </div>
</div>
```

> **Never skip the breed corner** — it's a cat's identity signature. Missing the chamfered corner is like calling a cat by the wrong name.

### Design Checklist for New Components

- [ ] Uses semantic tokens only (no raw hex / no `bg-white` / no `text-gray-*`)
- [ ] Border-radius follows scale (pills 100px, bubbles 24px, cards 16px, inputs 8px)
- [ ] Spacing is 8px-grid aligned
- [ ] Has hover/focus states with smooth transitions (200ms)
- [ ] Works in both light and dark mode (test with `data-theme="dark"`)
- [ ] Agent-colored elements use persona palette, not brand accent
- [ ] Animations are rate-limited (no constant loops)
- [ ] Touch targets >= 44px on mobile
- [ ] No emoji as functional icons

### Reference Implementation

- **Message bubbles**: `packages/web/src/components/ChatMessage.tsx` (breed corners, agent colors)
- **Semantic tokens (CSS variables)**: `packages/web/src/app/globals.css` `:root` and `[data-theme="dark"]` blocks
- **Legacy bubble theme**: `assets/themes/variables.css` (base palette + agent persona colors — NOT semantic tokens)
- **Tailwind config**: `packages/web/tailwind.config.js` (color/animation/shadow mappings)
- **Theme provider**: `packages/web/src/components/ThemeProvider.tsx` (next-themes, `data-theme` attribute)
- **Design truth source**: `docs/features/F056-cat-cafe-design-language.md`
