import { useUsage, useUpdatedAgo } from "@/lib/usage/context";
import type { TimeWindow } from "@/lib/usage/context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CHIPS: { key: TimeWindow; label: string }[] = [
  { key: "1h",  label: "Last 1 hour" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d",  label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

export function FilterBar() {
  const { window, setWindow } = useUsage();
  const ago = useUpdatedAgo();
  const isLive = window === "1h" || window === "24h";

  return (
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
  );
}
