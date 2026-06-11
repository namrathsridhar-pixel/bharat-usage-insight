// Dummy data for Usage & Metering dashboard
export type TimeWindow = "1h" | "24h" | "7d" | "30d" | "custom";
export type Role = "platform_admin" | "tenant_admin";
export type Plan = "Enterprise" | "Pro" | "Standard" | "Starter";

export interface ServiceDef {
  key: string;
  name: string;
  unit: string;
  unitShort: string;
  color: string;
  icon: string;
}

export const SERVICES: ServiceDef[] = [
  { key: "NMT", name: "NMT", unit: "Characters translated", unitShort: "chars", color: "#10B981", icon: "translate" },
  { key: "ASR", name: "ASR", unit: "Audio minutes processed", unitShort: "min", color: "#F87171", icon: "mic" },
  { key: "TTS", name: "TTS", unit: "Characters synthesized", unitShort: "chars", color: "#60A5FA", icon: "speaker" },
  { key: "LLM", name: "LLM", unit: "Tokens processed", unitShort: "tokens", color: "#F472B6", icon: "sparkle" },
  { key: "OCR", name: "OCR", unit: "Pages / Images processed", unitShort: "pages", color: "#2DD4BF", icon: "file" },
  { key: "Pipeline", name: "Pipeline", unit: "Jobs executed", unitShort: "jobs", color: "#A78BFA", icon: "wave" },
  { key: "Transliteration", name: "Transliteration", unit: "Characters processed", unitShort: "chars", color: "#A3E635", icon: "arrows" },
  { key: "NER", name: "NER", unit: "Requests processed", unitShort: "req", color: "#C084FC", icon: "tag" },
  { key: "LanguageDetection", name: "Language Detection", unit: "Requests processed", unitShort: "req", color: "#FB923C", icon: "globe" },
  { key: "SpeakerDiarization", name: "Speaker Diarization", unit: "Audio minutes processed", unitShort: "min", color: "#94A3B8", icon: "people" },
];

export interface Tenant {
  id: string;
  name: string;
  plan: Plan;
  share: number; // share of platform usage
  avatarColor: string;
  active24h: boolean;
  active7d: boolean;
  newWithin7d: boolean;
}

export const TENANTS: Tenant[] = [
  { id: "t1", name: "Bhashini Programme", plan: "Enterprise", share: 0.40, avatarColor: "#1A3C5E", active24h: true, active7d: true, newWithin7d: false },
  { id: "t2", name: "Ministry of Education", plan: "Enterprise", share: 0.20, avatarColor: "#0D7C6E", active24h: true, active7d: true, newWithin7d: false },
  { id: "t3", name: "IIIT Hyderabad", plan: "Pro", share: 0.12, avatarColor: "#A78BFA", active24h: true, active7d: true, newWithin7d: false },
  { id: "t4", name: "Prasar Bharati", plan: "Pro", share: 0.09, avatarColor: "#F472B6", active24h: true, active7d: true, newWithin7d: false },
  { id: "t5", name: "Tamil Nadu e-Governance", plan: "Standard", share: 0.07, avatarColor: "#FB923C", active24h: true, active7d: true, newWithin7d: false },
  { id: "t6", name: "Doordarshan Digital", plan: "Standard", share: 0.04, avatarColor: "#60A5FA", active24h: true, active7d: true, newWithin7d: false },
  { id: "t7", name: "NCERT Digital", plan: "Standard", share: 0.03, avatarColor: "#2DD4BF", active24h: false, active7d: true, newWithin7d: true },
  { id: "t8", name: "Kerala IT Mission", plan: "Standard", share: 0.02, avatarColor: "#10B981", active24h: true, active7d: true, newWithin7d: false },
  { id: "t9", name: "Assam NIC Unit", plan: "Starter", share: 0.02, avatarColor: "#C084FC", active24h: false, active7d: true, newWithin7d: true },
  { id: "t10", name: "Meghalaya e-District", plan: "Starter", share: 0.01, avatarColor: "#94A3B8", active24h: false, active7d: false, newWithin7d: false },
];

const WINDOW_SCALE: Record<TimeWindow, number> = {
  "1h": 1,
  "24h": 22,
  "7d": 150,
  "30d": 620,
  "custom": 280,
};

