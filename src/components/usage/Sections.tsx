import { useUsage } from "@/lib/usage/context";
import { useMemo, useState } from "react";
import {
  TENANTS, SERVICES, getTenantUsage, getTimeSeries, getServiceTrendSeries,
  formatIndian, formatCompact, getServiceByKey, type Tenant, type ServiceUsage,
} from "@/lib/usage/data";
import { Avatar, PlanPill } from "./FilterBar";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Download, Medal } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

// ------- helpers
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>{children}</div>;
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

function ExportBtn() {
  return (
    <button
      onClick={() => toast("Export coming soon")}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" /> Export
    </button>
  );
}

function Metric({ label, value, sub, tint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tint?: "green" | "red" }) {
  const bg = tint === "green" ? "bg-emerald-50/60 border-emerald-100" : tint === "red" ? "bg-rose-50/60 border-rose-100" : "bg-white border-slate-200";
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900 leading-none">{value}</div>
      {sub && <div className="mt-2 text-xs text-slate-600">{sub}</div>}
    </div>
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
    // aggregate per-service
    const services: ServiceUsage[] = SERVICES.map((sv) => {
      const rows = snapshots.flatMap((s) => s.services.filter((x) => x.service === sv.key));
      const total = rows.reduce((a, x) => a + x.totalRequests, 0);
      const succ = rows.reduce((a, x) => a + x.successful, 0);
      const fail = total - succ;
      const units = rows.reduce((a, x) => a + x.units, 0);
      const quotaUsed = rows.reduce((a, x) => a + x.quotaUsed, 0);
      const quotaLimit = rows.reduce((a, x) => a + x.quotaLimit, 0);
      const avgRps = +(rows.reduce((a, x) => a + x.avgRps, 0)).toFixed(2);
      const peakRps = +Math.max(0, ...rows.map((x) => x.peakRps)).toFixed(2);
      return {
        service: sv.key, totalRequests: total, successful: succ, failed: fail,
        units, unitShort: sv.unitShort, quotaUsed, quotaLimit, avgRps, peakRps,
        peakTimestamp: rows[0]?.peakTimestamp ?? "",
        failRate: fail / Math.max(1, total),
        sparkline: rows[0]?.sparkline ?? [0, 0, 0, 0, 0, 0, 0],
      };
    });
    return { snapshots, totalRequests, successful, failed, services, tenants };
  }, [tenants, window]);
}

