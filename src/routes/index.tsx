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
  const { setSelectedTenantId } = useUsage();
  const [open, setOpen] = useState(false);

  const PLAN_STYLE: Record<string, string> = {
    Enterprise: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Pro: "bg-blue-50 text-blue-700 border-blue-200",
    Standard: "bg-slate-100 text-slate-700 border-slate-200",
    Starter: "bg-amber-50 text-amber-700 border-amber-200",
  };

  // close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      className="rounded-lg p-3 flex flex-wrap items-center gap-3"
      style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
    >
      <span style={{ fontSize: 13, color: "#0F172A", fontWeight: 500 }}>
        Select a tenant to preview Tenant Admin view
      </span>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-white text-slate-400 border-slate-200 hover:bg-slate-50 transition min-w-[220px] justify-between"
        >
          <span>Select a tenant</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && (
          <div
            className="absolute z-20 mt-1 w-[280px] rounded-md border border-slate-200 bg-white shadow-md overflow-y-auto"
            style={{ maxHeight: 8 * 44 }}
          >
            {TENANTS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTenantId(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#F8FAFC]"
                style={{ minHeight: 44 }}
              >
                <span
                  className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                  style={{ background: t.avatarColor }}
                >
                  {t.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 text-sm text-slate-800 truncate">{t.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${PLAN_STYLE[t.plan] ?? PLAN_STYLE.Standard}`}>{t.plan}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
