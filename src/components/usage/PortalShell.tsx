import type { ReactNode } from "react";
import { Home, Database, LayoutGrid, Users, Key, FileText, Bell, ShieldCheck, ChevronDown, BarChart3, Menu } from "lucide-react";

const NAV_TOP = [
  { icon: Home, label: "Home" },
  { icon: Database, label: "Model Management" },
  { icon: LayoutGrid, label: "Services Management" },
  { icon: Users, label: "Tenant Management" },
  { icon: Key, label: "API Key Management" },
  { icon: FileText, label: "Logs Dashboard" },
  { icon: BarChart3, label: "Usage & Metering", active: true },
  { icon: Bell, label: "Alerts Management" },
  { icon: ShieldCheck, label: "PII Guardrail" },
];

export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      {/* Sidebar */}
      <aside className="w-[240px] shrink-0 border-r border-slate-200 bg-[#FAFBFC] flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
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
            const active = item.active;
            return (
              <button
                key={item.label}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition relative ${
                  active
                    ? "bg-orange-50 text-orange-600 font-medium"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-orange-500" />}
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
          <div className="pt-2 mt-2 border-t border-slate-200">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-700 hover:bg-slate-100">
              <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="flex-1 text-left">Services</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
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
