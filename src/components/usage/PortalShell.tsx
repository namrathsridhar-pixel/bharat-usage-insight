import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Database, LayoutGrid, Users, Key, FileText, Bell, ShieldCheck,
  BarChart3, Menu, UserCircle2,
} from "lucide-react";

const NAV_TOP = [
  { icon: Home, label: "Home", to: "/home" },
  { icon: Database, label: "Model Management", to: "/models" },
  { icon: LayoutGrid, label: "Services Management", to: "/services" },
  { icon: Users, label: "Tenant Management", to: "/tenants" },
  { icon: Key, label: "API Key Management", to: "/keys" },
  { icon: FileText, label: "Logs Dashboard", to: "/logs" },
  { icon: BarChart3, label: "Usage Dashboard", to: "/" },
  { icon: Bell, label: "Alerts Management", to: "/alerts" },
  { icon: ShieldCheck, label: "PII Guardrail", to: "/pii" },
];

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
