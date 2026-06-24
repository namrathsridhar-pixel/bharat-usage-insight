import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TENANTS, type TenantMeta } from "@/data/eventLog";
import { appendLiveTick } from "@/data/eventLog";

export type TimeWindow = "1h" | "24h" | "7d" | "30d" | "custom";
export type Role = "platform_admin" | "tenant_admin";
export type DashboardTab = "overview" | "tenant" | "service";

interface UsageCtx {
  role: Role;
  setRole: (r: Role) => void;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  selectedTenantId: string | null;
  setSelectedTenantId: (id: string | null) => void;
  effectiveTenant: TenantMeta | null;
  loading: boolean;
  tick: number;
  lastUpdatedAt: number;
  tab: DashboardTab;
  setTab: (t: DashboardTab) => void;
  tenantRankTopN: number;
  setTenantRankTopN: (n: number) => void;
  refresh: () => void;
}

const Ctx = createContext<UsageCtx | null>(null);

export function UsageProvider({
  children,
  role: initialRole = "platform_admin",
}: {
  children: ReactNode;
  role?: Role;
}) {
  const [role, setRoleState] = useState<Role>(initialRole);
  const [window, setWindowState] = useState<TimeWindow>("24h");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  // remember the Adopter Admin tenant filter so switching roles back restores it
  const savedTenantRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [tenantRankTopN, setTenantRankTopN] = useState<number>(10);

  const setRole = (r: Role) => {
    setRoleState((prev) => {
      if (prev === r) return prev;
      if (r === "tenant_admin") {
        // entering tenant admin — remember any current Adopter Admin tenant filter
        savedTenantRef.current = selectedTenantId;
      } else {
        // returning to Adopter Admin — restore prior tenant selection (or All Tenants)
        setSelectedTenantId(savedTenantRef.current);
        savedTenantRef.current = null;
      }
      return r;
    });
  };

  const setWindow = (w: TimeWindow) => {
    if (w === "custom") return;
    setWindowState(w);
    setLoading(true);
    setTimeout(() => setLoading(false), 200);
  };

  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(id);
  }, [selectedTenantId, role]);

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

  const refresh = () => {
    appendLiveTick();
    setTick((t) => t + 1);
    setLastUpdatedAt(Date.now());
  };

  const effectiveTenant = useMemo<TenantMeta | null>(() => {
    return selectedTenantId ? (TENANTS.find((t) => t.id === selectedTenantId) ?? null) : null;
  }, [selectedTenantId]);

  return (
    <Ctx.Provider
      value={{
        role,
        setRole,
        window,
        setWindow,
        selectedTenantId,
        setSelectedTenantId,
        effectiveTenant,
        loading,
        tick,
        lastUpdatedAt,
        tab,
        setTab,
        tenantRankTopN,
        setTenantRankTopN,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUsage() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUsage outside provider");
  return v;
}

export function useUpdatedAgo(): { text: string; stale: boolean } {
  const { lastUpdatedAt } = useUsage();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  if (diff <= 30) return { text: "just now", stale: false };
  if (diff <= 60) return { text: `${diff} sec ago`, stale: false };
  const m = Math.floor(diff / 60);
  const base =
    m < 60
      ? `${m} min ago`
      : (() => {
          const h = Math.floor(m / 60);
          return h === 1 ? "1 hour ago" : `${h} hours ago`;
        })();
  return { text: base, stale: true };
}