// Platform total requests baseline (24h)
const PLATFORM_BASE_24H = 12_50_000; // 12.5 lakh

function seededRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Service distribution weights (NMT & ASR highest, SpeakerDiarization lowest)
const SERVICE_WEIGHTS: Record<string, number> = {
  NMT: 0.24, ASR: 0.22, TTS: 0.10, LLM: 0.13, OCR: 0.08,
  Pipeline: 0.06, Transliteration: 0.06, NER: 0.05,
  LanguageDetection: 0.04, SpeakerDiarization: 0.02,
};

const UNIT_MULT: Record<string, number> = {
  chars: 220, tokens: 480, min: 1.8, pages: 1, jobs: 1, req: 1,
};

export interface ServiceUsage {
  service: string;
  totalRequests: number;
  successful: number;
  failed: number;
  units: number;
  unitShort: string;
  quotaUsed: number;
  quotaLimit: number;
  avgRps: number;
  peakRps: number;
  peakTimestamp: string;
  failRate: number;
  sparkline: number[];
}

export interface TenantUsageSnapshot {
  tenantId: string;
  totalRequests: number;
  successful: number;
  failed: number;
  failRate: number;
  successRate: number;
  avgRps: number;
  peakRps: number;
  peakTimestamp: string;
  topService: string;
  quotaUsed: number;
  quotaLimit: number;
  services: ServiceUsage[];
}

const PEAK_TS_POOL = [
  "Jun 8, 14:32", "Jun 9, 11:08", "Jun 10, 09:47", "Jun 7, 16:21",
  "Jun 6, 12:55", "Jun 9, 18:03", "Jun 10, 07:14", "Jun 8, 20:40",
];

export function getTenantUsage(tenant: Tenant, window: TimeWindow): TenantUsageSnapshot {
  const scale = WINDOW_SCALE[window];
  const totalPlatform = PLATFORM_BASE_24H * scale / WINDOW_SCALE["24h"];
  const tenantTotal = Math.floor(totalPlatform * tenant.share);
  const rand = seededRand(tenant.id.charCodeAt(1) * 137 + scale);

  const services: ServiceUsage[] = SERVICES.map((s, i) => {
    const w = SERVICE_WEIGHTS[s.key];
    const jitter = 0.7 + rand() * 0.6;
    const total = Math.max(0, Math.floor(tenantTotal * w * jitter));
    const failRate = 0.01 + rand() * 0.03;
    const failed = Math.floor(total * failRate);
    const successful = total - failed;
    const units = Math.floor(total * (UNIT_MULT[s.unitShort] || 1));
    const quotaLimit = Math.floor(total / (0.35 + rand() * 0.55));
    const quotaUsed = total;
    const seconds = window === "1h" ? 3600 : window === "24h" ? 86400 : window === "7d" ? 604800 : 2592000;
    const avgRps = +(total / seconds).toFixed(2);
    const peakRps = +(avgRps * (3.5 + rand() * 3)).toFixed(2);
    const sparkline = Array.from({ length: 7 }, () => Math.floor(total / 7 * (0.5 + rand() * 1.0)));
    return {
      service: s.key,
      totalRequests: total,
      successful, failed, units,
      unitShort: s.unitShort,
      quotaUsed, quotaLimit,
      avgRps, peakRps,
      peakTimestamp: PEAK_TS_POOL[(i + tenant.id.charCodeAt(1)) % PEAK_TS_POOL.length],
      failRate, sparkline,
    };
  });

  const totalRequests = services.reduce((a, x) => a + x.totalRequests, 0);
  const successful = services.reduce((a, x) => a + x.successful, 0);
  const failed = totalRequests - successful;
  const topService = [...services].sort((a, b) => b.totalRequests - a.totalRequests)[0]?.service ?? "NMT";
  const seconds = window === "1h" ? 3600 : window === "24h" ? 86400 : window === "7d" ? 604800 : 2592000;
  const avgRps = +(totalRequests / seconds).toFixed(2);
  const peakRps = +Math.max(...services.map((s) => s.peakRps)).toFixed(2);
  const quotaLimit = services.reduce((a, x) => a + x.quotaLimit, 0);
  const quotaUsed = services.reduce((a, x) => a + x.quotaUsed, 0);

  return {
    tenantId: tenant.id, totalRequests, successful, failed,
    failRate: failed / Math.max(1, totalRequests),
    successRate: successful / Math.max(1, totalRequests),
    avgRps, peakRps,
    peakTimestamp: services[0].peakTimestamp,
    topService, quotaUsed, quotaLimit, services,
  };
}

