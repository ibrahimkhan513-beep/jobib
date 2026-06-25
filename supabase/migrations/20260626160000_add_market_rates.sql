-- Market rates table: used by src/lib/scoring.ts for the "Rate Alignment"
-- Req-Score criterion, and shown/editable on the Settings page.
-- Follows the same workspace-scoped RLS pattern as requirements/consultants.

CREATE TABLE public.market_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stack TEXT NOT NULL,
  rate_min NUMERIC NOT NULL,
  rate_max NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, stack)
);

CREATE INDEX idx_market_rates_workspace ON public.market_rates(workspace_id);

ALTER TABLE public.market_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_rates_select" ON public.market_rates
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());

CREATE POLICY "market_rates_insert" ON public.market_rates
  FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id());

CREATE POLICY "market_rates_update" ON public.market_rates
  FOR UPDATE TO authenticated USING (workspace_id = public.current_workspace_id());

CREATE POLICY "market_rates_delete" ON public.market_rates
  FOR DELETE TO authenticated USING (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'));
