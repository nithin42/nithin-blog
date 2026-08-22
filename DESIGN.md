---
name: Russ Rimmerman Blog
description: "Practical cloud engineering from someone who's been building for 30 years."
colors:
  azure-brand: "#0078d4"
  azure-light: "#3b8ef8"
  azure-deep: "#005ba1"
  teal-accent: "#14b8a6"
  teal-bright: "#2dd4bf"
  ink-body: "#172231"
  ink-muted: "#4a5f76"
  ink-subtle: "#6c8299"
  ink-border: "#cad3df"
  surface-light: "#f5f7fa"
  surface-white: "#ffffff"
  surface-dark: "#070d16"
  surface-elevated-dark: "#0d1622"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Cascadia Code, Roboto Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.azure-brand}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.azure-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  card-surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.xl}"
    padding: "20px"
  chip-tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  input-search:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.md}"
    padding: "8px 12px 8px 36px"
---

# Design System: Russ Rimmerman Blog

## 1. Overview

**Creative North Star: "The Architect's Notebook"**

This design system embodies structured clarity and field-tested precision. Like a senior architect's personal notebook — organized, deliberate, and built from decades of real experience — the interface communicates authority through restraint, not decoration. Every element earns its place.

The system rejects corporate stiffness (no sterile whitespace or committee-designed layouts), visual clutter (no competing sidebars or noisy surfaces), and generic blandness (no template energy that could belong to anyone). It is technically current without being trendy, confident without being loud.

The Azure brand blue anchors identity without overwhelming — this is a practitioner's platform, not a Microsoft marketing page. The teal accent provides energy at the edges. The deep navy ink grounds everything in seriousness and depth.

**Key Characteristics:**

- Structured information hierarchy with clear visual rhythm
- Confident use of whitespace as a design element
- Technical precision in spacing, alignment, and typography
- Tactile, interactive elements that respond with presence
- Dark and light modes as equally considered first-class experiences

## 2. Colors

A committed-restrained hybrid: the Azure blue carries brand identity on interactive surfaces (CTAs, links, accents), while deep navy ink tones provide a rich, technical backdrop that avoids generic gray flatness.

### Primary

