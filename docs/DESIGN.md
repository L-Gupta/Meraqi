# DESIGN.md — TAM Frontend Design System (As Implemented)

> Status: drafted 2026-08-10 by Claude Code, extracted directly from
> `tailwind.config.ts`, `app/globals.css`, `lib/store/use-theme-store.ts`,
> every file under `components/ui/`, and a representative sample of real
> components/pages. **This documents what exists, not a recommendation.**
> Every value below is copied verbatim from the source file it came from —
> nothing here is approximated or invented. Where the codebase itself is
> inconsistent, that's flagged explicitly in §9 rather than silently
> resolved to one answer.

## 1. Color Palette

### 1.1 Design-token colors (CSS custom properties, HSL, theme-aware)

Defined in `app/globals.css` (`:root` = light, `.dark` = dark), exposed to
Tailwind via `tailwind.config.ts`'s `theme.extend.colors` as
`hsl(var(--token))`. Usable as `bg-background`, `text-foreground`,
`border-border`, etc.

| Token | Light (`:root`) | Dark (`.dark`) | Used for |
|---|---|---|---|
| `background` | `hsl(204 55% 97%)` | `hsl(222 47% 8%)` | Page background (`body` in globals.css) |
| `foreground` | `hsl(220 42% 12%)` | `hsl(193 95% 92%)` | Default text color (`body`) |
| `card` | `hsl(0 0% 100%)` | `hsl(223 39% 12%)` | Card/panel/dialog/sheet backgrounds |
| `card-foreground` | `hsl(220 42% 12%)` | `hsl(193 95% 92%)` | Text on card surfaces |
| `primary` | `hsl(197 88% 40%)` | `hsl(189 96% 56%)` | Primary buttons, active nav item text, focus rings, brand accents |
| `primary-foreground` | `hsl(210 40% 98%)` | `hsl(223 44% 10%)` | Text/icons on top of `primary` |
| `secondary` | `hsl(188 72% 92%)` | `hsl(217 30% 18%)` | Secondary surfaces (active sidenav background) |
| `secondary-foreground` | `hsl(220 42% 12%)` | `hsl(193 95% 92%)` | Text on `secondary` |
| `muted` | `hsl(204 34% 92%)` | `hsl(220 28% 16%)` | Subdued backgrounds (skeletons, inactive tab list, disabled-ish panels) |
| `muted-foreground` | `hsl(220 20% 39%)` | `hsl(204 24% 72%)` | Secondary/caption text, labels, placeholders |
| `accent` | `hsl(173 76% 90%)` | `hsl(176 64% 22%)` | Defined; see §9 for usage note |
| `accent-foreground` | `hsl(220 42% 12%)` | `hsl(177 82% 90%)` | Text on `accent` |
| `border` | `hsl(200 28% 84%)` | `hsl(217 23% 24%)` | All borders — applied globally via `* { @apply border-border }` |
| `danger` | `hsl(0 77% 52%)` | `hsl(358 86% 67%)` | Defined for error states; **not actually used in components — see §9** |
| `warning` | `hsl(35 92% 52%)` | `hsl(37 92% 61%)` | Defined for warning states; **not actually used in components — see §9** |
| `success` | `hsl(149 70% 41%)` | `hsl(152 74% 47%)` | Defined for success states; **not actually used in components — see §9** |

### 1.2 Status/severity colors actually used in components

Real severity, status, and pass/fail coloring throughout the app does
**not** use the `danger`/`warning`/`success` tokens above — it uses raw
Tailwind palette utility classes, chosen ad hoc per component. This is the
palette actually in effect:

