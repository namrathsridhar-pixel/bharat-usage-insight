import { useDashboard } from "@/lib/dashboard/context";
import { KPICard, Panel, SectionTitle, formatNum } from "./Primitives";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TenantAdoptionSection() {
  const { data, topN, setTopN } = useDashboard();
  const { adoption, tenantTotals, totalRequests } = data;

  const singleTenant = tenantTotals.length <= 1;
  const top = tenantTotals.slice(0, topN);
  const topSum = top.reduce((a, x) => a + x.total, 0);
  const rest = Math.max(0, totalRequests - topSum);
  const concentration = totalRequests > 0 ? Math.round((topSum / totalRequests) * 100) : 0;

  return (
    <section>
      <SectionTitle subtitle="Platform-wide tenant adoption and consumption distribution">
        Tenant Adoption
      </SectionTitle>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Total Tenants" value={adoption.total} />
        <KPICard
          label="Active (24h)"
          value={adoption.active24h}
          info="Tenants with at least one inference in the last 24 hours"
        />
        <KPICard label="Active (7 days)" value={adoption.active7d} />
        <KPICard label="Active (30 days)" value={adoption.active30d} />
        <KPICard label="New Onboarded (7d)" value={adoption.new7d} trend={12} />
      </div>

      {!singleTenant && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Top Tenants by Usage</h3>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs"
              >
                {[5, 10, 20].map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: "#0F172A" }} />
                <Tooltip formatter={(v: number) => formatNum(v)} />
                <Bar dataKey="total" fill="#0D7C6E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Usage Concentration</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: `Top ${topN}`, value: topSum },
                      { name: "Rest", value: rest },
                    ]}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="#0D7C6E" />
                    <Cell fill="#CBD5E1" />
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNum(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1">
                <p className="text-3xl font-bold text-neutral-900">{concentration}%</p>
                <p className="mt-1 text-xs text-neutral-600">
                  of platform usage comes from the Top {topN} tenants
                </p>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
                    <span>Top {topN}: {formatNum(topSum)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-neutral-300" />
                    <span>Rest: {formatNum(rest)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Average Requests / Tenant</h3>
            <p className="text-[32px] font-bold leading-none text-neutral-900">
              {formatNum(adoption.avgRequestsPerTenant)}
            </p>
            <p className="mt-2 text-xs text-accent">▲ +{adoption.avgTrendPct}% vs previous period</p>
            <div className="mt-6 border-t border-neutral-300 pt-3 text-xs text-neutral-600">
              Computed across all active tenants in the selected window.
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}
