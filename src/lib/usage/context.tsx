import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TENANTS, type Role, type TimeWindow, type Tenant } from "./data";

interface UsageCtx {
  role: Role;
  setRole: (r: Role) => void;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  customLabel: string | null;
  setCustomLabel: (l: string | null) => void;
  selectedTenantId: string | null;
  setSelectedTenantId: (id: string | null) => void;
  effectiveTenant: Tenant | null;
  loading: boolean;
  triggerLoading: () => void;
  /** increments every 30s when window is live (1h/24h) */
  tick: number;
  lastUpdatedAt: number;
  pulseDelta: { requests: number; successRate: number; rps: number };
}

const Ctx = createContext<UsageCtx | null>(null);

const SELF_TENANT_ID = "t1";

export function UsageProvider({ children, defaultRole = "platform_admin" }: { children: ReactNode; defaultRole?: Role }) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [window, setWindow] = useState<TimeWindow>("24h");
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [pulseDelta, setPulseDelta] = useState({ requests: 0, successRate: 0, rps: 0 });

  const triggerLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 350);
  };

  useEffect(() => { triggerLoading(); }, [window, selectedTenantId, role]);

  // reset live deltas when filters change
  useEffect(() => {
    setPulseDelta({ requests: 0, successRate: 0, rps: 0 });
    setLastUpdatedAt(Date.now());
    setTick(0);
  }, [window, selectedTenantId]);

  // live tick every 30s, only when window is 1h or 24h
  const isLive = window === "1h" || window === "24h";
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setLastUpdatedAt(Date.now());
      setPulseDelta((prev) => ({
        requests: prev.requests + Math.floor(200 + Math.random() * 600),
        successRate: +(prev.successRate + (Math.random() - 0.5) * 0.2).toFixed(2),
        rps: +(prev.rps + (Math.random() - 0.5) * 0.6).toFixed(2),
      }));
    }, 30_000);
    return () => clearInterval(id);
  }, [isLive]);

  const effectiveTenant = useMemo<Tenant | null>(() => {
    if (role === "tenant_admin") return TENANTS.find((t) => t.id === SELF_TENANT_ID) ?? null;
    return selectedTenantId ? TENANTS.find((t) => t.id === selectedTenantId) ?? null : null;
  }, [role, selectedTenantId]);

  return (
    <Ctx.Provider value={{
      role, setRole, window, setWindow, customLabel, setCustomLabel,
      selectedTenantId, setSelectedTenantId, effectiveTenant, loading, triggerLoading,
      tick, lastUpdatedAt, pulseDelta,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUsage() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUsage outside provider");
  return v;
}

/** Returns a "Updated Xs ago" string that updates every 5 seconds */
export function useUpdatedAgo(): string {
  const { lastUpdatedAt } = useUsage();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