export interface TimeSeriesPoint {
  label: string;
  total: number;
  successful: number;
  failed: number;
  rps: number;
}

export function getTimeSeries(window: TimeWindow, tenants: Tenant[]): TimeSeriesPoint[] {
  const buckets = window === "1h" ? 12 : window === "24h" ? 24 : window === "7d" ? 7 : 30;
  const labels: string[] = [];
  if (window === "1h") for (let i = 0; i < 12; i++) labels.push(`${i * 5}m`);
  else if (window === "24h") for (let i = 0; i < 24; i++) labels.push(`${String(i).padStart(2, "0")}:00`);
  else if (window === "7d") ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach((d) => labels.push(d));
  else for (let i = 0; i < 30; i++) labels.push(`D${i + 1}`);

  const rand = seededRand(tenants.map((t) => t.id.charCodeAt(1)).reduce((a, b) => a + b, 0) + buckets);
  const totalUsage = tenants.reduce((acc, t) => {
    return acc + getTenantUsage(t, window).totalRequests;
  }, 0);
  const seconds = window === "1h" ? 3600 : window === "24h" ? 86400 : window === "7d" ? 604800 : 2592000;

  return labels.map((label) => {
    const factor = 0.5 + rand() * 1.1;
    const total = Math.floor((totalUsage / buckets) * factor);
    const failed = Math.floor(total * (0.02 + rand() * 0.03));
    return {
      label, total,
      successful: total - failed,
      failed,
      rps: +((total / (seconds / buckets))).toFixed(2),
    };
  });
}

// Per-tenant RPS series (for throughput chart)
export function getTenantRpsSeries(tenant: Tenant, window: TimeWindow) {
  return getTimeSeries(window, [tenant]).map((p) => ({ label: p.label, rps: p.rps }));
}

// Per-service trend series (for usage trend chart)
export function getServiceTrendSeries(window: TimeWindow, tenants: Tenant[]) {
  const buckets = window === "1h" ? 12 : window === "24h" ? 24 : window === "7d" ? 7 : 30;
  const labels: string[] = [];
  if (window === "1h") for (let i = 0; i < 12; i++) labels.push(`${i * 5}m`);
  else if (window === "24h") for (let i = 0; i < 24; i++) labels.push(`${String(i).padStart(2, "0")}:00`);
  else if (window === "7d") ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach((d) => labels.push(d));
  else for (let i = 0; i < 30; i++) labels.push(`D${i + 1}`);

  // Aggregate service totals across tenants for selected window
  const serviceTotals: Record<string, number> = {};
  SERVICES.forEach((s) => (serviceTotals[s.key] = 0));
  tenants.forEach((t) => {
    getTenantUsage(t, window).services.forEach((s) => {
      serviceTotals[s.service] += s.totalRequests;
    });
  });

  return labels.map((label, i) => {
    const r = seededRand(i * 11 + buckets);
    const row: Record<string, any> = { label };
    SERVICES.forEach((s) => {
      const factor = 0.55 + r() * 1.0;
      row[s.key] = Math.floor((serviceTotals[s.key] / buckets) * factor);
    });
    return row;
  });
}

// Indian number formatting (1,23,456)
export function formatIndian(n: number): string {
  if (n === 0) return "0";
  const isNeg = n < 0;
  const abs = Math.abs(Math.floor(n));
  const s = abs.toString();
  if (s.length <= 3) return (isNeg ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (isNeg ? "-" : "") + withCommas + "," + last3;
}

export function formatCompact(n: number): string {
  if (n >= 1_00_00_000) return (n / 1_00_00_000).toFixed(2) + " Cr";
  if (n >= 1_00_000) return (n / 1_00_000).toFixed(2) + " L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export function getServiceByKey(k: string) {
  return SERVICES.find((s) => s.key === k)!;
}
