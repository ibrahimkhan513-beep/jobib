import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  useConsultants, useCreateConsultant, useUpdateConsultant, useDeleteConsultant, useRequirements, useSeedDemoData,
} from "@/lib/api";
import { matchConsultantToRequirements, type RequirementMatch } from "@/lib/matching";
import {
  Plus, Sparkles, Phone, Mail, ArrowUpRight, Edit3, Trash2, Search, FileText,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/consultants")({
  head: () => ({
    meta: [
      { title: "Consultants — Jobib" },
      { name: "description", content: "Your active bench and consultant profiles with intelligent requirement matching." },
    ],
  }),
  component: ConsultantsPage,
});

const STATUS_CONFIG = {
  available: { label: "Available", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  in_interview: { label: "In Interview", tone: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  placed: { label: "Placed", tone: "bg-muted text-muted-foreground border-border" },
} as const;

function ConsultantsPage() {
  const { data: consultants = [], isLoading } = useConsultants();
  const { data: requirements = [] } = useRequirements();
  const seedDemo = useSeedDemoData();
  const updateConsultant = useUpdateConsultant();
  const deleteConsultant = useDeleteConsultant();

  const [openAdd, setOpenAdd] = useState(false);
  const [editingConsultant, setEditingConsultant] = useState<any | null>(null);
  const [matchingConsultant, setMatchingConsultant] = useState<any | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const navigate = useNavigate();

  // Filter consultants by search query & status
  const filtered = useMemo(() => {
    return consultants.filter((c: any) => {
      const matchText = `${c.full_name} ${(c.tech_stack ?? []).join(" ")} ${c.work_authorization || ""}`.toLowerCase();
      if (query && !matchText.includes(query.toLowerCase())) return false;
      if (statusFilter !== "all" && c.bench_status !== statusFilter) return false;
      return true;
    });
  }, [consultants, query, statusFilter]);

  // Compute matches when a consultant is selected for matching
  const matches = useMemo(() => {
    if (!matchingConsultant || !requirements.length) return [];
    return matchConsultantToRequirements(matchingConsultant, requirements);
  }, [matchingConsultant, requirements]);

  async function handleQuickStatusChange(id: string, newStatus: any) {
    try {
      await updateConsultant.mutateAsync({
        id,
        patch: { bench_status: newStatus },
      });
      toast.success(`Bench status updated to ${newStatus.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update bench status");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from your bench?`)) return;
    try {
      await deleteConsultant.mutateAsync(id);
      toast.success("Consultant removed from bench");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete consultant");
    }
  }

  const availableCount = consultants.filter((c: any) => c.bench_status === "available").length;

  return (
    <div>
      <PageHeader
        title="Bench Consultants"
        subtitle={`${consultants.length} consultants total — ${availableCount} available right now`}
        actions={
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Add consultant
              </Button>
            </DialogTrigger>
            <AddConsultantModal onDone={() => setOpenAdd(false)} />
          </Dialog>
        }
      />

      <div className="space-y-4 p-6">
        {/* Search & Filter bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by candidate name, skills, or work auth…"
              className="pl-9 text-xs"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 text-xs">
              <SelectValue placeholder="Bench Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bench Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="in_interview">In Interview</SelectItem>
              <SelectItem value="placed">Placed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {consultants.length === 0
                ? "No consultants on your bench yet. Click 'Add consultant' above or load demo data."
                : "No consultants match your search filters."}
            </p>
            {consultants.length === 0 && (
              <Button
                size="sm"
                onClick={() => {
                  toast.promise(seedDemo.mutateAsync(), {
                    loading: "Loading demo bench data…",
                    success: "Demo consultants loaded!",
                    error: (e) => e?.message ?? "Failed to load demo data",
                  });
                }}
                disabled={seedDemo.isPending}
              >
                <Sparkles className="mr-1.5 h-4 w-4" /> Load Demo Consultants
              </Button>
            )}
          </div>
        )}

        {/* Consultants Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c: any) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                      {c.full_name
                        .split(" ")
                        .map((p: string) => p[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.years_experience ? `${c.years_experience} yrs exp · ` : ""}
                        <span className="uppercase font-medium">{c.work_authorization || "US Auth"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick status dropdown */}
                  <Select
                    value={c.bench_status || "available"}
                    onValueChange={(val) => handleQuickStatusChange(c.id, val)}
                  >
                    <SelectTrigger className="h-7 w-28 text-[11px] font-semibold capitalize border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available" className="text-xs text-emerald-600">Available</SelectItem>
                      <SelectItem value="in_interview" className="text-xs text-amber-600">In Interview</SelectItem>
                      <SelectItem value="placed" className="text-xs text-muted-foreground">Placed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {(c.tech_stack ?? []).map((t: string) => (
                    <span
                      key={t}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <dl className="mt-4 space-y-1 text-xs text-muted-foreground border-t border-border pt-2.5">
                  <div>
                    <dt className="inline font-medium text-foreground">Last project: </dt>
                    {c.last_project_title || "Not specified"} {c.last_project_duration ? `(${c.last_project_duration})` : ""}
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">Availability: </dt>
                    {c.availability_date || "Immediate"}
                  </div>
                </dl>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1 text-muted-foreground">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="rounded p-1.5 hover:bg-accent hover:text-accent-foreground"
                      title={c.email}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="rounded p-1.5 hover:bg-accent hover:text-accent-foreground"
                      title={c.phone}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => setEditingConsultant(c)}
                    className="rounded p-1.5 hover:bg-accent hover:text-foreground"
                    title="Edit consultant"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.full_name)}
                    className="rounded p-1.5 hover:bg-accent hover:text-destructive"
                    title="Remove consultant"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => navigate({ to: "/resume-tailor", search: { consultantId: c.id } })}
                    title="Tailor resume for this candidate"
                  >
                    <FileText className="mr-1 h-3.5 w-3.5" /> Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setMatchingConsultant(c)}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5 text-primary" /> Match
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Consultant Modal */}
      {editingConsultant && (
        <Dialog open={Boolean(editingConsultant)} onOpenChange={(val) => !val && setEditingConsultant(null)}>
          <EditConsultantModal
            c={editingConsultant}
            onDone={() => setEditingConsultant(null)}
          />
        </Dialog>
      )}

      {/* Requirement Matching Dialog */}
      {matchingConsultant && (
        <Dialog open={Boolean(matchingConsultant)} onOpenChange={(val) => !val && setMatchingConsultant(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <DialogTitle>Matched Requirements for {matchingConsultant.full_name}</DialogTitle>
              </div>
              <DialogDescription>
                Ranked by tech stack overlap, years of experience, and role suitability.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex flex-wrap items-center gap-4">
                <div>
                  <span className="font-semibold text-foreground">Candidate Skills: </span>
                  {(matchingConsultant.tech_stack ?? []).join(", ") || "None listed"}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Experience: </span>
                  {matchingConsultant.years_experience} years
                </div>
              </div>

              {requirements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Your pipeline doesn't have any requirements yet to match against.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        toast.promise(seedDemo.mutateAsync(), {
                          loading: "Loading demo requirements…",
                          success: "Demo requirements loaded!",
                          error: (e) => e?.message ?? "Failed to load demo data",
                        });
                      }}
                      disabled={seedDemo.isPending}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" /> Load Demo Requirements
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMatchingConsultant(null);
                        navigate({ to: "/requirements" });
                      }}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Add Requirement
                    </Button>
                  </div>
                </div>
              ) : matches.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No active requirements found in pipeline to match.
                </p>
              ) : (
                <div className="space-y-3">
                  {matches.slice(0, 10).map((m: RequirementMatch) => {
                    const r = m.requirement;
                    const isHigh = m.matchPercentage >= 75;
                    const isMid = m.matchPercentage >= 50 && m.matchPercentage < 75;
                    const badgeTone = isHigh
                      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                      : isMid
                      ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                      : "bg-muted text-muted-foreground";

                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-border bg-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-accent/15"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${badgeTone}`}>
                              {m.matchPercentage}% Match
                            </span>
                            <span className="font-semibold text-foreground">{r.title}</span>
                            <span className="text-xs text-muted-foreground">
                              · {r.client_masked || r.vendor_name || "Direct Client"}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                            {r.rate_max && (
                              <span>
                                Rate: <strong className="text-foreground">${r.rate_min ? `${r.rate_min}-$` : ""}{r.rate_max}/hr</strong>
                              </span>
                            )}
                            {(r.location_city || r.location_state) && (
                              <span>
                                Location: {[r.location_city, r.location_state].filter(Boolean).join(", ")}
                              </span>
                            )}
                            <span>
                              Req-Score: <strong className="text-foreground">{r.req_score}</strong>
                            </span>
                          </div>

                          {/* Matched skills */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-medium text-muted-foreground">Matched:</span>
                            {m.matchedSkills.map((s) => (
                              <span key={s} className="rounded bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 text-[10px] font-medium">
                                ✓ {s}
                              </span>
                            ))}
                            {m.missingSkills.length > 0 && (
                              <>
                                <span className="ml-2 text-[11px] font-medium text-muted-foreground">Missing:</span>
                                {m.missingSkills.slice(0, 3).map((s) => (
                                  <span key={s} className="rounded bg-muted text-muted-foreground px-1.5 py-0.2 text-[10px]">
                                    {s}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => {
                              setMatchingConsultant(null);
                              navigate({
                                to: "/submit",
                                search: {
                                  reqId: r.id,
                                  consultantId: matchingConsultant.id,
                                },
                              });
                            }}
                          >
                            Submit Candidate
                            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EditConsultantModal({ c, onDone }: { c: any; onDone: () => void }) {
  const update = useUpdateConsultant();

  const [name, setName] = useState(c.full_name || "");
  const [email, setEmail] = useState(c.email || "");
  const [phone, setPhone] = useState(c.phone || "");
  const [stack, setStack] = useState((c.tech_stack ?? []).join(", "));
  const [years, setYears] = useState(c.years_experience ? String(c.years_experience) : "");
  const [workAuth, setWorkAuth] = useState(c.work_authorization || "");
  const [status, setStatus] = useState<any>(c.bench_status || "available");
  const [lastProj, setLastProj] = useState(c.last_project_title || "");
  const [duration, setDuration] = useState(c.last_project_duration || "");
  const [avail, setAvail] = useState(c.availability_date || "");

  async function handleSave() {
    if (!name.trim()) return toast.error("Full name is required");
    try {
      await update.mutateAsync({
        id: c.id,
        patch: {
          full_name: name.trim(),
          email: email || null,
          phone: phone || null,
          tech_stack: stack.split(",").map((s) => s.trim()).filter(Boolean),
          years_experience: years ? Number(years) : null,
          work_authorization: workAuth || null,
          bench_status: status,
          last_project_title: lastProj || null,
          last_project_duration: duration || null,
          availability_date: avail || null,
        },
      });
      toast.success("Consultant profile updated!");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update consultant");
    }
  }

  return (
    <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Consultant Profile</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Bench Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="in_interview">In Interview</SelectItem>
              <SelectItem value="placed">Placed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Years experience</Label>
          <Input type="number" value={years} onChange={(e) => setYears(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Tech stack (comma separated)</Label>
          <Input value={stack} onChange={(e) => setStack(e.target.value)} />
        </div>
        <div>
          <Label>Work authorization</Label>
          <Input value={workAuth} onChange={(e) => setWorkAuth(e.target.value)} placeholder="USC / GC / H1B" />
        </div>
        <div>
          <Label>Availability date</Label>
          <Input value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="Immediate or YYYY-MM-DD" />
        </div>
        <div>
          <Label>Last project title</Label>
          <Input value={lastProj} onChange={(e) => setLastProj(e.target.value)} placeholder="Senior Cloud Engineer" />
        </div>
        <div>
          <Label>Project duration</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="18 months" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </DialogContent>
  );
}

function AddConsultantModal({ onDone }: { onDone: () => void }) {
  const create = useCreateConsultant();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stack, setStack] = useState("");
  const [years, setYears] = useState("");
  const [workAuth, setWorkAuth] = useState("");
  const [avail, setAvail] = useState("");

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    try {
      await create.mutateAsync({
        full_name: name.trim(),
        email: email || null,
        phone: phone || null,
        tech_stack: stack.split(",").map((s) => s.trim()).filter(Boolean),
        years_experience: years ? Number(years) : null,
        work_authorization: workAuth || null,
        availability_date: avail || null,
        bench_status: "available",
      });
      toast.success("Consultant added");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add consultant");
    }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Add Bench Consultant</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Mehta" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="arjun@bench.dev" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (469) 555-1010" />
        </div>
        <div className="sm:col-span-2">
          <Label>Tech stack (comma separated)</Label>
          <Input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Java, Spring Boot, AWS, Kafka" />
        </div>
        <div>
          <Label>Years experience</Label>
          <Input type="number" value={years} onChange={(e) => setYears(e.target.value)} placeholder="9" />
        </div>
        <div>
          <Label>Work authorization</Label>
          <Input value={workAuth} onChange={(e) => setWorkAuth(e.target.value)} placeholder="USC / GC / H1B" />
        </div>
        <div className="sm:col-span-2">
          <Label>Availability date</Label>
          <Input value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="Immediate or YYYY-MM-DD" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </DialogContent>
  );
}