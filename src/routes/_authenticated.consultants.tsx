import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConsultants, useCreateConsultant } from "@/lib/api";
import { Plus, Upload, Sparkles, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/consultants")({
  head: () => ({
    meta: [
      { title: "Consultants — Jobib" },
      { name: "description", content: "Your active bench and consultant profiles." },
    ],
  }),
  component: ConsultantsPage,
});

const STATUS_TONE = {
  available: "bg-score-high/15 text-score-high",
  in_interview: "bg-score-mid/15 text-score-mid",
  placed: "bg-muted text-muted-foreground",
} as const;

function ConsultantsPage() {
  const { data: consultants = [], isLoading } = useConsultants();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader
        title="Bench Consultants"
        subtitle={`${consultants.length} consultants — ${consultants.filter((c: any) => c.bench_status === "available").length} available now`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add consultant</Button></DialogTrigger>
            <AddConsultantModal onDone={() => setOpen(false)} />
          </Dialog>
        }
      />
      {!isLoading && consultants.length === 0 && (
        <p className="p-12 text-center text-sm text-muted-foreground">No consultants on the bench yet. Add one above, or seed demo data from the Dashboard.</p>
      )}
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {consultants.map((c: any) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {c.full_name.split(" ").map((p: string) => p[0]).join("")}
                </div>
                <div>
                  <div className="font-semibold">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.years_experience} yrs · {c.work_authorization}</div>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[c.bench_status as keyof typeof STATUS_TONE]}`}>
                {String(c.bench_status).replace("_", " ")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {(c.tech_stack ?? []).map((t: string) => (
                <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t}</span>
              ))}
            </div>
            <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
              <div><dt className="inline font-medium text-foreground">Last project:</dt> {c.last_project_title} · {c.last_project_duration}</div>
              <div><dt className="inline font-medium text-foreground">Available:</dt> {c.availability_date}</div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex gap-2 text-muted-foreground">
                <a href={`mailto:${c.email}`} className="rounded p-1.5 hover:bg-accent hover:text-accent-foreground"><Mail className="h-4 w-4" /></a>
                <a href={`tel:${c.phone}`} className="rounded p-1.5 hover:bg-accent hover:text-accent-foreground"><Phone className="h-4 w-4" /></a>
              </div>
              <Button size="sm" variant="outline"><Sparkles className="mr-1.5 h-4 w-4" />Match reqs</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Add consultant</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Mehta" /></div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="arjun@bench.dev" /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (469) 555-1010" /></div>
        <div className="sm:col-span-2"><Label>Tech stack (comma separated)</Label><Input value={stack} onChange={(e) => setStack(e.target.value)} placeholder="Java, Spring Boot, AWS" /></div>
        <div><Label>Years experience</Label><Input type="number" value={years} onChange={(e) => setYears(e.target.value)} placeholder="9" /></div>
        <div><Label>Work authorization</Label><Input value={workAuth} onChange={(e) => setWorkAuth(e.target.value)} placeholder="USC / GC / H1B" /></div>
        <div><Label>Availability date</Label><Input type="date" value={avail} onChange={(e) => setAvail(e.target.value)} /></div>
        <div className="sm:col-span-2">
          <Label>Resume</Label>
          <div className="mt-1 flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            <Upload className="h-4 w-4" /> Upload coming in next pass
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onDone}>Cancel</Button><Button onClick={save} disabled={create.isPending}>{create.isPending ? "Saving…" : "Save"}</Button></div>
    </DialogContent>
  );
}