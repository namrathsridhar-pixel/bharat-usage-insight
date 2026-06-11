import { createFileRoute } from "@tanstack/react-router";
import { UsageProvider, useUsage } from "@/lib/usage/context";
import { PortalShell } from "@/components/usage/PortalShell";
import { FilterBar } from "@/components/usage/FilterBar";
import {
  PlatformPulse, VolumeHealth, ServiceBreakdown, ThroughputLoad, LoadingOverlay,
} from "@/components/usage/Sections";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/my-usage")({
  head: () => ({
    meta: [
      { title: "My Usage · AI4I Orchestrate" },
      { name: "description", content: "Your organisation's consumption across AI4I Orchestrate services." },
    ],
  }),
  component: MyUsagePage,
});

function MyUsagePage() {
  return (
    <UsageProvider role="tenant_admin">
      <PortalShell>
        <PageInner />
      </PortalShell>
      <Toaster position="top-right" />
    </UsageProvider>
  );
}

function PageInner() {
  const { effectiveTenant } = useUsage();
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          My Usage — {effectiveTenant?.name ?? "Your organisation"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Your organisation's service consumption</p>
      </div>

      <FilterBar />

      <LoadingOverlay>
        <div className="space-y-8">
          <PlatformPulse />
          <VolumeHealth />
          <ServiceBreakdown />
          <ThroughputLoad singleLineOnly />
        </div>
      </LoadingOverlay>

      <footer className="pt-4 text-center text-xs text-slate-400">
        AI4I Orchestrate · Tenant view
      </footer>
    </div>
  );
}
