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
  /** native units produced per inference request (real-world ratios) */
  unitsPerRequest: number;
}

export const SERVICES: ServiceDef[] = [
  { key: "NMT",                name: "NMT",                  unit: "Characters translated",     unitShort: "chars",  color: "#10B981", unitsPerRequest: 180 },
  { key: "ASR",                name: "ASR",                  unit: "Audio minutes processed",   unitShort: "min",    color: "#F87171", unitsPerRequest: 5 },
  { key: "TTS",                name: "TTS",                  unit: "Characters synthesized",    unitShort: "chars",  color: "#60A5FA", unitsPerRequest: 200 },
  { key: "LLM",                name: "LLM",                  unit: "Tokens processed",          unitShort: "tokens", color: "#F472B6", unitsPerRequest: 320 },
  { key: "OCR",                name: "OCR",                  unit: "Images processed",          unitShort: "images", color: "#2DD4BF", unitsPerRequest: 4 },
  { key: "Pipeline",           name: "Pipeline",             unit: "Jobs executed",             unitShort: "jobs",   color: "#A78BFA", unitsPerRequest: 3 },
  { key: "Transliteration",    name: "Transliteration",      unit: "Characters processed",      unitShort: "chars",  color: "#A3E635", unitsPerRequest: 150 },
  { key: "NER",                name: "NER",                  unit: "Characters processed",      unitShort: "chars",  color: "#C084FC", unitsPerRequest: 120 },
  { key: "LanguageDetection",  name: "Language Detection",   unit: "Characters processed",      unitShort: "chars",  color: "#FB923C", unitsPerRequest: 80 },
  { key: "SpeakerDiarization", name: "Speaker Diarization",  unit: "Audio minutes processed",   unitShort: "min",    color: "#94A3B8", unitsPerRequest: 8 },
];

export interface Tenant {
  id: string;
  name: string;
  plan: Plan;
  share: number;
  avatarColor: string;
  active24h: boolean;
  active7d: boolean;
  newWithin7d: boolean;
}

