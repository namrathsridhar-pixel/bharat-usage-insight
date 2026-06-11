// Single-source-of-truth event log for Usage & Metering.
// 720 hours x 47 tenants x 10 services. Generated deterministically once.

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

export type TenantCategory =
  | "Central Government"
  | "State Government"
  | "Academic & Research"
  | "PSU & Public Enterprise"
  | "Private & NGO";

export interface TenantMeta {
  id: string;
  name: string;
  category: TenantCategory;
  plan: "Enterprise" | "Pro" | "Standard" | "Starter";
  share: number;             // fraction of platform requests
  avatarColor: string;
  firstActiveHour: number;   // hour from which tenant starts emitting
  lastActiveHour: number;    // -1 means never active
}

export interface ServiceMeta {
  key: string;
  name: string;
  unit: string;
  unitShort: string;
  color: string;
  share: number;
  failRate: number;
  unitsPerRequest: number;
}

const PALETTE = [
  "#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899",
  "#06B6D4", "#F59E0B", "#6366F1", "#84CC16", "#94A3B8",
  "#EF4444", "#14B8A6", "#A855F7", "#0EA5E9", "#DC2626",
  "#22C55E", "#EAB308", "#7C3AED", "#DB2777", "#0891B2",
  "#65A30D", "#D97706", "#4F46E5", "#BE185D", "#0D9488",
  "#9333EA", "#E11D48", "#16A34A", "#CA8A04", "#7E22CE",
  "#1D4ED8", "#15803D", "#B45309", "#831843", "#1E40AF",
  "#166534", "#92400E", "#581C87", "#9F1239", "#075985",
  "#365314", "#854D0E", "#4338CA", "#9D174D", "#0F766E",
  "#A21CAF", "#1E3A8A",
];

// Tenant definitions. Bhashini Programme is the platform operator — not a tenant.
type TenantSeed = {
  name: string;
  category: TenantCategory;
  share: number;
  plan: TenantMeta["plan"];
  /** "live" = active up to hour 719; "7d" = stopped >24h ago; "30d" = stopped >7d ago; "off" = never active (or stopped >30d ago) */
  status: "live" | "7d" | "30d" | "off";
  /** if true, first-active hour is within the last 168h */
  newThisWeek?: boolean;
};

