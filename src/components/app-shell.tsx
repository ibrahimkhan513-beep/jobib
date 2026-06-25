import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListChecks, Send, Users, FileText, BarChart3, Plug, Settings, Radar, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useProfile } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = {
  to: "/dashboard" | "/requirements" | "/submit" | "/consultants" | "/resume-tailor" | "/analytics" | "/integrations" | "/settings";
  label: string;
  Icon: typeof LayoutDashboard;
  dot?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/requirements", label: "Requirements", Icon: ListChecks },
  { to: "/submit", label: "Submissions", Icon: Send },
  { to: "/consultants", label: "Consultants", Icon: Users },
  { to: "/resume-tailor", label: "Resume Tailor", Icon: FileText },
  { to: "/analytics", label: "Analytics", Icon: BarChart3 },
  { to: "/integrations", label: "Integrations", Icon: Plug, dot: true },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const name = profile?.full_name || profile?.email || "Account";
  const wsName = (profile as any)?.workspace?.name || "Workspace";
  const initials = name
    .split(/\s+/)
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 pb-4 pt-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Radar className="h-5 w-5" />
          </span>
          <div>
            <div className="text-base font-semibold leading-none">Jobib</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Bench Sales Intel</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map(({ to, label, Icon, dot }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {dot && <span className="h-1.5 w-1.5 rounded-full bg-sync-ok" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold">{initials || "?"}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="truncate text-xs text-sidebar-foreground/60">{wsName}</div>
            </div>
            <button onClick={signOut} className="rounded p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      <MobileNav pathname={pathname} />
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const items = NAV.slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
      {items.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium",
              active ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60",
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-surface px-6 py-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}