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
  getServiceSparkline, getTopTenantsByRps, getHeatmap,
  windowToHours, formatIndian, formatCompact,
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

function Sparkline({ serviceKey, color, windowHours }: { serviceKey: string; color: string; windowHours: WindowHours }) {
  const data = useMemo(() => getServiceSparkline(serviceKey, windowHours), [serviceKey, windowHours]);
  return (
    <div style={{ width: 60, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 1, right: 0, left: 0, bottom: 0 }}>
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", padding: "4px 8px" }}
            formatter={(v: number) => [formatIndian(v), "Requests"]}
            labelFormatter={(_l, p: any) => p?.[0]?.payload?.label ?? ""}
            separator="  "
          />
          <Bar dataKey="v" fill={color} radius={[1, 1, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
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
    { label: "Total requests", value: formatIndian(totals.totalRequests), delta: reqDelta },
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
  const concentration = useMemo(() => getUsageConcentration(), []);
  const items = [
    { label: "Active tenants", value: getActiveTenants24h(), sub: "last 24 hours" },
    { label: "Active tenants", value: getActiveTenants7d(),  sub: "last 7 days" },
    { label: "Active tenants", value: getActiveTenants30d(), sub: "last 30 days" },
    { label: "New this week",  value: getNewTenants7d(),     sub: "onboarded" },
  ];

  // donut: top 5 tenants + Others
  const top5 = concentration.slice(0, 5);
  const rest = concentration.slice(5);
  const othersPct = rest.reduce((a, r) => a + r.pct, 0);
  const othersReq = rest.reduce((a, r) => a + r.requests, 0);
  const donut = [
    ...top5.map((c) => ({ name: c.name, value: c.requests, pct: c.pct, color: c.color })),
    ...(rest.length ? [{ name: "Others", value: othersReq, pct: othersPct, color: "#CBD5E1" }] : []),
  ];
  const top3Pct = concentration.slice(0, 3).reduce((a, r) => a + r.pct, 0);

  return (
    <section>
      <Eyebrow>Platform adoption</Eyebrow>
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid grid-cols-2 gap-y-5 gap-x-4">
            {items.map((it, i) => (
              <div key={i}>
                <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
                <div className="mt-1.5 text-[28px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
                <div className="mt-1 text-[11px] text-slate-500">{it.sub}</div>
              </div>
            ))}
          </div>
          <div className="md:border-l md:border-slate-100 md:pl-6">
            <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-500 mb-2">
              Usage concentration <span className="text-slate-400 normal-case font-normal">· last 30 days</span>
            </div>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      innerRadius={56}
                      outerRadius={86}
                      paddingAngle={1}
                      stroke="#fff"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                      formatter={(v: number, _n, p: any) => [`${formatIndian(v)} req · ${p.payload.pct.toFixed(1)}%`, p.payload.name]}
                      separator="  "
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[20px] font-bold text-slate-900 tabular-nums leading-none">{top3Pct.toFixed(0)}%</div>
                  <div className="text-[10px] text-slate-500 mt-1">top 3 tenants</div>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {donut.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-[11px]">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                    <span className="flex-1 text-slate-700 truncate">{d.name}</span>
                    <span className="tabular-nums text-slate-500">{d.pct.toFixed(1)}%</span>
                  </div>
                ))}
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
          <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{formatIndian(totals.totalRequests)}</div>
          <div className="mt-2"><Delta pct={reqDelta} /></div>
        </Card>
        <Card className="p-4 bg-emerald-50/40 border-emerald-100">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-emerald-700">Successful</div>
          <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{formatIndian(totals.totalSuccessful)}</div>
          <div className="mt-1.5 text-[11px] text-emerald-700 tabular-nums">{successRate.toFixed(2)}% success rate</div>
        </Card>
        <Card className="p-4 bg-rose-50/40 border-rose-100">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-rose-700">Failed</div>
          <div className="mt-1.5 text-[24px] leading-none font-bold text-slate-900 tabular-nums">{formatIndian(totals.totalFailed)}</div>
          <div className="mt-1.5 text-[11px] text-rose-700 tabular-nums">{failureRate.toFixed(2)}% failure rate</div>
        </Card>
      </div>
      <Card className="p-5">
        <div className="relative">
          <div className="absolute top-2 left-3 z-10 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Requests</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartWithFailRate} margin={{ top: 22, right: 12, left: -5, bottom: 0 }} syncId="vh">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} height={0} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }}
                formatter={(v: number) => [formatIndian(v), "Requests"]}
                labelFormatter={(l) => `Time  ${l}`}
                separator="  "
              />
              <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fill="#DBEAFE" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="relative -mt-1">
          <div className="absolute top-1 left-3 z-10 text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Failure rate %</div>
          <ResponsiveContainer width="100%" height={92}>
            <LineChart data={chartWithFailRate} margin={{ top: 16, right: 12, left: -5, bottom: 0 }} syncId="vh">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis
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
  const services = useMemo(() => getServiceBreakdown(rows, windowHours), [rows, windowHours]);
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
                <th className="py-3 px-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Trend (5 periods)</th>
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
                    <td className="py-3 px-3 text-right tabular-nums text-slate-900 font-medium">{formatIndian(r.requests)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                      {formatCompact(r.nativeUnits)} <span className="text-[11px] text-slate-500">{r.service.unitShort}</span>
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums font-medium ${srClr}`}>{sr.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600">{formatIndian(r.failed)}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-block">
                        <Sparkline serviceKey={r.service.key} color={r.service.color} windowHours={windowHours} />
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

  function handleClick(id: string) {
    setSelectedTenantId(id);
    setTimeout(() => globalThis.scrollTo({ top: 0, behavior: "smooth" }), 60);
  }

  let visibleRank = 0;
  return (
    <section>
      <Eyebrow subtitle="Ranked by request volume">Tenant ranking</Eyebrow>
      <Card className="p-2">
        <div className="space-y-0.5">
          {ranked.map((r) => {
            if (!r.inactive) visibleRank++;
            const idx = visibleRank - 1;
            const rankColor = !r.inactive && idx < 3 ? RANK_COLOR[idx] : undefined;
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
                    <span className={`text-[11px] tabular-nums font-semibold ${r.inactive ? "text-slate-300" : idx < 3 ? "text-slate-900" : "text-slate-400"}`}>
                      {r.inactive ? "—" : `#${idx + 1}`}
                    </span>
                  </div>
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
                        {r.inactive ? "—" : formatIndian(r.requests)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        {!r.inactive && <div className="h-full rounded-full bg-orange-500" style={{ width: `${(r.requests / max) * 100}%` }} />}
                      </div>
                      <span className={`text-[10px] tabular-nums w-10 text-right ${r.inactive ? "text-slate-300" : "text-slate-500"}`}>
                        {r.inactive ? "—" : `${r.pct.toFixed(1)}%`}
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
export function ThroughputLoad({ singleLineOnly = false }: { singleLineOnly?: boolean }) {
  const { windowHours, tenantId } = useScope();
  const { tick, window, effectiveTenant } = useUsage();
  const isDaily = windowHours === 168 || windowHours === 720;
  const [breakdown, setBreakdown] = useState(false);
  const isTenantScoped = !!effectiveTenant;
  const showBreakdownBtn = !singleLineOnly && !isTenantScoped;

  const breakdownIds = showBreakdownBtn && breakdown ? ["t1", "t2", "t3"] : [];
  const rows = useMemo(() => getFilteredData({ windowHours, tenantId }), [windowHours, tenantId, tick]);
  const { points, avgRps, peakRps, peakLabel, baseline } = useMemo(
    () => getRpsData(rows, windowHours, breakdownIds),
    [rows, windowHours, breakdownIds.join(",")]
  );

  const peakIdx = points.findIndex((p) => (isDaily ? p.peakRps : p.platformRps) === (isDaily ? peakRps : Math.max(...points.map((q) => q.platformRps))));

  const tenantSwatches = [
    { id: "t1", name: "Bhashini", color: "#F97316" },
    { id: "t2", name: "Ministry of Education", color: "#3B82F6" },
    { id: "t3", name: "IIIT Hyderabad", color: "#10B981" },
  ];

  const subtitle = isTenantScoped
    ? `Requests per second for ${effectiveTenant!.name}`
    : "Requests per second across the selected time window";

  return (
    <section>
      <Eyebrow
        subtitle={subtitle}
        right={showBreakdownBtn && (
          <button
            onClick={() => setBreakdown((b) => !b)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded border transition ${
              breakdown ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {breakdown ? "Hide tenant breakdown" : "Break down by tenant"}
          </button>
        )}
      >Throughput &amp; load</Eyebrow>
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
        {showBreakdownBtn && breakdown && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#1F2937]" /> Platform total</span>
            {tenantSwatches.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: t.color }} /> {t.name}</span>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height={220}>
          {isDaily ? (
            <BarChart data={points} margin={{ top: 10, right: 40, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number) => [`${v} req/s`, "Peak RPS"]} separator="  " />
              <ReferenceLine y={baseline} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "30d avg", position: "right", fill: "#94A3B8", fontSize: 10 }} />
              <Bar dataKey="peakRps" radius={[3, 3, 0, 0]}>
                {points.map((_, i) => <Cell key={i} fill={i === peakIdx ? "#F97316" : "#CBD5E1"} />)}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={points} margin={{ top: 5, right: 40, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number, n: string) => [`${v} req/s`, n]} separator="  " />
              <ReferenceLine y={baseline} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: "30d avg", position: "right", fill: "#94A3B8", fontSize: 10 }} />
              <Line type="monotone" dataKey="platformRps" stroke="#1F2937" strokeWidth={2} dot={false} isAnimationActive={false} name="Platform total" />
              {showBreakdownBtn && breakdown && tenantSwatches.map((t) => (
                <Line key={t.id} type="monotone" dataKey={t.id} stroke={t.color} strokeWidth={1.6} dot={false} isAnimationActive={false} name={t.name} />
              ))}
            </LineChart>
          )}
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
  const segments = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.requests, 0) || 1;
    return SERVICES.map((s) => {
      const requests = rows.filter((r) => r.service === s.key).reduce((a, r) => a + r.requests, 0);
      return { key: s.key, name: s.name, color: s.color, requests, pct: (requests / total) * 100 };
    }).filter((x) => x.requests > 0).sort((a, b) => b.requests - a.requests);
  }, [rows]);

  return (
    <section>
      <Eyebrow subtitle={`Service mix · ${effectiveTenant?.name ?? ""}`}>Service share</Eyebrow>
      <Card className="p-5">
        <div className="flex h-7 rounded-md overflow-hidden bg-slate-100 border border-slate-200">
          {segments.map((s) => (
            <div
              key={s.key}
              style={{ width: `${s.pct}%`, background: s.color }}
              title={`${s.name} · ${formatIndian(s.requests)} req · ${s.pct.toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="flex-1 text-slate-700 truncate">{s.name}</span>
              <span className="tabular-nums text-slate-900 font-medium">{formatIndian(s.requests)}</span>
              <span className="tabular-nums text-slate-500 w-12 text-right">{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 6 — Compare tenants / Service usage breakdown
========================================================= */
export function CompareTenants() {
  const { windowHours, tenantId } = useScope();
  const { effectiveTenant, tick } = useUsage();
  const isTenantScoped = !!effectiveTenant;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(SERVICES.map((s) => s.key));

  const data = useMemo(() => getCompareData(windowHours, selected), [windowHours, selected]);

  const scopedRows = useMemo(
    () => (isTenantScoped ? getFilteredData({ windowHours, tenantId }) : []),
    [isTenantScoped, windowHours, tenantId, tick]
  );
  const scopedData = useMemo(() => {
    if (!isTenantScoped) return [];
    return SERVICES.map((s) => ({
      key: s.key,
      name: s.name,
      color: s.color,
      requests: scopedRows.filter((r) => r.service === s.key).reduce((a, r) => a + r.requests, 0),
    })).filter((x) => x.requests > 0).sort((a, b) => b.requests - a.requests);
  }, [isTenantScoped, scopedRows]);

  function toggle(k: string) {
    setSelected((s) => s.includes(k) ? (s.length > 1 ? s.filter((x) => x !== k) : s) : [...s, k]);
  }

  const triggerLabel = isTenantScoped ? "Service usage breakdown" : "Usage by tenant & service";

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
                  <BarChart data={scopedData} layout="vertical" margin={{ top: 5, right: 24, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={170} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number) => [formatIndian(v), "Requests"]} separator="  " />
                    <Bar dataKey="requests" radius={[0, 3, 3, 0]}>
                      {scopedData.map((s) => <Cell key={s.key} fill={s.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          ) : (
            <>
              <Eyebrow
                subtitle="Compare consumption across tenants and services"
                right={
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
                }
              >Usage by tenant &amp; service</Eyebrow>
              <Card className="p-5">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs">
                  {selected.map((k) => {
                    const s = SERVICES.find((x) => x.key === k)!;
                    return (
                      <span key={k} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                        {s.name}
                      </span>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={44 * 10 + 60}>
                  <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={170} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff" }} formatter={(v: number) => formatIndian(v)} separator="  " />
                    {selected.map((k, i) => {
                      const s = SERVICES.find((x) => x.key === k)!;
                      const isLast = i === selected.length - 1;
                      return <Bar key={k} dataKey={k} stackId="svc" fill={s.color} radius={isLast ? [0, 3, 3, 0] : 0} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 text-[11px] text-slate-500 italic">
                  Showing request count. Native units vary by service.
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
