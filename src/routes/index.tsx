import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  PlatformPulse, PlatformAdoption, VolumeHealth, ServiceBreakdown,
  TenantRanking, ThroughputLoad, CompareTenants, LoadingOverlay,
} from "@/components/usage/Sections";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Usage & Metering · AI4I Orchestrate" },
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
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 border-l-4 border-orange-500 border-y border-r border-orange-100 px-4 py-2.5 text-sm">
      <div className="text-slate-800">
        <span className="font-semibold">Viewing: {effectiveTenant.name}</span>
        <span className="mx-1.5 text-slate-400">·</span>
        <span>{effectiveTenant.plan}</span>
        <span className="mx-1.5 text-slate-400">·</span>
        <span className="text-slate-600">All data scoped to this tenant</span>
      </div>
      <button onClick={() => setSelectedTenantId(null)} className="p-1 rounded hover:bg-orange-100 text-slate-600" aria-label="Clear">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PageInner() {
  const { effectiveTenant } = useUsage();
  const isTenantScoped = !!effectiveTenant;
  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usage &amp; Metering</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor service consumption, tenant activity, and platform throughput</p>
      </div>

      <FilterBar />
      <TenantContextBanner />

      <LoadingOverlay>
        <div className="space-y-8">
          <PlatformPulse />
          {!isTenantScoped && <PlatformAdoption />}
          <VolumeHealth />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3"><ServiceBreakdown /></div>
            {!isTenantScoped && <div className="lg:col-span-2"><TenantRanking /></div>}
            {isTenantScoped && <div className="lg:col-span-2"><ThroughputLoad singleLineOnly /></div>}
          </div>
          {!isTenantScoped && <ThroughputLoad />}
          {!isTenantScoped && <CompareTenants />}
        </div>
      </LoadingOverlay>

      <footer className="pt-4 text-center text-xs text-slate-400">
        AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 10 Services
      </footer>
    </div>
  );
}