- **Azure Brand** (#0078d4): The primary action color. CTAs, links, active states, and the "RR" monogram gradient start. Used on ≤15% of any screen — its rarity carries weight.
- **Azure Light** (#3b8ef8): Hover states and secondary emphasis in light mode.
- **Azure Deep** (#005ba1): Pressed states and text-on-light when brand blue needs more contrast.

### Secondary

- **Teal Accent** (#14b8a6): Energy at the edges — status indicators, gradient endpoints, and the subtle "alive" signal. Never dominant; always a counterpoint.
- **Teal Bright** (#2dd4bf): The gradient partner to Azure in hero treatments and the brand monogram.

### Neutral

- **Ink Body** (#172231): Primary text in light mode. Deep enough to feel rich, not harsh black.
- **Ink Muted** (#4a5f76): Secondary text, metadata, timestamps. Comfortable reading contrast without competing with headlines.
- **Ink Subtle** (#6c8299): Decorative icons and low-emphasis large text. Use Ink Muted for body-sized text and placeholders so they meet 4.5:1 on white.
- **Ink Border** (#cad3df): Dividers and card borders in light mode. Visible but not heavy.
- **Surface Light** (#f5f7fa): Subtle background tint for footer and secondary zones. Cool-neutral, not warm.
- **Surface Dark** (#070d16): Body background in dark mode. Near-black with a blue undertone.
- **Surface Elevated Dark** (#0d1622): Cards and elevated surfaces in dark mode.

### Named Rules

**The Cool Neutral Rule.** All neutrals carry a subtle blue undertone from the ink palette. Never warm-tint toward cream, sand, or beige — the system's temperature is the Azure family's own cool depth.

## 3. Typography

**Display & Body Font:** Inter (with ui-sans-serif, system-ui fallback stack)
**Mono Font:** JetBrains Mono (with ui-monospace, SFMono-Regular, Cascadia Code fallback)

**Character:** Technical confidence meets reading comfort. Inter's clean geometry signals engineering precision, while its generous x-height and open apertures keep long-form content approachable. JetBrains Mono for code blocks reinforces the practitioner identity without decorating.

### Hierarchy

- **Display** (700, clamp(2.25rem, 5vw, 3.5rem), line-height 1.1, tracking -0.02em): Hero headlines and page titles. `text-wrap: balance` applied.
- **Headline** (700, 1.5rem, line-height 1.25, tracking -0.015em): Section headings and card titles.
- **Title** (600, 1.125rem, line-height 1.3): Sidebar section headings, widget titles.
- **Body** (400, 1rem, line-height 1.65): Article content. Max line-length capped at 65–75ch via prose containers.
- **Label** (600, 0.875rem, line-height 1.4): Navigation items, tag text, metadata. Uppercase used sparingly and only for small functional labels (e.g., "Featured" badge, "Popular topics").
- **Mono** (400, 0.875rem, line-height 1.6): Code blocks, the hero animation, and any technical inline references.

### Named Rules

**The One Family Rule.** Inter carries the entire typographic load (display through label). Differentiation comes from weight and size, not from pairing a second sans. JetBrains Mono is purely functional — code and terminal contexts only.

## 4. Elevation

A hybrid approach: tonal layering is the primary depth mechanism (cards use background color + border to separate from the page), with shadows appearing as interactive feedback rather than resting state.

### Shadow Vocabulary

- **Hover lift** (`0 20px 45px -20px oklch(0.45 0.12 240 / 0.45)` — azure-tinted): Applied to cards and the hero panel on hover. Lifts the element optically; the azure tint ties the shadow to the brand.
- **Card hover** (`shadow-lg shadow-azure-500/5`): Subtle brand-colored glow that appears on card hover. Barely visible but felt.
- **Backdrop blur** (`backdrop-blur-md`): Header and sticky elements use frosted glass, not hard backgrounds. Signals layering without hard edges.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only in response to interaction (hover, focus, elevation change). The page at rest is calm; motion and depth are earned by engagement.

## 5. Components

### Buttons

Tactile and confident — these are elements you want to press.

- **Shape:** rounded-lg (12px)
- **Primary:** Azure Brand bg, white text, px-5 py-3, font-semibold text-sm. Communicates the primary action unambiguously.
- **Hover:** Darker azure (azure-700), smooth transition. Focus: 2px ring azure-500/40.
- **Secondary (outline):** Transparent bg, ink-700 text, 1px border ink-300. On hover: border shifts to azure-400, text to azure-600. In dark mode: border ink-700, text ink-200.

### Chips / Tags

- **Style:** Rounded-full (pill shape), 1px border ink-200, white bg, ink-600 text, text-xs font-medium.
- **Hover:** Border shifts to azure-400, text to azure-600. Subtle bg tint in dark mode.
- **Purpose:** Topic and tag navigation — always interactive, always linking to filtered content.

### Cards / Containers

Cards have presence — they're distinct surfaces, not just grouped content.

- **Corner Style:** rounded-2xl (16px) for standard cards; rounded-3xl (24px) for featured/hero cards.
- **Background:** White in light mode, ink-900 in dark mode.
- **Border:** 1px ink-200 (light) / ink-800 (dark). Shifts to azure-300/azure-700 on hover.
- **Shadow Strategy:** Flat at rest; subtle azure-tinted shadow on hover with -translate-y-1 lift.
- **Internal Padding:** p-5 (20px) standard; p-7/p-9 for featured content.

### Inputs / Fields

- **Style:** rounded-lg (12px), 1px border ink-300, white bg, text-sm.
- **Focus:** Border to azure-500, ring-2 ring-azure-500/30. Clear, immediate feedback.
- **Placeholder:** ink-500 in light mode and ink-400 in dark mode, meeting contrast requirements.

### Navigation

- **Header:** Sticky, backdrop-blur-md, 1px bottom border. Max-w-5xl centered.
- **Links:** text-sm font-medium, ink-600 default, azure-600 on hover/active. Active page: azure-600 always.
- **Brand mark:** "RR" monogram in a gradient (azure-600 → teal-500) rounded square. Compact, recognizable.
- **Mobile:** Full-width slide-down panel with larger tap targets (py-2, text-base).

### Hero Panel (Signature Component)

The animated "vibe coding" panel is the site's signature visual — a living demonstration of the practitioner identity. Conic-gradient rotating border, floating animation, typing simulation, and streaming code lines. Fully disabled under `prefers-reduced-motion`. Dark/light aware.

## 6. Do's and Don'ts

### Do:

- **Do** use the Azure blue (#0078d4) exclusively for interactive elements and brand moments — never as a decorative wash.
- **Do** maintain the cool-neutral temperature across all surfaces. Ink palette carries a blue undertone that ties everything to the brand.
- **Do** give cards breathing room — p-5 minimum internal padding, gap-6+ between cards in a grid.
- **Do** use `text-wrap: balance` on h1–h3 and `text-wrap: pretty` on prose paragraphs.
- **Do** respect `prefers-reduced-motion`: all animations must have a static fallback that shows full content.
- **Do** test every text color against its background for WCAG AA (4.5:1 body, 3:1 large text).
- **Do** use the `bg-grid` subtle grid pattern sparingly — hero sections and empty-state placeholders only.

### Don't:

- **Don't** use warm neutrals (cream, sand, beige, parchment). The system's warmth comes from content and personality, not from background tint.
- **Don't** make the site look corporate or stiff — no stock-photo energy, no whitepaper layouts, no enterprise marketing tone in the UI.
- **Don't** clutter layouts with competing CTAs, multiple sidebars, or visual noise that makes the reader work to find content.
- **Don't** use gradient text (`background-clip: text`) outside the hero's name treatment — one instance is signature, repetition is decoration.
- **Don't** use border-left or border-right > 1px as a colored accent stripe on any element.
- **Don't** add glassmorphism (blur + transparency cards) as decoration. The header's backdrop-blur is functional, not stylistic.
- **Don't** pair a second sans-serif with Inter. If you need contrast, it's Inter at different weights/sizes or JetBrains Mono for code.
- **Don't** use arbitrary z-index values. The scale is: dropdown (10) → sticky header (40) → modal-backdrop (50) → modal (60) → toast (70) → tooltip (80).
