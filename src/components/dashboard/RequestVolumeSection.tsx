import { useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard/context";
import { Panel, SectionTitle, formatNum, EmptyState } from "./Primitives";
import { SERVICES, TENANTS } from "@/lib/dashboard/mock-data";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpDown, Search } from "lucide-react";

type Tab = "overall" | "tenant" | "service";

export function RequestVolumeSection() {
  const { role, data } = useDashboard();
  const defaultTab: Tab = role === "adopter_admin" ? "overall" : "tenant";
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const tabs = role === "adopter_admin"
    ? [{ k: "overall", l: "Overall" }, { k: "tenant", l: "By Tenant" }, { k: "service", l: "By Service" }]
    : [{ k: "tenant", l: "By Tenant" }, { k: "service", l: "By Service" }];

  const chartData = data.buckets;

  // Tenant aggregates
  const tenantRows = useMemo(() => {
    const map = new Map<string, { tenantId: string; name: string; total: number; successful: number; failed: number }>();
    data.rows.forEach((r) => {
      const name = TENANTS.find((t) => t.id === r.tenantId)?.name ?? r.tenantId;
      const cur = map.get(r.tenantId) ?? { tenantId: r.tenantId, name, total: 0, successful: 0, failed: 0 };
      cur.total += r.total;
      cur.successful += r.successful;
      cur.failed += r.failed;
      map.set(r.tenantId, cur);
    });
    return Array.from(map.values());
  }, [data]);

  // Service aggregates
  const serviceRows = useMemo(() => {
    const map = new Map<string, { service: string; total: number; successful: number; failed: number; units: number; unit: string }>();
    data.rows.forEach((r) => {
      const svc = SERVICES.find((s) => s.key === r.service)!;
      const cur = map.get(r.service) ?? { service: r.service, total: 0, successful: 0, failed: 0, units: 0, unit: svc.unit };
      cur.total += r.total;
      cur.successful += r.successful;
      cur.failed += r.failed;
      cur.units += r.units;
      map.set(r.service, cur);
    });
    return Array.from(map.values());
  }, [data]);

  const sort = <T extends Record<string, any>>(rows: T[]) =>
    [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number") return sortDir === "desc" ? bv - av : av - bv;
      return sortDir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const Th = ({ k, children, right }: { k: string; children: any; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none px-3 py-2 text-xs font-medium text-neutral-600 ${right ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "text-primary" : "opacity-30"}`} />
      </span>
    </th>
  );

  const filteredTenantRows = sort(tenantRows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())));
  const sortedServiceRows = sort(serviceRows);

  return (
    <section>
      <SectionTitle subtitle="Total, successful, and failed inference requests over the selected window">
        Request Volume
      </SectionTitle>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 pb-3">
          <div className="flex gap-1 rounded-md bg-neutral-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as Tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.k ? "bg-white text-primary shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
          {tab === "tenant" && role === "adopter_admin" && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants…"
                className="rounded-md border border-neutral-300 bg-white py-1.5 pl-7 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        {chartData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis tick={{ fontSize: 11, fill: "#475569" }} tickFormatter={formatNum} />
              <Tooltip formatter={(v: number) => formatNum(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Total" fill="#94A3B8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="successful" name="Successful" fill="#0D7C6E" radius={[3, 3, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill="#D97706" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="mt-4 overflow-x-auto rounded-md border border-neutral-300">
          <table className="min-w-full">
            <thead className="bg-neutral-100">
              <tr>
                {tab === "service" ? (
                  <>
                    <Th k="service">Service</Th>
                    <Th k="unit">Metering Unit</Th>
                    <Th k="total" right>Requests</Th>
                    <Th k="units" right>Native Units</Th>
                    <Th k="successful" right>Successful</Th>
                    <Th k="failed" right>Failed</Th>
                    <Th k="successRate" right>Success %</Th>
                  </>
                ) : (
                  <>
                    <Th k="name">Tenant</Th>
                    <Th k="total" right>Total</Th>
                    <Th k="successful" right>Successful</Th>
                    <Th k="failed" right>Failed</Th>
                    <Th k="successRate" right>Success %</Th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === "service"
                ? sortedServiceRows.map((r) => {
                    const rate = r.total ? ((r.successful / r.total) * 100).toFixed(2) : "—";
                    return (
                      <tr key={r.service} className="border-t border-neutral-300 hover:bg-neutral-100">
                        <td className="px-3 py-2 text-sm font-medium text-neutral-900">{r.service}</td>
                        <td className="px-3 py-2 text-xs text-neutral-600">{r.unit}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums">{formatNum(r.total)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-neutral-600">{formatNum(r.units)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-accent">{formatNum(r.successful)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-warning">{formatNum(r.failed)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums">{rate}%</td>
                      </tr>
                    );
                  })
                : filteredTenantRows.map((r) => {
                    const rate = r.total ? ((r.successful / r.total) * 100).toFixed(2) : "—";
                    return (
                      <tr key={r.tenantId} className="border-t border-neutral-300 hover:bg-neutral-100">
                        <td className="px-3 py-2 text-sm font-medium text-neutral-900">{r.name}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums">{formatNum(r.total)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-accent">{formatNum(r.successful)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums text-warning">{formatNum(r.failed)}</td>
                        <td className="px-3 py-2 text-right text-sm tabular-nums">{rate}%</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
