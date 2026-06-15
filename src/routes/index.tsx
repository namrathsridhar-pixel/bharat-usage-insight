import { createFileRoute } from "@tanstack/react-router";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  PlatformPulse, TenantOverview, ConsumptionOverview, VolumeHealth, ServiceBreakdown,
  TenantRanking, ServiceMix, ThroughputLoad, CompareTenants, LoadingOverlay,
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

function PageInner() {
  const { effectiveTenant } = useUsage();
  const isTenantScoped = !!effectiveTenant;
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

      {/* 1. Tenant Overview — always at top, fixed, above filter */}
      <TenantOverview />

      {/* 2. Time window filter bar */}
      <FilterBar />

      <LoadingOverlay>
        <div className="space-y-6">
          {/* 3. Top KPI cards (3 cards) */}
          <PlatformPulse />
          {/* 4. Consumption overview (3 panels) */}
          {!isTenantScoped && <ConsumptionOverview />}
          {/* 5. Request volume & health */}
          <VolumeHealth />
          {/* 6. Throughput & load */}
          <ThroughputLoad />
          {/* 7. Service breakdown (+ tenant ranking / service mix side panel) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-3"><ServiceBreakdown /></div>
            <div className="lg:col-span-2">
              {isTenantScoped ? <ServiceMix /> : <TenantRanking />}
            </div>
          </div>
          {/* 8. Usage by tenant & service heatmap */}
          <CompareTenants />
        </div>
      </LoadingOverlay>

      <footer className="pt-4 text-center text-xs text-slate-400">
        AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 10 Services
      </footer>
    </div>
  );
}
