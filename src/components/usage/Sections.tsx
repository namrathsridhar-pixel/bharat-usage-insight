import { useUsage } from "@/lib/usage/context";
import { useEffect, useMemo, useState } from "react";
import {
  TENANTS, SERVICES, getTenantUsage, getTimeSeries, getTenantRpsSeries,
  formatIndian, formatCompact, getServiceByKey, type ServiceUsage,
} from "@/lib/usage/data";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- shared ---------- */

function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">{children}</h2>
      {right}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

function Delta({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const up = pct >= 0;
  const good = invert ? !up : up;
  const color = good ? "text-emerald-600" : "text-rose-600";
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}% vs previous
    </span>
  );
}

function useScopedTenants() {
  const { role, effectiveTenant } = useUsage();
  return useMemo(() => {
    if (role === "tenant_admin" && effectiveTenant) return [effectiveTenant];
    return effectiveTenant ? [effectiveTenant] : TENANTS;
  }, [role, effectiveTenant]);
}

function useAggregate() {
  const { window } = useUsage();
  const tenants = useScopedTenants();
  return useMemo(() => {
    const snapshots = tenants.map((t) => getTenantUsage(t, window));
    const totalRequests = snapshots.reduce((a, s) => a + s.totalRequests, 0);
    const successful = snapshots.reduce((a, s) => a + s.successful, 0);
    const failed = totalRequests - successful;
    const services: ServiceUsage[] = SERVICES.map((sv) => {
      const rows = snapshots.flatMap((s) => s.services.filter((x) => x.service === sv.key));
      const total = rows.reduce((a, x) => a + x.totalRequests, 0);
      const succ = rows.reduce((a, x) => a + x.successful, 0);
      const fail = total - succ;
      const units = rows.reduce((a, x) => a + x.units, 0);
      const avgRps = +(rows.reduce((a, x) => a + x.avgRps, 0)).toFixed(2);
      const ratioSeed = (sv.key.charCodeAt(0) % 30) / 100 + 0.25; // 0.25..0.55
      const peakRps = +(avgRps / Math.min(0.40, Math.max(0.25, ratioSeed))).toFixed(2);
      const trendPct = rows.length ? +(rows.reduce((a, x) => a + x.trendPct, 0) / rows.length).toFixed(1) : 0;
      return {
        service: sv.key, totalRequests: total, successful: succ, failed: fail,
        units, unitShort: sv.unitShort,
        avgRps, peakRps,
        peakTimestamp: rows[0]?.peakTimestamp ?? "",
        failRate: fail / Math.max(1, total),
        successRate: succ / Math.max(1, total),
        trendPct,
      };
    });
    return { snapshots, totalRequests, successful, failed, services, tenants };
  }, [tenants, window]);
}

