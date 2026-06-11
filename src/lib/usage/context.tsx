import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { TENANTS, type Role, type TimeWindow, type Tenant } from "./data";

interface UsageCtx {
  role: Role;
  setRole: (r: Role) => void;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  customLabel: string | null;
  setCustomLabel: (l: string | null) => void;
  selectedTenantId: string | null; // null = all tenants (platform admin)
  setSelectedTenantId: (id: string | null) => void;
  effectiveTenant: Tenant | null;
  loading: boolean;
  triggerLoading: () => void;
}

const Ctx = createContext<UsageCtx | null>(null);

const SELF_TENANT_ID = "t1"; // Tenant admin is scoped to Bhashini Programme for demo

export function UsageProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("platform_admin");
  const [window, setWindow] = useState<TimeWindow>("24h");
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const triggerLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 400);
  };

  useEffect(() => {
    triggerLoading();
  }, [window, selectedTenantId, role]);

  const effectiveTenant = useMemo<Tenant | null>(() => {
    if (role === "tenant_admin") return TENANTS.find((t) => t.id === SELF_TENANT_ID) ?? null;
    return selectedTenantId ? TENANTS.find((t) => t.id === selectedTenantId) ?? null : null;
  }, [role, selectedTenantId]);

  return (
    <Ctx.Provider value={{
      role, setRole, window, setWindow, customLabel, setCustomLabel,
      selectedTenantId, setSelectedTenantId, effectiveTenant, loading, triggerLoading,
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
