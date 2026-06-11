// Single-source-of-truth event log for Usage & Metering.
// 720 hours x 10 tenants x 10 services. Generated deterministically once.

export interface HourRecord {
  hour: number; // 0 = oldest, 719 = most recent
  tenantId: string;
  service: string;
  requests: number;
  successful: number;
  failed: number;
  nativeUnits: number;
  peakRps: number;
}

export interface TenantMeta {
  id: string;
  name: string;
  plan: "Enterprise" | "Pro" | "Standard" | "Starter";
  share: number;       // fraction of platform requests
  avatarColor: string;
  lastActiveHour: number; // up to which hour this tenant emits
}

export interface ServiceMeta {
  key: string;
  name: string;
  unit: string;       // human-readable
  unitShort: string;  // chars/min/tokens etc
  color: string;
  share: number;      // fraction of tenant requests
  failRate: number;
  unitsPerRequest: number;
}

export const TENANTS: TenantMeta[] = [
  { id: "t1",  name: "Bhashini Programme",       plan: "Enterprise", share: 0.420, avatarColor: "#F97316", lastActiveHour: 719 },
  { id: "t2",  name: "Ministry of Education",    plan: "Enterprise", share: 0.190, avatarColor: "#3B82F6", lastActiveHour: 719 },
  { id: "t3",  name: "IIIT Hyderabad",           plan: "Pro",        share: 0.120, avatarColor: "#10B981", lastActiveHour: 719 },
  { id: "t4",  name: "Prasar Bharati",           plan: "Pro",        share: 0.090, avatarColor: "#8B5CF6", lastActiveHour: 719 },
  { id: "t5",  name: "Tamil Nadu e-Governance",  plan: "Standard",   share: 0.070, avatarColor: "#EC4899", lastActiveHour: 719 },
  { id: "t6",  name: "Doordarshan Digital",      plan: "Standard",   share: 0.040, avatarColor: "#06B6D4", lastActiveHour: 719 },
  { id: "t7",  name: "NCERT Digital",            plan: "Standard",   share: 0.030, avatarColor: "#F59E0B", lastActiveHour: 719 },
  { id: "t8",  name: "Kerala IT Mission",        plan: "Standard",   share: 0.020, avatarColor: "#6366F1", lastActiveHour: 719 },
  { id: "t9",  name: "Assam NIC Unit",           plan: "Starter",    share: 0.015, avatarColor: "#84CC16", lastActiveHour: 719 },
  { id: "t10", name: "Meghalaya e-District",     plan: "Starter",    share: 0.005, avatarColor: "#94A3B8", lastActiveHour: 671 },
];

export const SERVICES: ServiceMeta[] = [
  { key: "NMT",                name: "NMT",                 unit: "Characters translated",    unitShort: "chars",  color: "#10B981", share: 0.23, failRate: 0.021, unitsPerRequest: 180 },
  { key: "ASR",                name: "ASR",                 unit: "Audio minutes processed",  unitShort: "min",    color: "#F87171", share: 0.18, failRate: 0.032, unitsPerRequest: 5 },
  { key: "TTS",                name: "TTS",                 unit: "Characters synthesized",   unitShort: "chars",  color: "#60A5FA", share: 0.14, failRate: 0.018, unitsPerRequest: 200 },
  { key: "LLM",                name: "LLM",                 unit: "Tokens processed",         unitShort: "tokens", color: "#F472B6", share: 0.13, failRate: 0.041, unitsPerRequest: 320 },
  { key: "OCR",                name: "OCR",                 unit: "Pages / Images processed", unitShort: "pages",  color: "#2DD4BF", share: 0.10, failRate: 0.026, unitsPerRequest: 4 },
  { key: "Transliteration",    name: "Transliteration",     unit: "Characters processed",     unitShort: "chars",  color: "#A3E635", share: 0.08, failRate: 0.014, unitsPerRequest: 150 },
  { key: "Pipeline",           name: "Pipeline",            unit: "Jobs executed",            unitShort: "jobs",   color: "#A78BFA", share: 0.06, failRate: 0.038, unitsPerRequest: 3 },
  { key: "NER",                name: "NER",                 unit: "Requests processed",       unitShort: "req",    color: "#C084FC", share: 0.05, failRate: 0.029, unitsPerRequest: 1 },
  { key: "LanguageDetection",  name: "Language Detection",  unit: "Requests processed",       unitShort: "req",    color: "#FB923C", share: 0.02, failRate: 0.012, unitsPerRequest: 1 },
  { key: "SpeakerDiarization", name: "Speaker Diarization", unit: "Audio minutes processed",  unitShort: "min",    color: "#94A3B8", share: 0.01, failRate: 0.035, unitsPerRequest: 8 },
];

