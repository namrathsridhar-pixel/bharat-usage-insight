import { useState } from "react";
import { useUsage, useUpdatedAgo } from "@/lib/usage/context";
import type { TimeWindow } from "@/lib/usage/context";
import { TENANTS, type TenantMeta } from "@/data/eventLog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, ChevronDown, Search, Users, X, Grid3x3 } from "lucide-react";

const CHIPS: { key: TimeWindow; label: string }[] = [
  { key: "1h",  label: "Last 1 hour" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

const PLAN_STYLE: Record<TenantMeta["plan"], string> = {
  Enterprise: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Pro: "bg-blue-50 text-blue-700 border-blue-200",
  Standard: "bg-slate-100 text-slate-700 border-slate-200",
  Starter: "bg-amber-50 text-amber-700 border-amber-200",
};

function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
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

function TenantDropdown() {
  const { selectedTenantId, setSelectedTenantId, effectiveTenant } = useUsage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = TENANTS.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const active = !!effectiveTenant;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition max-w-[260px] ${
            active
              ? "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {effectiveTenant ? (
            <Avatar name={effectiveTenant.name} color={effectiveTenant.avatarColor} size={18} />
          ) : (
            <Users className="h-3.5 w-3.5" />
          )}
          <span className="truncate">{effectiveTenant ? effectiveTenant.name : "All Tenants"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end" side="bottom">
        <div className="p-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded border border-slate-200 focus:outline-none focus:border-orange-400"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto py-1">
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
                <Avatar name={t.name} color={t.avatarColor} size={30} />
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

export function FilterBar() {
  const { window, setWindow, effectiveTenant, setSelectedTenantId } = useUsage();
  const ago = useUpdatedAgo();
  const isLive = window === "1h" || window === "24h";

  return (
    <div className="space-y-2">
      <div className="border border-slate-200 rounded-xl bg-white px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS.map((c) => {
            const active = window === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setWindow(c.key)}
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="px-3 py-1.5 rounded-full text-xs font-medium border bg-white text-slate-400 border-slate-200 cursor-not-allowed"
                >
                  Custom range
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex-1" />

        <TenantDropdown />

        <div className="inline-flex items-center gap-2 text-[12px] text-slate-600">
          {isLive ? (
            <>
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 live-dot" />
              </span>
              <span className="font-medium text-slate-700">Live</span>
              <span className="text-slate-400">·</span>
              <span>Updated {ago}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Historical data
            </span>
          )}
        </div>
      </div>

      {effectiveTenant && (
        <div className="flex">
          <button
            onClick={() => setSelectedTenantId(null)}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-800 hover:bg-orange-100 transition"
          >
            <Avatar name={effectiveTenant.name} color={effectiveTenant.avatarColor} size={16} />
            <span className="font-medium">{effectiveTenant.name}</span>
            <X className="h-3 w-3 opacity-70" />
          </button>
        </div>
      )}
    </div>
  );
}
