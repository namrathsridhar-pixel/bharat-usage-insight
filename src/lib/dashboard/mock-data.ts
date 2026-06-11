export type Role = "adopter_admin" | "tenant_admin";
export type TimeWindow = "1h" | "24h" | "7d" | "30d";

export const SERVICES = [
  { key: "NMT", unit: "Characters translated", unitShort: "chars" },
  { key: "ASR", unit: "Audio minutes processed", unitShort: "min" },
  { key: "TTS", unit: "Characters synthesized", unitShort: "chars" },
  { key: "LLM", unit: "Tokens processed", unitShort: "tokens" },
  { key: "OCR", unit: "Pages / Images processed", unitShort: "pages" },
  { key: "Pipeline", unit: "Jobs executed", unitShort: "jobs" },
  { key: "Transliteration", unit: "Characters processed", unitShort: "chars" },
  { key: "NER", unit: "Characters processed", unitShort: "chars" },
  { key: "Text Language Detection", unit: "Characters processed", unitShort: "chars" },
  { key: "Speaker Diarization", unit: "Audio minutes processed", unitShort: "min" },
  { key: "Audio Language Detection", unit: "Audio minutes processed", unitShort: "min" },
] as const;

export const TENANTS = [
  { id: "t1", name: "Ministry of Education" },
  { id: "t2", name: "Bharat Digital Services" },
  { id: "t3", name: "NIC Karnataka" },
  { id: "t4", name: "Akshara EdTech" },
  { id: "t5", name: "Sahayak Health Pvt Ltd" },
];

// Deterministic pseudo-random
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const WINDOW_BUCKETS: Record<TimeWindow, { count: number; label: (i: number) => string }> = {
  "1h": { count: 12, label: (i) => `${i * 5}m` },
  "24h": { count: 24, label: (i) => `${i}:00` },
  "7d": { count: 7, label: (i) => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i] },
  "30d": { count: 30, label: (i) => `D${i + 1}` },
};

export interface TenantServicePoint {
  tenantId: string;
  service: string;
  total: number;
  successful: number;
  failed: number;
  units: number;
}

export interface BucketData {
  bucket: string;
  total: number;
  successful: number;
  failed: number;
}

export function getMockData(window: TimeWindow, role: Role, scopedTenantId?: string) {
  const cfg = WINDOW_BUCKETS[window];
  const scaleMap = { "1h": 1, "24h": 10, "7d": 60, "30d": 220 };
  const scale = scaleMap[window];
  const r = rand(42);

  const tenants = role === "tenant_admin" && scopedTenantId
    ? TENANTS.filter((t) => t.id === scopedTenantId)
    : TENANTS;

  // Per-tenant per-service aggregate
  const rows: TenantServicePoint[] = [];
  TENANTS.forEach((t, ti) => {
    SERVICES.forEach((s, si) => {
      const base = Math.floor((100 + r() * 900) * scale * (1 + ti * 0.3));
      const failed = Math.floor(base * (0.02 + r() * 0.06));
      const successful = base - failed;
      const unitMul = s.unitShort === "chars" ? 180 : s.unitShort === "tokens" ? 320 : s.unitShort === "min" ? 1.5 : 1;
      rows.push({
        tenantId: t.id,
        service: s.key,
        total: base,
        successful,
        failed,
        units: Math.floor(base * unitMul),
      });
    });
  });

  const scopedRows = role === "tenant_admin" && scopedTenantId
    ? rows.filter((r) => r.tenantId === scopedTenantId)
    : rows;

  // Time-bucketed totals (respecting scope)
  const r2 = rand(100);
  const buckets: BucketData[] = Array.from({ length: cfg.count }, (_, i) => {
    const totalReqs = scopedRows.reduce((acc, x) => acc + x.total, 0);
    const factor = 0.6 + r2() * 0.8;
    const total = Math.floor((totalReqs / cfg.count) * factor);
    const failed = Math.floor(total * (0.03 + r2() * 0.05));
    return { bucket: cfg.label(i), total, successful: total - failed, failed };
  });

  // Per tenant time series
  const tenantSeries = tenants.map((t) => {
    const r3 = rand(t.id.charCodeAt(1) * 17);
    const tenantTotal = scopedRows.filter((x) => x.tenantId === t.id).reduce((a, x) => a + x.total, 0);
    const series = Array.from({ length: cfg.count }, (_, i) => {
      const factor = 0.5 + r3() * 0.9;
      return { bucket: cfg.label(i), rps: +((tenantTotal / cfg.count) * factor / 60).toFixed(2) };
    });
    return { tenantId: t.id, name: t.name, series, peakRps: Math.max(...series.map((s) => s.rps)) };
  });

  // Overall RPS
  const overallSeries = buckets.map((b) => ({ bucket: b.bucket, rps: +(b.total / 60).toFixed(2) }));
  const peakRps = Math.max(...overallSeries.map((s) => s.rps));

  // Tenant totals (for top-N)
  const tenantTotals = TENANTS.map((t) => ({
    tenantId: t.id,
    name: t.name,
    total: rows.filter((r) => r.tenantId === t.id).reduce((a, x) => a + x.total, 0),
  })).sort((a, b) => b.total - a.total);

  const totalRequests = tenantTotals.reduce((a, x) => a + x.total, 0);

  return {
    tenants,
    rows: scopedRows,
    allRows: rows,
    buckets,
    tenantSeries,
    overallSeries,
    peakRps,
    tenantTotals,
    totalRequests,
    // Tenant adoption (platform-wide)
    adoption: {
      total: TENANTS.length,
      active24h: 4,
      active7d: 5,
      active30d: 5,
      new7d: 1,
      avgRequestsPerTenant: Math.floor(totalRequests / TENANTS.length),
      avgTrendPct: 8.4,
    },
  };
}
