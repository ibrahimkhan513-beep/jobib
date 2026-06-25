
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter', 'viewer');
CREATE TYPE public.origin_channel AS ENUM ('dice', 'gmail', 'manual', 'sheets');
CREATE TYPE public.source_type AS ENUM ('direct', 'tier1', 'jobboard');
CREATE TYPE public.req_status AS ENUM ('new', 'reviewing', 'submitted', 'interview', 'closed');
CREATE TYPE public.sync_status AS ENUM ('synced', 'pending', 'failed');
CREATE TYPE public.bench_status AS ENUM ('available', 'in_interview', 'placed');
CREATE TYPE public.submission_status AS ENUM ('submitted', 'in_review', 'interview_scheduled', 'rejected', 'placed');
CREATE TYPE public.integration_type AS ENUM ('google_sheets', 'dice', 'gmail');
CREATE TYPE public.sync_log_status AS ENUM ('success', 'partial', 'failed');

-- =========================================================
-- WORKSPACES + PROFILES
-- =========================================================
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_workspace ON public.profiles(workspace_id);

-- =========================================================
-- USER ROLES (separate table, security-definer check)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, workspace_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT workspace_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Workspace + profile policies (use the helper to avoid recursion)
CREATE POLICY "Members read their workspace" ON public.workspaces
  FOR SELECT TO authenticated USING (id = public.current_workspace_id());
CREATE POLICY "Admins update workspace" ON public.workspaces
  FOR UPDATE TO authenticated USING (id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members read profiles in workspace" ON public.profiles
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile row" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Users read roles in workspace" ON public.user_roles
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());

-- =========================================================
-- AUTO-PROVISION: new auth user -> workspace + profile + admin role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_ws UUID;
BEGIN
  INSERT INTO public.workspaces (name) VALUES (COALESCE(NEW.raw_user_meta_data->>'workspace_name', 'My Workspace'))
    RETURNING id INTO new_ws;
  INSERT INTO public.profiles (id, workspace_id, full_name, email)
    VALUES (NEW.id, new_ws, NEW.raw_user_meta_data->>'full_name', NEW.email);
  INSERT INTO public.user_roles (user_id, workspace_id, role) VALUES (NEW.id, new_ws, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- REQUIREMENTS
-- =========================================================
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  vendor_name TEXT,
  client_masked TEXT,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  location_city TEXT,
  location_state TEXT,
  rate_min NUMERIC,
  rate_max NUMERIC,
  source_type public.source_type NOT NULL DEFAULT 'jobboard',
  origin_channel public.origin_channel NOT NULL DEFAULT 'manual',
  jd_text TEXT,
  am_name TEXT,
  am_phone TEXT,
  am_email TEXT,
  posted_date DATE,
  req_score INT NOT NULL DEFAULT 50,
  status public.req_status NOT NULL DEFAULT 'new',
  is_ghost BOOLEAN NOT NULL DEFAULT false,
  ghost_reasons TEXT[] NOT NULL DEFAULT '{}',
  sheet_sync_status public.sync_status NOT NULL DEFAULT 'pending',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements TO authenticated;
GRANT ALL ON public.requirements TO service_role;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_req_workspace ON public.requirements(workspace_id);
CREATE INDEX idx_req_status ON public.requirements(workspace_id, status);
CREATE INDEX idx_req_score ON public.requirements(workspace_id, req_score DESC);

CREATE POLICY "Members read reqs" ON public.requirements
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Members insert reqs" ON public.requirements
  FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id());
CREATE POLICY "Members update reqs" ON public.requirements
  FOR UPDATE TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Admins delete reqs" ON public.requirements
  FOR DELETE TO authenticated USING (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- CONSULTANTS
-- =========================================================
CREATE TABLE public.consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  years_experience INT,
  work_authorization TEXT,
  last_project_title TEXT,
  last_client_type TEXT,
  last_project_duration TEXT,
  availability_date DATE,
  bench_status public.bench_status NOT NULL DEFAULT 'available',
  resume_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultants TO authenticated;
GRANT ALL ON public.consultants TO service_role;
ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cons_workspace ON public.consultants(workspace_id);

CREATE POLICY "Members read consultants" ON public.consultants
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Members insert consultants" ON public.consultants
  FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id());
CREATE POLICY "Members update consultants" ON public.consultants
  FOR UPDATE TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Admins delete consultants" ON public.consultants
  FOR DELETE TO authenticated USING (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SUBMISSIONS
-- =========================================================
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  submitted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  am_summary TEXT,
  am_feedback TEXT,
  status public.submission_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sub_workspace ON public.submissions(workspace_id);
CREATE INDEX idx_sub_req ON public.submissions(requirement_id);

CREATE POLICY "Members read submissions" ON public.submissions
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Members insert submissions" ON public.submissions
  FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id());
CREATE POLICY "Members update submissions" ON public.submissions
  FOR UPDATE TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Admins delete submissions" ON public.submissions
  FOR DELETE TO authenticated USING (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- INTEGRATION CONFIGS
-- =========================================================
CREATE TABLE public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_type public.integration_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, integration_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_configs TO authenticated;
GRANT ALL ON public.integration_configs TO service_role;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read integrations" ON public.integration_configs
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Admins manage integrations" ON public.integration_configs
  FOR ALL TO authenticated
  USING (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (workspace_id = public.current_workspace_id() AND public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SYNC LOGS
-- =========================================================
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_type public.integration_type NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  records_processed INT NOT NULL DEFAULT 0,
  records_added INT NOT NULL DEFAULT 0,
  status public.sync_log_status NOT NULL DEFAULT 'success',
  error_message TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sync_logs_ws ON public.sync_logs(workspace_id, run_at DESC);

CREATE POLICY "Members read sync logs" ON public.sync_logs
  FOR SELECT TO authenticated USING (workspace_id = public.current_workspace_id());
CREATE POLICY "Service inserts sync logs" ON public.sync_logs
  FOR INSERT TO authenticated WITH CHECK (workspace_id = public.current_workspace_id());

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_req_updated BEFORE UPDATE ON public.requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cons_updated BEFORE UPDATE ON public.consultants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sub_updated BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_intg_updated BEFORE UPDATE ON public.integration_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
