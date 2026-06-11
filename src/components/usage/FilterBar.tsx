import { useUsage, useUpdatedAgo } from "@/lib/usage/context";
import type { TimeWindow } from "@/lib/usage/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "lucide-react";
import { useState } from "react";
import { Calendar as DayCalendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

const CHIPS: { key: TimeWindow; label: string }[] = [
  { key: "1h",  label: "Last 1 hour" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

export function FilterBar({ showTenantSwitcher = false }: { showTenantSwitcher?: boolean }) {
  void showTenantSwitcher; // tenant switcher now lives in the sidebar
  const { window, setWindow, customLabel, setCustomLabel } = useUsage();
  const ago = useUpdatedAgo();
  const isLive = window === "1h" || window === "24h";

  const [range, setRange] = useState<DateRange | undefined>();
  const [openCustom, setOpenCustom] = useState(false);

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

      <div className="inline-flex items-center gap-2 text-[12px] text-slate-600">
        {isLive ? (
          <>
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-500 live-dot" />
            </span>
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
  );
}
