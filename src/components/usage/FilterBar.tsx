import { useUsage } from "@/lib/usage/context";
import { TENANTS, type TimeWindow } from "@/lib/usage/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search, Check, Calendar } from "lucide-react";
import { useState } from "react";
import { Calendar as DayCalendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

const CHIPS: { key: TimeWindow; label: string }[] = [
  { key: "1h", label: "Last 1 hour" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="rounded-full grid place-items-center text-white font-semibold shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

const PLAN_STYLE: Record<string, string> = {
  Enterprise: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Pro: "bg-blue-50 text-blue-700 border-blue-200",
  Standard: "bg-slate-100 text-slate-700 border-slate-200",
  Starter: "bg-amber-50 text-amber-700 border-amber-200",
};

function PlanPill({ plan }: { plan: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${PLAN_STYLE[plan]}`}>{plan}</span>
  );
}

export function FilterBar() {
  const {
    window, setWindow, customLabel, setCustomLabel,
    role, setRole,
    selectedTenantId, setSelectedTenantId, effectiveTenant,
  } = useUsage();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [openCustom, setOpenCustom] = useState(false);

  const filtered = TENANTS.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  function applyCustom() {
    if (range?.from && range?.to) {
      const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const yr = range.to.getFullYear();
      setCustomLabel(`${fmt(range.from)} – ${fmt(range.to)} ${yr}`);
      setWindow("custom");
      setOpenCustom(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHIPS.map((c) => {
          const active = window === c.key;
          return (
            <button
              key={c.key}
              onClick={() => { setWindow(c.key); setCustomLabel(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                active
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {c.label}
            </button>
          );
        })}
        <Popover open={openCustom} onOpenChange={setOpenCustom}>
          <PopoverTrigger asChild>
            <button
              className={`px-3 py-1.5 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition ${
                window === "custom"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {window === "custom" && customLabel ? customLabel : "Custom range"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <DayCalendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setOpenCustom(false)} className="px-3 py-1.5 rounded text-xs border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button onClick={applyCustom} className="px-3 py-1.5 rounded text-xs bg-orange-500 text-white hover:bg-orange-600">Apply</button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex-1" />

      {role === "platform_admin" && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
              {effectiveTenant ? (
                <>
                  <Avatar name={effectiveTenant.name} color={effectiveTenant.avatarColor} size={20} />
                  <span className="font-medium">{effectiveTenant.name}</span>
                </>
              ) : (
                <span className="font-medium">All Tenants</span>
              )}
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
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
            <div className="max-h-[360px] overflow-y-auto py-1">
              <button
                onClick={() => setSelectedTenantId(null)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
              >
                <div className="h-8 w-8 rounded-full bg-slate-200 grid place-items-center text-slate-700 text-xs font-semibold">All</div>
                <span className="flex-1 text-sm font-medium">All Tenants</span>
                {!selectedTenantId && <Check className="h-4 w-4 text-orange-500" />}
              </button>
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTenantId(t.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
                >
                  <Avatar name={t.name} color={t.avatarColor} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                      {t.name}
                      {t.active24h && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </div>
                    <div className="mt-0.5"><PlanPill plan={t.plan} /></div>
                  </div>
                  {selectedTenantId === t.id && <Check className="h-4 w-4 text-orange-500" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* View-as role toggle (power-user) */}
      <div className="flex items-center gap-2 pl-3 ml-1 border-l border-slate-200">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">View as</span>
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px]">
          {[
            { k: "platform_admin", l: "Platform" },
            { k: "tenant_admin", l: "Tenant" },
          ].map((opt) => {
            const active = role === opt.k;
            return (
              <button
                key={opt.k}
                onClick={() => setRole(opt.k as any)}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.l}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { Avatar, PlanPill };