/* =========================================================
   ZONE 1 — Platform Pulse
========================================================= */
export function PlatformPulse() {
  const { totalRequests, successful, snapshots } = useAggregate();
  const { pulseDelta, tick } = useUsage();

  const baseSuccessRate = successful / Math.max(1, totalRequests);
  const baseAvgRps = +snapshots.reduce((a, s) => a + s.avgRps, 0).toFixed(2);
  const activeTenants = TENANTS.filter((t) => t.active24h).length;

  const liveRequests = totalRequests + pulseDelta.requests;
  const liveSuccessRate = Math.min(100, Math.max(0, baseSuccessRate * 100 + pulseDelta.successRate));
  const liveRps = Math.max(0, +(baseAvgRps + pulseDelta.rps).toFixed(2));

  const items = [
    { label: "Total requests", value: formatIndian(liveRequests), delta: 8.4 },
    { label: "Success rate", value: `${liveSuccessRate.toFixed(2)}%`, delta: 0.3 },
    { label: "Avg RPS", value: `${liveRps}`, suffix: "req/s", delta: 5.1 },
    { label: "Active tenants", value: `${activeTenants}`, suffix: `of ${TENANTS.length}`, delta: 12.5 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-y border-slate-200 py-5">
      {items.map((it, i) => (
        <div key={i} className="px-2 md:px-6 first:pl-0 last:pr-0 py-4 md:py-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
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
   ZONE 2 — Volume + health  (with live shift on 1h/24h)
========================================================= */
export function VolumeHealthChart() {
  const { window, tick } = useUsage();
  const tenants = useScopedTenants();
  const baseSeries = useMemo(() => getTimeSeries(window, tenants), [window, tenants]);
  const [series, setSeries] = useState(baseSeries);

  // reset on filter changes
  useEffect(() => { setSeries(baseSeries); }, [baseSeries]);

  // shift on live tick (only 1h/24h)
  const isLive = window === "1h" || window === "24h";
  useEffect(() => {
    if (!isLive || tick === 0) return;
    setSeries((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const jitter = 0.85 + Math.random() * 0.4;
      const total = Math.floor(last.total * jitter);
      const failed = Math.floor(total * (0.015 + Math.random() * 0.025));
      const newPoint = {
        label: last.label,
        total,
        successful: total - failed,
        failed,
        rps: +(total / 3600).toFixed(2),
      };
      return [...prev.slice(1), newPoint];
    });
  }, [tick, isLive]);

  return (
    <section>
      <Eyebrow>Volume &amp; health</Eyebrow>
      <Card className="p-5">
        <div className="flex items-center gap-5 mb-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded bg-[#3B82F6]" /> Total requests
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded bg-[#EF4444]" /> Failed requests
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={series} margin={{ top: 5, right: 12, left: -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="L" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 11, fill: "#EF4444" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
              formatter={(v: number, n: string) => [formatIndian(v), n === "total" ? "Total" : "Failed"]}
              labelFormatter={(l) => `Time  ${l}`}
              separator="  "
            />
            <Line yAxisId="L" type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2.4} dot={false} isAnimationActive={false} />
            <Line yAxisId="R" type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 3 LEFT — Service breakdown table
========================================================= */
type SortKey = "totalRequests" | "units" | "successRate" | "failed" | "trendPct";
export function ServiceBreakdownTable() {
  const { services } = useAggregate();
  const [sortKey, setSortKey] = useState<SortKey>("totalRequests");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const r = [...services];
    r.sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return r;
  }, [services, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function Th({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <th className="py-3 px-3 text-right">
        <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 ${active ? "text-slate-900" : "text-slate-500"}`}>
          {children}
          {active ? (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </button>
      </th>
    );
  }

  return (
    <section>
      <Eyebrow>Service breakdown</Eyebrow>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 pl-4 pr-3 text-left font-semibold">Service</th>
                <Th k="totalRequests">Requests</Th>
                <Th k="units">Native units</Th>
                <Th k="successRate">Success %</Th>
                <Th k="failed">Failed</Th>
                <Th k="trendPct">Trend</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sv = getServiceByKey(r.service);
                const sr = r.successRate * 100;
                const srColor = sr >= 95 ? "text-emerald-700" : sr >= 90 ? "text-amber-600" : "text-rose-600";
                const trendUp = r.trendPct >= 0;
                if (r.totalRequests === 0) {
                  return (
                    <tr key={r.service} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pl-4 pr-3 relative">
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: sv.color }} />
                        <span className="font-medium text-slate-900">{sv.name}</span>
                      </td>
                      <td colSpan={5} className="py-3 px-3 text-slate-400 italic">No activity this period</td>
                    </tr>
                  );
                }
                return (
                  <tr key={r.service} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="py-3 pl-4 pr-3 relative">
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: sv.color }} />
                      <div className="font-medium text-slate-900">{sv.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{sv.unit}</div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-900 font-medium">{formatIndian(r.totalRequests)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                      {formatCompact(r.units)} <span className="text-[11px] text-slate-500">{r.unitShort}</span>
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums font-medium ${srColor}`}>{sr.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600">{formatIndian(r.failed)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1 tabular-nums text-xs font-medium ${trendUp ? "text-emerald-600" : "text-rose-600"}`}>
                        {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {trendUp ? "↑" : "↓"} {Math.abs(r.trendPct).toFixed(1)}%
                      </span>
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
   ZONE 3 RIGHT — Top tenants ranked list
========================================================= */
const RANK_COLOR = ["#F59E0B", "#94A3B8", "#B45309"];

export function TopTenantsList() {
  const { window, setSelectedTenantId } = useUsage();
  const [count, setCount] = useState<5 | 10>(10);

  const all = useMemo(() => {
    const snaps = TENANTS.map((t) => ({ tenant: t, ...getTenantUsage(t, window) }));
    snaps.sort((a, b) => b.totalRequests - a.totalRequests);
    return snaps;
  }, [window]);
  const platformTotal = all.reduce((a, s) => a + s.totalRequests, 0);
  const max = all[0]?.totalRequests || 1;
  const rows = all.slice(0, count);

  function handleSelect(id: string) {
    setSelectedTenantId(id);
    window && setTimeout(() => globalThis.scrollTo({ top: 0, behavior: "smooth" }), 60);
  }

  return (
    <section>
      <Eyebrow right={
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px]">
          {[5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n as 5 | 10)}
              className={`px-2.5 py-1 rounded font-medium transition ${count === n ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >{n}</button>
          ))}
        </div>
      }>Top tenants</Eyebrow>
      <Card className="p-2">
        <div className="space-y-0.5">
          {rows.map((r, idx) => {
            const sharePct = (r.totalRequests / Math.max(1, platformTotal)) * 100;
            const barPct = (r.totalRequests / max) * 100;
            const rankColor = idx < 3 ? RANK_COLOR[idx] : undefined;
            return (
              <button
                key={r.tenantId}
                onClick={() => handleSelect(r.tenantId)}
                className="press-anim w-full text-left px-3 py-2.5 rounded-lg hover:bg-orange-50/60 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-9 shrink-0">
                    {rankColor && <span className="h-1.5 w-1.5 rounded-full" style={{ background: rankColor }} />}
                    <span className={`text-[11px] tabular-nums font-semibold ${idx < 3 ? "text-slate-900" : "text-slate-400"}`}>#{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-slate-900 truncate group-hover:text-orange-600">{r.tenant.name}</span>
                      <span className="text-xs text-slate-500 tabular-nums shrink-0">{formatIndian(r.totalRequests)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-slate-500 w-10 text-right">{sharePct.toFixed(1)}%</span>
                    </div>
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
   ZONE 4 LEFT — Throughput
========================================================= */
export function ThroughputBlock({ singleLineOnly = false }: { singleLineOnly?: boolean }) {
  const { window, role, effectiveTenant } = useUsage();
  const tenants = useScopedTenants();
  const platformContext = !singleLineOnly && role === "platform_admin" && !effectiveTenant;
  const { snapshots } = useAggregate();

  const avgRps = +snapshots.reduce((a, s) => a + s.avgRps, 0).toFixed(2);
  const ratio = 0.32; // mid of 25-40%
  const peakRps = +(avgRps / ratio).toFixed(2);
  const peakTs = snapshots[0]?.peakTimestamp ?? "Jun 9, 14:32";

  const [breakdown, setBreakdown] = useState(false);
  const top3 = useMemo(() => [...TENANTS].sort((a, b) => b.share - a.share).slice(0, 3), []);

  const data = useMemo(() => {
    const base = getTimeSeries(window, tenants);
    if (platformContext && breakdown) {
      return base.map((p, i) => {
        const row: any = { label: p.label, total: p.rps };
        top3.forEach((t) => {
          const tSeries = getTenantRpsSeries(t, window);
          row[t.id] = tSeries[i]?.rps ?? 0;
        });
        return row;
      });
    }
    return base.map((p) => ({ label: p.label, total: p.rps }));
  }, [window, tenants, platformContext, breakdown, top3]);

  return (
    <section>
      <Eyebrow right={
        platformContext ? (
          <button
            onClick={() => setBreakdown((b) => !b)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded border transition ${
              breakdown ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {breakdown ? "Hide tenant breakdown" : "Break down by tenant"}
          </button>
        ) : null
      }>Throughput</Eyebrow>
      <Card className="p-5">
        <div className="flex flex-col gap-2 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Avg RPS</div>
            <div className="mt-1 text-[26px] leading-none font-bold text-slate-900 tabular-nums">
              {avgRps}<span className="text-sm font-normal text-slate-500 ml-1">req/s</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Peak</div>
            <div className="mt-1 text-[20px] leading-none font-semibold text-slate-900 tabular-nums">
              {peakRps}<span className="text-sm font-normal text-slate-500 ml-1">req/s · {peakTs}</span>
            </div>
          </div>
        </div>
        {platformContext && breakdown && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-900" /> Platform total</span>
            {top3.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: t.avatarColor }} /> {t.name}</span>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} separator="  " />
            <Line type="monotone" dataKey="total" stroke="#0F172A" strokeWidth={2} dot={false} isAnimationActive={false} />
            {platformContext && breakdown && top3.map((t) => (
              <Line key={t.id} type="monotone" dataKey={t.id} stroke={t.avatarColor} strokeWidth={1.6} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 4 RIGHT — Tenant adoption (Platform only)
========================================================= */
export function TenantAdoptionGrid() {
  const active24 = TENANTS.filter((t) => t.active24h).length;
  const active7 = TENANTS.filter((t) => t.active7d).length;
  const active30 = TENANTS.length;
  const newOnboard = TENANTS.filter((t) => t.newWithin7d).length;

  const items = [
    { label: "Active (24h)", value: active24, sub: "Rolling window" },
    { label: "Active (7 days)", value: active7, sub: "Rolling window" },
    { label: "Active (30 days)", value: active30, sub: "Rolling window" },
    { label: "New this week", value: newOnboard, sub: "Onboarded" },
  ];

  const top3 = [...TENANTS].sort((a, b) => b.share - a.share).slice(0, 3);
  const top3Sum = top3.reduce((a, t) => a + t.share, 0);
  const others = 1 - top3Sum;

  return (
    <section>
      <Eyebrow>Tenant adoption</Eyebrow>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-y-5 gap-x-4">
          {items.map((it) => (
            <div key={it.label}>
              <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
              <div className="mt-1.5 text-[28px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
              <div className="mt-1 text-[11px] text-slate-500">{it.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">Usage concentration</div>
            <div className="text-xs text-slate-700"><span className="font-semibold">Top 3 tenants</span> · {Math.round(top3Sum * 100)}% of platform</div>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
            {top3.map((t) => (
              <div key={t.id} style={{ width: `${t.share * 100}%`, background: t.avatarColor }} title={`${t.name}: ${Math.round(t.share * 100)}%`} />
            ))}
            <div style={{ width: `${others * 100}%`, background: "#E2E8F0" }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
            {top3.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: t.avatarColor }} />
                {t.name} {Math.round(t.share * 100)}%
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-slate-300" />
              Others {Math.round(others * 100)}%
            </span>
          </div>
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 5 — Cross-tenant comparison (stacked, request count)
========================================================= */
export function CompareTenantsSection() {
  const { window } = useUsage();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(["NMT", "ASR", "TTS"]);

  const data = useMemo(() => {
    return TENANTS.map((t) => {
      const snap = getTenantUsage(t, window);
      const row: any = { name: t.name };
      selected.forEach((k) => {
        row[k] = snap.services.find((s) => s.service === k)?.totalRequests ?? 0;
      });
      return row;
    });
  }, [window, selected]);

  function toggle(k: string) {
    setSelected((s) => {
      if (s.includes(k)) return s.length > 1 ? s.filter((x) => x !== k) : s;
      if (s.length >= 3) return [...s.slice(1), k];
      return [...s, k];
    });
  }

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-800"
      >
        <span className="inline-flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {open ? "Collapse comparison" : "Compare tenants by service usage"}
        </span>
        <span className="text-xs text-slate-500">{selected.length} services selected</span>
      </button>
      {open && (
        <div className="mt-4">
          <div className="flex justify-end mb-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">
                  Services (max 3) <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
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
          <Card className="p-5">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs">
              {selected.map((k) => {
                const s = getServiceByKey(k);
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
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} formatter={(v: number) => formatIndian(v)} separator="  " />
                {selected.map((k, i) => {
                  const s = getServiceByKey(k);
                  const isLast = i === selected.length - 1;
                  return <Bar key={k} dataKey={k} stackId="svc" fill={s.color} radius={isLast ? [0, 3, 3, 0] : 0} />;
                })}
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 text-[11px] text-slate-500 italic">
              Showing request count across selected services — not native units.
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   Loading wrapper
========================================================= */
export function LoadingOverlay({ children }: { children: React.ReactNode }) {
  const { loading } = useUsage();
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[260px] w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="h-[400px] lg:col-span-3" />
          <Skeleton className="h-[400px] lg:col-span-2" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
