import { useDashboard } from "@/lib/dashboard/context";
import { Panel, SectionTitle } from "./Primitives";
import { CartesianGrid, Legend, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LINE_COLORS = ["#0D7C6E", "#1A3C5E", "#D97706", "#7C3AED", "#0891B2", "#475569"];

export function ThroughputSection() {
  const { role, data } = useDashboard();
  const { overallSeries, peakRps, tenantSeries } = data;
  const peakIdx = overallSeries.findIndex((p) => p.rps === peakRps);

  const merged = overallSeries.map((b, i) => {
    const row: Record<string, any> = { bucket: b.bucket };
    tenantSeries.forEach((ts) => {
      row[ts.name] = ts.series[i]?.rps ?? 0;
    });
    return row;
  });

  return (
    <section>
      <SectionTitle subtitle="Requests per second across the selected time window">Throughput</SectionTitle>
      <div className={`grid gap-4 ${role === "adopter_admin" ? "lg:grid-cols-2" : ""}`}>
        {role === "adopter_admin" && (
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Overall Throughput</h3>
              <div className="text-xs text-neutral-600">
                Peak RPS: <span className="font-semibold text-accent">{peakRps.toFixed(2)}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={overallSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip />
                <Line type="monotone" dataKey="rps" stroke="#0D7C6E" strokeWidth={2} dot={false} />
                {peakIdx >= 0 && (
                  <ReferenceDot
                    x={overallSeries[peakIdx].bucket}
                    y={peakRps}
                    r={5}
                    fill="#D97706"
                    stroke="white"
                    label={{ value: `Peak ${peakRps}`, position: "top", fontSize: 11, fill: "#D97706" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        )}

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              {role === "adopter_admin" ? "Throughput by Tenant (Top 10)" : "Throughput"}
            </h3>
            <div className="text-xs text-neutral-600">
              Peak: <span className="font-semibold text-accent">
                {Math.max(...tenantSeries.map((s) => s.peakRps)).toFixed(2)} RPS
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={merged}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {tenantSeries.map((ts, i) => (
                <Line
                  key={ts.tenantId}
                  type="monotone"
                  dataKey={ts.name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={1.8}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </section>
  );
}
