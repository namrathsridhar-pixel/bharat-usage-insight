import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  PlatformPulse, TenantOverview, ConsumptionOverview, VolumeHealth, ServiceBreakdown,
  TenantRanking, ServiceMix, ServiceKPIs, ThroughputLoad, CompareTenants, LoadingOverlay,
} from "@/components/usage/Sections";
import { Toaster } from "@/components/ui/sonner";
import { TENANTS } from "@/data/eventLog";
import { Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Usage Dashboard · AI4I Orchestrate" },
      { name: "description", content: "Monitor service consumption, tenant activity, and platform throughput across AI4I Orchestrate." },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  return (
    <UsageProvider role="platform_admin">
      <PortalShell>
        <PageInner />
      </PortalShell>
      <Toaster position="top-right" />
    </UsageProvider>
  );
}

function TenantContextBanner() {
  const { effectiveTenant, setSelectedTenantId } = useUsage();
  if (!effectiveTenant) return null;
  const initials = effectiveTenant.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", borderRadius: 8 }}>
      <div className="flex items-center gap-2.5">
        <span
          className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ background: effectiveTenant.avatarColor }}
          aria-hidden
        >
          {initials}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>
          Viewing: {effectiveTenant.name}
        </span>
      </div>
      <button
        onClick={() => setSelectedTenantId(null)}
        className="hover:underline"
        style={{ fontSize: 12, color: "#475569" }}
      >
        × Clear filter
      </button>
    </div>
  );
}

/** Inline prompt shown in Tenant Admin mode when no tenant is selected. */
function TenantSelectPrompt() {
  const { setSelectedTenantId, setRole } = useUsage();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => TENANTS.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  return (
    <div
      className="rounded-lg p-3 flex flex-wrap items-center gap-3"
      style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
    >
      <span style={{ fontSize: 13, color: "#0F172A", fontWeight: 500 }}>
        Select a tenant to preview Tenant Admin view
      </span>
      <div className="relative flex-1 min-w-[240px] max-w-[360px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tenants..."
          className="w-full pl-8 pr-2 py-1.5 text-sm rounded border border-slate-200 bg-white focus:outline-none focus:border-orange-400"
        />
        {search && (
          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-md">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">No matches</div>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => { setPendingId(t.id); setSearch(t.name); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
              >
                <span
                  className="h-5 w-5 rounded-full inline-flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                  style={{ background: t.avatarColor }}
                >
                  {t.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm text-slate-800 truncate">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => pendingId && setSelectedTenantId(pendingId)}
        disabled={!pendingId}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        View as Tenant Admin
      </button>
      <button
        onClick={() => setRole("platform_admin")}
        className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

function PageInner() {
  const { effectiveTenant, setSelectedTenantId, tab, setTab, role } = useUsage();
  const isTenantScoped = !!effectiveTenant;
  const isTenantAdmin = role === "tenant_admin";
  const contentRef = useRef<HTMLDivElement>(null);

  function handleTenantDrilldown(id: string) {
    setSelectedTenantId(id);
    setTab("tenant");
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [tab, role]);

  // Tenant Admin without a tenant selected — show prompt only
  if (isTenantAdmin && !isTenantScoped) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usage Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">My Usage</p>
        </div>
        <TenantSelectPrompt />
      </div>
    );
  }

  // Tenant Admin layout — single page
  if (isTenantAdmin && effectiveTenant) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usage Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">My Usage · {effectiveTenant.name}</p>
        </div>

        <FilterBar />

        <LoadingOverlay>
          <div ref={contentRef} className="space-y-6">
            {/* Section 1 — Consumption Summary (4 KPI cards) */}
            <PlatformPulse />

            {/* Section 2 — Consumption Overview (Volume left, Service mix right) */}
            <section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <div><VolumeHealth /></div>
                <div><ServiceMix /></div>
              </div>
            </section>

            {/* Section 3 — Service breakdown */}
            <ServiceBreakdown />

            {/* Section 4 — Throughput */}
            <ThroughputLoad />
          </div>
        </LoadingOverlay>

        <footer className="pt-4 text-center text-xs text-slate-400">
          AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 10 Services
        </footer>
      </div>
    );
  }

  // Adopter Admin layout (unchanged)
  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usage Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isTenantScoped
            ? `Service consumption and throughput for ${effectiveTenant!.name}`
            : "Monitor service consumption, tenant activity, and platform throughput"}
        </p>
      </div>

      <FilterBar />

      {isTenantScoped ? <TenantContextBanner /> : <TenantOverview />}

      <LoadingOverlay>
        <div ref={contentRef} className="space-y-6">
          {tab === "overview" && (
            <>
              <PlatformPulse />
              {!isTenantScoped && <ConsumptionOverview singleDonut onTenantClick={handleTenantDrilldown} />}
              <VolumeHealth />
            </>
          )}

          {tab === "tenant" && (
            <>
              <TenantRanking />
              <ThroughputLoad />
              <CompareTenants view="heatmap" />
            </>
          )}

          {tab === "service" && (
            <>
              <ServiceKPIs />
              <ServiceMix />
              <ServiceBreakdown />
            </>
          )}
        </div>
      </LoadingOverlay>

      <footer className="pt-4 text-center text-xs text-slate-400">
        AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 10 Services
      </footer>
    </div>
  );
}
