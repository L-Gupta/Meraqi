# TAM Frontend

Production-grade frontend for TAM (Financial Due Diligence Automation), built with Next.js App Router + TypeScript + Tailwind + reusable shadcn-style components.

## Run locally

1. Install Node.js 20+ and npm.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Included

- Sidebar routes: Dashboard, Documents, Financial Analysis, Risk Assessment, Customer Analytics, Reports, Inquiry, Notes, Settings
- Topbar selectors: Deal, Period, Basis, Export Pack
- Clickable KPI cards -> Metric trace modal (Lineage + Cell Trace)
- Clickable charts -> Drilldown modal with expanded chart + TAM Build Steps panel
- Mock APIs with Zod validation and simulated latency
- Risk scoring, tie-outs, inquiry workflow, notes persistence via Zustand + localStorage
- Inquiry Copilot chat in `Inquiry` tab, backed by `/api/inquiry/assistant`

## Optional LLM setup for Inquiry Copilot

If `OPENAI_API_KEY` is set, Inquiry Copilot uses OpenAI Responses API.  
If not set, it falls back to deterministic dashboard-grounded answers.

Create `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

## Auth and Entry Flow

- First page: `/welcome`
- New analyst sign-up: `/signup` (company-domain email required)
- Sign in page: `/login`
- First-time post-login intake + walkthrough: `/onboarding`
- Final destination after analysis load: `/dashboard`

Behavior:
- First-time user: sign in/sign up -> `/onboarding` -> Generate Analysis -> `/dashboard`
- Returning user: sign in -> directly to `/dashboard`
- Existing analysts can launch a new company intake anytime via `Start New Company Analysis` in the top bar.

Demo login credentials:

```bash
username: analyst@tam.com
password: TAM2026!
```