const SEEDS: TenantSeed[] = [
  // Top tier (named, active)
  { name: "Ministry of Electronics & IT (MeitY)",   category: "Central Government",       share: 0.18,   plan: "Enterprise", status: "live" },
  { name: "Ministry of Education",                  category: "Central Government",       share: 0.14,   plan: "Enterprise", status: "live" },

  // Mid tier (named, active)
  { name: "IIIT Hyderabad",                         category: "Academic & Research",      share: 0.07,   plan: "Enterprise", status: "live" },
  { name: "Tamil Nadu e-Governance Agency",         category: "State Government",         share: 0.06,   plan: "Enterprise", status: "live" },
  { name: "CDAC Pune",                              category: "Academic & Research",      share: 0.05,   plan: "Pro",        status: "live" },
  { name: "IIT Madras",                             category: "Academic & Research",      share: 0.05,   plan: "Pro",        status: "live" },
  { name: "Indian Railways (CRIS)",                 category: "PSU & Public Enterprise",  share: 0.04,   plan: "Pro",        status: "live" },
  { name: "UIDAI (Aadhaar)",                        category: "PSU & Public Enterprise",  share: 0.04,   plan: "Pro",        status: "live" },
  { name: "Reverie Language Technologies",          category: "Private & NGO",            share: 0.04,   plan: "Pro",        status: "live" },
  { name: "Kerala IT Mission",                      category: "State Government",         share: 0.03,   plan: "Pro",        status: "live" },

  // Low tier active-in-24h (21)
  { name: "Ministry of Health & Family Welfare",    category: "Central Government",       share: 0.018,  plan: "Standard",   status: "live" },
  { name: "NCERT",                                  category: "Central Government",       share: 0.012,  plan: "Standard",   status: "live" },
  { name: "Department of Posts",                    category: "Central Government",       share: 0.010,  plan: "Standard",   status: "live" },
  { name: "Assam NIC Unit",                         category: "State Government",         share: 0.015,  plan: "Standard",   status: "live" },
  { name: "Telangana State Technology Services",    category: "State Government",         share: 0.014,  plan: "Standard",   status: "live" },
  { name: "Gujarat Informatics Ltd",                category: "State Government",         share: 0.013,  plan: "Standard",   status: "live" },
  { name: "Maharashtra IT Corp",                    category: "State Government",         share: 0.014,  plan: "Standard",   status: "live" },
  { name: "Karnataka e-Governance",                 category: "State Government",         share: 0.012,  plan: "Standard",   status: "live" },
  { name: "Uttar Pradesh Electronics Corp",         category: "State Government",         share: 0.011,  plan: "Standard",   status: "live" },
  { name: "IIT Bombay",                             category: "Academic & Research",      share: 0.016,  plan: "Standard",   status: "live" },
  { name: "IIT Delhi",                              category: "Academic & Research",      share: 0.014,  plan: "Standard",   status: "live" },
  { name: "CDAC Noida",                             category: "Academic & Research",      share: 0.012,  plan: "Standard",   status: "live" },
  { name: "University of Hyderabad",                category: "Academic & Research",      share: 0.009,  plan: "Standard",   status: "live" },
  { name: "BSNL",                                   category: "PSU & Public Enterprise",  share: 0.015,  plan: "Standard",   status: "live" },
  { name: "NPCI",                                   category: "PSU & Public Enterprise",  share: 0.013,  plan: "Standard",   status: "live" },
  { name: "NABARD",                                 category: "PSU & Public Enterprise",  share: 0.010,  plan: "Standard",   status: "live" },
  { name: "NTPC Limited",                           category: "PSU & Public Enterprise",  share: 0.006,  plan: "Starter",    status: "live", newThisWeek: true },
  { name: "Koo App",                                category: "Private & NGO",            share: 0.014,  plan: "Standard",   status: "live" },
  { name: "Jugalbandi (AI4Bharat)",                 category: "Private & NGO",            share: 0.011,  plan: "Standard",   status: "live" },
  { name: "Navam Technologies",                     category: "Private & NGO",            share: 0.005,  plan: "Starter",    status: "live", newThisWeek: true },
  { name: "Karya Inc",                              category: "Private & NGO",            share: 0.004,  plan: "Starter",    status: "live", newThisWeek: true },

  // Active in last 7 days but not last 24h (7)
  { name: "Ministry of Agriculture",                category: "Central Government",       share: 0.006,  plan: "Standard",   status: "7d" },
  { name: "Doordarshan / Prasar Bharati",           category: "Central Government",       share: 0.007,  plan: "Standard",   status: "7d" },
  { name: "Tezpur University",                      category: "Academic & Research",      share: 0.004,  plan: "Starter",    status: "7d" },
  { name: "Anna University",                        category: "Academic & Research",      share: 0.005,  plan: "Starter",    status: "7d" },
  { name: "Oil India Limited",                      category: "PSU & Public Enterprise",  share: 0.005,  plan: "Starter",    status: "7d" },
  { name: "Raftaar.in",                             category: "Private & NGO",            share: 0.004,  plan: "Starter",    status: "7d" },
  { name: "Gram Vaani",                             category: "Private & NGO",            share: 0.004,  plan: "Starter",    status: "7d" },

  // Active in last 30 days but not last 7 days (6)
  { name: "National Informatics Centre (NIC)",      category: "Central Government",       share: 0.004,  plan: "Standard",   status: "30d" },
  { name: "Rajasthan IT Corp",                      category: "State Government",         share: 0.003,  plan: "Starter",    status: "30d" },
  { name: "Punjab IT Corp",                         category: "State Government",         share: 0.003,  plan: "Starter",    status: "30d" },
  { name: "Odisha Computer App Centre",             category: "State Government",         share: 0.003,  plan: "Starter",    status: "30d" },
  { name: "Jawaharlal Nehru University",            category: "Academic & Research",      share: 0.003,  plan: "Starter",    status: "30d" },
  { name: "iGot Karmayogi Platform",                category: "Private & NGO",            share: 0.002,  plan: "Starter",    status: "30d" },

  // Inactive — never active in this 30-day window (3)
  { name: "Meghalaya e-District",                   category: "State Government",         share: 0,      plan: "Starter",    status: "off" },
  { name: "Coal India Limited",                     category: "PSU & Public Enterprise",  share: 0,      plan: "Starter",    status: "off" },
  { name: "Bhasadhara",                             category: "Private & NGO",            share: 0,      plan: "Starter",    status: "off" },
];

function activeRange(status: TenantSeed["status"], newThisWeek?: boolean): { first: number; last: number } {
  if (status === "off")  return { first: 0,   last: -1 };                 // never emits
  if (status === "30d")  return { first: 0,   last: 380 };                // stopped >7d ago
  if (status === "7d")   return { first: 0,   last: 620 };                // stopped >24h ago
  // live
  return { first: newThisWeek ? 600 : 0, last: 719 };
}

export const TENANTS: TenantMeta[] = SEEDS.map((s, i) => {
  const { first, last } = activeRange(s.status, s.newThisWeek);
  return {
    id: `t${i + 1}`,
    name: s.name,
    category: s.category,
    plan: s.plan,
    share: s.share,
    avatarColor: PALETTE[i % PALETTE.length],
    firstActiveHour: first,
    lastActiveHour: last,
  };
});

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
  const PEAK_HOUR = 715;

  for (let h = 0; h < TOTAL_HOURS; h++) {
    const hourOfDay = h % 24;
    let platformHourly = PLATFORM_BASELINE_HOURLY * todMultiplier(hourOfDay);
    platformHourly *= 0.85 + rand() * 0.30;
    if (h === PEAK_HOUR) platformHourly *= 1.4;

    for (const t of TENANTS) {
      const active = h >= t.firstActiveHour && h <= t.lastActiveHour && t.share > 0;
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
  const delta = 200 + Math.floor(Math.random() * 600);
  const activeTenants = TENANTS.filter((t) => lastHour >= t.firstActiveHour && lastHour <= t.lastActiveHour && t.share > 0);
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
