import { createFileRoute } from "@tanstack/react-router";
import { DashboardProvider, useDashboard } from "@/lib/dashboard/context";
import { TopBar } from "@/components/dashboard/TopBar";
import { TenantAdoptionSection } from "@/components/dashboard/TenantAdoptionSection";
import { RequestVolumeSection } from "@/components/dashboard/RequestVolumeSection";
import { ThroughputSection } from "@/components/dashboard/ThroughputSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Metering & Usage · AI4I Orchestrate" },
      { name: "description", content: "Platform-wide metering and usage dashboard for AI4I Orchestrate." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-neutral-100">
        <TopBar />
        <StaleBanner />
        <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
          <RoleGatedAdoption />
          <RequestVolumeSection />
          <ThroughputSection />
          <footer className="pt-4 text-center text-xs text-neutral-600">
            AI4I Orchestrate · Sovereign Language AI Platform · 22 Scheduled Indian Languages · 11 Services
          </footer>
        </main>
      </div>
    </DashboardProvider>
  );
}

function RoleGatedAdoption() {
  const { role } = useDashboard();
  // Role rendering enforced — Tenant Admin: section never enters DOM
  if (role !== "adopter_admin") return null;
  return <TenantAdoptionSection />;
}

function StaleBanner() {
  const { stale, lastRefreshed } = useDashboard();
  if (!stale) return null;
  return (
    <div className="border-b border-warning/40 bg-warning-light px-6 py-2 text-xs text-warning">
      Dashboard data may be outdated — last refreshed at {lastRefreshed.toLocaleTimeString()}
    </div>
  );
}
