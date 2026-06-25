-- Auto-sync trigger: whenever a requirement is inserted, or its status /
-- req_score changes, fire the sync-to-sheets edge function for that
-- workspace. This implements the "Auto-sync on new requirement" and
-- "Auto-sync on status update" toggles from the Integrations Hub UI.
--
-- Uses pg_net (built into Supabase) for a fire-and-forget async HTTP call
-- so inserts/updates are never slowed down or blocked by the Sheets API.
--
-- IMPORTANT — after running this migration, set the two settings below
-- with your actual project values (run once in the SQL editor):
--
--   alter database postgres set app.settings.supabase_url = 'https://<your-project-ref>.supabase.co';
--   alter database postgres set app.settings.service_role_key = '<your-service-role-key>';
--
-- (Storing the service-role key as a DB setting like this is the
-- standard Supabase pattern for trigger-to-edge-function calls; it is
-- never exposed to the frontend.)

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_sheets_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sync_enabled BOOLEAN;
  base_url TEXT;
  svc_key TEXT;
BEGIN
  -- Only fire if this workspace actually has Sheets sync turned on.
  SELECT enabled INTO sync_enabled
  FROM public.integration_configs
  WHERE workspace_id = NEW.workspace_id AND integration_type = 'google_sheets';

  IF sync_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  BEGIN
    base_url := current_setting('app.settings.supabase_url', true);
    svc_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- settings not configured yet — skip silently rather than fail the write
  END;

  IF base_url IS NULL OR svc_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/functions/v1/sync-to-sheets',
    headers := jsonb_build_object('Authorization', 'Bearer ' || svc_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('workspace_id', NEW.workspace_id, 'requirement_ids', jsonb_build_array(NEW.id))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requirements_sheets_sync_insert ON public.requirements;
CREATE TRIGGER requirements_sheets_sync_insert
  AFTER INSERT ON public.requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sheets_sync();

DROP TRIGGER IF EXISTS requirements_sheets_sync_update ON public.requirements;
CREATE TRIGGER requirements_sheets_sync_update
  AFTER UPDATE OF status, req_score ON public.requirements
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.req_score IS DISTINCT FROM NEW.req_score)
  EXECUTE FUNCTION public.trigger_sheets_sync();
