import { useUsage } from "@/lib/usage/context";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { TENANTS, SERVICES } from "@/data/eventLog";
import {
  getFilteredData, getTotals, getActiveTenants,
  getActiveTenants24h, getActiveTenants7d, getActiveTenants30d, getNewTenants7d,
  getTenantRanking, getServiceBreakdown, getChartData, getRpsData,
  getUsageConcentration, getPrevTotals,
  getHeatmap,
  windowToHours, formatIndian, formatKMB, formatLakhCr,
  type WindowHours,
} from "@/data/aggregations";

/* ---------- shared bits ---------- */
function Eyebrow({ children, right, subtitle }: { children: React.ReactNode; right?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">{children}</h2>
        {right}
      </div>
      {subtitle && <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div>}
    </div>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}
function Delta({ pct, invert = false, size = 11 }: { pct: number; invert?: boolean; size?: number }) {
  if (!isFinite(pct) || pct === 0) {
    return <span className="text-slate-400 tabular-nums" style={{ fontSize: size }}>— 0% vs previous</span>;
  }
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${good ? "text-emerald-600" : "text-rose-600"}`} style={{ fontSize: size }}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}% vs previous
    </span>
  );
}


/** Abbreviate long service names so they always fit on a single line in tables. */
const SERVICE_ABBR: Record<string, string> = {
  "Language Detection": "Text LD",
  "Audio Language Detection": "Audio LD",
  "Speaker Diarization": "Spk. Diar",
  "Transliteration": "Translit",
};
function abbrService(name: string): string {
  return SERVICE_ABBR[name] ?? name;
}

/** Axis-only formatter: whole numbers, K/M with no decimal. */
function formatAxisKMB(n: number): string {
  if (!isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a < 1000) return sign + Math.round(a).toString();
  if (a < 1_000_000) return sign + Math.round(a / 1000) + "K";
  return sign + Math.round(a / 1_000_000) + "M";
}


function useScope() {
  const { window, effectiveTenant } = useUsage();
  const windowHours = windowToHours(window === "custom" ? "24h" : window) as WindowHours;
  const tenantId = effectiveTenant?.id;
  return { windowHours, tenantId };
}

/* =========================================================
   ZONE 1 — Platform Pulse (3 KPI cards)
========================================================= */
export function PlatformPulse() {
  const { windowHours, tenantId } = useScope();
  const { tick } = useUsage();

  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const totals = useMemo(() => getTotals(rows), [rows]);
  const prev = useMemo(() => getPrevTotals(windowHours, tenantId), [windowHours, tenantId]);
  const avgRps = +(totals.totalRequests / (windowHours * 3600)).toFixed(3);
  const prevAvgRps = +(prev.totalRequests / (windowHours * 3600)).toFixed(3);

  const activeCount = Math.max(1, getActiveTenants(rows));
  const avgPerTenant = Math.round(totals.totalRequests / activeCount);
  const prevAvgPerTenant = Math.round(prev.totalRequests / activeCount);

  const reqDelta = prev.totalRequests ? ((totals.totalRequests - prev.totalRequests) / prev.totalRequests) * 100 : 0;
  const srDelta = (totals.successRate - prev.successRate) * 100;
  const rpsDelta = prevAvgRps ? ((avgRps - prevAvgRps) / prevAvgRps) * 100 : 0;
  const avgPerTenantDelta = prevAvgPerTenant ? ((avgPerTenant - prevAvgPerTenant) / prevAvgPerTenant) * 100 : 0;

  void avgPerTenant; void prevAvgPerTenant; void avgPerTenantDelta;

  const items = [
    {
      label: "Total requests",
      value: formatKMB(totals.totalRequests),
      delta: reqDelta,
      sub: tenantId ? "across selected window" : "across all services and tenants",
      sub2: `${formatKMB(totals.totalSuccessful)} successful · ${formatKMB(totals.totalFailed)} failed`,
    },
    { label: "Success rate",    value: `${(totals.successRate * 100).toFixed(2)}%`, delta: srDelta,  sub: "of all requests" },
    { label: "Avg RPS (req/s)", value: `${avgRps}`,                                  delta: rpsDelta, sub: "requests per second" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
      {items.map((it, i) => (
        <div
          key={i}
          title={`${it.label}: ${it.value}`}
          className="rounded-xl bg-white p-5 transition cursor-default flex flex-col"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
        >
          <div className="text-[11px] uppercase font-medium tracking-[0.08em]" style={{ color: "#475569" }}>{it.label}</div>
          <div key={tick} className="pulse-fade mt-2 leading-none tabular-nums" style={{ fontSize: 28, fontWeight: 700, color: "#0F172A" }}>{it.value}</div>
          <div className="mt-2"><Delta pct={it.delta} size={12} /></div>
          <div className="mt-1" style={{ fontSize: 11, color: "#94A3B8" }}>{it.sub}</div>
          {it.sub2 && <div className="mt-0.5 tabular-nums" style={{ fontSize: 11, color: "#475569" }}>{it.sub2}</div>}
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   ZONE 2A — Tenant Overview (fixed, above filter bar)
========================================================= */
export function TenantOverview() {
  const items = [
    { label: "Total tenants",     value: TENANTS.length,        sub: "registered on platform",      period: "all time" },
    { label: "Active tenants",    value: getActiveTenants24h(), sub: "last 24 hours",               period: "last 24 hours" },
    { label: "Active tenants",    value: getActiveTenants7d(),  sub: "last 7 days",                 period: "last 7 days" },
    { label: "Active tenants",    value: getActiveTenants30d(), sub: "last 30 days",                period: "last 30 days" },
    { label: "New — Last 7 days", value: getNewTenants7d(),     sub: "onboarded in last 7 days",    period: "last 7 days" },
  ];
  return (
    <section>
      <Eyebrow>Platform adoption</Eyebrow>
      <Card className="p-6">
        <div className="mb-3 text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-600">
          Tenant overview
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
          {items.map((it, i) => (
            <div
              key={i}
              title={`${it.label} — ${it.value} (${it.period})`}
              className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:shadow-sm transition cursor-default"
            >
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-600">{it.label}</div>
              <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
              <div className="mt-1.5 text-[11px] text-slate-400">{it.sub}</div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 2B — Consumption Overview (3 panels)
========================================================= */
export function ConsumptionOverview({ singleDonut = false, onTenantClick }: { singleDonut?: boolean; onTenantClick?: (id: string) => void } = {}) {
  const { window } = useUsage();
  const windowHours = windowToHours(window === "custom" ? "30d" : window) as WindowHours;
  const concentration = useMemo(() => getUsageConcentration(windowHours), [windowHours]);
  const windowLabel =
    window === "1h"  ? "last 1 hour"   :
    window === "24h" ? "last 24 hours" :
    window === "7d"  ? "last 7 days"   : "last 30 days";

  const curRows = useMemo(() => getFilteredData({ windowHours }), [windowHours]);
  const curTotals = useMemo(() => getTotals(curRows), [curRows]);
  const prevTotals = useMemo(() => getPrevTotals(windowHours), [windowHours]);
  const activeCount = Math.max(1, getActiveTenants(curRows));
  const avgPerTenant = Math.round(curTotals.totalRequests / activeCount);
  const prevAvgPerTenant = Math.round(prevTotals.totalRequests / activeCount);
  const avgDelta = prevAvgPerTenant ? ((avgPerTenant - prevAvgPerTenant) / prevAvgPerTenant) * 100 : 0;

  // Fixed Top 5 — same 5 tenants drive both donuts
  const concTopN = 5;
  const active = concentration.filter((c) => c.requests > 0);
  const donutTopCount = Math.min(concTopN, active.length);
  const topSlice = active.slice(0, donutTopCount);
  const rest = active.slice(donutTopCount);
  const othersPct = rest.reduce((a, r) => a + r.pct, 0);
  const othersReq = rest.reduce((a, r) => a + r.requests, 0);
  const donut = [
    ...topSlice.map((c) => ({ id: c.id, name: c.name, value: c.requests, pct: c.pct, color: c.color })),
    ...(rest.length ? [{ id: undefined as string | undefined, name: `Others (${rest.length} tenants)`, value: othersReq, pct: othersPct, color: "#CBD5E1" }] : []),
  ];
  

  // Throughput donut — same top 5 tenants/colors as Usage Concentration
  const rpsByTenant = useMemo(() => {
    return topSlice.map((c) => {
      const tr = curRows.filter((r) => r.tenantId === c.id);
      const reqs = tr.reduce((a, r) => a + r.requests, 0);
      const avgRps = +(reqs / (windowHours * 3600)).toFixed(3);
      const rawPeak = tr.reduce((a, r) => Math.max(a, r.peakRps), 0);
      // burst multiplier (1.5x–3x), deterministic
      let h = 2166136261;
      const seed = `${c.id}:${windowHours}`;
      for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
      const burst = 1.5 + (((h >>> 0) % 1000) / 1000) * 1.5;
      const peakRps = +Math.max(rawPeak, +(avgRps * burst).toFixed(3)).toFixed(3);
      return { id: c.id, name: c.name, color: c.color, avgRps, peakRps };
    });
  }, [topSlice, curRows, windowHours]);

  return (
    <section>
      <Card className="p-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">
            Consumption overview
          </div>
          <div className="text-[10px] italic text-slate-500 whitespace-nowrap shrink-0">reflects selected time window · {windowLabel}</div>
        </div>
        {singleDonut ? (
          <div className="relative min-w-0 flex flex-col">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-600">
                Usage concentration
              </div>
            </div>
            <div className="mb-3 text-[11px] text-slate-400">Top 5 by request volume · reflects selected time window</div>
            <div className="flex flex-col lg:flex-row gap-6 items-center min-w-0">
              <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut.filter(d => !d.name.startsWith("Others")).slice(0, 5)}
                      dataKey="value"
                      innerRadius={64}
                      outerRadius={92}
                      paddingAngle={1}
                      stroke="#fff"
                      strokeWidth={2}
                      isAnimationActive={false}
                      onClick={(d: any) => d?.payload?.id && onTenantClick?.(d.payload.id)}
                    >
                      {donut.filter(d => !d.name.startsWith("Others")).slice(0, 5).map((d, i) => (
                        <Cell key={i} fill={d.color} style={{ cursor: d.id && onTenantClick ? "pointer" : "default", outline: "none" }} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                      formatter={(v: number, _n, p: any) => [
                        `${formatKMB(v)} req · ${p.payload.pct.toFixed(2)}%${p.payload.id && onTenantClick ? " · Click to view" : ""}`,
                        p.payload.name,
                      ]}
                      separator="  "
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[20px] font-bold text-slate-900 leading-none">Top {donutTopCount}</div>
                  <div className="text-[12px] font-normal text-slate-600 mt-1 leading-none">tenants</div>
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full">
                {(() => {
                  const rows = donut.filter(d => !d.name.startsWith("Others")).slice(0, 5);
                  const maxVal = rows.length ? rows[0].value : 1;
                  return (
                    <>
                      {/* Column headers */}
                      <div className="flex items-center gap-3 px-2 pb-2">
                        <div className="shrink-0" style={{ width: 260 }} />
                        <div
                          className="flex-1 uppercase tracking-[0.12em] text-center"
                          style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", paddingRight: 48 }}
                        >
                          Request volume &amp; share
                        </div>
                        <div
                          className="shrink-0 uppercase tracking-[0.12em] text-right"
                          style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8", width: 60 }}
                        >
                          % of total
                        </div>
                      </div>
                      {rows.map((d, i) => {
                        const clickable = !!d.id && !!onTenantClick;
                        const barPct = Math.max(2, (d.value / maxVal) * 100);
                        const isLast = i === rows.length - 1;
                        return (
                          <div
                            key={d.name}
                            role={clickable ? "button" : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            onClick={() => clickable && onTenantClick?.(d.id!)}
                            onKeyDown={(e) => { if (clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onTenantClick?.(d.id!); } }}
                            title={`${d.name} — ${d.pct.toFixed(2)}%`}
                            className="flex items-center gap-3 px-2 rounded transition-colors"
                            style={{ height: 48, cursor: clickable ? "pointer" : "default", borderBottom: isLast ? "none" : "1px solid #F5F7FA" }}
                            onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = "#F8FAFC"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            <div className="shrink-0 flex items-center gap-2" style={{ width: 260 }}>
                              <span className="tabular-nums text-left" style={{ fontSize: 11, color: "#94A3B8", width: 24 }}>
                                {`#${i + 1}`}
                              </span>
                              <span className="shrink-0 flex items-center justify-center" style={{ width: 20 }}>
                                <span className="rounded-full" style={{ background: d.color, width: 8, height: 8 }} />
                              </span>
                              <span className="truncate" style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>
                                {d.name}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0" style={{ paddingRight: 48 }}>
                              <div className="relative rounded-full" style={{ height: 6, width: `${barPct}%`, background: d.color }}>
                                <div
                                  className="absolute top-1/2 flex items-center gap-1 pointer-events-none"
                                  style={{ right: 0, transform: "translate(calc(100% + 6px), -50%)" }}
                                >
                                  <span
                                    className="tabular-nums rounded bg-white flex items-center"
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: d.color,
                                      border: `1px solid ${d.color}40`,
                                      padding: "1px 6px",
                                      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                      lineHeight: "14px",
                                    }}
                                  >
                                    {formatKMB(d.value)}
                                  </span>
                                  <span className="rounded-full" style={{ background: d.color, width: 4, height: 4 }} />
                                </div>
                              </div>
                            </div>
                            <span
                              className="tabular-nums shrink-0 text-right"
                              style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", width: 60 }}
                            >
                              {d.pct.toFixed(2)}%
                            </span>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

            </div>
          </div>
        ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
          {/* Left: Usage concentration donut */}
          <div className="relative min-w-0 flex flex-col">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-600">
                Usage concentration
              </div>
            </div>
            <div className="mb-3 text-[11px] text-slate-400">Top 5 by request volume · reflects selected time window</div>
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      innerRadius={64}
                      outerRadius={92}
                      paddingAngle={1}
                      stroke="#fff"
                      strokeWidth={2}
                      isAnimationActive={false}
                      onClick={(d: any) => d?.payload?.id && onTenantClick?.(d.payload.id)}
                    >
                      {donut.map((d, i) => (
                        <Cell key={i} fill={d.color} style={{ cursor: d.id && onTenantClick ? "pointer" : "default", outline: "none" }} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                      formatter={(v: number, _n, p: any) => [
                        `${formatKMB(v)} req · ${p.payload.pct.toFixed(2)}%${p.payload.id && onTenantClick ? " · Click to view" : ""}`,
                        p.payload.name,
                      ]}
                      separator="  "
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[20px] font-bold text-slate-900 leading-none">Top {donutTopCount}</div>
                  <div className="text-[12px] font-normal text-slate-600 mt-1 leading-none">tenants</div>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {donut.map((d) => {
                  const isOthers = d.name.startsWith("Others");
                  return (
                    <div
                      key={d.name}
                      title={`${d.name} — ${formatKMB(d.value)} req · ${d.pct.toFixed(2)}%`}
                      className="flex items-start gap-2"
                      style={{ fontSize: 12, wordBreak: "normal", overflowWrap: "break-word" }}
                    >
                      <span className="rounded-full shrink-0 mt-[5px]" style={{ background: isOthers ? "#94A3B8" : d.color, width: 8, height: 8 }} />
                      <span className={`flex-1 min-w-0 leading-tight ${isOthers ? "text-slate-400 italic" : "text-slate-900"}`} style={{ wordBreak: "normal", overflowWrap: "break-word" }}>{d.name}</span>
                      <span className={`tabular-nums font-semibold shrink-0 text-right ${isOthers ? "text-slate-400" : "text-slate-900"}`} style={{ width: 56, fontSize: 12 }}>{d.pct.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Top Tenants by Throughput donut */}
          <div className="min-w-0 lg:border-l lg:border-slate-100 lg:pl-6 flex flex-col">
            <div className="mb-1 text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-600">
              Top tenants by throughput
            </div>
            <div className="mb-3 text-[11px] text-slate-400">Top 5 by avg RPS · reflects selected time window</div>
            {rpsByTenant.length === 0 ? (
              <div className="text-[11px] text-slate-400 italic">No tenants with activity in this period</div>
            ) : (
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={rpsByTenant} dataKey="avgRps" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                        {rpsByTenant.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number, _n, p: any) => [`${v.toFixed(3)} req/s`, p.payload.name]} separator="  " />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[20px] font-bold text-slate-900 leading-none">Top {rpsByTenant.length}</div>
                    <div className="text-[12px] font-normal text-slate-600 mt-1 leading-none">tenants</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {rpsByTenant.map((t) => (
                    <div key={t.id} className="flex items-start gap-2" style={{ fontSize: 12 }}>
                      <span className="rounded-full shrink-0 mt-[5px]" style={{ background: t.color, width: 8, height: 8 }} />
                      <span className="flex-1 min-w-0 text-slate-900 leading-tight">{t.name}</span>
                      <span className="text-right tabular-nums text-slate-900 font-semibold shrink-0" style={{ width: 78 }}>{t.avgRps.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 3 — Volume & Health
========================================================= */
export function VolumeHealth() {
  const { windowHours, tenantId } = useScope();
  const { tick } = useUsage();
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const totals = useMemo(() => getTotals(rows), [rows]);
  const chart = useMemo(() => getChartData(rows, windowHours), [rows, windowHours]);

  void totals;

  return (
    <section className="h-full flex flex-col">
      <Eyebrow subtitle="Request volume over the selected time window">Request volume &amp; health</Eyebrow>

      <Card className="p-5 flex-1">
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 16, right: 16, left: 28, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={0} minTickGap={0} />

              <YAxis
                width={56}
                tick={{ fontSize: 11, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatAxisKMB(v)}
                label={{ value: "REQUESTS", angle: -90, position: "insideLeft", dx: -16, dy: 40, style: { fontSize: 10, fill: "#64748B", letterSpacing: "0.14em", fontWeight: 600, textAnchor: "middle" } }}
              />
              <Tooltip
                cursor={{ fill: "#F1F5F9" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0].payload as ChartPointLocal;
                  return (
                    <div style={{ fontSize: 12, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 10px", boxShadow: "0 2px 6px rgba(15,23,42,0.06)" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: "#16A34A" }}>{formatKMB(p.successful)} successful</div>
                      <div style={{ color: "#DC2626" }}>{formatKMB(p.failed)} failed</div>
                      <div style={{ color: "#475569", marginTop: 2 }}>{formatKMB(p.total)} total</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="successful" stackId="a" fill="#22C55E" fillOpacity={0.8} isAnimationActive={false} />
              <Bar dataKey="failed" stackId="a" fill="#EF4444" fillOpacity={0.9} radius={[3, 3, 0, 0]} isAnimationActive={false} minPointSize={(v: number) => (v > 0 ? 3 : 0)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

    </section>
  );
}

type ChartPointLocal = { label: string; total: number; failed: number; successful: number };

/* =========================================================
   ZONE 4 LEFT — Service Breakdown
========================================================= */
type SortKey = "requests" | "nativeUnits" | "successRate" | "failed";
export function ServiceBreakdown() {
  const { effectiveTenant } = useUsage();
  const { windowHours, tenantId } = useScope();
  const { tick } = useUsage();
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const services = useMemo(() => getServiceBreakdown(rows, windowHours, tenantId), [rows, windowHours, tenantId]);
  const [sortKey, setSortKey] = useState<SortKey>("requests");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...services];
    arr.sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [services, sortKey, sortDir]);

  function toggle(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function Th({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <th className="py-3 px-3 text-right">
        <button onClick={() => toggle(k)} className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold ${active ? "text-slate-900" : "text-slate-500"}`}>
          {children}
          {active ? (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </button>
      </th>
    );
  }

  return (
    <section>
      <Eyebrow subtitle={effectiveTenant ? `Service consumption for ${effectiveTenant.name}` : "Consumption across all services · reflects selected time window"}>Service breakdown</Eyebrow>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Service</th>
                <Th k="requests">Total requests</Th>
                <Th k="nativeUnits">Native consumption</Th>
                <Th k="successRate">Success rate</Th>
                <Th k="failed">Failure rate %</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.filter((r) => r.requests > 0).map((r) => {
                const sr = r.successRate * 100;
                const srClr = sr >= 95 ? "text-emerald-700" : sr >= 90 ? "text-amber-600" : "text-rose-600";
                const failRate = r.requests ? (r.failed / r.requests) * 100 : 0;
                const failClr = failRate > 1 ? "text-rose-600" : "text-slate-500";
                return (
                  <tr key={r.service.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60" style={{ height: 48 }}>
                    <td className="py-3 pl-4 pr-3 relative" title={r.service.name}>
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: r.service.color }} />
                      <span className="font-medium text-slate-900 whitespace-nowrap">{abbrService(r.service.name)}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-900 font-medium">{formatLakhCr(r.requests)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                      {formatLakhCr(r.nativeUnits)} <span className="text-[11px] text-slate-500">{r.service.unitShort}</span>
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums font-medium ${srClr}`}>{sr.toFixed(2)}%</td>
                    <td className={`py-3 px-3 text-right tabular-nums font-medium ${failClr}`}>{failRate.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 4 RIGHT — Tenant Ranking
========================================================= */
const RANK_COLOR = ["#F59E0B", "#94A3B8", "#B45309"];

export function TenantRanking() {
  const { windowHours, tenantId } = useScope();
  const { tick, setSelectedTenantId, effectiveTenant, tenantRankTopN, setTenantRankTopN } = useUsage();
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const ranked = useMemo(() => getTenantRanking(rows, windowHours), [rows, windowHours]);
  const max = Math.max(1, ...ranked.map((r) => r.requests));

  const TOP_OPTIONS = [10, 25] as const;
  type TopN = typeof TOP_OPTIONS[number];
  const isScoped = !!effectiveTenant;

  function handleClick(id: string) {
    setSelectedTenantId(id);
    setTimeout(() => globalThis.scrollTo({ top: 0, behavior: "smooth" }), 60);
  }

  const activeRanked = ranked.filter((r) => !r.inactive);
  const limit = isScoped ? activeRanked.length : Math.min(tenantRankTopN, activeRanked.length);
  const visibleAll = isScoped
    ? activeRanked.filter((r) => r.tenant.id === tenantId)
    : activeRanked.slice(0, limit);
  const visible = visibleAll;
  const isExpanded = !isScoped && tenantRankTopN > 10;

  // K/M/B for compact (≤10), Indian K/L/Cr for detail
  const fmt = isExpanded ? formatLakhCr : formatKMB;

  const rankIndex = new Map<string, number>();
  activeRanked.forEach((r, i) => rankIndex.set(r.tenant.id, i + 1));

  const subtitle = isScoped ? undefined : `Top ${limit} by request volume`;

  return (
    <section>
      <Eyebrow
        subtitle={subtitle}
        right={
          isScoped && effectiveTenant ? (
            <div className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: "#475569" }}>
              <span className="rounded-full" style={{ background: effectiveTenant.avatarColor, width: 8, height: 8, display: "inline-block" }} />
              <span>Showing: {effectiveTenant.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Show</span>
              <div className="inline-flex items-center overflow-hidden bg-white rounded-md" style={{ border: "1px solid #E2E8F0" }}>
                {TOP_OPTIONS.map((n, i) => {
                  const active = tenantRankTopN === n;
                  const isLast = i === TOP_OPTIONS.length - 1;
                  return (
                    <button
                      key={n}
                      onClick={() => setTenantRankTopN(n)}
                      className="transition"
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: active ? 600 : 500,
                        color: active ? "#FFFFFF" : "#475569",
                        background: active ? "#F97316" : "#FFFFFF",
                        borderRight: isLast ? "none" : "1px solid #E2E8F0",
                        borderRadius: 0,
                      }}
                    >
                      {`Top ${n}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        }
      >
        Tenant ranking
      </Eyebrow>
      <Card className="p-3 max-h-[520px] overflow-y-auto scroll-subtle">
        <div className="space-y-0.5">
          {visible.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-400">No tenants in this period</div>
          )}
          {visible.map((r) => {
            const idx = rankIndex.get(r.tenant.id) ?? 0;
            const rankColor = !r.inactive && idx <= 3 ? RANK_COLOR[idx - 1] : undefined;
            return (
              <button
                key={r.tenant.id}
                onClick={() => !r.inactive && handleClick(r.tenant.id)}
                className={`press-anim w-full text-left px-3 py-2.5 rounded-lg transition group ${
                  r.inactive ? "cursor-default opacity-70" : "hover:bg-orange-50/60"
                }`}
                disabled={r.inactive}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-10 shrink-0">
                    {rankColor && <span className="h-1.5 w-1.5 rounded-full" style={{ background: rankColor }} />}
                    <span className={`text-[11px] tabular-nums font-semibold ${r.inactive ? "text-slate-300" : idx <= 3 ? "text-slate-900" : "text-slate-400"}`}>
                      {r.inactive ? "—" : `#${idx}`}
                    </span>
                  </div>
                  <span
                    className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{ background: r.inactive ? "#CBD5E1" : r.tenant.avatarColor }}
                    aria-hidden
                  >
                    {r.tenant.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          title={r.tenant.name}
                          className={`text-sm font-medium truncate ${r.inactive ? "text-slate-400" : "text-slate-900 group-hover:text-orange-600"}`}
                        >{r.tenant.name}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] border ${
                          r.inactive
                            ? "bg-slate-50 border-slate-200 text-slate-400"
                            : "bg-slate-100 border-slate-200 text-slate-600"
                        }`}>{r.tenant.plan}</span>
                      </div>
                      <span className={`text-xs tabular-nums shrink-0 ${r.inactive ? "text-slate-300" : "text-slate-600"}`}>
                        {r.inactive ? "—" : fmt(r.requests)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        {!r.inactive && (
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(r.requests / max) * 100}%`, background: r.tenant.avatarColor }}
                          />
                        )}
                      </div>
                      <span className={`text-[10px] tabular-nums w-12 text-right ${r.inactive ? "text-slate-300" : "text-slate-500"}`}>
                        {r.inactive ? "—" : `${r.pct.toFixed(2)}%`}
                      </span>
                    </div>
                    {r.inactive && (
                      <div className="mt-1 text-[10px] text-slate-400 italic">No activity this period</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 5 — Throughput & Load
========================================================= */
export function ThroughputLoad({ singleLineOnly: _singleLineOnly = false }: { singleLineOnly?: boolean }) {
  const { windowHours, tenantId } = useScope();
  const { tick, window, effectiveTenant } = useUsage();
  const isDaily = windowHours === 168 || windowHours === 720;
  const isTenantScoped = !!effectiveTenant;

  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const { points, avgRps, peakRps, peakLabel, baseline } = useMemo(
    () => getRpsData(rows, windowHours, []),
    [rows, windowHours]
  );

  const _peakIdx = points.findIndex((p) => (isDaily ? p.peakRps : p.platformRps) === (isDaily ? peakRps : Math.max(...points.map((q) => q.platformRps))));

  const subtitle = isTenantScoped
    ? `Requests per second for ${effectiveTenant!.name}`
    : "Requests per second across the selected time window";

  return (
    <section>
      <Eyebrow subtitle={subtitle}>Throughput &amp; load</Eyebrow>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Avg RPS</div>
          <div className="mt-1 text-[26px] leading-none font-bold text-slate-900 tabular-nums">
            {avgRps}<span className="text-sm font-normal text-slate-500 ml-1">req/s</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-[0.14em] font-medium text-slate-600">Peak RPS</div>
          <div className="mt-1 text-[26px] leading-none font-bold text-slate-900 tabular-nums">
            {Math.max(peakRps, avgRps).toFixed(3)}<span className="text-sm font-normal text-slate-500 ml-1">req/s</span>
          </div>
          <div className="mt-1.5 text-[12px] text-slate-500 tabular-nums">
            · {window === "1h" ? `${peakLabel} ago` : peakLabel}
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 5, right: 40, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v).toFixed(3)} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number, n: string) => [`${Number(v).toFixed(3)} req/s`, n]} separator="  " />
            <ReferenceLine y={baseline} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "30d avg", position: "right", fill: "#94A3B8", fontSize: 10 }} />
            <ReferenceLine y={avgRps} stroke="#0EA5E9" strokeDasharray="3 3" label={{ value: `Avg ${Number(avgRps).toFixed(3)}`, position: "right", fill: "#0EA5E9", fontSize: 10 }} />
            <ReferenceLine y={Math.max(peakRps, avgRps)} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `Peak ${Math.max(peakRps, avgRps).toFixed(3)}`, position: "right", fill: "#EF4444", fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey={isDaily ? "peakRps" : "platformRps"}
              stroke="#1F2937"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name={isTenantScoped ? effectiveTenant!.name : "Platform total"}
            />
          </LineChart>
        </ResponsiveContainer>

      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 4 RIGHT (scoped) — Service mix for one tenant
========================================================= */
export function ServiceMix() {
  const { windowHours, tenantId } = useScope();
  const { tick, effectiveTenant } = useUsage();
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const totalRequests = useMemo(() => rows.reduce((a, r) => a + r.requests, 0), [rows]);
  const segments = useMemo(() => {
    const total = totalRequests || 1;
    return SERVICES.map((s) => {
      const requests = rows.filter((r) => r.service === s.key).reduce((a, r) => a + r.requests, 0);
      return { key: s.key, name: s.name, color: s.color, requests, pct: (requests / total) * 100 };
    }).filter((x) => x.requests > 0).sort((a, b) => b.requests - a.requests);
  }, [rows, totalRequests]);

  return (
    <section>
      <Eyebrow subtitle={effectiveTenant ? `Request distribution for ${effectiveTenant.name} · reflects selected time window` : "Platform-wide request distribution · reflects selected time window"}>Service consumption</Eyebrow>
      <Card className="p-5">
        <div className="flex items-center gap-5 w-full">
          <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width={200} height={200}>

              <PieChart>
                <Pie
                  data={segments}
                  dataKey="requests"
                  innerRadius={62}
                  outerRadius={96}
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {segments.map((s) => <Cell key={s.key} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                  formatter={(v: number, _n, p: any) => [`${formatKMB(v)} req · ${p.payload.pct.toFixed(2)}%`, p.payload.name]}
                  separator="  "
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>All</div>
              <div className="mt-1" style={{ fontSize: 12, fontWeight: 400, color: "#475569", lineHeight: 1 }}>Services</div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {segments.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-2"
                style={{ height: 28 }}
                title={`${s.name} — ${s.pct.toFixed(2)}%`}
              >
                <span className="rounded-full shrink-0" style={{ background: s.color, width: 8, height: 8 }} />
                <span
                  className="shrink-0 truncate"
                  style={{ fontSize: 12, color: "#0F172A", minWidth: 180 }}
                >
                  {s.name}
                </span>
                <span
                  className="flex-1"
                  style={{
                    borderBottom: "1px dotted #CBD5E1",
                    margin: "0 6px",
                    minWidth: 16,
                    transform: "translateY(-3px)",
                  }}
                />
                <span className="tabular-nums shrink-0 text-right" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", minWidth: 52 }}>
                  {s.pct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 6 — Heatmap (all tenants) / Service breakdown (scoped)
========================================================= */
const HEAT_RAMP = ["#FFFFFF", "#FFEDD5", "#FED7AA", "#FDBA74", "#FB923C", "#F97316", "#EA580C"];
function heatColor(v: number, max: number) {
  if (max <= 0 || v <= 0) return HEAT_RAMP[0];
  const r = v / max;
  const idx = Math.min(HEAT_RAMP.length - 1, Math.max(1, Math.ceil(r * (HEAT_RAMP.length - 1))));
  return HEAT_RAMP[idx];
}

export function CompareTenants({ view = "auto" }: { view?: "auto" | "heatmap" | "serviceBar" } = {}) {
  const { windowHours, tenantId } = useScope();
  const { effectiveTenant, tick, tenantRankTopN } = useUsage();
  const isTenantScoped = !!effectiveTenant;
  const [selected, setSelected] = useState<string[]>(SERVICES.map((s) => s.key));

  // Resolve view mode: auto = old behavior (heatmap when not scoped, bar when scoped)
  const resolved = view === "auto" ? (isTenantScoped ? "serviceBar" : "heatmap") : view;

  const heat = useMemo(
    () => (resolved === "heatmap" ? getHeatmap(windowHours, selected) : null),
    [resolved, windowHours, selected]
  );

  const scopedRows = useMemo(
    () => (resolved === "serviceBar" ? getFilteredData({ windowHours, tenantId }) : []),
    [resolved, windowHours, tenantId, tick]
  );
  const scopedData = useMemo(() => {
    if (resolved !== "serviceBar") return [];
    return SERVICES.map((s) => {
      const r = scopedRows.filter((x) => x.service === s.key);
      return {
        key: s.key, name: s.name, color: s.color,
        requests: r.reduce((a, x) => a + x.requests, 0),
        nativeUnits: r.reduce((a, x) => a + x.nativeUnits, 0),
        unitShort: s.unitShort,
      };
    }).filter((x) => x.requests > 0).sort((a, b) => b.requests - a.requests);
  }, [resolved, scopedRows]);

  function toggle(k: string) {
    setSelected((s) => s.includes(k) ? (s.length > 1 ? s.filter((x) => x !== k) : s) : [...s, k]);
  }

  const maxTenantTotal = heat ? Math.max(1, ...Object.values(heat.tenantTotals)) : 1;

  return (
    <section>
      {true && (
        <div>
          {/* @keep-existing-structure */}
          {resolved === "serviceBar" ? (
            <>
              <Eyebrow subtitle={`Request volume by service${isTenantScoped ? ` for ${effectiveTenant!.name}` : ""}`}>Request volume by service</Eyebrow>
              <Card className="p-5">
                <ResponsiveContainer width="100%" height={Math.max(220, scopedData.length * 38 + 40)}>
                  <BarChart data={scopedData} layout="vertical" margin={{ top: 5, right: 110, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAxisKMB(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={170} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                      formatter={(v: number, _n, p: any) => [
                        `${formatKMB(v)} req · ${formatKMB(p.payload.nativeUnits)} ${p.payload.unitShort}`,
                        "Usage",
                      ]}
                      separator="  "
                    />
                    <Bar dataKey="requests" radius={[0, 3, 3, 0]}
                      label={{
                        position: "right", fontSize: 11, fill: "#475569",
                        formatter: (_v: any, _n: any, p: any) => {
                          const d = p?.payload;
                          if (!d) return "";
                          return `${formatKMB(d.requests)} req · ${formatKMB(d.nativeUnits)} ${d.unitShort}`;
                        },
                      }}
                    >
                      {scopedData.map((s) => <Cell key={s.key} fill={s.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          ) : (
            <>
              <Eyebrow
                subtitle="Heatmap of request volume per tenant per service"
                right={
                  <div className="flex items-center gap-2">
                    {isTenantScoped && effectiveTenant ? (
                      <div className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: "#475569" }}>
                        <span className="rounded-full" style={{ background: effectiveTenant.avatarColor, width: 8, height: 8, display: "inline-block" }} />
                        <span>Showing: {effectiveTenant.name}</span>
                      </div>
                    ) : null}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">
                          Select services ({selected.length}) <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-2" align="end">
                        <div className="flex justify-between gap-2 px-1 pb-2 mb-1 border-b border-slate-100 text-xs">
                          <button className="text-orange-600 hover:underline" onClick={() => setSelected(SERVICES.map((s) => s.key))}>Select all</button>
                          <button className="text-slate-500 hover:underline" onClick={() => setSelected([SERVICES[0].key])}>Clear all</button>
                        </div>
                        <div className="space-y-0.5 max-h-[320px] overflow-y-auto">
                          {SERVICES.map((s) => (
                            <label key={s.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                              <Checkbox checked={selected.includes(s.key)} onCheckedChange={() => toggle(s.key)} />
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                              <span className="text-sm">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                }
              >Usage by tenant &amp; service</Eyebrow>
              <Card className="p-5 overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className="text-left font-semibold text-slate-500 uppercase tracking-wider pb-2 pr-3 align-bottom" style={{ minWidth: 160 }}>Tenant</th>
                      {selected.map((k) => {
                        const s = SERVICES.find((x) => x.key === k)!;
                        return (
                          <th key={k} className="px-1 pb-2 align-bottom" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
                            <div className="flex flex-col items-center gap-1">
                              <span className="h-1.5 w-6 rounded-sm" style={{ background: s.color }} />
                              <span className="text-slate-600 font-medium whitespace-nowrap" title={s.name}>{abbrService(s.name)}</span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="text-right font-semibold text-slate-500 uppercase tracking-wider pb-2 pl-3 align-bottom" style={{ minWidth: 140 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...TENANTS]
                      .filter((t) => (heat!.tenantTotals[t.id] || 0) > 0)
                      .filter((t) => (isTenantScoped ? t.id === tenantId : true))
                      .sort((a, b) => (heat!.tenantTotals[b.id] || 0) - (heat!.tenantTotals[a.id] || 0))
                      .slice(0, isTenantScoped ? 1 : tenantRankTopN)
                      .map((t) => {
                      const total = heat!.tenantTotals[t.id] || 0;
                      return (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="py-1 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.avatarColor }} />
                              <span className="text-slate-800 text-xs truncate">{t.name}</span>
                            </div>
                          </td>
                          {selected.map((k) => {
                            const v = heat!.matrix[t.id][k];
                            const bg = heatColor(v, heat!.max);
                            const dark = v / heat!.max > 0.55;
                            const pct = total ? (v / total) * 100 : 0;
                            const svc = SERVICES.find((x) => x.key === k)!;
                            return (
                              <td key={k} className="p-0.5" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
                                <div
                                  className="flex items-center justify-center rounded-sm text-[10px] tabular-nums"
                                  style={{ background: bg, height: 44, color: dark ? "#fff" : "#334155" }}
                                  title={`${t.name} · ${svc.name} · ${formatKMB(v)} req · ${pct.toFixed(2)}% of tenant`}
                                >
                                  {v > 0 ? formatKMB(v) : ""}
                                </div>
                              </td>
                            );
                          })}
                          <td className="pl-3 py-1">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${(total / maxTenantTotal) * 100}%` }} />
                              </div>
                              <span className="tabular-nums text-slate-700 text-xs w-16 text-right">{formatKMB(total)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 text-[12px] text-slate-500">
                  Showing Top {isTenantScoped ? 1 : tenantRankTopN} tenants by total request volume, matching the Tenant Ranking filter.
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-slate-500">
                  <span className="italic">Colour intensity = request volume.</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>Low</span>
                    {HEAT_RAMP.map((c, i) => (
                      <span key={i} className="inline-block h-2.5 w-4 border border-slate-200" style={{ background: c }} />
                    ))}
                    <span>High</span>
                  </span>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   Loading overlay
========================================================= */
export function LoadingOverlay({ children }: { children: React.ReactNode }) {
  const { loading } = useUsage();
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="h-[400px] lg:col-span-3" />
          <Skeleton className="h-[400px] lg:col-span-2" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/* =========================================================
   Service KPIs — Active / Most Used / Highest Failure Rate
========================================================= */
export function ServiceKPIs() {
  const { windowHours, tenantId } = useScope();
  const { tick } = useUsage();
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);

  const perService = useMemo(() => {
    return SERVICES.map((s) => {
      const r = rows.filter((x) => x.service === s.key);
      const requests = r.reduce((a, x) => a + x.requests, 0);
      const failed = r.reduce((a, x) => a + x.failed, 0);
      const failRate = requests ? (failed / requests) * 100 : 0;
      return { key: s.key, name: s.name, color: s.color, requests, failed, failRate };
    });
  }, [rows]);

  const active = perService.filter((s) => s.requests > 0);
  const mostUsed = [...active].sort((a, b) => b.requests - a.requests)[0];
  const highestFail = [...active].sort((a, b) => b.failRate - a.failRate)[0];

  const failClr = highestFail && highestFail.failRate > 1 ? "#D97706" : "#0F172A";

  return (
    <section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">


        <div className="rounded-xl bg-white p-5 flex flex-col" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="text-[11px] uppercase font-medium tracking-[0.08em]" style={{ color: "#475569" }}>Most used service</div>
          <div className="mt-2 flex items-center gap-2 leading-none">
            {mostUsed && <span className="rounded-full shrink-0" style={{ background: mostUsed.color, width: 10, height: 10 }} />}
            <span className="tabular-nums truncate" style={{ fontSize: 24, fontWeight: 700, color: "#0F172A" }}>
              {mostUsed ? abbrService(mostUsed.name) : "—"}
            </span>
          </div>
          <div className="mt-2 tabular-nums" style={{ fontSize: 12, color: "#94A3B8" }}>
            {mostUsed ? `${formatKMB(mostUsed.requests)} requests` : "No activity"}
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 flex flex-col" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="text-[11px] uppercase font-medium tracking-[0.08em]" style={{ color: "#475569" }}>Highest failure rate</div>
          <div className="mt-2 flex items-center gap-2 leading-none">
            {highestFail && <span className="rounded-full shrink-0" style={{ background: highestFail.color, width: 10, height: 10 }} />}
            <span className="tabular-nums truncate" style={{ fontSize: 24, fontWeight: 700, color: failClr }}>
              {highestFail ? abbrService(highestFail.name) : "—"}
            </span>
          </div>
          <div className="mt-2 tabular-nums" style={{ fontSize: 12, color: "#94A3B8" }}>
            {highestFail ? `${highestFail.failRate.toFixed(2)}% failure rate` : "No activity"}
          </div>
        </div>
      </div>
    </section>
  );
}