| Meaning | Classes seen in the wild | Example locations |
|---|---|---|
| Positive / Pass / Green / Available | `bg-emerald-100 text-emerald-700` (majority) or `bg-emerald-100 text-emerald-800` (minority — see §9) | `severity-badge.tsx`, `documents-panel.tsx`, `tie-outs-panel.tsx`, `risk-assessment/page.tsx`, `dashboard/page.tsx`, `reports/page.tsx`, `documents/page.tsx` legend |
| Caution / Warn / Amber / Medium / Partial | `bg-amber-100 text-amber-700` (majority) or `bg-amber-100 text-amber-800` (minority — see §9) | same set of files |
| Negative / Fail / Red / High / Missing | `bg-rose-100 text-rose-700` (majority) or `bg-rose-100 text-rose-800` (minority — see §9) | same set of files |
| Low / Informational severity | `bg-blue-100 text-blue-700` | `real-dashboard.tsx` `SEVERITY_STYLE` |
| Informational (alt.) | `bg-slate-100 text-slate-700` | `real-dashboard.tsx` `SEVERITY_STYLE` (`Informational` key) |
| Inline warning callouts (border+bg+text triplet) | `border-amber-300 bg-amber-50 text-amber-800` | `margin-panel.tsx`, `nwc-panel.tsx` |
| Inline failure callouts | `border-rose-400 bg-rose-50 text-rose-700` | `cash-flow-panel.tsx` |

Dark-mode variants for these are applied **inconsistently** — some
components add explicit `dark:bg-*/dark:text-*` overrides (e.g.
`tie-outs-panel.tsx`, `cash-flow-panel.tsx`, `margin-panel.tsx`,
`nwc-panel.tsx`, `junior-analyst-report.tsx`), others don't (e.g. the
shared `severity-badge.tsx`, `dashboard/page.tsx`'s Decision Queue
readiness pill, `risk-assessment/page.tsx`'s tie-out status pills). See §9.

### 1.3 Chart colors

Defined in `components/charts/common-charts.tsx`'s `useChartPalette()`
hook, which reads `useThemeStore` and returns different hex values per
theme — this is the one place chart-specific color is centralized:

| Purpose | Light | Dark |
|---|---|---|
| Grid lines | `rgba(100, 116, 139, 0.28)` | `rgba(148, 163, 184, 0.35)` |
| Axis line | `#0f172a` | `#d7f7ff` |
| Tick labels | `#334155` | `#c9ebf7` |
| Tooltip background | `#ffffff` | `#0b1a32` |
| Tooltip border | `#cbd5e1` | `#155e75` |
| Revenue line | `#0369a1` | `#38bdf8` |
| Adjusted (EBITDA) line | `#16a34a` | `#22c55e` |
| Area stroke | `#0891b2` | `#22d3ee` |
| Area fill | `#67e8f9` | `#0891b2` |
| Waterfall bars | `#0d9488` | `#2dd4bf` |
| Risk band — low | `rgba(34, 197, 94, 0.18)` | `rgba(34, 197, 94, 0.25)` |
| Risk band — watch | `rgba(245, 158, 11, 0.2)` | `rgba(245, 158, 11, 0.24)` |
| Risk band — high | `rgba(244, 63, 94, 0.2)` | `rgba(244, 63, 94, 0.24)` |
| Risk dot — low/watch/high | `#16a34a` / `#d97706` / `#e11d48` | `#22c55e` / `#f59e0b` / `#f43f5e` |
| Bridge/waterfall — base/positive/negative/result | `#6366f1` / `#22c55e` / `#ef4444` / `#22c55e` | `#818cf8` / `#4ade80` / `#fb7185` / `#4ade80` |

Note this chart palette is a **separate, third color system** from both
the CSS-token system (§1.1) and the ad-hoc badge palette (§1.2) — it's
internally consistent (every chart consumer goes through
`useChartPalette()`), just not unified with the other two.

### 1.4 Decorative/atmospheric colors

