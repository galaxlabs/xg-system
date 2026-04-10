import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchActivityLogs, fetchCallSummary, fmtMins, thisMonthRange } from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, ProgressBar, Badge,
} from "../components/ui/index";
import { ColumnChart, BarChart } from "../components/charts/index";
import type { ActivityLogRow } from "../lib/types";

export default function AttendancePage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo]   = useState(to);
  const [search, setSearch] = useState("");

  const logQuery = useQuery({
    queryKey: ["activity_logs", fromDate, toDate],
    queryFn: () => fetchActivityLogs({ from_date: fromDate, to_date: toDate }),
  });

  const callQuery = useQuery({
    queryKey: ["call_summary", fromDate, toDate],
    queryFn: () => fetchCallSummary({ from_date: fromDate, to_date: toDate }),
  });

  const logs   = logQuery.data  ?? [];
  const calls  = callQuery.data ?? [];

  // Filter by search
  const filteredLogs = logs.filter((r) =>
    !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.employee?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by employee — aggregate totals
  const employeeMap = new Map<string, {
    name: string; id: string; active: number; idle: number; unauth: number; days: Set<string>;
  }>();
  for (const row of logs) {
    const key = row.employee ?? "";
    if (!employeeMap.has(key)) {
      employeeMap.set(key, { name: row.employee_name ?? key, id: key, active: 0, idle: 0, unauth: 0, days: new Set() });
    }
    const e = employeeMap.get(key)!;
    e.active += row.active_time_mins ?? 0;
    e.idle   += row.idle_time_mins   ?? 0;
    e.unauth += row.unauthorized_hits ?? 0;
    if (row.log_date) e.days.add(row.log_date);
  }
  const empList = [...employeeMap.values()]
    .sort((a, b) => b.active - a.active)
    .filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()));

  // KPIs
  const totalEmployees = employeeMap.size;
  const totalActive    = [...employeeMap.values()].reduce((s, e) => s + e.active, 0);
  const totalIdle      = [...employeeMap.values()].reduce((s, e) => s + e.idle,   0);
  const totalUnauth    = [...employeeMap.values()].reduce((s, e) => s + e.unauth, 0);

  // Chart data — top 12 by active time
  const top12 = empList.slice(0, 12);
  const barCats = top12.map((e) => e.name);

  // Activity % badge
  const actPct = (active: number, idle: number) => {
    const total = active + idle;
    if (total === 0) return <span className="gc-badge-gray">—</span>;
    const pct = Math.round((active / total) * 100);
    if (pct >= 70) return <span className="gc-badge-green">{pct}%</span>;
    if (pct >= 40) return <span className="gc-badge-yellow">{pct}%</span>;
    return <span className="gc-badge-red">{pct}%</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => { logQuery.refetch(); callQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search employee</span>
          <input className="gc-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or ID" />
        </label>
      </FilterRow>

      {/* KPI cards */}
      {logQuery.isLoading ? <LoadingBlock /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Employees Tracked" value={totalEmployees} color="#6366f1" />
          <StatCard label="Total Active Time"  value={fmtMins(totalActive)} color="#10b981" />
          <StatCard label="Total Idle Time"    value={fmtMins(totalIdle)}   color="#f59e0b" />
          <StatCard label="Unauthorized Hits"  value={totalUnauth}          color="#ef4444" />
        </div>
      )}

      {/* Activity charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Active vs Idle Time (Top 12)" subtitle="Minutes per employee in selected period" />
          <div className="px-4 pb-4">
            {logQuery.isLoading ? <LoadingBlock /> : top12.length === 0 ? <EmptyBlock /> : (
              <ColumnChart
                categories={barCats}
                series={[
                  { name: "Active (mins)", data: top12.map((e) => e.active), color: "#10b981" },
                  { name: "Idle (mins)",   data: top12.map((e) => e.idle),   color: "#f59e0b" },
                ]}
                height={300}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Unauthorized Access Hits (Top 12)" />
          <div className="px-4 pb-4">
            {logQuery.isLoading ? <LoadingBlock /> : top12.length === 0 ? <EmptyBlock /> : (
              <BarChart
                categories={barCats}
                series={[
                  { name: "Unauthorized Hits", data: top12.map((e) => e.unauth), color: "#ef4444" },
                ]}
                height={300}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Days active per employee */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Days Active in Period" subtitle="Unique dates with any logged activity" />
          <div className="px-5 pb-5 space-y-2 overflow-auto max-h-80">
            {logQuery.isLoading ? <LoadingBlock /> : empList.length === 0 ? <EmptyBlock /> : (
              empList.slice(0, 20).map((e) => {
                const days = e.days.size;
                const maxDays = Math.max(...empList.map((x) => x.days.size), 1);
                return (
                  <div key={e.id} className="flex items-center gap-3">
                    <span className="w-36 text-xs text-text truncate">{e.name}</span>
                    <ProgressBar value={days} max={maxDays} color="#6366f1" />
                    <span className="w-10 text-xs font-bold text-right text-indigo-500">{days}d</span>
                    {actPct(e.active, e.idle)}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Call summary */}
        <Card>
          <CardHeader title="Call Summary" subtitle="Daily call activity overview" />
          <div className="px-4 pb-4 overflow-auto max-h-80">
            {callQuery.isLoading ? <LoadingBlock /> : calls.length === 0 ? <EmptyBlock msg="No call data available" /> : (
              <DataTable<Record<string, unknown>>
                cols={[
                  { key: "name",          label: "Date/ID" },
                  { key: "employee_name", label: "Employee" },
                  { key: "total_calls",   label: "Calls",     align: "right" as const },
                  { key: "duration_mins", label: "Duration",  align: "right" as const,
                    render: (r) => <span className="text-xs">{fmtMins(Number(r.duration_mins ?? 0))}</span> },
                  { key: "avg_duration",  label: "Avg (s)",   align: "right" as const },
                ]}
                rows={calls as Record<string, unknown>[]}
                keyField="name"
              />
            )}
          </div>
        </Card>
      </div>

      {/* Daily detail log */}
      <Card>
        <CardHeader
          title="Employee Activity Log — Daily Records"
          action={<span className="gc-badge-indigo">{filteredLogs.length} rows</span>}
        />
        <div className="px-4 pb-4">
          {logQuery.isLoading ? <LoadingBlock /> : filteredLogs.length === 0 ? <EmptyBlock /> : (
            <DataTable<ActivityLogRow>
              cols={[
                { key: "log_date",        label: "Date",     width: "90px" },
                { key: "employee_name",   label: "Employee" },
                { key: "employee",        label: "ID",       width: "80px",
                  render: (r) => <span className="text-xs text-muted font-mono">{r.employee}</span> },
                { key: "active_time_mins",label: "Active",   align: "right" as const,
                  render: (r) => <span className="text-emerald-600 font-medium">{fmtMins(r.active_time_mins ?? 0)}</span> },
                { key: "idle_time_mins",  label: "Idle",     align: "right" as const,
                  render: (r) => <span className="text-amber-500">{fmtMins(r.idle_time_mins ?? 0)}</span> },
                { key: "unauthorized_hits",label: "Unauth Hits",align: "right" as const,
                  render: (r) => (
                    (r.unauthorized_hits ?? 0) > 0
                      ? <span className="gc-badge-red">{r.unauthorized_hits}</span>
                      : <span className="text-xs text-muted">0</span>
                  ) },
                { key: "active_time_mins",label: "Activity %",
                  render: (r) => actPct(r.active_time_mins ?? 0, r.idle_time_mins ?? 0) },
              ]}
              rows={filteredLogs}
              keyField="name"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
