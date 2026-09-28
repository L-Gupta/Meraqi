# frontend/components — React components

**Purpose:** Everything rendered inside pages: the real-backend analysis panels, design-system primitives, charts, layout, and modals.

**Contents**
- `fdd/` — real-backend panels, one per domain (QoE, red flags, statements, NWC, net debt, tie-outs, contracts, documents, narrative/PDF export). See `fdd/CLAUDE.md`.
- `ui/` — Radix + Tailwind primitives (button, card, badge, dialog, sheet, tabs, tooltip, table, textarea, skeleton). See `ui/CLAUDE.md`.
- `charts/` — `chart-card.tsx`; `common-charts.tsx` with `useChartPalette()` (the one place chart colors live, light/dark) and the shared `BridgeChart`.
- `layout/` — `app-shell.tsx` (sidebar nav; topbar with deal selector, "New Deal" → `/upload`, theme toggle); `theme-toggle.tsx`.
- `modals/` — `chart-drilldown-modal.tsx`, `metric-trace-modal.tsx`: the "where did this number come from" click-throughs.
- `dashboard/tam-llm-sidebar.tsx` — Inquiry Copilot chat UI (posts to `/api/inquiry/assistant`).
- `documents/document-upload-tool.tsx` — multi-file / ZIP upload.
- `tables/data-table.tsx` — hand-rolled sortable table.
- `kpi-card.tsx` (demo dashboard KPI tile with trace modal), `severity-badge.tsx` (shared severity pill), `providers.tsx` (TanStack Query client + `ThemeSync`).

**How it fits in:** Used by `app/*/page.tsx`. Data comes from `lib/api/fdd-client.ts` (real) or `lib/mock-data` (demo only). Design rules: `docs/DESIGN.md`.

**Gotchas**
- `app-shell.tsx`'s topbar auto-selects the first deal on every window `focus` when the stored `dealId` isn't found — part of the Phase 0 investigation.
- Chart colors must go through `useChartPalette()`; icons are `lucide-react` only.
- `severity-badge.tsx` has no dark-mode variants and uses `-800` shades where most of the app uses `-700` (`docs/DESIGN.md` §9).
- `kpi-card.tsx` (demo) and the tiles in `fdd/deal-summary-banner.tsx` (real) are two different KPI implementations.
