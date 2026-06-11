import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Database, LayoutGrid, Users, Key, FileText, Bell, ShieldCheck,
  ChevronDown, BarChart3, Menu, UserCircle2, Check, Search, Grid3x3,
} from "lucide-react";
import { useUsage } from "@/lib/usage/context";
import { TENANTS, type TenantMeta } from "@/data/eventLog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const NAV_TOP = [
  { icon: Home, label: "Home", to: "/home" },
  { icon: Database, label: "Model Management", to: "/models" },
  { icon: LayoutGrid, label: "Services Management", to: "/services" },
  { icon: Users, label: "Tenant Management", to: "/tenants" },
  { icon: Key, label: "API Key Management", to: "/keys" },
  { icon: FileText, label: "Logs Dashboard", to: "/logs" },
  { icon: BarChart3, label: "Usage & Metering", to: "/" },
  { icon: UserCircle2, label: "My Usage", to: "/my-usage" },
  { icon: Bell, label: "Alerts Management", to: "/alerts" },
  { icon: ShieldCheck, label: "PII Guardrail", to: "/pii" },
];

const PLAN_STYLE: Record<TenantMeta["plan"], string> = {
  Enterprise: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Pro: "bg-blue-50 text-blue-700 border-blue-200",
  Standard: "bg-slate-100 text-slate-700 border-slate-200",
  Starter: "bg-amber-50 text-amber-700 border-amber-200",
};

function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="rounded-full grid place-items-center text-white font-semibold shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  );
}

function SidebarTenantSwitcher() {
  const { selectedTenantId, setSelectedTenantId, effectiveTenant, role } = useUsage();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const disabled = role === "tenant_admin";

  const filtered = TENANTS.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open && !disabled} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition text-left disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {effectiveTenant ? (
            <Avatar name={effectiveTenant.name} color={effectiveTenant.avatarColor} size={28} />
          ) : (
            <div className="h-7 w-7 rounded-full bg-slate-100 grid place-items-center text-slate-600">
              <Grid3x3 className="h-3.5 w-3.5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium leading-none">Viewing</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900 truncate">
              {effectiveTenant ? effectiveTenant.name : "All Tenants"}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start" side="bottom">
        <div className="p-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded border border-slate-200 focus:outline-none focus:border-orange-400"
            />
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto py-1">
          <button
            onClick={() => { setSelectedTenantId(null); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
          >
            <div className="h-8 w-8 rounded-full bg-slate-100 grid place-items-center text-slate-700">
              <Grid3x3 className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">All Tenants</span>
            {!selectedTenantId && <Check className="h-4 w-4 text-orange-500" />}
          </button>
          <div className="h-px bg-slate-100 my-1" />
          {filtered.map((t) => {
            const active24 = t.lastActiveHour >= 720 - 24;
            return (
              <button
                key={t.id}
                onClick={() => { setSelectedTenantId(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
              >
                <Avatar name={t.name} color={t.avatarColor} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                    {t.name}
                    {active24 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  </div>
                  <div className="mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${PLAN_STYLE[t.plan]}`}>{t.plan}</span>
                  </div>
                </div>
                {selectedTenantId === t.id && <Check className="h-4 w-4 text-orange-500" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      <aside className="w-[260px] shrink-0 border-r border-slate-200 bg-[#FAFBFC] flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <div className="inline-flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2 shadow-sm">
            <div className="font-black text-[15px] tracking-tight leading-none">
              <span className="text-slate-900">AI</span>
              <span className="text-orange-500">4</span>
            </div>
            <div className="text-[9px] font-semibold tracking-[0.15em] text-slate-600 leading-none">INCLUSION</div>
          </div>
        </div>

        <div className="px-3 pt-3 pb-2 border-b border-slate-200">
          <SidebarTenantSwitcher />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_TOP.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition relative ${
                  active ? "bg-orange-50 text-orange-600 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-orange-500" />}
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-end gap-3 px-6">
          <div className="px-3 py-1.5 rounded border border-slate-200 text-xs font-semibold tracking-wider text-slate-700">
            DEFAULT ADMIN
          </div>
          <button className="p-2 rounded hover:bg-slate-100">
            <Menu className="h-5 w-5 text-slate-700" />
          </button>
        </header>
        <main className="flex-1 min-w-0 bg-white">{children}</main>
      </div>
    </div>
  );
}
