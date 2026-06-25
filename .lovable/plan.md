
# ReqRadar — Build Plan

This is a large, multi-phase product (8 pages + 3 external integrations + edge functions + OAuth). I'll build it in clearly-scoped passes so each step ships something working, instead of one massive batch that will be hard to debug.

## Stack adjustments (vs your prompt)

Your prompt specifies React Router v6 + Zustand + Vercel. This Lovable template is **TanStack Start v1** (file-based routes under `src/routes/`, deployed to Cloudflare Workers via Lovable Cloud). I'll keep your product spec exact, but:

- Routing → TanStack Router (file-based, same URLs)
- Backend → Lovable Cloud (Supabase under the hood — DB, auth, storage, edge functions all included, no external account)
- AI → Lovable AI Gateway (covers GPT-class models without you managing an OpenAI key)
- State → TanStack Query for server state; React state/Zustand only if needed
- No Vercel — Lovable handles deploys

Everything else (schema, scoring logic, UI spec, page structure, color tokens) stays as you wrote it.

## Pass 1 — Foundation + all 8 pages with mock data (this turn)

Goal: clickable, polished app end-to-end with seeded mock data. No backend yet.

1. Design system in `src/styles.css`: dark navy sidebar `#0F172A`, indigo accent `#6366F1`, Inter font, Req-Score color tokens (green/amber/red), sync-status tokens. All as semantic CSS variables — no hardcoded colors in components.
2. Layout: pathless `_app` layout route with persistent sidebar + topbar, mobile bottom-nav fallback.
3. Routes: `/` (redirects to `/dashboard`), `/dashboard`, `/requirements`, `/submit`, `/consultants`, `/resume-tailor`, `/analytics`, `/integrations`, `/settings`.
4. Mock data module (`src/lib/mock-data.ts`): 15 requirements, 8 consultants, 20 submissions, sync logs, KPI series.
5. Build each page per spec:
   - Dashboard: 4 KPI cards, Top-10 reqs, workflow timeline, live sync panel, ghost alerts
   - Requirements: filterable table, req-score drawer with weighted calc, add-req modal, ghost indicators
   - Submissions: pending queue + history + AM-summary generator (stub)
   - Consultants: card grid, add modal (file input UI only), match feature (stub)
   - Resume Tailor: JD textarea + tailored output (stub)
   - Analytics: 5 KPI cards + bar/pie/line/funnel/channel charts (recharts)
   - Integrations Hub: 3 cards (Sheets / Dice / Gmail) with all controls + sync logs — disconnected state
   - Settings: API key field, market rates table, notification toggles, team, CSV export
6. Shared UI: source badges, score badges, sync-status badges, ghost-alert pill, skeleton loaders, empty states, toasts via sonner.

Stop here, show you the result, then continue.

## Pass 2 — Lovable Cloud + real CRUD (next turn, after you approve Pass 1)

- Enable Lovable Cloud
- Migrations for `requirements`, `consultants`, `submissions`, `integration_configs`, `sync_logs` (with GRANTs + RLS + `user_roles` pattern)
- Auth (email + Google), `_authenticated` layout gate
- Replace mock data with server functions backed by Supabase
- CSV export

## Pass 3 — AI features (next turn after Pass 2)

- Lovable AI Gateway server functions: JD analysis, resume tailoring, ghost-job detection, AM summary, email parsing
- Req-Score auto-calc on insert

## Pass 4 — Integrations (separate turn each, because each is non-trivial)

- 4a: Google OAuth (Sheets + Gmail scopes) + Sheets sync edge function + DB webhook
- 4b: Gmail parser cron edge function
- 4c: Dice scraper cron edge function (public listings, rate-limited) — **note:** scraping Dice from a Worker may be blocked by their bot protection; if so I'll surface that and recommend the official Dice Recruiter API path you mentioned

## Technical notes

- `src/routes/_app.tsx` = pathless layout with sidebar + `<Outlet />`. Each page lives at e.g. `src/routes/_app.dashboard.tsx`.
- All charts via `recharts` (already aliased in shadcn chart component).
- Color tokens added to `:root` and `.dark` in `src/styles.css`; surfaced via `@theme inline` so Tailwind utilities like `bg-sidebar`, `text-score-high` work.
- Mock data is deterministic so screenshots/tests are stable.
- Each route file gets its own `head()` with unique title + description (per project routing rules).

## Question before I start

Pass 1 alone is already a lot of UI code. Do you want me to proceed straight through Pass 1 (recommended — gives you the full clickable app today), or split it further (e.g. just Dashboard + Requirements + Integrations first, rest later)?
