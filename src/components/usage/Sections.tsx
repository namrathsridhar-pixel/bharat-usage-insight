import { useUsage } from "@/lib/usage/context";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { TENANTS, SERVICES } from "@/data/eventLog";
import {
  getFilteredData, getTotals, getActiveTenants, getActiveServices,
  getActiveTenants24h, getActiveTenants7d, getActiveTenants30d, getNewTenants7d,
  getTenantRanking, getServiceBreakdown, getChartData, getRpsData,
  getUsageConcentration, getPrevTotals,
  getTopTenantsByRps, getHeatmap,
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
function Delta({ pct, invert = false }: { pct: number; invert?: boolean }) {
  if (!isFinite(pct) || pct === 0) {
    return <span className="text-[11px] text-slate-400 tabular-nums">— 0% vs previous</span>;
  }
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums ${good ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}% vs previous
    </span>
  );
}


function useScope() {
  const { window, effectiveTenant } = useUsage();
  const windowHours = windowToHours(window === "custom" ? "24h" : window) as WindowHours;
  const tenantId = effectiveTenant?.id;
  return { windowHours, tenantId };
}

/* =========================================================
   ZONE 1 — Platform Pulse
========================================================= */
export function PlatformPulse() {
  const { windowHours, tenantId } = useScope();
  const { tick, effectiveTenant } = useUsage();

  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const totals = useMemo(() => getTotals(rows), [rows]);
  const prev = useMemo(() => getPrevTotals(windowHours, tenantId), [windowHours, tenantId]);
  const avgRps = +(totals.totalRequests / (windowHours * 3600)).toFixed(2);
  const prevAvgRps = +(prev.totalRequests / (windowHours * 3600)).toFixed(2);

  const reqDelta = prev.totalRequests ? ((totals.totalRequests - prev.totalRequests) / prev.totalRequests) * 100 : 0;
  const srDelta = (totals.successRate - prev.successRate) * 100;
  const rpsDelta = prevAvgRps ? ((avgRps - prevAvgRps) / prevAvgRps) * 100 : 0;

  const isTenantView = !!effectiveTenant;
  const activeCount = isTenantView ? getActiveServices(rows) : getActiveTenants(rows);
  const prevRows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId]);
  const prevActive = isTenantView ? getActiveServices(prevRows) : getActiveTenants(prevRows);

  const items = [
    { label: "Total requests", value: formatKMB(totals.totalRequests), delta: reqDelta },
    { label: "Success rate", value: `${(totals.successRate * 100).toFixed(2)}%`, delta: srDelta },
    { label: "Avg RPS", value: `${avgRps}`, suffix: "req/s", delta: rpsDelta },
    isTenantView
      ? { label: "Active services", value: `${activeCount}`, suffix: `of ${SERVICES.length}`, delta: 0 }
      : { label: "Active tenants", value: `${activeCount}`, suffix: `of ${TENANTS.length}`, delta: activeCount - prevActive, tip: "Tenants with ≥1 inference in the selected period" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-y border-slate-200 py-5">
      {items.map((it, i) => (
        <div key={i} className="px-2 md:px-6 first:pl-0 last:pr-0 py-4 md:py-0" title={"tip" in it ? it.tip : undefined}>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
          <div key={tick} className="pulse-fade mt-2 flex items-baseline gap-1.5">
            <div className="text-[28px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
            {"suffix" in it && it.suffix && <div className="text-xs text-slate-500">{it.suffix}</div>}
          </div>
          <div className="mt-2"><Delta pct={it.delta} /></div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   ZONE 2 — Platform Adoption
========================================================= */
export function PlatformAdoption() {
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

  type Item = { label: string; value: React.ReactNode; sub: string; delta?: number };
  const items: Item[] = [
    { label: "Total tenants",         value: TENANTS.length,             sub: "registered on platform" },
    { label: "Active tenants",        value: getActiveTenants24h(),      sub: "last 24 hours" },
    { label: "Active tenants",        value: getActiveTenants7d(),       sub: "last 7 days" },
    { label: "Active tenants",        value: getActiveTenants30d(),      sub: "last 30 days" },
    { label: "New — Last 7 days",     value: getNewTenants7d(),          sub: "onboarded" },
    { label: "Avg requests per tenant", value: formatKMB(avgPerTenant),  sub: "across active tenants", delta: avgDelta },
  ];

  // Fixed Top 5 for usage concentration donut
  const concTopN = 5;

  const active = concentration.filter((c) => c.requests > 0);
  const donutTopCount = Math.min(concTopN, active.length);
  const topSlice = active.slice(0, donutTopCount);
  const rest = active.slice(donutTopCount);
  const othersPct = rest.reduce((a, r) => a + r.pct, 0);
  const othersReq = rest.reduce((a, r) => a + r.requests, 0);
  const donut = [
    ...topSlice.map((c) => ({ name: c.name, value: c.requests, pct: c.pct, color: c.color })),
    ...(rest.length ? [{ name: `Others (${rest.length} tenants)`, value: othersReq, pct: othersPct, color: "#CBD5E1" }] : []),
  ];
  const donutTopPct = topSlice.reduce((a, r) => a + r.pct, 0);

  const snapshotItems = items.slice(0, 5);
  const avgItem = items[5];

  return (
    <section>
      <Eyebrow>Platform adoption</Eyebrow>
      <Card className="p-5">
        {/* Sub-group 1: Platform Snapshot */}
        <div>
          <div className="mb-3 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">
            Platform snapshot
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 auto-rows-fr">
            {snapshotItems.map((it, i) => (
              <div key={i} className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 h-full">
                <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
                <div className="mt-1 text-[22px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
                <div className="mt-1 text-[11px] text-slate-500">{it.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-5 h-px w-full bg-slate-200" />

        {/* Sub-group 2: Consumption Overview */}
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">
              Consumption overview
            </div>
            <div className="text-[10px] italic text-slate-400">reflects selected time window · {windowLabel}</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Left: Avg Requests per Tenant */}
            <div className="lg:col-span-4">
              <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 h-full">
                <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{avgItem.label}</div>
                <div className="mt-1 text-[22px] leading-none font-bold text-slate-900 tabular-nums">{avgItem.value}</div>
                <div className="mt-1 text-[11px] text-slate-500">{avgItem.sub}</div>
                {avgItem.delta !== undefined && <div className="mt-1"><Delta pct={avgItem.delta} /></div>}
              </div>
            </div>

            {/* Right: Usage concentration donut */}
            <div className="lg:col-span-6 lg:border-l lg:border-slate-100 lg:pl-6 flex flex-col justify-center">
              <div className="mb-3 text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500">
                Usage concentration
              </div>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        innerRadius={50}
                        outerRadius={76}
                        paddingAngle={1}
                        stroke="#fff"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                        formatter={(v: number, _n, p: any) => [`${formatKMB(v)} req · ${p.payload.pct.toFixed(2)}%`, p.payload.name]}
                        separator="  "
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[20px] font-bold text-slate-900 tabular-nums leading-none">{donutTopPct.toFixed(0)}%</div>
                    <div className="text-[10px] text-slate-500 mt-1">top {donutTopCount} tenants</div>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {donut.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="shrink-0 text-slate-700 truncate max-w-[60%]">{d.name}</span>
                      <span className="flex-1 border-b border-dotted border-slate-300 mx-1" aria-hidden />
                      <span className="tabular-nums text-slate-600 shrink-0 text-right w-12">{d.pct.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
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
  const prev = useMemo(() => getPrevTotals(windowHours, tenantId), [windowHours, tenantId]);
  const chart = useMemo(() => getChartData(rows, windowHours), [rows, windowHours]);

  const successRate = totals.successRate * 100;
  const failureRate = totals.totalRequests ? (totals.totalFailed / totals.totalRequests) * 100 : 0;
  const reqDelta = prev.totalRequests ? ((totals.totalRequests - prev.totalRequests) / prev.totalRequests) * 100 : 0;

  const chartWithFailRate = useMemo(
    () => chart.map((p) => ({ ...p, failRate: p.total ? +((p.failed / p.total) * 100).toFixed(2) : 0 })),
    [chart]
  );

  return (
    <section>
      <Eyebrow subtitle="Total requests and failure rate over the selected period">Request volume &amp; health</Eyebrow>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Total requests</div>
          <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{formatKMB(totals.totalRequests)}</div>
          <div className="mt-2"><Delta pct={reqDelta} /></div>
        </Card>
        <Card className="p-4 bg-emerald-50/40 border-emerald-100">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-700">Successful</div>
          <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{formatKMB(totals.totalSuccessful)}</div>
          <div className="mt-1.5 text-[11px] text-emerald-700 tabular-nums">{successRate.toFixed(2)}% success rate</div>
        </Card>
        <Card className="p-4 bg-rose-50/40 border-rose-100">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-rose-700">Failed</div>
          <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{formatKMB(totals.totalFailed)}</div>
          <div className="mt-1.5 text-[11px] text-rose-700 tabular-nums">{failureRate.toFixed(2)}% failure rate</div>
        </Card>
      </div>
      <Card className="p-5">
        <div className="flex items-stretch">
          <div className="w-5 shrink-0 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#3B82F6" }}>
              Requests
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartWithFailRate} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} syncId="vh">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} height={0} />
                <YAxis width={48} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatKMB(v)} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                  formatter={(v: number) => [formatKMB(v), "Requests"]}
                  labelFormatter={(l) => `Time  ${l}`}
                  separator="  "
                />
                <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fill="#DBEAFE" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex items-stretch -mt-1">
          <div className="w-5 shrink-0 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#EF4444" }}>
              Failure rate %
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height={92}>
              <LineChart data={chartWithFailRate} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} syncId="vh">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis
                  width={48}
                  domain={[0, 10]}
                  ticks={[0, 5, 10]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Failure rate"]}
                  labelFormatter={(l) => `Time  ${l}`}
                  separator="  "
                />
                <ReferenceLine y={0} stroke="#E2E8F0" strokeWidth={1} />
                <Line type="monotone" dataKey="failRate" stroke="#EF4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 4 LEFT — Service Breakdown
========================================================= */
type SortKey = "requests" | "nativeUnits" | "successRate" | "failed";
export function ServiceBreakdown() {
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
      <Eyebrow subtitle="Consumption by service type">Service breakdown</Eyebrow>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Service</th>
                <th className="py-3 px-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Metering unit</th>
                <Th k="requests">Requests</Th>
                <Th k="nativeUnits">Native units</Th>
                <Th k="successRate">Success %</Th>
                <Th k="failed">Failed</Th>
                <th className="py-3 px-3 pr-4 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">vs prev period</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                if (r.requests === 0) {
                  return (
                    <tr key={r.service.key} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pl-4 pr-3 relative">
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: r.service.color }} />
                        <span className="font-medium text-slate-400">{r.service.name}</span>
                      </td>
                      <td colSpan={6} className="py-3 px-3 text-slate-400 italic">No activity this period</td>
                    </tr>
                  );
                }
                const sr = r.successRate * 100;
                const srClr = sr >= 95 ? "text-emerald-700" : sr >= 90 ? "text-amber-600" : "text-rose-600";
                return (
                  <tr key={r.service.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="py-3 pl-4 pr-3 relative">
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: r.service.color }} />
                      <span className="font-medium text-slate-900">{r.service.name}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{r.service.unit}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-900 font-medium">{formatLakhCr(r.requests)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                      {formatLakhCr(r.nativeUnits)} <span className="text-[11px] text-slate-500">{r.service.unitShort}</span>
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums font-medium ${srClr}`}>{sr.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600">{formatLakhCr(r.failed)}</td>
                    <td className="py-3 px-3 pr-4 text-right tabular-nums">
                      {r.trendPct === 0 || !isFinite(r.trendPct) ? (
                        <span className="text-slate-400">— 0%</span>
                      ) : r.trendPct > 0 ? (
                        <span className="text-emerald-600">↑ {Math.abs(r.trendPct).toFixed(0)}%</span>
                      ) : (
                        <span className="text-rose-600">↓ {Math.abs(r.trendPct).toFixed(0)}%</span>
                      )}
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        {formatLakhCr(r.prevRequests)} → {formatLakhCr(r.requests)}
                      </div>
                    </td>
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
  const { tick, setSelectedTenantId } = useUsage();
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const ranked = useMemo(() => getTenantRanking(rows, windowHours), [rows, windowHours]);
  const max = Math.max(1, ...ranked.map((r) => r.requests));

  const TOP_OPTIONS = [5, 10, 25] as const;
  type TopN = typeof TOP_OPTIONS[number];
  const [topN, setTopN] = useState<TopN>(10);

  function handleClick(id: string) {
    setSelectedTenantId(id);
    setTimeout(() => globalThis.scrollTo({ top: 0, behavior: "smooth" }), 60);
  }

  const activeRanked = ranked.filter((r) => !r.inactive);
  const inactiveRanked = ranked.filter((r) => r.inactive);
  const limit = Math.min(topN, activeRanked.length);
  const visibleActive = activeRanked.slice(0, limit);
  const isExpanded = topN > 10;
  const visible = [...visibleActive, ...(isExpanded ? inactiveRanked : [])];

  // K/M/B for compact (≤10), Indian K/L/Cr for detail
  const fmt = isExpanded ? formatLakhCr : formatKMB;

  const rankIndex = new Map<string, number>();
  activeRanked.forEach((r, i) => rankIndex.set(r.tenant.id, i + 1));

  const subtitle = `Top ${limit} by request volume`;

  return (
    <section>
      <Eyebrow
        subtitle={subtitle}
        right={
          <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 bg-white">
            {TOP_OPTIONS.map((n) => {
              const active = topN === n;
              return (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
                    active ? "bg-orange-500 text-white" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {`Top ${n}`}
                </button>
              );
            })}
          </div>
        }
      >
        Tenant ranking
      </Eyebrow>
      <Card className="p-3">
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
                        <span className={`text-sm font-medium truncate ${r.inactive ? "text-slate-400" : "text-slate-900 group-hover:text-orange-600"}`}>{r.tenant.name}</span>
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
  const topTenants = useMemo(
    () => (isTenantScoped ? [] : getTopTenantsByRps(windowHours, 3)),
    [windowHours, isTenantScoped, tick]
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
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Peak</div>
          <div className="mt-1 text-[20px] leading-none font-semibold text-slate-900 tabular-nums">
            {peakRps}<span className="text-sm font-normal text-slate-500 ml-1">req/s · {window === "1h" ? `${peakLabel} ago` : peakLabel}</span>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 5, right: 40, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number, n: string) => [`${v} req/s`, n]} separator="  " />
            <ReferenceLine y={baseline} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "30d avg", position: "right", fill: "#94A3B8", fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey={isDaily ? "peakRps" : "platformRps"}
              stroke="#1F2937"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name={isDaily ? "Peak RPS" : "Platform total"}
            />
          </LineChart>
        </ResponsiveContainer>

        {!isTenantScoped && topTenants.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">Top tenants by throughput</div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center text-[10px] uppercase tracking-wider text-slate-400 pb-1.5">
                <div className="flex-1">Tenant</div>
                <div className="w-24 text-right tabular-nums">Avg RPS</div>
                <div className="w-24 text-right tabular-nums">Peak RPS</div>
              </div>
              {topTenants.map((t) => (
                <div key={t.tenant.id} className="flex items-center py-2 text-sm">
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <span className="h-7 w-1.5 rounded-sm shrink-0" style={{ background: t.tenant.avatarColor }} aria-hidden />
                    <span
                      className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                      style={{ background: t.tenant.avatarColor }}
                      aria-hidden
                    >
                      {t.tenant.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-slate-800 truncate">{t.tenant.name}</span>
                  </div>
                  <div className="w-24 text-right tabular-nums text-slate-900 font-medium">{t.avgRps}</div>
                  <div className="w-24 text-right tabular-nums text-slate-600">{t.peakRps}</div>
                </div>
              ))}
            </div>
          </div>
        )}
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
  const segments = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.requests, 0) || 1;
    return SERVICES.map((s) => {
      const requests = rows.filter((r) => r.service === s.key).reduce((a, r) => a + r.requests, 0);
      return { key: s.key, name: s.name, color: s.color, requests, pct: (requests / total) * 100 };
    }).filter((x) => x.requests > 0).sort((a, b) => b.requests - a.requests);
  }, [rows]);

  const shortName = (effectiveTenant?.name ?? "")
    .split(/\s+/).map((w) => w[0]).join("").slice(0, 4).toUpperCase();

  return (
    <section>
      <Eyebrow subtitle={`Service mix · ${effectiveTenant?.name ?? ""}`}>Service share</Eyebrow>
      <Card className="p-5">
        <div className="flex items-center gap-5">
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
              <div className="text-[16px] font-bold text-slate-900 leading-tight">{shortName}</div>
              <div className="text-[10px] text-slate-500 mt-1">services</div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-[11px]">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-slate-700 truncate">{s.name}</span>
                <span className="tabular-nums text-slate-500">{s.pct.toFixed(2)}%</span>
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

export function CompareTenants() {
  const { windowHours, tenantId } = useScope();
  const { effectiveTenant, tick } = useUsage();
  const isTenantScoped = !!effectiveTenant;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(SERVICES.map((s) => s.key));
  const HEAT_TOP_OPTIONS = [5, 10, 25] as const;
  type HeatTopN = typeof HEAT_TOP_OPTIONS[number];
  const [heatTopN, setHeatTopN] = useState<HeatTopN>(10);

  const heat = useMemo(
    () => (!isTenantScoped ? getHeatmap(windowHours, selected) : null),
    [isTenantScoped, windowHours, selected]
  );

  const scopedRows = useMemo(
    () => (isTenantScoped ? getFilteredData({ windowHours, tenantId }) : []),
    [isTenantScoped, windowHours, tenantId, tick]
  );
  const scopedData = useMemo(() => {
    if (!isTenantScoped) return [];
    return SERVICES.map((s) => {
      const r = scopedRows.filter((x) => x.service === s.key);
      return {
        key: s.key, name: s.name, color: s.color,
        requests: r.reduce((a, x) => a + x.requests, 0),
        nativeUnits: r.reduce((a, x) => a + x.nativeUnits, 0),
        unitShort: s.unitShort,
      };
    }).filter((x) => x.requests > 0).sort((a, b) => b.requests - a.requests);
  }, [isTenantScoped, scopedRows]);

  function toggle(k: string) {
    setSelected((s) => s.includes(k) ? (s.length > 1 ? s.filter((x) => x !== k) : s) : [...s, k]);
  }

  const triggerLabel = isTenantScoped ? "Service usage breakdown" : "Usage by tenant & service";
  const maxTenantTotal = heat ? Math.max(1, ...Object.values(heat.tenantTotals)) : 1;

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-800"
      >
        <span className="inline-flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {open ? "Collapse" : "Expand"} {triggerLabel.toLowerCase()}
        </span>
        <span className="text-[11px] text-slate-500 uppercase tracking-wider">{triggerLabel}</span>
      </button>
      {open && (
        <div className="mt-3">
          {isTenantScoped ? (
            <>
              <Eyebrow subtitle={`Request volume by service for ${effectiveTenant!.name}`}>Service usage breakdown</Eyebrow>
              <Card className="p-5">
                <ResponsiveContainer width="100%" height={Math.max(220, scopedData.length * 38 + 40)}>
                  <BarChart data={scopedData} layout="vertical" margin={{ top: 5, right: 110, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatKMB(v)} />
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
                    <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 bg-white">
                      {HEAT_TOP_OPTIONS.map((n) => {
                        const active = heatTopN === n;
                        return (
                          <button
                            key={n}
                            onClick={() => setHeatTopN(n)}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
                              active ? "bg-orange-500 text-white" : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {`Top ${n}`}
                          </button>
                        );
                      })}
                    </div>
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
                          <th key={k} className="px-1 pb-2 align-bottom" style={{ minWidth: 64 }}>
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="h-1.5 w-6 rounded-sm" style={{ background: s.color }} />
                              <span className="text-slate-600 font-medium whitespace-nowrap" style={{ writingMode: "horizontal-tb" }}>{s.name}</span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="text-right font-semibold text-slate-500 uppercase tracking-wider pb-2 pl-3 align-bottom" style={{ minWidth: 140 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...TENANTS]
                      .sort((a, b) => (heat!.tenantTotals[b.id] || 0) - (heat!.tenantTotals[a.id] || 0))
                      .slice(0, heatTopN)
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
                              <td key={k} className="p-0.5">
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
                  Showing Top {heatTopN} tenants by total request volume. Adjust using the selector above.
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-slate-500">
                  <span className="italic">Colour intensity = request volume. Hover any cell for details.</span>
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
