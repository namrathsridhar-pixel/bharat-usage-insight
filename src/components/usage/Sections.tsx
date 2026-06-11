import { useUsage } from "@/lib/usage/context";
import { useMemo, useState } from "react";
import {
  TENANTS, SERVICES, getTenantUsage, getTimeSeries,
  formatIndian, formatCompact, getServiceByKey, type ServiceUsage,
} from "@/lib/usage/data";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- shared helpers ---------- */

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
      const peakRps = +(avgRps * 4.2).toFixed(2);
      return {
        service: sv.key, totalRequests: total, successful: succ, failed: fail,
        units, unitShort: sv.unitShort,
        quotaUsed: 0, quotaLimit: 0,
        avgRps, peakRps,
        peakTimestamp: rows[0]?.peakTimestamp ?? "",
        failRate: fail / Math.max(1, total),
        sparkline: rows[0]?.sparkline ?? [0, 0, 0, 0, 0, 0, 0],
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
  const successRate = successful / Math.max(1, totalRequests);
  const avgRps = +snapshots.reduce((a, s) => a + s.avgRps, 0).toFixed(2);
  const activeTenants = TENANTS.filter((t) => t.active24h).length;
  const { role } = useUsage();

  const items = [
    { label: "Total requests", value: formatIndian(totalRequests), delta: 8.4 },
    { label: "Success rate", value: `${(successRate * 100).toFixed(2)}%`, delta: 0.3 },
    { label: "Avg RPS", value: `${avgRps}`, suffix: "req/s", delta: 5.1 },
    role === "platform_admin"
      ? { label: "Active tenants", value: `${activeTenants}`, suffix: `of ${TENANTS.length}`, delta: 12.5 }
      : { label: "Failed requests", value: formatIndian(totalRequests - successful), delta: -2.1, invert: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-y border-slate-200 py-5">
      {items.map((it, i) => (
        <div key={i} className="px-2 md:px-6 first:pl-0 last:pr-0 py-4 md:py-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <div className="text-[28px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
            {"suffix" in it && it.suffix && <div className="text-xs text-slate-500">{it.suffix}</div>}
          </div>
          <div className="mt-2"><Delta pct={it.delta} invert={(it as any).invert} /></div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   ZONE 2 — Volume + Health chart
========================================================= */
export function VolumeHealthChart() {
  const { window } = useUsage();
  const tenants = useScopedTenants();
  const series = useMemo(() => getTimeSeries(window, tenants), [window, tenants]);

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
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v: number, n: string) => [formatIndian(v), n === "total" ? "Total requests" : "Failed requests"]}
              labelFormatter={(l) => `Time  ${l}`}
              separator="  "
            />
            <Line yAxisId="L" type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2.4} dot={false} />
            <Line yAxisId="R" type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 3 LEFT — Service breakdown table
========================================================= */
type SortKey = "totalRequests" | "units" | "successRate" | "failed";
export function ServiceBreakdownTable() {
  const { services } = useAggregate();
  const [sortKey, setSortKey] = useState<SortKey>("totalRequests");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const r = [...services];
    r.sort((a, b) => {
      const av = sortKey === "units" ? a.units : sortKey === "successRate"
        ? a.successful / Math.max(1, a.totalRequests)
        : sortKey === "failed" ? a.failed : a.totalRequests;
      const bv = sortKey === "units" ? b.units : sortKey === "successRate"
        ? b.successful / Math.max(1, b.totalRequests)
        : sortKey === "failed" ? b.failed : b.totalRequests;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return r;
  }, [services, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function Th({ k, align = "right", children }: { k: SortKey; align?: "right" | "left"; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <th className={`py-3 px-3 ${align === "right" ? "text-right" : "text-left"}`}>
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
                <Th k="successRate">Success</Th>
                <Th k="failed">Failed</Th>
                <th className="py-3 px-3 pr-4 text-left font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sv = getServiceByKey(r.service);
                const successRate = r.totalRequests > 0 ? r.successful / r.totalRequests : 0;
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
                      {formatIndian(r.units)} <span className="text-[11px] text-slate-500">{r.unitShort}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-emerald-700">{(successRate * 100).toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-600">{formatIndian(r.failed)}</td>
                    <td className="py-3 px-3 pr-4 w-[110px]">
                      <div className="h-10 w-[90px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={r.sparkline.map((v, i) => ({ i, v }))}>
                            <Bar dataKey="v" fill={sv.color} radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
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
   ZONE 3 RIGHT — Top tenants ranked list
========================================================= */
export function TopTenantsList() {
  const { window, setSelectedTenantId } = useUsage();
  const [showAll, setShowAll] = useState(false);

  const all = useMemo(() => {
    const snaps = TENANTS.map((t) => ({ tenant: t, ...getTenantUsage(t, window) }));
    snaps.sort((a, b) => b.totalRequests - a.totalRequests);
    return snaps;
  }, [window]);
  const platformTotal = all.reduce((a, s) => a + s.totalRequests, 0);
  const max = all[0]?.totalRequests || 1;
  const rows = showAll ? all : all.slice(0, 5);

  return (
    <section>
      <Eyebrow>Top tenants</Eyebrow>
      <div className="space-y-2">
        {rows.map((r, idx) => {
          const sharePct = (r.totalRequests / Math.max(1, platformTotal)) * 100;
          const barPct = (r.totalRequests / max) * 100;
          return (
            <button
              key={r.tenantId}
              onClick={() => setSelectedTenantId(r.tenantId)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 transition group"
            >
              <div className="flex items-center gap-3">
                <span className="text-[11px] tabular-nums text-slate-400 w-5 font-medium">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900 truncate group-hover:text-orange-600">{r.tenant.name}</span>
                    <span className="text-xs text-slate-500 tabular-nums shrink-0">{formatIndian(r.totalRequests)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: r.tenant.avatarColor }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-slate-500 w-10 text-right">{sharePct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setShowAll((v) => !v)}
        className="mt-3 text-xs font-medium text-orange-600 hover:text-orange-700"
      >
        {showAll ? "Show top 5" : `Show all ${all.length} tenants →`}
      </button>
    </section>
  );
}

/* =========================================================
   ZONE 4 LEFT — Throughput
========================================================= */
export function ThroughputBlock() {
  const { window, role, effectiveTenant } = useUsage();
  const tenants = useScopedTenants();
  const isAllPlatform = role === "platform_admin" && !effectiveTenant;
  const { snapshots } = useAggregate();
  const avgRps = +snapshots.reduce((a, s) => a + s.avgRps, 0).toFixed(2);
  const peakRps = +(avgRps * 4.2).toFixed(2);

  const data = useMemo(() => {
    const base = getTimeSeries(window, tenants);
    if (isAllPlatform) {
      const top3 = [...TENANTS].sort((a, b) => b.share - a.share).slice(0, 3);
      return base.map((p, i) => {
        const row: any = { label: p.label, total: p.rps };
        top3.forEach((t) => {
          row[t.id] = +(p.rps * t.share * (0.8 + (i % 3) * 0.1)).toFixed(2);
        });
        return row;
      });
    }
    return base.map((p) => ({ label: p.label, total: p.rps }));
  }, [window, tenants, isAllPlatform]);

  const top3 = [...TENANTS].sort((a, b) => b.share - a.share).slice(0, 3);

  return (
    <section>
      <Eyebrow>Throughput</Eyebrow>
      <Card className="p-5">
        <div className="flex items-end gap-8 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Avg RPS</div>
            <div className="mt-1.5 text-[26px] leading-none font-bold text-slate-900 tabular-nums">{avgRps}<span className="text-sm font-normal text-slate-500 ml-1">req/s</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Peak RPS</div>
            <div className="mt-1.5 text-[26px] leading-none font-bold text-slate-900 tabular-nums">{peakRps}<span className="text-sm font-normal text-slate-500 ml-1">req/s</span></div>
          </div>
        </div>
        {isAllPlatform && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-900" /> Platform</span>
            {top3.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: t.avatarColor }} /> {t.name}</span>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} separator="  " />
            <Line type="monotone" dataKey="total" stroke="#0F172A" strokeWidth={2} dot={false} />
            {isAllPlatform && top3.map((t) => (
              <Line key={t.id} type="monotone" dataKey={t.id} stroke={t.avatarColor} strokeWidth={1.6} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 4 RIGHT — Tenant adoption (Platform Admin only)
========================================================= */
export function TenantAdoptionGrid() {
  const active24 = TENANTS.filter((t) => t.active24h).length;
  const active7 = TENANTS.filter((t) => t.active7d).length;
  const active30 = TENANTS.length;
  const newOnboard = TENANTS.filter((t) => t.newWithin7d).length;

  const items = [
    { label: "Active 24h", value: active24, sub: `of ${TENANTS.length} tenants` },
    { label: "Active 7 days", value: active7, sub: `of ${TENANTS.length} tenants` },
    { label: "Active 30 days", value: active30, sub: `of ${TENANTS.length} tenants` },
    { label: "New this week", value: newOnboard, sub: "newly onboarded" },
  ];

  return (
    <section>
      <Eyebrow>Tenant adoption</Eyebrow>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
          {items.map((it) => (
            <div key={it.label}>
              <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{it.label}</div>
              <div className="mt-1.5 text-[28px] leading-none font-bold text-slate-900 tabular-nums">{it.value}</div>
              <div className="mt-1.5 text-[11px] text-slate-500">{it.sub}</div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* =========================================================
   ZONE 5 — Compare tenants (collapsed by default)
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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-orange-600"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Compare tenants
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
            <ResponsiveContainer width="100%" height={44 * 10 + 40}>
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} width={170} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatIndian(v)} separator="  " />
                {selected.map((k) => {
                  const s = getServiceByKey(k);
                  return <Bar key={k} dataKey={k} fill={s.color} radius={[0, 3, 3, 0]} />;
                })}
              </BarChart>
            </ResponsiveContainer>
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