export const PLATFORM_BASELINE_HOURLY = 48_000;
export const TOTAL_HOURS = 720;

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todMultiplier(hourOfDay: number) {
  if (hourOfDay < 6)  return 0.40;
  if (hourOfDay < 9)  return 0.70 + ((hourOfDay - 6) / 3) * 0.30;
  if (hourOfDay < 18) return 1.00 + ((hourOfDay - 9) / 9) * 0.30;
  if (hourOfDay < 21) return 1.00 - ((hourOfDay - 18) / 3) * 0.20;
  return 0.80 - ((hourOfDay - 21) / 3) * 0.20;
}

function buildLog(): HourRecord[] {
  const rand = mulberry(20260611);
  const out: HourRecord[] = [];
  // peak spike at hour 715 — boost platform total to land peakRps ~18.7 req/s
  const PEAK_HOUR = 715;

  for (let h = 0; h < TOTAL_HOURS; h++) {
    const hourOfDay = h % 24;
    let platformHourly = PLATFORM_BASELINE_HOURLY * todMultiplier(hourOfDay);
    platformHourly *= 0.85 + rand() * 0.30; // ±15%
    if (h === PEAK_HOUR) platformHourly *= 1.4;

    for (const t of TENANTS) {
      const active = h <= t.lastActiveHour;
      const tenantHourly = active ? platformHourly * t.share : 0;
      for (const s of SERVICES) {
        const svcHourly = tenantHourly * s.share * (0.92 + rand() * 0.16);
        const requests = Math.max(0, Math.round(svcHourly));
        const failed = Math.round(requests * s.failRate);
        const successful = requests - failed;
        const nativeUnits = requests * s.unitsPerRequest;
        const avgRps = requests / 3600;
        const peakBoost = h === PEAK_HOUR ? 3.2 + rand() * 0.8 : 2.5 + rand();
        const peakRps = +(avgRps * peakBoost).toFixed(3);
        out.push({ hour: h, tenantId: t.id, service: s.key, requests, successful, failed, nativeUnits, peakRps });
      }
    }
  }
  return out;
}

export const BASE_HOURLY_DATA: HourRecord[] = buildLog();

/** Append simulated new records for the most-recent hour. Called by live tick. */
export function appendLiveTick() {
  const lastHour = TOTAL_HOURS - 1;
  const delta = 200 + Math.floor(Math.random() * 600); // total extra requests for this tick
  // distribute across active tenants by share, then across services by share
  const activeTenants = TENANTS.filter((t) => lastHour <= t.lastActiveHour);
  const totalShare = activeTenants.reduce((a, t) => a + t.share, 0) || 1;
  for (const t of activeTenants) {
    const tDelta = delta * (t.share / totalShare);
    for (const s of SERVICES) {
      const sDelta = Math.round(tDelta * s.share);
      if (sDelta <= 0) continue;
      const rec = BASE_HOURLY_DATA.find((r) => r.hour === lastHour && r.tenantId === t.id && r.service === s.key);
      if (!rec) continue;
      const failed = Math.round(sDelta * s.failRate);
      rec.requests += sDelta;
      rec.failed += failed;
      rec.successful += sDelta - failed;
      rec.nativeUnits += sDelta * s.unitsPerRequest;
    }
  }
}