export const TENANTS: Tenant[] = [
  { id: "t1",  name: "Bhashini Programme",       plan: "Enterprise", share: 0.40, avatarColor: "#1A3C5E", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t2",  name: "Ministry of Education",    plan: "Enterprise", share: 0.20, avatarColor: "#0D7C6E", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t3",  name: "IIIT Hyderabad",           plan: "Pro",        share: 0.12, avatarColor: "#A78BFA", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t4",  name: "Prasar Bharati",           plan: "Pro",        share: 0.09, avatarColor: "#F472B6", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t5",  name: "Tamil Nadu e-Governance",  plan: "Standard",   share: 0.07, avatarColor: "#FB923C", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t6",  name: "Doordarshan Digital",      plan: "Standard",   share: 0.04, avatarColor: "#60A5FA", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t7",  name: "NCERT Digital",            plan: "Standard",   share: 0.03, avatarColor: "#2DD4BF", active24h: false, active7d: true,  newWithin7d: true  },
  { id: "t8",  name: "Kerala IT Mission",        plan: "Standard",   share: 0.02, avatarColor: "#10B981", active24h: true,  active7d: true,  newWithin7d: false },
  { id: "t9",  name: "Assam NIC Unit",           plan: "Starter",    share: 0.02, avatarColor: "#C084FC", active24h: false, active7d: true,  newWithin7d: true  },
  { id: "t10", name: "Meghalaya e-District",     plan: "Starter",    share: 0.01, avatarColor: "#94A3B8", active24h: false, active7d: false, newWithin7d: false },
];

// Hour-equivalent scale. 24h is base, others scale proportionally.
const WINDOW_HOURS: Record<TimeWindow, number> = {
  "1h": 1, "24h": 24, "7d": 24 * 7, "30d": 24 * 30, "custom": 24 * 14,
};

const PLATFORM_BASE_24H = 12_50_000;

function seededRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const SERVICE_WEIGHTS: Record<string, number> = {
  NMT: 0.24, ASR: 0.22, TTS: 0.10, LLM: 0.13, OCR: 0.08,
  Pipeline: 0.06, Transliteration: 0.06, NER: 0.05,
  LanguageDetection: 0.04, SpeakerDiarization: 0.02,
};

export interface ServiceUsage {
  service: string;
  totalRequests: number;
  successful: number;
  failed: number;
  units: number;
  unitShort: string;
  avgRps: number;
  peakRps: number;
  peakTimestamp: string;
  failRate: number;
  successRate: number;
  trendPct: number; // % change vs previous period
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
  services: ServiceUsage[];
}

const PEAK_TS_POOL = [
  "Jun 8, 14:32", "Jun 9, 11:08", "Jun 10, 09:47", "Jun 7, 16:21",
  "Jun 6, 12:55", "Jun 9, 18:03", "Jun 10, 07:14", "Jun 8, 20:40",
];

function getWindowSeconds(window: TimeWindow) {
  return WINDOW_HOURS[window] * 3600;
}

export function getTenantUsage(tenant: Tenant, window: TimeWindow): TenantUsageSnapshot {
  const hours = WINDOW_HOURS[window];
  const platformTotal = PLATFORM_BASE_24H * (hours / 24);
  const tenantTotal = Math.floor(platformTotal * tenant.share);
  const rand = seededRand(tenant.id.charCodeAt(1) * 137 + hours);

  const seconds = getWindowSeconds(window);

  const services: ServiceUsage[] = SERVICES.map((s, i) => {
    const w = SERVICE_WEIGHTS[s.key];
    const jitter = 0.78 + rand() * 0.44;
    const total = Math.max(0, Math.floor(tenantTotal * w * jitter));
    const failRate = 0.008 + rand() * 0.032;
    const failed = Math.floor(total * failRate);
    const successful = total - failed;
    const units = Math.floor(total * s.unitsPerRequest);
    const avgRps = +(total / seconds).toFixed(2);
    // Avg must be 25-40% of peak  ->  peak = avg / (0.25..0.40)
    const ratio = 0.25 + rand() * 0.15;
    const peakRps = +(avgRps / ratio).toFixed(2);
    const trendPct = +((rand() - 0.4) * 30).toFixed(1); // -12 .. +18 ish
    return {
      service: s.key,
      totalRequests: total, successful, failed,
      units, unitShort: s.unitShort,
      avgRps, peakRps,
      peakTimestamp: PEAK_TS_POOL[(i + tenant.id.charCodeAt(1)) % PEAK_TS_POOL.length],
      failRate, successRate: 1 - failRate, trendPct,
    };
  });

  const totalRequests = services.reduce((a, x) => a + x.totalRequests, 0);
  const successful = services.reduce((a, x) => a + x.successful, 0);
  const failed = totalRequests - successful;
  const topService = [...services].sort((a, b) => b.totalRequests - a.totalRequests)[0]?.service ?? "NMT";
  const avgRps = +(totalRequests / seconds).toFixed(2);
  const peakRand = seededRand(tenant.id.charCodeAt(1) * 31 + hours)();
  const ratio = 0.25 + peakRand * 0.15;
  const peakRps = +(avgRps / ratio).toFixed(2);

  return {
    tenantId: tenant.id, totalRequests, successful, failed,
    failRate: failed / Math.max(1, totalRequests),
    successRate: successful / Math.max(1, totalRequests),
    avgRps, peakRps,
    peakTimestamp: services[0].peakTimestamp,
    topService, services,
  };
}

export interface TimeSeriesPoint {
  label: string;
  total: number;
  successful: number;
  failed: number;
  rps: number;
}

function bucketsFor(window: TimeWindow): { labels: string[]; bucketSeconds: number } {
  let labels: string[] = [];
  if (window === "1h") for (let i = 0; i < 12; i++) labels.push(`${i * 5}m`);
  else if (window === "24h") for (let i = 0; i < 24; i++) labels.push(`${String(i).padStart(2, "0")}:00`);
  else if (window === "7d") labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  else if (window === "30d") for (let i = 0; i < 30; i++) labels.push(`D${i + 1}`);
  else for (let i = 0; i < 14; i++) labels.push(`D${i + 1}`);
  return { labels, bucketSeconds: getWindowSeconds(window) / labels.length };
}

export function getTimeSeries(window: TimeWindow, tenants: Tenant[]): TimeSeriesPoint[] {
  const { labels, bucketSeconds } = bucketsFor(window);
  const totalUsage = tenants.reduce((acc, t) => acc + getTenantUsage(t, window).totalRequests, 0);
  const rand = seededRand(tenants.map((t) => t.id.charCodeAt(1)).reduce((a, b) => a + b, 0) + labels.length);

  return labels.map((label) => {
    const factor = 0.55 + rand() * 1.0;
    const total = Math.floor((totalUsage / labels.length) * factor);
    const failed = Math.floor(total * (0.015 + rand() * 0.025));
    return {
      label, total,
      successful: total - failed,
      failed,
      rps: +((total / bucketSeconds)).toFixed(2),
    };
  });
}

export function getTenantRpsSeries(tenant: Tenant, window: TimeWindow) {
  return getTimeSeries(window, [tenant]).map((p) => ({ label: p.label, rps: p.rps }));
}

export function getServiceTrendBars(service: string, window: TimeWindow, count?: number) {
  const { labels } = bucketsFor(window);
  const n = count ?? labels.length;
  const r = seededRand(service.charCodeAt(0) * 53 + n);
  return Array.from({ length: n }, () => Math.floor(40 + r() * 100));
}

export function formatIndian(n: number): string {
  if (!isFinite(n)) return "0";
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
