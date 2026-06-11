import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role, TimeWindow } from "./mock-data";
import { getMockData, TENANTS } from "./mock-data";

interface DashboardCtx {
  role: Role;
  setRole: (r: Role) => void;
  tenantId: string;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  topN: number;
  setTopN: (n: number) => void;
  lastRefreshed: Date;
  refreshing: boolean;
  stale: boolean;
  refresh: () => void;
  data: ReturnType<typeof getMockData>;
}

const Ctx = createContext<DashboardCtx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("adopter_admin");
  const [tenantId] = useState<string>(TENANTS[0].id); // simulated authenticated tenant
  const [window, setWindow] = useState<TimeWindow>("24h");
  const [topN, setTopN] = useState<number>(10);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const stale = false;

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastRefreshed(new Date());
      setTick((t) => t + 1);
      setRefreshing(false);
    }, 600);
  };

  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  const data = useMemo(
    () => getMockData(window, role, role === "tenant_admin" ? tenantId : undefined),
    [window, role, tenantId, tick],
  );

  return (
    <Ctx.Provider value={{ role, setRole, tenantId, window, setWindow, topN, setTopN, lastRefreshed, refreshing, stale, refresh, data }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDashboard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard outside provider");
  return v;
}
