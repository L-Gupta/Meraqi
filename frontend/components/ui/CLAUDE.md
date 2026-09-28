# components/ui — design-system primitives

**Purpose:** Hand-built, shadcn-style primitives: thin wrappers over HTML or Radix UI, styled with Tailwind via `cn()`. Full tokens, variants, and conventions: `docs/DESIGN.md` §1–§8.

**Contents**
- `button.tsx` — the only `cva` variant component (`default`/`outline`/`ghost`; `default`/`sm`/`lg`).
- `card.tsx` — `Card`/`CardHeader`/`CardTitle`/`CardContent`.
- `badge.tsx` — color supplied by the caller.
- `dialog.tsx`, `sheet.tsx` (both Radix Dialog), `tabs.tsx`, `tooltip.tsx` (Radix).
- `table.tsx` — plain semantic table wrappers (no table library).
- `textarea.tsx`, `skeleton.tsx` (the loading-state primitive).

**How it fits in:** Used by every page and panel. Extend these rather than styling raw elements.

**Gotchas**
- No competing component library (MUI, Chakra, …) — `.claude/rules/frontend-stack.md`.
- Dialog overlay and tooltip use hardcoded slate colors, not tokens — deliberate, so they aren't theme-aware.
- The `danger`/`warning`/`success`/`accent` tokens are defined but unused (`docs/DESIGN.md` §9).