// ===================== A. Tenant Adoption (Platform Admin only) =====================
export function AdoptionSection() {
  const { role, window } = useUsage();
  if (role !== "platform_admin") return null;
  const active24 = TENANTS.filter((t) => t.active24h).length;
  const active7 = TENANTS.filter((t) => t.active7d).length;
  const active30 = TENANTS.length;
  const newOnboard = TENANTS.filter((t) => t.newWithin7d).length;
  const platformTotal = TENANTS.reduce((a, t) => a + getTenantUsage(t, window).totalRequests, 0);
  const top3 = [...TENANTS].sort((a, b) => b.share - a.share).slice(0, 3);
  const top3Share = top3.reduce((a, t) => a + t.share, 0);
  const avgPerTenant = Math.floor(platformTotal / TENANTS.length);

  return (
    <section>
      <SectionHeader title="Tenant adoption" subtitle="Platform-wide engagement across all tenants" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Metric label="Total tenants" value={TENANTS.length} />
        <Metric label="Active last 24h" value={active24} sub={`${Math.round(active24 / TENANTS.length * 100)}% of base`} />
        <Metric label="Active last 7 days" value={active7} />
        <Metric label="New onboarded (7 days)" value={newOnboard} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Metric label="Active last 30 days" value={active30} />
        <Metric label="Avg requests per tenant" value={formatCompact(avgPerTenant)} sub={`${formatIndian(avgPerTenant)} requests`} />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Usage concentration</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">Top 3 tenants · {Math.round(top3Share * 100)}% of usage</div>
          <div className="mt-3 h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
            {top3.map((t) => (
              <div key={t.id} style={{ width: `${t.share * 100}%`, background: t.avatarColor }} title={t.name} />
            ))}
            <div style={{ width: `${(1 - top3Share) * 100}%`, background: "#E2E8F0" }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
            {top3.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: t.avatarColor }} /> {t.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================== B. Request Volume =====================
export function RequestVolumeSection() {
  const { window } = useUsage();
  const tenants = useScopedTenants();
  const { totalRequests, successful, failed } = useAggregate();
  const series = useMemo(() => getTimeSeries(window, tenants), [window, tenants]);
  const trend = 8.4;

  return (
    <section>
      <SectionHeader title="Request volume" subtitle="Inference requests across the selected period" right={<ExportBtn />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Metric label="Total requests" value={formatIndian(totalRequests)} sub={<span className="inline-flex items-center gap-1 text-emerald-700"><ArrowUp className="h-3 w-3" /> {trend}% vs previous</span>} />
        <Metric label="Successful requests" value={formatIndian(successful)} sub={<span className="text-emerald-700 font-medium">{(successful / Math.max(1, totalRequests) * 100).toFixed(2)}% success</span>} tint="green" />
        <Metric label="Failed requests" value={formatIndian(failed)} sub={<span className="text-rose-700 font-medium">{(failed / Math.max(1, totalRequests) * 100).toFixed(2)}% failure</span>} tint="red" />
      </div>
      <Card>
        <div className="flex items-center gap-4 mb-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#60A5FA]" /> Total</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Successful</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Failed</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={series} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#60A5FA" stopOpacity={0.35} /><stop offset="95%" stopColor="#60A5FA" stopOpacity={0} /></linearGradient>
              <linearGradient id="gSucc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
              <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F87171" stopOpacity={0.3} /><stop offset="95%" stopColor="#F87171" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatIndian(v)} />
            <Area type="monotone" dataKey="total" stroke="#60A5FA" fill="url(#gTotal)" strokeWidth={2} />
            <Area type="monotone" dataKey="successful" stroke="#10B981" fill="url(#gSucc)" strokeWidth={2} />
            <Area type="monotone" dataKey="failed" stroke="#F87171" fill="url(#gFail)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

// ===================== C. Throughput =====================
export function ThroughputSection() {
  const { window, role, effectiveTenant } = useUsage();
  const tenants = useScopedTenants();
  const isAllPlatform = role === "platform_admin" && !effectiveTenant;
  const { snapshots } = useAggregate();
  const avgRps = +(snapshots.reduce((a, s) => a + s.avgRps, 0)).toFixed(2);
  const peakSnap = [...snapshots].sort((a, b) => b.peakRps - a.peakRps)[0];
  const peakRps = peakSnap?.peakRps ?? 0;
  const peakTs = peakSnap?.peakTimestamp ?? "";
  const topByRps = [...snapshots].sort((a, b) => b.avgRps - a.avgRps)[0];
  const topTenant = topByRps ? TENANTS.find((t) => t.id === topByRps.tenantId) : null;

  // Series
  const data = useMemo(() => {
    const base = getTimeSeries(window, tenants);
    if (isAllPlatform) {
      // Add top 3 tenant lines
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
      <SectionHeader title="Throughput" subtitle="Requests per second over the selected window" />
      <div className={`grid grid-cols-1 ${isAllPlatform ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3 mb-3`}>
        <Metric label="Average RPS" value={`${avgRps} req/s`} />
        <Metric label="Peak throughput" value={`${peakRps} req/s`} sub={`peaked ${peakTs}`} />
        {isAllPlatform && topTenant && (
          <Metric label="Top tenant by RPS" value={topTenant.name} sub={`${topByRps.avgRps} req/s avg`} />
        )}
      </div>
      <Card>
        {isAllPlatform && (
          <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-900" /> Platform total</span>
            {top3.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: t.avatarColor }} /> {t.name}</span>
            ))}
          </div>
        )}
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="total" stroke="#0F172A" strokeWidth={2} dot={false} />
            {isAllPlatform && top3.map((t) => (
              <Line key={t.id} type="monotone" dataKey={t.id} stroke={t.avatarColor} strokeWidth={1.8} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

// ===================== D. Service Usage Table =====================
type SortKey = "usage" | "totalRequests" | "successRate" | "quota";
export function ServiceUsageSection() {
  const { services } = useAggregate();
  const [sortKey, setSortKey] = useState<SortKey>("totalRequests");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const r = [...services];
    r.sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "usage") { av = a.units; bv = b.units; }
      else if (sortKey === "totalRequests") { av = a.totalRequests; bv = b.totalRequests; }
      else if (sortKey === "successRate") { av = a.successful / Math.max(1, a.totalRequests); bv = b.successful / Math.max(1, b.totalRequests); }
      else if (sortKey === "quota") { av = a.quotaUsed / Math.max(1, a.quotaLimit); bv = b.quotaUsed / Math.max(1, b.quotaLimit); }
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return r;
  }, [services, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 ${active ? "text-slate-900" : "text-slate-600"}`}>
        {children}
        {active ? (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    );
  }

  return (
    <section>
      <SectionHeader title="Service usage" subtitle="Per-service consumption and quota status" right={<ExportBtn />} />
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-3">Metering unit</th>
                <th className="py-3 px-3"><SortBtn k="usage">Usage</SortBtn></th>
                <th className="py-3 px-3"><SortBtn k="quota">Quota</SortBtn></th>
                <th className="py-3 px-3 text-right"><SortBtn k="totalRequests">Total req</SortBtn></th>
                <th className="py-3 px-3 text-right"><SortBtn k="successRate">Success</SortBtn></th>
                <th className="py-3 px-3 text-right">Failed</th>
                <th className="py-3 px-3">Trend</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sv = getServiceByKey(r.service);
                const quotaPct = r.quotaLimit > 0 ? r.quotaUsed / r.quotaLimit : 0;
                const quotaColor = quotaPct > 0.85 ? "#EF4444" : quotaPct > 0.6 ? "#F59E0B" : "#10B981";
                const successRate = r.totalRequests > 0 ? r.successful / r.totalRequests : 0;
                const noActivity = r.totalRequests === 0;
                const status = noActivity ? "Idle" : quotaPct > 0.85 ? "Near limit" : "Active";
                const statusCls = status === "Near limit" ? "bg-amber-50 text-amber-700 border-amber-200" : status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200";
                return (
                  <tr key={r.service} className="border-b border-slate-100 last:border-0 relative">
                    <td className="py-3 pl-4 pr-3 relative">
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: sv.color }} />
                      <div className="flex items-center gap-2.5">
                        <span className="h-7 w-7 rounded-md grid place-items-center text-white text-[10px] font-bold" style={{ background: sv.color }}>
                          {sv.key.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-900">{sv.name}</span>
                      </div>
                    </td>
                    {noActivity ? (
                      <td colSpan={7} className="py-3 px-3 text-slate-400 italic">No activity this period</td>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-slate-600 text-xs">{sv.unit}</td>
                        <td className="py-3 px-3 tabular-nums">{formatCompact(r.units)} <span className="text-xs text-slate-500">{r.unitShort}</span></td>
                        <td className="py-3 px-3 w-[200px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, quotaPct * 100)}%`, background: quotaColor }} />
                            </div>
                            <span className="text-xs tabular-nums w-10 text-right" style={{ color: quotaColor }}>{Math.round(quotaPct * 100)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatIndian(r.totalRequests)}</td>
                        <td className="py-3 px-3 text-right text-emerald-700 tabular-nums">{(successRate * 100).toFixed(2)}%</td>
                        <td className="py-3 px-3 text-right text-rose-600 tabular-nums">{formatIndian(r.failed)}</td>
                        <td className="py-3 px-3 w-[100px]">
                          <div className="h-10 w-[80px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={r.sparkline.map((v, i) => ({ i, v }))}>
                                <Bar dataKey="v" fill={sv.color} radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCls}`}>{status}</span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 text-[11px] text-slate-500 border-t border-slate-100">Quota resets on the 1st of each month</div>
      </Card>
    </section>
  );
}

// ===================== E. Usage Trend by Service =====================
export function UsageTrendSection() {
  const { window } = useUsage();
  const tenants = useScopedTenants();
  const [selected, setSelected] = useState<string[]>(["NMT", "ASR", "TTS"]);
  const series = useMemo(() => getServiceTrendSeries(window, tenants), [window, tenants]);

  const totals = useMemo(() => {
    const m: Record<string, number> = {};
    SERVICES.forEach((s) => (m[s.key] = series.reduce((a, r) => a + (r[s.key] ?? 0), 0)));
    return m;
  }, [series]);

  function toggle(k: string) {
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  }

  return (
    <section>
      <SectionHeader
        title="Usage trend by service"
        subtitle="Compare consumption patterns across services"
        right={
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">
                Services ({selected.length}) <ChevronDown className="h-3.5 w-3.5" />
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
        }
      />
      <Card>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs">
          {selected.map((k) => {
            const s = getServiceByKey(k);
            return (
              <span key={k} className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="font-medium">{s.name}</span>
                <span className="text-slate-500">· {formatCompact(totals[k] || 0)} {s.unitShort}</span>
              </span>
            );
          })}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series} margin={{ top: 5, right: 12, left: -5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatIndian(v)} />
            {selected.map((k) => {
              const s = getServiceByKey(k);
              return <Line key={k} type="monotone" dataKey={k} stroke={s.color} strokeWidth={2} dot={false} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

// ===================== F. Top Tenants =====================
export function TopTenantsSection() {
  const { role, window, setSelectedTenantId } = useUsage();
  const [topN, setTopN] = useState<5 | 10>(10);
  if (role !== "platform_admin") return null;

  const rows = useMemo(() => {
    const snaps = TENANTS.map((t) => ({ tenant: t, ...getTenantUsage(t, window) }));
    snaps.sort((a, b) => b.totalRequests - a.totalRequests);
    return snaps.slice(0, topN);
  }, [window, topN]);
  const platformTotal = TENANTS.reduce((a, t) => a + getTenantUsage(t, window).totalRequests, 0);
  const maxReq = rows[0]?.totalRequests ?? 1;

  const medals = ["#F59E0B", "#94A3B8", "#B45309"];

  return (
    <section>
      <SectionHeader
        title="Top tenants by usage"
        right={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
              {[5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setTopN(n as 5 | 10)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${topN === n ? "bg-orange-500 text-white" : "text-slate-700"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <ExportBtn />
          </div>
        }
      />
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 pl-4 pr-2">#</th>
                <th className="py-3 px-3">Tenant</th>
                <th className="py-3 px-3">Total requests</th>
                <th className="py-3 px-3 text-right">Successful</th>
                <th className="py-3 px-3 text-right">Failed</th>
                <th className="py-3 px-3 text-right">Success rate</th>
                <th className="py-3 px-3">Top service</th>
                <th className="py-3 px-3 text-right">Avg RPS</th>
                <th className="py-3 px-3 text-right">% platform</th>
                <th className="py-3 px-3 pr-4">Quota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const sv = getServiceByKey(r.topService);
                const sharePct = (r.totalRequests / Math.max(1, platformTotal)) * 100;
                const barPct = (r.totalRequests / maxReq) * 100;
                const quotaPct = r.quotaLimit > 0 ? r.quotaUsed / r.quotaLimit : 0;
                const quotaColor = quotaPct > 0.85 ? "#EF4444" : quotaPct > 0.6 ? "#F59E0B" : "#10B981";
                return (
                  <tr
                    key={r.tenantId}
                    onClick={() => setSelectedTenantId(r.tenantId)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-3 pl-4 pr-2 text-slate-500 tabular-nums">
                      {idx < 3 ? <Medal className="h-4 w-4" style={{ color: medals[idx] }} /> : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.tenant.name} color={r.tenant.avatarColor} size={28} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{r.tenant.name}</div>
                          <div className="mt-0.5"><PlanPill plan={r.tenant.plan} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-slate-900 font-medium w-20 shrink-0">{formatIndian(r.totalRequests)}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-slate-700 rounded-full" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 tabular-nums">{formatIndian(r.successful)}</td>
                    <td className="py-3 px-3 text-right text-rose-600 tabular-nums">{formatIndian(r.failed)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{(r.successRate * 100).toFixed(2)}%</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium" style={{ background: sv.color + "1A", borderColor: sv.color + "55", color: sv.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: sv.color }} /> {sv.name}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.avgRps}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{sharePct.toFixed(1)}%</td>
                    <td className="py-3 px-3 pr-4 w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, quotaPct * 100)}%`, background: quotaColor }} />
                        </div>
                        <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: quotaColor }}>{Math.round(quotaPct * 100)}%</span>
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

// ===================== G. Cross-tenant Comparison =====================
export function ComparisonSection() {
  const { role, window } = useUsage();
  const [selected, setSelected] = useState<string[]>(["NMT", "ASR", "TTS"]);
  if (role !== "platform_admin") return null;

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
      <SectionHeader
        title="Usage by tenant"
        subtitle="Compare service consumption across all tenants"
        right={
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
        }
      />
      <Card>
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
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => formatIndian(v)} />
            {selected.map((k) => {
              const s = getServiceByKey(k);
              return <Bar key={k} dataKey={k} fill={s.color} radius={[0, 3, 3, 0]} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </section>
  );
}

// ===================== H. Volume Breakdown (collapsible) =====================
export function BreakdownSection() {
  const { role, window } = useUsage();
  const [open, setOpen] = useState(false);
  if (role !== "platform_admin") return null;

  const rows = TENANTS.map((t) => ({ tenant: t, ...getTenantUsage(t, window) }));

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-900">Volume breakdown by tenant</span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
      </button>
      {open && (
        <Card className="mt-2 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-3 text-right">Total requests</th>
                  <th className="py-3 px-3 text-right">Successful</th>
                  <th className="py-3 px-3 text-right">Failed</th>
                  <th className="py-3 px-3 text-right">Avg RPS</th>
                  <th className="py-3 px-3 text-right">Peak RPS</th>
                  <th className="py-3 px-3">Peak timestamp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tenantId} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <Avatar name={r.tenant.name} color={r.tenant.avatarColor} size={24} />
                      <span className="font-medium">{r.tenant.name}</span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatIndian(r.totalRequests)}</td>
                    <td className="py-3 px-3 text-right text-emerald-700 tabular-nums">{formatIndian(r.successful)}</td>
                    <td className="py-3 px-3 text-right text-rose-600 tabular-nums">{formatIndian(r.failed)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.avgRps}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.peakRps}</td>
                    <td className="py-3 px-3 text-slate-600">{r.peakTimestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}

// Loading skeleton wrapper
export function LoadingOverlay({ children }: { children: React.ReactNode }) {
  const { loading } = useUsage();
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
