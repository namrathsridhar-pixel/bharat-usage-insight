import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X } from "lucide-react";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  PlatformPulse, VolumeHealthChart, ServiceBreakdownTable, TopTenantsList,
  ThroughputBlock, TenantAdoptionGrid, CompareTenantsSection, LoadingOverlay,
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
    <UsageProvider>
      <PortalShell>
        <PageInner />
      </PortalShell>
      <Toaster position="top-right" />
    </UsageProvider>
  );
}

function PageInner() {
  const { role, effectiveTenant } = useUsage();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const isTenant = role === "tenant_admin";

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usage &amp; Metering</h1>
        <p className="mt-1 text-sm text-slate-500">Monitor service consumption, tenant activity, and platform throughput</p>
      </div>

      <FilterBar />

      {isTenant && !bannerDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-2.5 text-sm text-slate-700">
          <div>
            <span className="font-medium">Bhashini Programme</span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span className="text-slate-600">Viewing your organisation's usage data</span>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="p-1 rounded hover:bg-sky-100 text-slate-500"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {!isTenant && effectiveTenant && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
          Viewing: <span className="font-medium">{effectiveTenant.name}</span> · {effectiveTenant.plan} plan
        </div>
      )}

      <LoadingOverlay>
        <div className="space-y-8">
          {/* ZONE 1 — Platform pulse */}
          <PlatformPulse />

          {/* ZONE 2 — Volume + health */}
          <VolumeHealthChart />

          {/* ZONE 3 — Split: service breakdown + top tenants */}
          <div className={`grid grid-cols-1 ${isTenant ? "" : "lg:grid-cols-5"} gap-6`}>
            <div className={isTenant ? "" : "lg:col-span-3"}>
              <ServiceBreakdownTable />
            </div>
            {!isTenant && (
              <div className="lg:col-span-2">
                <TopTenantsList />
              </div>
            )}
          </div>

          {/* ZONE 4 — Throughput + tenant adoption */}
          <div className={`grid grid-cols-1 ${isTenant ? "" : "lg:grid-cols-2"} gap-6`}>
            <ThroughputBlock />
            {!isTenant && <TenantAdoptionGrid />}
          </div>

          {/* ZONE 5 — Compare tenants */}
          {!isTenant && <CompareTenantsSection />}
        </div>
      </LoadingOverlay>

      <footer className="pt-4 text-center text-xs text-slate-400">
        AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 10 Services
      </footer>
    </div>
  );
}
