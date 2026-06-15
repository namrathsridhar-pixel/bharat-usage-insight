import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { TENANTS, type TenantMeta } from "@/data/eventLog";
import { appendLiveTick } from "@/data/eventLog";

export type TimeWindow = "1h" | "24h" | "7d" | "30d" | "custom";
export type Role = "platform_admin" | "tenant_admin";

interface UsageCtx {
  role: Role;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  selectedTenantId: string | null;
  setSelectedTenantId: (id: string | null) => void;
  effectiveTenant: TenantMeta | null;
  loading: boolean;
  tick: number;
  lastUpdatedAt: number;
}

const Ctx = createContext<UsageCtx | null>(null);
const TENANT_ADMIN_TENANT_ID = "t1";

export function UsageProvider({ children, role = "platform_admin" }: { children: ReactNode; role?: Role }) {
  const [window, setWindowState] = useState<TimeWindow>("24h");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());

  const setWindow = (w: TimeWindow) => {
    if (w === "custom") return; // disabled
    setWindowState(w);
    setLoading(true);
    setTimeout(() => setLoading(false), 200);
  };

  useEffect(() => {
    // 400ms skeleton on tenant change
    setLoading(true);
    const id = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(id);
  }, [selectedTenantId]);

  const isLive = window === "1h" || window === "24h";
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => {
      appendLiveTick();
      setTick((t) => t + 1);
      setLastUpdatedAt(Date.now());
    }, 60_000);
    return () => clearInterval(id);
  }, [isLive]);

  const effectiveTenant = useMemo<TenantMeta | null>(() => {
    if (role === "tenant_admin") return TENANTS.find((t) => t.id === TENANT_ADMIN_TENANT_ID) ?? null;
    return selectedTenantId ? TENANTS.find((t) => t.id === selectedTenantId) ?? null : null;
  }, [role, selectedTenantId]);

  return (
    <Ctx.Provider value={{ role, window, setWindow, selectedTenantId, setSelectedTenantId, effectiveTenant, loading, tick, lastUpdatedAt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUsage() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUsage outside provider");
  return v;
}

export function useUpdatedAgo(): string {
  const { lastUpdatedAt } = useUsage();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  const m = Math.floor(diff / 60);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}
