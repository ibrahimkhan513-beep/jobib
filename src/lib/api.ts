import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type RequirementRow = Tables extends { requirements: { Row: infer R } } ? R : any;
export type ConsultantRow = Tables extends { consultants: { Row: infer R } } ? R : any;
export type SubmissionRow = Tables extends { submissions: { Row: infer R } } ? R : any;

// --- Requirements ---
export function useRequirements() {
  return useQuery({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirements")
        .select("*")
        .order("req_score", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      vendor_name?: string | null;
      client_masked?: string | null;
      tech_stack: string[];
      location_city?: string | null;
      location_state?: string | null;
      rate_min?: number | null;
      rate_max?: number | null;
      source_type?: "direct" | "tier1" | "jobboard";
      origin_channel?: "dice" | "gmail" | "manual" | "sheets";
      jd_text?: string | null;
      am_name?: string | null;
      am_phone?: string | null;
      am_email?: string | null;
      posted_date?: string | null;
      req_score?: number;
      is_ghost?: boolean;
      ghost_reasons?: string[];
      status?: "new" | "reviewing" | "submitted" | "interview" | "closed";
    }) => {
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
      if (!profile) throw new Error("No workspace found for current user");
      const { data, error } = await supabase
        .from("requirements")
        .insert({ ...input, workspace_id: profile.workspace_id, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requirements"] }),
  });
}

export function useUpdateRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RequirementRow> }) => {
      const { data, error } = await supabase.from("requirements").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requirements"] }),
  });
}

