import { TrendingDown, TrendingUp, Minus, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function SectionTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-neutral-900">{children}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-neutral-600">{subtitle}</p>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-300 bg-card p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function KPICard({
  label,
  value,
  trend,
  info,
}: {
  label: string;
  value: string | number;
  trend?: number;
  info?: string;
}) {
  const dir = trend === undefined ? "neutral" : trend > 0 ? "up" : trend < 0 ? "down" : "neutral";
  return (
    <Panel className="transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">{label}</p>
        {info && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
              </TooltipTrigger>
              <TooltipContent>{info}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none text-neutral-900">{value}</p>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {dir === "up" && <TrendingUp className="h-3.5 w-3.5 text-accent" />}
          {dir === "down" && <TrendingDown className="h-3.5 w-3.5 text-warning" />}
          {dir === "neutral" && <Minus className="h-3.5 w-3.5 text-neutral-600" />}
          <span className={dir === "up" ? "text-accent" : dir === "down" ? "text-warning" : "text-neutral-600"}>
            {trend > 0 ? "+" : ""}
            {trend}% vs previous
          </span>
        </div>
      )}
    </Panel>
  );
}

export function EmptyState({ message = "No consumption data for this period" }: { message?: string }) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-md bg-neutral-100 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-neutral-300/40">
        <div className="h-4 w-4 rounded-sm border-2 border-neutral-600" />
      </div>
      <p className="text-sm text-neutral-600">{message}</p>
    </div>
  );
}

export function formatNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}