`globals.css` also defines a set of one-off gradient/glow effects
(`.tam-gradient`, `.tam-grid`, `.tam-background-flow`,
`.tam-analyst-scene` and its sub-elements, `.tam-ai-*` animation classes)
used for the marketing/loading/onboarding surfaces (welcome, upload
processing state, etc.). These use raw `rgba()` values in the cyan/teal/sky
family (e.g. `rgba(34, 211, 238, ...)`, `rgba(16, 185, 129, ...)`,
`rgba(56, 189, 248, ...)`) independent of both the token system and the
chart palette. Treat these as intentionally decorative/one-off, not a
reusable semantic palette — don't reuse `.tam-*` classes for anything but
the specific atmospheric effect they were built for.

## 2. Typography

- **Font family:** Manrope (Google Font, loaded via `next/font/google` in
  `app/layout.tsx`), applied to `<body>` via `className={manrope.className}`.
  `tailwind.config.ts` also registers it as the `sans` family
  (`fontFamily.sans: ["Manrope", "ui-sans-serif", "system-ui"]`), so it's
  the default for all unstyled text, not just an opt-in utility.
- **No separate monospace/code font is configured** — no `fontFamily.mono`
  override exists; any code/data-like display (e.g. request IDs, raw
  figures) falls back to the browser default monospace stack if `font-mono`
  is used, or renders in Manrope if not explicitly set to mono.
- **Sizes and weights in practice** (no type-scale is centrally defined —
  these are the sizes actually used, taken directly from component code):

| Role | Classes | Example |
|---|---|---|
| Page/section heading | `text-xl font-semibold` | `dashboard/page.tsx` "Executive Overview" |
| Card title | `text-sm font-semibold` | `CardTitle` in `components/ui/card.tsx` |
| KPI tile value (large number) | `text-2xl font-bold` (`kpi-card.tsx`) or `text-xl font-bold` (`deal-summary-banner.tsx`) — see §9 | |
| Hero/large stat (e.g. Enterprise Value) | `text-3xl font-semibold` (`real-dashboard.tsx`) or `text-4xl font-semibold` (`dashboard/page.tsx` predicted valuation) | |
| Body text | `text-sm` (default, unstyled weight) | throughout |
| Caption / label / uppercase eyebrow | `text-xs uppercase tracking-wide` or `text-[11px] uppercase tracking-[0.18em]` | KPI labels, section eyebrows |
| Micro text (badges, sub-labels) | `text-[10px]` / `text-xs` | benchmark band labels, badges |
| Tables | `text-sm` (`components/ui/table.tsx`), header row `text-xs uppercase text-muted-foreground` | |

## 3. Spacing & Layout Conventions

No custom spacing scale is defined in `tailwind.config.ts` — everything
uses Tailwind's default spacing scale directly. Patterns observed
consistently across pages/components:

- **Page-level vertical rhythm:** `space-y-5` or `space-y-6` wrapping a
  page's top-level sections (seen in `dashboard/page.tsx`,
  `customer-analytics/page.tsx`, and others).
- **Card/panel internal padding:** `p-4` (card header/content default in
  `components/ui/card.tsx`), with `CardContent` overriding to `p-4 pt-0`
  when stacked under a `CardHeader`.
- **Grid gaps:** `gap-3` or `gap-4` for KPI tile grids and multi-card
  layouts; responsive columns via `sm:grid-cols-3 lg:grid-cols-6` (banner
  tiles) or `md:grid-cols-2 xl:grid-cols-4` (KPI grids).