// --- Consultants ---
export function useConsultants() {
  return useQuery({
    queryKey: ["consultants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("*").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateConsultant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      full_name: string;
      email?: string | null;
      phone?: string | null;
      tech_stack: string[];
      years_experience?: number | null;
      work_authorization?: string | null;
      last_project_title?: string | null;
      last_client_type?: string | null;
      last_project_duration?: string | null;
      availability_date?: string | null;
      bench_status?: "available" | "in_interview" | "placed";
    }) => {
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
      if (!profile) throw new Error("No workspace found");
      const { data, error } = await supabase
        .from("consultants")
        .insert({ ...input, workspace_id: profile.workspace_id, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultants"] }),
  });
}

// --- Submissions ---
export function useSubmissions() {
  return useQuery({
    queryKey: ["submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, requirement:requirements(title, client_masked, tech_stack), consultant:consultants(full_name, tech_stack)")
        .order("submitted_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requirement_id: string; consultant_id: string; am_summary?: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
      if (!profile) throw new Error("No workspace found");
      const { data, error } = await supabase
        .from("submissions")
        .insert({ ...input, workspace_id: profile.workspace_id, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
    },
  });
}

// --- Market rates (used by scoring.ts for rate-alignment criterion) ---
export function useMarketRates() {
  return useQuery({
    queryKey: ["market_rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("market_rates").select("*").order("stack");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddMarketRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stack: string; rate_min: number; rate_max: number }) => {
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
      if (!profile) throw new Error("No workspace found");
      const { data, error } = await supabase
        .from("market_rates")
        .insert({ workspace_id: profile.workspace_id, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market_rates"] }),
  });
}

export function useDeleteMarketRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("market_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market_rates"] }),
  });
}

// --- Sync logs ---
export function useSyncLogs() {
  return useQuery({
    queryKey: ["sync_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// --- Integration configs ---
export function useIntegrationConfigs() {
  return useQuery({
    queryKey: ["integration_configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("integration_configs").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertIntegrationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      integration_type: "google_sheets" | "dice" | "gmail";
      enabled?: boolean;
      config?: Record<string, unknown>;
    }) => {
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
      if (!profile) throw new Error("No workspace found");
      const { data, error } = await supabase
        .from("integration_configs")
        .upsert(
          {
            workspace_id: profile.workspace_id,
            integration_type: input.integration_type,
            enabled: input.enabled ?? false,
            config: (input.config ?? {}) as never,
          },
          { onConflict: "workspace_id,integration_type" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration_configs"] }),
  });
}

// --- Integration actions: OAuth + manual "Run now" triggers ---
export function useStartGoogleOAuth() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-oauth", { body: { action: "start" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.url as string;
    },
  });
}

async function getWorkspaceId(): Promise<string> {
  const { data: me } = await supabase.auth.getUser();
  const userId = me.user?.id;
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
  if (!profile) throw new Error("No workspace found");
  return profile.workspace_id;
}

export function useCreateSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const workspace_id = await getWorkspaceId();
      const { data, error } = await supabase.functions.invoke("sync-to-sheets", {
        body: { action: "create-sheet", workspace_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sheet_id: string; url: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration_configs"] }),
  });
}

export function useRunSheetsSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const workspace_id = await getWorkspaceId();
      const { data, error } = await supabase.functions.invoke("sync-to-sheets", { body: { workspace_id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRunDiceScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keywords: string; location: string }) => {
      const { data, error } = await supabase.functions.invoke("scrape-dice", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { found: number; added: number; duplicatesSkipped: number };
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRunGmailParse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const workspace_id = await getWorkspaceId();
      const { data, error } = await supabase.functions.invoke("parse-gmail", { body: { workspace_id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { scanned: number; extracted: number; skipped: number; previews: any[] };
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- Profile ---
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*, workspace:workspaces(name)")
        .eq("id", me.user.id)
        .maybeSingle();
      return data;
    },
  });
}

// --- Seed demo data ---
import { requirements as mockReqs, consultants as mockCons } from "./mock-data";

export function useSeedDemoData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", userId!).maybeSingle();
      if (!profile) throw new Error("No workspace found");
      const ws = profile.workspace_id;

      const reqRows = mockReqs.map((r) => ({
        workspace_id: ws,
        created_by: userId,
        title: r.title,
        vendor_name: r.vendor_name,
        client_masked: r.client_masked,
        tech_stack: r.tech_stack,
        location_city: r.location_city,
        location_state: r.location_state,
        rate_min: r.rate_min,
        rate_max: r.rate_max,
        source_type: r.source_type,
        origin_channel: r.origin_channel,
        jd_text: r.jd_text,
        am_name: r.am_name,
        am_phone: r.am_phone,
        am_email: r.am_email,
        posted_date: r.posted_date,
        req_score: r.req_score,
        status: r.status,
        is_ghost: r.is_ghost,
        ghost_reasons: r.ghost_reasons,
        sheet_sync_status: r.sheet_sync_status,
      }));
      const consRows = mockCons.map((c) => ({
        workspace_id: ws,
        created_by: userId,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone,
        tech_stack: c.tech_stack,
        years_experience: c.years_experience,
        work_authorization: c.work_authorization,
        last_project_title: c.last_project_title,
        last_client_type: c.last_client_type,
        last_project_duration: c.last_project_duration,
        availability_date: c.availability_date,
        bench_status: c.bench_status,
      }));

      const { error: rerr } = await supabase.from("requirements").insert(reqRows);
      if (rerr) throw rerr;
      const { error: cerr } = await supabase.from("consultants").insert(consRows);
      if (cerr) throw cerr;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

// --- AI: JD analysis, resume tailoring, ghost-job verdict (Groq via edge function) ---
export interface JDAnalysisResult {
  must_have_skills: string[];
  nice_to_have_skills: string[];
  domain: string;
  seniority: string;
  pain_points: string[];
  tailored_bullets: { original: string; tailored: string }[];
  ghost_job: { is_ghost: boolean; confidence: number; reasons: string[] };
}

export function useAnalyzeJD() {
  return useMutation({
    mutationFn: async (input: {
      jd_text: string;
      consultant?: {
        full_name?: string | null;
        tech_stack?: string[] | null;
        years_experience?: number | null;
        last_project_title?: string | null;
        last_client_type?: string | null;
        last_project_duration?: string | null;
      };
    }): Promise<JDAnalysisResult> => {
      const { data, error } = await supabase.functions.invoke("analyze-jd", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as JDAnalysisResult;
    },
  });
}