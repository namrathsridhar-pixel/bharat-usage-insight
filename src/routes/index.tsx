import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  PlatformPulse, TenantOverview, ConsumptionOverview, VolumeHealth, ServiceBreakdown,
  TenantRanking, ServiceMix, ServiceKPIs, ThroughputLoad, CompareTenants, LoadingOverlay,
} from "@/components/usage/Sections";
import { Toaster } from "@/components/ui/sonner";

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

type TabKey = "overview" | "tenant" | "service";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tenant", label: "Tenant Consumption" },
  { key: "service", label: "Service Consumption" },
];

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

function PageInner() {
  const { effectiveTenant, setSelectedTenantId } = useUsage();
  const isTenantScoped = !!effectiveTenant;
  const [tab, setTab] = useState<TabKey>("overview");
  const contentRef = useRef<HTMLDivElement>(null);

  function handleTenantDrilldown(id: string) {
    setSelectedTenantId(id);
    setTab("tenant");
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [tab]);

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

      {/* Global filter bar — fixed across all tabs */}
      <FilterBar />

      {/* Persistent section — Platform Adoption (or tenant banner when scoped) */}
      {isTenantScoped ? <TenantContextBanner /> : <TenantOverview />}

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative px-4 py-2.5 text-sm transition-colors -mb-px border-b-2 ${
                  active
                    ? "text-slate-900 font-semibold border-orange-500"
                    : "text-slate-500 font-medium border-transparent hover:text-slate-700"
                }`}
                style={{ color: active ? "#0F172A" : "#475569" }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

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
              <CompareTenants view="serviceBar" />
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
