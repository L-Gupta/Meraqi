# components/fdd — real-backend panels

**Purpose:** The panels that render real FastAPI data for a selected deal — one per analysis domain. Everything here reads through `lib/api/fdd-client.ts`; nothing here uses mock data.

**Contents**
- `real-dashboard.tsx`, `deal-summary-banner.tsx` — the real-deal dashboard (KPIs, NWC/cash-conversion trends, DCF EV highlight when `status="complete"`).
- `qoe-center.tsx` — QoE waterfall + adjustment table + source-GL drill-through.
- `redflag-center.tsx` — red flags, severity distribution, diligence questions.
- `statements-panel.tsx`, `cash-flow-panel.tsx`, `margin-panel.tsx` — P&L/BS, cash flow, and Margin/Cost QoE (built from PnL rows + Commercial Health).
- `nwc-panel.tsx`, `net-debt-panel.tsx`, `tie-outs-panel.tsx`, `contracts-panel.tsx`, `documents-panel.tsx`.
- `derived-risk-gauge.tsx` — a **client-derived**, labeled-as-such risk gauge from flag/tie-out counts (not a backend score).
- `junior-analyst-report.tsx` — narrative view: fetch, regenerate, `exportToPrintablePdf`.

**How it fits in:** Rendered by `app/*/page.tsx` when `dealId` is set. Charts come from `components/charts/`, primitives from `components/ui/`.

**Gotchas**
- Never compute a displayed figure with an invented formula — show a real API value or an explicit "unavailable" state (PRD §7, PHASES.md Phase 1).
- `/financials/pnl` and `/cash-flow` key records `YYYY-MM` but list periods `YYYY-MM-DD` — use `lookupByPeriod()` from `lib/utils/format.ts`.
- Amounts arrive as Decimal strings; convert only at display.
- `junior-analyst-report.tsx` is slated for an IAR rename/reframe (PHASES.md Phase 4).
- Severity colors are ad hoc Tailwind classes and dark-mode coverage is uneven (`docs/DESIGN.md` §9).
