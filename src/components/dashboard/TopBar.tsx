import { useDashboard } from "@/lib/dashboard/context";
import type { TimeWindow } from "@/lib/dashboard/mock-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";

const WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: "1h", label: "Last 1 hour" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

export function TopBar() {
  const { role, setRole, window: w, setWindow, lastRefreshed, refreshing, refresh } = useDashboard();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-300 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent font-bold">A4</div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">AI4I Orchestrate</h1>
            <p className="text-[11px] uppercase tracking-wider text-white/70">
              {role === "adopter_admin" ? "Adopter Admin" : "Tenant Admin"}
            </p>
          </div>
        </div>

        <div className="hidden flex-1 lg:block" />

        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-white/5 p-1">
            {WINDOWS.map((win) => {
              const active = w === win.key;
              return (
                <button
                  key={win.key}
                  onClick={() => setWindow(win.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-accent text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {win.label}
                </button>
              );
            })}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="cursor-not-allowed rounded-full px-3 py-1.5 text-xs font-medium text-white/40"
                >
                  Custom Range
                </button>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10"
          >
            {refreshing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            )}
            <span className="text-white/80">
              Auto-refresh on · Last updated {lastRefreshed.toLocaleTimeString()}
            </span>
          </button>

          {/* Dev role switcher */}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="rounded-md border border-white/20 bg-primary px-2 py-1.5 text-xs"
            title="Dev: switch role"
          >
            <option value="adopter_admin">Adopter Admin</option>
            <option value="tenant_admin">Tenant Admin</option>
          </select>
        </div>
      </div>
    </header>
  );
}