- **Border radius scale** (`tailwind.config.ts theme.extend.borderRadius`,
  overriding Tailwind's defaults):
  | Token | Value |
  |---|---|
  | `rounded-lg` | `1rem` |
  | `rounded-md` | `0.75rem` |
  | `rounded-sm` | `0.5rem` |
  Component-level radius in practice varies below and above this scale too
  — e.g. `rounded-full` for badges/pills, `rounded` (Tailwind default,
  `0.25rem`) for small chips, `rounded-xl`/`rounded-2xl` (Tailwind default
  values, not overridden) for some hero/dialog surfaces
  (`DialogContent` uses `rounded-xl`).
- **Shadows** (`tailwind.config.ts theme.extend.boxShadow`):
  | Token | Value | Used for |
  |---|---|---|
  | `shadow-card` | `0 8px 28px rgba(10,20,40,0.08)` | Default `Card` shadow, dialogs, sheets |
  | `shadow-soft` | `0 2px 10px rgba(10,20,40,0.06)` | Hover elevation (e.g. `KpiCard` hover), active tab indicator |
- **App shell layout:** fixed `w-64` left sidebar (desktop) +
  `max-w-[1600px]` centered content container (`components/layout/app-shell.tsx`),
  collapsing to a `Sheet`-based slide-over nav below `md:`.

## 4. Component Patterns

All primitives live in `components/ui/` and follow one consistent
construction pattern: a thin wrapper around either a plain HTML element or
a Radix UI primitive, styled with Tailwind classes composed through the
`cn()` helper (`lib/utils/cn.ts` — `clsx` + `tailwind-merge`, so
later/prop-supplied classes correctly override earlier ones rather than
just concatenating). This is a **hand-built system in the shadcn/ui style**
— no `components.json` or shadcn CLI scaffold exists in the repo, but the
pattern (Radix primitive + CVA variants + Tailwind + `cn()`) is the same
convention shadcn/ui uses.

- **Buttons** (`components/ui/button.tsx`): built with
  `class-variance-authority` (`cva`). Base classes:
  `inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50`.
  - Variants: `default` (`bg-primary text-primary-foreground hover:opacity-90`),
    `outline` (`border border-border bg-card hover:bg-muted`), `ghost`
    (`hover:bg-muted`).
  - Sizes: `default` (`h-10 px-4 py-2`), `sm` (`h-8 px-3`), `lg` (`h-11 px-6`).
  - This is the **only** primitive in `components/ui/` using `cva` for
    variants — every other primitive (Card, Badge, Table, etc.) takes a
    plain `className` override instead of a variant prop system. If a new
    component needs multiple visual variants, `Button`'s `cva` pattern is
    the established one to follow.
- **Cards** (`components/ui/card.tsx`): `Card` /
  `CardHeader` / `CardTitle` / `CardContent` compound components. Base
  `Card` class: `rounded-lg border bg-card text-card-foreground shadow-card`.
  `CardHeader` defaults to `flex items-center justify-between p-4`
  (i.e. title-left/action-right by default, not stacked).
- **Badges** (`components/ui/badge.tsx`): minimal — `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold`,
  with color entirely supplied by the caller via `className` (no built-in
  color variants). `SeverityBadge` (`components/severity-badge.tsx`) is
  the one domain-specific wrapper around it, mapping a `Severity` enum to
  colors (see §1.2/§9).
- **Tables** (`components/ui/table.tsx`): plain semantic wrappers
  (`Table`, `THead`, `TBody`, `TR`, `TH`, `TD`), not a data-grid library —
  despite `@tanstack/react-query` being in the stack for server state,
  there is **no TanStack Table usage**; `components/tables/data-table.tsx`
  is a hand-rolled sortable table, not a wrapper around a table library.
  Row hover: `hover:bg-muted/50`. Body rows separated with `divide-y`, not
  individual borders.
- **Modals/Dialogs** (`components/ui/dialog.tsx`, wrapping
  `@radix-ui/react-dialog`): overlay is `bg-slate-900/35 backdrop-blur-[1px]`
  (a hardcoded slate value, not a token — consistent across both light and
  dark mode since it's a fixed overlay tint). Content surface:
  `rounded-xl border bg-card p-6 shadow-card`, centered via
  `fixed left-1/2 top-1/2 ... -translate-x-1/2 -translate-y-1/2`, capped at
  `max-w-5xl`/`max-h-[90vh]` with internal scroll. Always includes a
  top-right `X` close icon (`lucide-react`) in a `hover:bg-muted` hit
  target. Two purpose-built modals extend this:
  `chart-drilldown-modal.tsx` (expands a chart + shows lineage steps) and
  `metric-trace-modal.tsx` (shows a KPI's cell-level trace) — both are the
  audit-trail "where did this come from" UI referenced in
  ARCHITECTURE.md §4.
- **Sheet** (`components/ui/sheet.tsx`, also wrapping
  `@radix-ui/react-dialog`): side-anchored variant of the same primitive,
  used for the mobile nav slide-over. `w-72`, anchored `left-0` or
  `right-0`, same `shadow-card`/`bg-card` surface treatment as `Dialog`.
- **Tabs** (`components/ui/tabs.tsx`, wrapping `@radix-ui/react-tabs`):
  list container `inline-flex rounded-md bg-muted p-1`; active trigger gets
  `bg-card text-foreground shadow-soft` (i.e. the active tab "lifts" off
  the muted track using the same soft-shadow token as card hover states).
- **Tooltip** (`components/ui/tooltip.tsx`, wrapping
  `@radix-ui/react-tooltip`): content is a **hardcoded** dark chip
  (`bg-slate-900 px-2 py-1 text-xs text-white`) regardless of light/dark
  theme — this is deliberate-looking (a tooltip should stay legible over
  any surface) but is, like the dialog overlay, a fixed value rather than
  a token.
- **Textarea** (`components/ui/textarea.tsx`): `min-h-44 w-full rounded-md border bg-card p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30`
  — the `focus:ring-2 focus:ring-primary/30` pattern is the established
  focus-state treatment; no other input primitives exist yet to confirm
  this is used everywhere, but it's the reference to match.
- **Skeleton** (`components/ui/skeleton.tsx`): `animate-pulse rounded bg-muted`
  — the sole loading-state primitive; every loading state seen in the
  sampled components (`DealSummaryBanner`, `RealDashboard`,
  `dashboard/page.tsx`) composes `Skeleton` blocks rather than a spinner,
  except for inline async-action states (e.g. upload/processing), which
  use a spinning `Loader2` icon from `lucide-react` instead.
- **KPI tiles**: two parallel implementations exist —
  `components/kpi-card.tsx` (the richer one: click-to-open
  `MetricTraceModal`, optional benchmark band visualization,
  `text-2xl font-bold` value) used on the mock/demo dashboard, and the
  inline tile markup in `deal-summary-banner.tsx` (`text-xl font-bold`,
  icon + label + sub-caption, no click-through) used on the real dashboard.
  These are not the same component — see §9.

## 5. Iconography

**`lucide-react` exclusively** — no other icon library or custom SVG icon
set is used anywhere in `components/`/`app/` (confirmed: every icon import
across 17 files is from `lucide-react`). Icons are used inline at small
fixed sizes (`h-4 w-4`, `h-3.5 w-3.5`, `h-5 w-5` depending on context —
button-adjacent icons trend smaller, standalone status icons trend
larger), always paired with `currentColor`-inheriting behavior (no icon
has a hardcoded fill color independent of its surrounding text color
class). Common icons in use: `AlertCircle`/`AlertTriangle` (warnings/risk),
`CheckCircle2` (success/complete), `Loader2` with `animate-spin`
(in-progress/async), `Upload`/`UploadCloud`/`FileText`/`File` (document
actions), `Download` (exports), `X` (close), `ChevronRight`/`ChevronDown`
(disclosure), `RefreshCw` (regenerate/refresh actions), `Menu` (mobile nav
trigger), `Sparkles`/`Bot` (AI-related UI, e.g. `tam-llm-sidebar.tsx`).

## 6. Dark / Light Mode

- **Mechanism:** Tailwind's `darkMode: ["class"]` (`tailwind.config.ts`) —
  dark mode is driven by a `.dark` class on `<html>`, not the OS-level
  `prefers-color-scheme` media query.
- **State management:** `lib/store/use-theme-store.ts` — a Zustand store
  (`theme: "light" | "dark"`, default `"light"`), persisted to
  `localStorage` under the key `tam-theme-state`.
- **Application:** `components/providers.tsx`'s `ThemeSync` component
  reads the store and toggles `document.documentElement.classList` between
  `dark`/not-dark in a `useEffect`. On first load with no persisted value,
  it explicitly defaults to `"light"` (not the OS preference).
- **Toggle UI:** `components/layout/theme-toggle.tsx`, calling
  `useThemeStore`'s `toggleTheme()`, rendered in the app shell topbar.
- **Transition:** `body` has `transition-colors duration-300` (globals.css)
  so the light/dark swap animates rather than snapping instantly.
- **Coverage:** the token system (§1.1) is fully dark-mode-aware by
  construction (every token has both a `:root` and `.dark` value). The
  ad-hoc status-color palette (§1.2) and one-off component colors (e.g.
  hardcoded dialog overlay, tooltip) are **not** uniformly dark-aware — see
  §9 for the specific gaps.

## 7. State Management (relevant to design consistency)

Not a color/spacing concern directly, but relevant to "how to extend this
consistently": UI-only presentational state (theme, dialog open/closed,
active tab) is local `useState` or the two dedicated Zustand stores
(`use-global-store.ts` for deal/period/basis selection,
`use-theme-store.ts` for theme) — never server data. See ARCHITECTURE.md §2
and RULES.md §1 for the full rule; mentioned here because a new styled
component that needs to remember something across a session (e.g. a
collapsed/expanded preference) should follow the existing Zustand-with-`persist`
pattern (`{ name: "tam-<thing>-state" }` in `localStorage`), not invent a
new persistence mechanism.

## 8. How to Extend This Consistently

When adding a new component or page, in order:

1. **Reach for an existing primitive in `components/ui/` first.** If it's
   a button, card, badge, table, dialog, sheet, tabs, tooltip, textarea, or
   skeleton, it already exists — use it, don't rebuild it.
2. **For color, use the token classes (`bg-card`, `text-foreground`,
   `border-border`, `bg-primary`, `text-muted-foreground`, etc.) for
   structural UI** (surfaces, borders, default text) — these are the
   values that are actually theme-aware and consistently applied.
3. **For semantic status/severity color** (pass/fail/high/medium/low,
   error/warning/success), match the **majority pattern** documented in
   §1.2 (`bg-{color}-100 text-{color}-700`, with an explicit
   `dark:bg-{color}-500/20 dark:text-{color}-200`-style override) rather
   than inventing a new shade — and prefer reusing `SeverityBadge` or
   `Badge` with those classes over writing a new inline color map, even
   though `SeverityBadge` itself currently lacks dark-mode variants (§9) —
   don't propagate that specific gap into new code; add the dark variant
   when you touch it.
4. **For a new button variant/size**, extend `buttonVariants` in
   `components/ui/button.tsx`'s `cva` config rather than styling a raw
   `<button>` inline.
5. **For spacing/radius/shadow**, use the existing scale — `p-4` card
   padding, `gap-3`/`gap-4` grids, `rounded-lg`/`rounded-md`/`rounded-sm`
   per §3's table, `shadow-card`/`shadow-soft`. Don't introduce a new
   arbitrary shadow or radius value without a reason tied to an existing
   pattern (e.g. `rounded-full` for pills/badges, `rounded-xl` for large
   dialog/hero surfaces are both established exceptions to the 3-step
   scale — matching those is fine, inventing a fourth is not).
6. **For icons**, `lucide-react` only, sized `h-4 w-4` (default/button
   context) or `h-5 w-5` (standalone/emphasis context), never a hardcoded
   fill — let it inherit `currentColor` from the surrounding text class.
7. **For charts**, always go through `useChartPalette()`
   (`common-charts.tsx`) rather than hardcoding hex values in a new chart
   component — it's the one place theme-aware chart color is centralized,
   and adding a new chart type outside it would fragment that.
8. **For font**, do nothing — Manrope is the `body` default and applies
   automatically; only reach for `font-mono` (Tailwind's default stack, no
   custom override) for genuinely code/ID-like content, and know that no
   custom monospace font is configured if you do.
9. **When in doubt about a color value specifically**, prefer the
   documented majority pattern in this file over copying whichever
   component you happened to open first — given the discrepancies in §9,
   not every existing instance is a safe copy source.

## 9. Discrepancies Found (flagged, not resolved)

These are real inconsistencies in the current codebase, surfaced here per
instruction rather than silently picked one way. None of these are fixed
by this document — they're documented so a future change doesn't
"consistently" propagate the wrong one, and so the product owner can
decide whether/how to reconcile them.

1. **`danger`/`warning`/`success` design tokens are defined but
   unused.** `app/globals.css` and `tailwind.config.ts` define full
   light/dark HSL values for `danger`, `warning`, and `success`
   (§1.1) — but a repo-wide search found **zero** uses of
   `bg-danger`/`text-danger`/`bg-warning`/`text-warning`/`bg-success`/`text-success`
   anywhere in `app/` or `components/`. Every actual status/severity color
   in the app instead uses raw Tailwind palette classes (rose/amber/emerald/etc.,
   §1.2). Either these tokens are dead code that should eventually be
   removed, or the intent was for them to be the semantic-color system and
   components were never migrated to use them — worth a decision either
   way, not assumed.
2. **Two different shades used for the same severity meaning.** The
   majority pattern is `text-{color}-700` (`real-dashboard.tsx`,
   `documents-panel.tsx`, `customer-analytics/page.tsx`,
   `dashboard/page.tsx`, `inquiry/page.tsx`, `reports/page.tsx`, and
   `tie-outs-panel.tsx`'s/`risk-assessment/page.tsx`'s own status badges),
   but `text-{color}-800` also appears (`severity-badge.tsx` — the shared,
   reusable component — plus the same two files' own summary-count stat
   tiles, e.g. `tie-outs-panel.tsx` lines 53–55 use `-800` while its status
   badges at line ~11-13 use `-700`, an inconsistency **within the same
   file**). A shared component (`SeverityBadge`) using a different shade
   than most of its ad-hoc duplicates elsewhere is the specific case worth
   resolving first if this gets addressed.
3. **Dark-mode coverage is inconsistent for ad-hoc status colors.**
   Some inline status-color usages include explicit `dark:` overrides
   (`tie-outs-panel.tsx`, `cash-flow-panel.tsx`, `margin-panel.tsx`,
   `nwc-panel.tsx`, `junior-analyst-report.tsx`); others don't
   (`severity-badge.tsx` — meaning every consumer of the shared severity
   badge component gets no dark-mode adjustment — plus
   `dashboard/page.tsx`'s Decision Queue readiness pill and
   `risk-assessment/page.tsx`'s tie-out status pills at lines 243/280).
   The gap in the *shared* component is the higher-impact instance, since
   it's reused rather than duplicated.
4. **Two non-identical KPI tile implementations.** `components/kpi-card.tsx`
   (`text-2xl font-bold`, click-to-open trace modal, optional benchmark
   band) and the inline tile markup in `deal-summary-banner.tsx`
   (`text-xl font-bold`, icon-led, no click-through) both render "a KPI in
   a card" but with different value type scale (`text-2xl` vs `text-xl`)
   and different interaction models. This may be intentional (mock/demo
   dashboard vs. real dashboard have different needs) rather than a bug —
   flagged for awareness, not assumed to need unification.
5. **`accent`/`accent-foreground` tokens are also defined but unused.**
   Same repo-wide check as finding 1: zero uses of `bg-accent`,
   `text-accent`, or `accent-foreground` found anywhere in `app/` or
   `components/` — only the `:root`/`.dark` definitions in `globals.css`
   exist. Grouped separately from finding 1 because it's a single token
   pair rather than a full semantic-color trio, but the same question
   applies: dead code to remove, or an intended system never adopted.
