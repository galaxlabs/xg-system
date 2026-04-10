import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchStateByExecutive, thisMonthRange } from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, ProgressBar, Badge,
} from "../components/ui/index";
import { ColumnChart, BarChart } from "../components/charts/index";
import type { StateByExecRow } from "../lib/types";

type DrillMode = "state" | "executive";

export default function DirectionPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo]   = useState(to);
  const [company, setCompany] = useState("");
  const [drill, setDrill]   = useState<DrillMode>("state");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedExec, setSelectedExec] = useState<string | null>(null);
  const [metric, setMetric] = useState<"signed" | "approved" | "submitted">("signed");

  const args = { from_date: fromDate, to_date: toDate, ...(company ? { company } : {}) };

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["state_exec", fromDate, toDate, company],
    queryFn: () => fetchStateByExecutive(args),
  });

  // --- Aggregations ---
  // By state
  const stateMap = useMemo(() => {
    const m = new Map<string, { state: string; signed: number; approved: number; submitted: number; execs: Set<string> }>();
    for (const row of data) {
      const k = row.state ?? "Unknown";
      if (!m.has(k)) m.set(k, { state: k, signed: 0, approved: 0, submitted: 0, execs: new Set() });
      const e = m.get(k)!;
      e.signed    += row.signed    ?? 0;
      e.approved  += row.approved  ?? 0;
      e.submitted += row.submitted ?? 0;
      if (row.executive) e.execs.add(row.executive);
    }
    return [...m.values()].sort((a, b) => b[metric] - a[metric]);
  }, [data, metric]);

  // By executive
  const execMap = useMemo(() => {
    const filtered = selectedState ? data.filter((r) => r.state === selectedState) : data;
    const m = new Map<string, { exec: string; signed: number; approved: number; submitted: number; states: Set<string> }>();
    for (const row of filtered) {
      const k = row.executive ?? "Unknown";
      if (!m.has(k)) m.set(k, { exec: k, signed: 0, approved: 0, submitted: 0, states: new Set() });
      const e = m.get(k)!;
      e.signed    += row.signed    ?? 0;
      e.approved  += row.approved  ?? 0;
      e.submitted += row.submitted ?? 0;
      if (row.state) e.states.add(row.state);
    }
    return [...m.values()].sort((a, b) => b[metric] - a[metric]);
  }, [data, metric, selectedState]);

  // KPIs
  const totalSigned    = stateMap.reduce((s, r) => s + r.signed,    0);
  const totalApproved  = stateMap.reduce((s, r) => s + r.approved,  0);
  const totalSubmitted = stateMap.reduce((s, r) => s + r.submitted, 0);
  const totalStates    = stateMap.length;
  const topState       = stateMap[0]?.state ?? "—";

  // Chart: top 15 states
  const chartStates = stateMap.slice(0, 15);
  const chartCats   = chartStates.map((s) => s.state);

  // For exec chart filtered
  const chartExecs = execMap.slice(0, 12);
  const execCats   = chartExecs.map((e) => e.exec);

  // Raw detail filtered view
  const filteredRaw = useMemo(() => {
    let rows = data;
    if (selectedState) rows = rows.filter((r) => r.state === selectedState);
    if (selectedExec)  rows = rows.filter((r) => r.executive === selectedExec);
    return rows.sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  }, [data, selectedState, selectedExec, metric]);

  const metricLabel = (r: StateByExecRow) => {
    if (metric === "signed")    return r.signed    ?? 0;
    if (metric === "approved")  return r.approved  ?? 0;
    return r.submitted ?? 0;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => refetch()}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input className="gc-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="All" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Metric</span>
          <select className="gc-select" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
            <option value="signed">Signed</option>
            <option value="approved">Approved</option>
            <option value="submitted">Submitted</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Drill by</span>
          <select className="gc-select" value={drill} onChange={(e) => { setDrill(e.target.value as DrillMode); setSelectedState(null); setSelectedExec(null); }}>
            <option value="state">By State</option>
            <option value="executive">By Executive</option>
          </select>
        </label>
      </FilterRow>

      {/* KPIs */}
      {isLoading ? <LoadingBlock /> : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard label="States Covered"  value={totalStates}    color="#6366f1" />
          <StatCard label="Total Signed"    value={totalSigned}    color="#10b981" />
          <StatCard label="Total Approved"  value={totalApproved}  color="#f59e0b" />
          <StatCard label="Total Submitted" value={totalSubmitted}  color="#0ea5e9" />
          <StatCard label="Top State"       value={topState}       color="#a855f7" />
        </div>
      )}

      {/* State bar chart + exec bar chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title={`Top 15 States by ${metric.charAt(0).toUpperCase() + metric.slice(1)}`}
            subtitle="Click a bar to drill into executives for that state"
          />
          <div className="px-4 pb-4">
            {isLoading ? <LoadingBlock /> : chartStates.length === 0 ? <EmptyBlock /> : (
              <BarChart
                categories={chartCats}
                series={[
                  { name: metric,     data: chartStates.map((s) => s[metric]),    color: "#6366f1" },
                  { name: "Approved", data: chartStates.map((s) => s.approved),   color: "#10b981" },
                ]}
                height={360}
                onPointClick={(cat) => {
                  setSelectedState(selectedState === cat ? null : cat);
                  setSelectedExec(null);
                }}
              />
            )}
          </div>
          {selectedState && (
            <div className="px-4 pb-3 flex items-center gap-2 text-xs">
              <span className="gc-badge-indigo">Filtered: {selectedState}</span>
              <button className="text-muted hover:text-danger" onClick={() => setSelectedState(null)}>✕ Clear</button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title={`Executives${selectedState ? ` — ${selectedState}` : " (All States)"}`}
            subtitle={`Top 12 executives by ${metric}`}
          />
          <div className="px-4 pb-4">
            {isLoading ? <LoadingBlock /> : chartExecs.length === 0 ? <EmptyBlock /> : (
              <BarChart
                categories={execCats}
                series={[
                  { name: metric,     data: chartExecs.map((e) => e[metric]),    color: "#f59e0b" },
                  { name: "Approved", data: chartExecs.map((e) => e.approved),   color: "#0ea5e9" },
                ]}
                height={360}
                onPointClick={(cat) => {
                  setSelectedExec(selectedExec === cat ? null : cat);
                }}
              />
            )}
          </div>
          {selectedExec && (
            <div className="px-4 pb-3 flex items-center gap-2 text-xs">
              <span className="gc-badge-yellow">Executive: {selectedExec}</span>
              <button className="text-muted hover:text-danger" onClick={() => setSelectedExec(null)}>✕ Clear</button>
            </div>
          )}
        </Card>
      </div>

      {/* State heatmap grid */}
      <Card>
        <CardHeader
          title="State Performance Grid"
          subtitle={`${stateMap.length} states • sorted by ${metric} descending`}
        />
        <div className="px-5 pb-5 space-y-2 overflow-auto max-h-96">
          {isLoading ? <LoadingBlock /> : stateMap.length === 0 ? <EmptyBlock /> : (() => {
            const maxVal = Math.max(...stateMap.map((s) => s[metric]), 1);
            return stateMap.map((s) => {
              const intensity = s[metric] / maxVal;
              const bg = `rgba(99,102,241,${0.08 + intensity * 0.4})`;
              return (
                <div
                  key={s.state}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors hover:bg-surface"
                  style={{ background: selectedState === s.state ? bg : undefined }}
                  onClick={() => setSelectedState(selectedState === s.state ? null : s.state)}
                >
                  <span className="w-32 text-xs font-medium text-text truncate">{s.state}</span>
                  <ProgressBar value={s[metric]} max={maxVal} color="#6366f1" />
                  <span className="w-10 text-xs font-bold text-indigo-500 text-right">{s[metric]}</span>
                  <span className="w-10 text-xs text-emerald-600 text-right">{s.approved}</span>
                  <span className="w-10 text-xs text-muted text-right">{s.execs.size} exec{s.execs.size === 1 ? "" : "s"}</span>
                </div>
              );
            });
          })()}
        </div>
      </Card>

      {/* Drill detail table */}
      <Card>
        <CardHeader
          title="Detailed View — State × Executive"
          action={
            <div className="flex gap-2">
              {selectedState && <span className="gc-badge-indigo">{selectedState}</span>}
              {selectedExec  && <span className="gc-badge-yellow">{selectedExec}</span>}
              {(selectedState || selectedExec) && (
                <button className="text-xs text-muted hover:text-danger"
                  onClick={() => { setSelectedState(null); setSelectedExec(null); }}>
                  Clear filters
                </button>
              )}
            </div>
          }
        />
        <div className="px-4 pb-4">
          {isLoading ? <LoadingBlock /> : filteredRaw.length === 0 ? <EmptyBlock /> : (
            <DataTable<StateByExecRow>
              cols={[
                { key: "state",     label: "State" },
                { key: "executive", label: "Executive" },
                { key: "submitted", label: "Submitted", align: "right" as const },
                { key: "approved",  label: "Approved",  align: "right" as const,
                  render: (r) => <span className="text-amber-600 font-medium">{r.approved ?? 0}</span> },
                { key: "signed",    label: "Signed",    align: "right" as const,
                  render: (r) => <span className="font-bold text-emerald-600">{r.signed ?? 0}</span> },
                { key: "installed", label: "Installed", align: "right" as const },
                { key: "rejected",  label: "Rejected",  align: "right" as const,
                  render: (r) => <span className="text-red-500">{r.rejected ?? 0}</span> },
              ]}
              rows={filteredRaw}
              keyField="state"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
