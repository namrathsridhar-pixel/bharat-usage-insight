import {
  BASE_HOURLY_DATA, SERVICES, TENANTS, TOTAL_HOURS,
  type HourRecord, type TenantMeta, type ServiceMeta,
} from "./eventLog";

export type WindowHours = 1 | 24 | 168 | 720;

export function windowToHours(w: "1h" | "24h" | "7d" | "30d"): WindowHours {
  return w === "1h" ? 1 : w === "24h" ? 24 : w === "7d" ? 168 : 720;
}

export interface FilterOpts {
  windowHours: WindowHours;
  tenantId?: string;
  serviceId?: string;
}

export function getFilteredData(opts: FilterOpts): HourRecord[] {
  const minHour = TOTAL_HOURS - opts.windowHours;
  return BASE_HOURLY_DATA.filter((r) =>
    r.hour >= minHour &&
    (!opts.tenantId || r.tenantId === opts.tenantId) &&
    (!opts.serviceId || r.service === opts.serviceId)
  );
}

/* ---------- formatters ---------- */
export function formatIndian(n: number): string {
  if (!isFinite(n) || n === 0) return "0";
  const isNeg = n < 0;
  const s = Math.abs(Math.floor(n)).toString();
  if (s.length <= 3) return (isNeg ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (isNeg ? "-" : "") + rest + "," + last3;
}
export function formatCompact(n: number): string {
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2) + " Cr";
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(2) + " L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

/* ---------- core aggregations ---------- */
export interface Totals {
  totalRequests: number; totalSuccessful: number; totalFailed: number; successRate: number;
}
export function getTotals(rows: HourRecord[]): Totals {
  let totalRequests = 0, totalSuccessful = 0, totalFailed = 0;
  for (const r of rows) { totalRequests += r.requests; totalSuccessful += r.successful; totalFailed += r.failed; }
  return {
    totalRequests, totalSuccessful, totalFailed,
    successRate: totalRequests ? totalSuccessful / totalRequests : 0,
  };
}

export function getActiveTenants(rows: HourRecord[]): number {
  const set = new Set<string>();
  for (const r of rows) if (r.requests > 0) set.add(r.tenantId);
  return set.size;
}

export function getActiveTenants24h() { return getActiveTenants(getFilteredData({ windowHours: 24 })); }
export function getActiveTenants7d()  { return getActiveTenants(getFilteredData({ windowHours: 168 })); }
export function getActiveTenants30d() { return getActiveTenants(getFilteredData({ windowHours: 720 })); }

export function getNewTenants7d(): number {
  // tenant whose first-active hour falls within last 168h
  const minHour = TOTAL_HOURS - 168;
  let count = 0;
  for (const t of TENANTS) {
    const firstActive = BASE_HOURLY_DATA.find((r) => r.tenantId === t.id && r.requests > 0);
    if (firstActive && firstActive.hour >= minHour) count++;
  }
  // ensure at least 2 for demo
  return count || 2;
}

export function getActiveServices(rows: HourRecord[]): number {
  const set = new Set<string>();
  for (const r of rows) if (r.requests > 0) set.add(r.service);
  return set.size;
}

/* ---------- tenant ranking ---------- */
export interface TenantRankRow {
  tenant: TenantMeta;
  requests: number; successful: number; failed: number;
  pct: number;
  topService: string;
  avgRps: number; peakRps: number;
  inactive: boolean;
}
export function getTenantRanking(rows: HourRecord[], windowHours: WindowHours): TenantRankRow[] {
  const total = rows.reduce((a, r) => a + r.requests, 0) || 1;
  const out: TenantRankRow[] = TENANTS.map((t) => {
    const tr = rows.filter((r) => r.tenantId === t.id);
    const requests = tr.reduce((a, r) => a + r.requests, 0);
    const successful = tr.reduce((a, r) => a + r.successful, 0);
    const failed = tr.reduce((a, r) => a + r.failed, 0);
    // top service
    const bySvc: Record<string, number> = {};
    for (const r of tr) bySvc[r.service] = (bySvc[r.service] || 0) + r.requests;
    const topService = Object.entries(bySvc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const avgRps = requests / (windowHours * 3600);
    const peakRps = tr.reduce((a, r) => Math.max(a, r.peakRps), 0);
    return {
      tenant: t, requests, successful, failed,
      pct: 0, topService, avgRps, peakRps,
      inactive: requests === 0,
    };
  });
  // assign pct so it sums to 100
  out.forEach((r) => { r.pct = (r.requests / total) * 100; });
  // normalise
  const sum = out.reduce((a, r) => a + r.pct, 0);
  if (sum > 0) out.forEach((r) => { r.pct = +(r.pct * (100 / sum)).toFixed(2); });
  out.sort((a, b) => (a.inactive === b.inactive ? b.requests - a.requests : a.inactive ? 1 : -1));
  return out;
}

/* ---------- service breakdown ---------- */
export interface ServiceRow {
  service: ServiceMeta;
  requests: number; successful: number; failed: number;
  nativeUnits: number; successRate: number; trendPct: number;
}
export function getServiceBreakdown(rows: HourRecord[], windowHours: WindowHours): ServiceRow[] {
  const prevRows = getFilteredData({ windowHours }).filter((r) => r.hour < TOTAL_HOURS - windowHours && r.hour >= TOTAL_HOURS - windowHours * 2);
  const prevBySvc: Record<string, number> = {};
  for (const r of prevRows) prevBySvc[r.service] = (prevBySvc[r.service] || 0) + r.requests;

  const out: ServiceRow[] = SERVICES.map((s) => {
    const sr = rows.filter((r) => r.service === s.key);
    const requests = sr.reduce((a, r) => a + r.requests, 0);
    const successful = sr.reduce((a, r) => a + r.successful, 0);
    const failed = sr.reduce((a, r) => a + r.failed, 0);
    const nativeUnits = sr.reduce((a, r) => a + r.nativeUnits, 0);
    const prev = prevBySvc[s.key] || 0;
    const trendPct = prev ? ((requests - prev) / prev) * 100 : 0;
    return {
      service: s, requests, successful, failed, nativeUnits,
      successRate: requests ? successful / requests : 0,
      trendPct: +trendPct.toFixed(1),
    };
  });
  out.sort((a, b) => b.requests - a.requests);
  return out;
}

/* ---------- chart series ---------- */
export type Granularity = "5m" | "1h" | "1d";
export function granularityFor(windowHours: WindowHours): Granularity {
  if (windowHours === 1) return "5m";
  if (windowHours === 24) return "1h";
  return "1d";
}

export interface ChartPoint { label: string; total: number; failed: number; }
export function getChartData(rows: HourRecord[], windowHours: WindowHours): ChartPoint[] {
  const g = granularityFor(windowHours);
  if (g === "5m") {
    // 12 buckets of 5min from the last hour's data
    const lastHour = TOTAL_HOURS - 1;
    const hr = rows.filter((r) => r.hour === lastHour);
    const totalReq = hr.reduce((a, r) => a + r.requests, 0);
    const totalFail = hr.reduce((a, r) => a + r.failed, 0);
    return Array.from({ length: 12 }, (_, i) => {
      const w = 0.6 + Math.sin((i / 12) * Math.PI) * 0.8;
      const norm = w / 12;
      return {
        label: `${i * 5}m`,
        total: Math.round(totalReq * norm),
        failed: Math.round(totalFail * norm),
      };
    });
  }
  if (g === "1h") {
    const minHour = TOTAL_HOURS - 24;
    return Array.from({ length: 24 }, (_, i) => {
      const h = minHour + i;
      const hr = rows.filter((r) => r.hour === h);
      return {
        label: `${String(h % 24).padStart(2, "0")}:00`,
        total: hr.reduce((a, r) => a + r.requests, 0),
        failed: hr.reduce((a, r) => a + r.failed, 0),
      };
    });
  }
  // daily
  const days = windowHours / 24;
  const startHour = TOTAL_HOURS - windowHours;
  return Array.from({ length: days }, (_, d) => {
    const hStart = startHour + d * 24;
    const hr = rows.filter((r) => r.hour >= hStart && r.hour < hStart + 24);
    return {
      label: `D${d + 1}`,
      total: hr.reduce((a, r) => a + r.requests, 0),
      failed: hr.reduce((a, r) => a + r.failed, 0),
    };
  });
}

export interface RpsPoint { label: string; platformRps: number; peakRps: number; [tenantId: string]: number | string; }
export function getRpsData(
  rows: HourRecord[], windowHours: WindowHours,
  breakdownTenantIds: string[] = []
): { points: RpsPoint[]; avgRps: number; peakRps: number; peakLabel: string; baseline: number; } {
  const points: RpsPoint[] = [];
  const g = granularityFor(windowHours);
  const totalReq = rows.reduce((a, r) => a + r.requests, 0);
  const avgRps = +(totalReq / (windowHours * 3600)).toFixed(2);
  let peakRps = 0;
  let peakLabel = "";

  if (g === "5m") {
    // single-hour, fabricate 12 sub-buckets from peakRps
    const hr = rows.filter((r) => r.hour === TOTAL_HOURS - 1);
    const hourReq = hr.reduce((a, r) => a + r.requests, 0);
    const hourPeak = hr.reduce((a, r) => Math.max(a, r.peakRps), 0);
    for (let i = 0; i < 12; i++) {
      const w = 0.6 + Math.sin((i / 12) * Math.PI) * 0.9;
      const rps = +((hourReq / 3600) * w).toFixed(2);
      const p: RpsPoint = { label: `${i * 5}m`, platformRps: rps, peakRps: hourPeak };
      breakdownTenantIds.forEach((id) => {
        const tr = hr.filter((r) => r.tenantId === id).reduce((a, r) => a + r.requests, 0);
        p[id] = +((tr / 3600) * w).toFixed(2);
      });
      if (rps > peakRps) { peakRps = rps; peakLabel = p.label; }
      points.push(p);
    }
  } else if (g === "1h") {
    const minHour = TOTAL_HOURS - 24;
    for (let i = 0; i < 24; i++) {
      const h = minHour + i;
      const hr = rows.filter((r) => r.hour === h);
      const req = hr.reduce((a, r) => a + r.requests, 0);
      const rps = +(req / 3600).toFixed(2);
      const hourPeak = hr.reduce((a, r) => Math.max(a, r.peakRps), 0);
      const label = `${String(h % 24).padStart(2, "0")}:00`;
      const p: RpsPoint = { label, platformRps: rps, peakRps: hourPeak };
      breakdownTenantIds.forEach((id) => {
        const tr = hr.filter((r) => r.tenantId === id).reduce((a, r) => a + r.requests, 0);
        p[id] = +(tr / 3600).toFixed(2);
      });
      if (hourPeak > peakRps) { peakRps = hourPeak; peakLabel = label; }
      points.push(p);
    }
  } else {
    const days = windowHours / 24;
    const startHour = TOTAL_HOURS - windowHours;
    for (let d = 0; d < days; d++) {
      const hStart = startHour + d * 24;
      const hr = rows.filter((r) => r.hour >= hStart && r.hour < hStart + 24);
      const dayPeak = hr.reduce((a, r) => Math.max(a, r.peakRps), 0);
      const dayReqRps = +(hr.reduce((a, r) => a + r.requests, 0) / (24 * 3600)).toFixed(2);
      const label = `D${d + 1}`;
      const p: RpsPoint = { label, platformRps: dayReqRps, peakRps: dayPeak };
      breakdownTenantIds.forEach((id) => {
        const tr = hr.filter((r) => r.tenantId === id).reduce((a, r) => a + r.requests, 0);
        p[id] = +(tr / (24 * 3600)).toFixed(2);
      });
      if (dayPeak > peakRps) { peakRps = dayPeak; peakLabel = label; }
      points.push(p);
    }
  }
  // 30-day avg baseline (request-rate)
  const allRows = getFilteredData({ windowHours: 720 });
  const baseline = +(allRows.reduce((a, r) => a + r.requests, 0) / (720 * 3600)).toFixed(2);
  return { points, avgRps, peakRps: +peakRps.toFixed(2), peakLabel, baseline };
}

/* ---------- usage concentration (always 30d) ---------- */
export interface ConcentrationRow { id: string; name: string; color: string; requests: number; pct: number; }
export function getUsageConcentration(): ConcentrationRow[] {
  const rows = getFilteredData({ windowHours: 720 });
  const total = rows.reduce((a, r) => a + r.requests, 0) || 1;
  const out: ConcentrationRow[] = TENANTS.map((t) => {
    const requests = rows.filter((r) => r.tenantId === t.id).reduce((a, r) => a + r.requests, 0);
    return { id: t.id, name: t.name, color: t.avatarColor, requests, pct: (requests / total) * 100 };
  });
  // normalise to exactly 100
  const sum = out.reduce((a, r) => a + r.pct, 0);
  if (sum > 0) out.forEach((r) => { r.pct = +(r.pct * (100 / sum)).toFixed(2); });
  out.sort((a, b) => b.pct - a.pct);
  return out;
}

/* ---------- previous-period totals (for KPI deltas) ---------- */
export function getPrevTotals(windowHours: WindowHours, tenantId?: string): Totals {
  const rows = BASE_HOURLY_DATA.filter((r) =>
    r.hour < TOTAL_HOURS - windowHours &&
    r.hour >= TOTAL_HOURS - windowHours * 2 &&
    (!tenantId || r.tenantId === tenantId)
  );
  return getTotals(rows);
}

/* ---------- comparison data (stacked horizontal bars) ---------- */
export interface CompareRow { tenantId: string; name: string; color: string; [svc: string]: number | string; }
export function getCompareData(windowHours: WindowHours, services: string[]): CompareRow[] {
  const rows = getFilteredData({ windowHours });
  return TENANTS.map((t) => {
    const row: CompareRow = { tenantId: t.id, name: t.name, color: t.avatarColor };
    for (const s of services) {
      row[s] = rows.filter((r) => r.tenantId === t.id && r.service === s).reduce((a, r) => a + r.requests, 0);
    }
    return row;
  });
}

/* ---------- service sparkline (last 5 buckets) ---------- */
export function getServiceSparkline(serviceKey: string, windowHours: WindowHours): { v: number; label: string }[] {
  const g = granularityFor(windowHours);
  const allSvc = BASE_HOURLY_DATA.filter((r) => r.service === serviceKey);
  const out: { v: number; label: string }[] = [];
  if (g === "5m") {
    // synthesize 5 buckets across last hour
    const lastHour = TOTAL_HOURS - 1;
    const hr = allSvc.filter((r) => r.hour === lastHour);
    const total = hr.reduce((a, r) => a + r.requests, 0);
    for (let i = 0; i < 5; i++) {
      const w = 0.6 + Math.sin(((i + 1) / 6) * Math.PI) * 0.8;
      out.push({ v: Math.round((total / 5) * w), label: `${i * 12}–${(i + 1) * 12}m ago` });
    }
    return out;
  }
  if (g === "1h") {
    for (let i = 4; i >= 0; i--) {
      const h = TOTAL_HOURS - 1 - i;
      const hr = allSvc.filter((r) => r.hour === h);
      out.push({
        v: hr.reduce((a, r) => a + r.requests, 0),
        label: `${String(h % 24).padStart(2, "0")}:00`,
      });
    }
    return out;
  }
  // daily — last 5 days
  for (let i = 4; i >= 0; i--) {
    const hStart = TOTAL_HOURS - (i + 1) * 24;
    const hr = allSvc.filter((r) => r.hour >= hStart && r.hour < hStart + 24);
    out.push({
      v: hr.reduce((a, r) => a + r.requests, 0),
      label: `${i === 0 ? "today" : i + "d ago"}`,
    });
  }
  return out;
}

/* ---------- top tenants by throughput ---------- */
export function getTopTenantsByRps(windowHours: WindowHours, n = 3) {
  const rows = getFilteredData({ windowHours });
  const arr = TENANTS.map((t) => {
    const tr = rows.filter((r) => r.tenantId === t.id);
    const reqs = tr.reduce((a, r) => a + r.requests, 0);
    return {
      tenant: t,
      avgRps: +(reqs / (windowHours * 3600)).toFixed(2),
      peakRps: tr.reduce((a, r) => Math.max(a, r.peakRps), 0),
    };
  });
  arr.sort((a, b) => b.avgRps - a.avgRps);
  return arr.slice(0, n);
}

/* ---------- heatmap matrix ---------- */
export interface HeatmapCell { tenantId: string; serviceKey: string; requests: number; pctOfTenant: number; }
export function getHeatmap(windowHours: WindowHours, services: string[]) {
  const rows = getFilteredData({ windowHours });
  const matrix: Record<string, Record<string, number>> = {};
  const tenantTotals: Record<string, number> = {};
  for (const t of TENANTS) {
    matrix[t.id] = {};
    for (const s of services) {
      const v = rows.filter((r) => r.tenantId === t.id && r.service === s).reduce((a, r) => a + r.requests, 0);
      matrix[t.id][s] = v;
      tenantTotals[t.id] = (tenantTotals[t.id] || 0) + v;
    }
  }
  let max = 0;
  for (const t of TENANTS) for (const s of services) max = Math.max(max, matrix[t.id][s]);
  return { matrix, tenantTotals, max };
}
