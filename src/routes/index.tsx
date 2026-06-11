import { createFileRoute } from "@tanstack/react-router";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  AdoptionSection, RequestVolumeSection, ThroughputSection, ServiceUsageSection,
  UsageTrendSection, TopTenantsSection, ComparisonSection, BreakdownSection,
  LoadingOverlay,
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
  const { role, setRole, effectiveTenant } = useUsage();

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usage &amp; Metering</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor service consumption, tenant activity, and platform throughput</p>
        </div>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs">
          {[
            { k: "platform_admin", l: "Platform Admin" },
            { k: "tenant_admin", l: "Tenant Admin" },
          ].map((opt) => {
            const active = role === opt.k;
            return (
              <button
                key={opt.k}
                onClick={() => setRole(opt.k as any)}
                className={`px-3 py-1.5 rounded-full font-medium transition ${active ? "bg-orange-500 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                {opt.l}
              </button>
            );
          })}
        </div>
      </div>

      <FilterBar />

      {role === "tenant_admin" && effectiveTenant && (
        <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-2.5 text-sm text-slate-700">
          <span className="font-medium">{effectiveTenant.name}</span> · {effectiveTenant.plan} plan ·{" "}
          <span className="text-slate-500">Usage data scoped to your organisation</span>
        </div>
      )}
      {role === "platform_admin" && effectiveTenant && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
          Viewing: <span className="font-medium">{effectiveTenant.name}</span> · {effectiveTenant.plan} plan
        </div>
      )}

      <LoadingOverlay>
        <div className="space-y-6">
          <AdoptionSection />
          <RequestVolumeSection />
          <ThroughputSection />
          <ServiceUsageSection />
          <UsageTrendSection />
          <TopTenantsSection />
          <ComparisonSection />
          <BreakdownSection />
        </div>
      </LoadingOverlay>

      <footer className="pt-4 text-center text-xs text-slate-400">
        AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 10 Services
      </footer>
    </div>
  );
}
