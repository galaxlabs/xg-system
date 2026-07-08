import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchActivityLogsExtended, fetchActivityEntryBreakdown, fetchCallAnalysis,
  thisMonthRange, fmtMins,
} from "../lib/api";
import {
  Card, CardHeader, DataTable, LoadingBlock, EmptyBlock, StatCard,
  FilterRow, DateInput, Tabs,
} from "../components/ui/index";
import { ColumnChart, BarChart, DonutChart } from "../components/charts/index";
import { Phone, Clock, Monitor, Globe, Activity } from "lucide-react";

const today = () => new Date().toISOString().split("T")[0];

export default function ActivityPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo] = useState(to);
  const [activeTab, setTab] = useState(0);

  const logQuery = useQuery({
    queryKey: ["activity-ext", fromDate, toDate],
    queryFn: () => fetchActivityLogsExtended({ start_date: fromDate, end_date: toDate }),
  });
  const breakQuery = useQuery({
    queryKey: ["activity-break", fromDate, toDate],
    queryFn: () => fetchActivityEntryBreakdown({ start_date: fromDate, end_date: toDate }),
  });
  const callQuery = useQuery({
    queryKey: ["call-analysis", fromDate, toDate],
    queryFn: () => fetchCallAnalysis({ start_date: fromDate, end_date: toDate }),
  });

  const logs = logQuery.data ?? [];
  const breakdown = breakQuery.data;
  const calls = callQuery.data;

  const totalActive = logs.reduce((s, r) => s + (r.total_active_minutes ?? 0), 0);
  const totalIdle = logs.reduce((s, r) => s + (r.total_idle_minutes ?? 0), 0);
  const totalUnauth = logs.reduce((s, r) => s + (r.unauthorized_site_hits ?? 0), 0);
  const totalCalls = (calls?.daily_summary ?? []).reduce((s, r) => s + (r.total_calls ?? 0), 0);

  const callDir = calls?.direction_breakdown ?? [];
  const outboundCalls = callDir.find((d) => d.direction === "Outbound")?.count ?? 0;
  const inboundCalls = callDir.find((d) => d.direction === "Inbound")?.count ?? 0;

  const logTop = logs.slice(0, 12);
  const logBarCats = logTop.map((r) => r.employee_name || r.employee);
  const logActiveSeries = logTop.map((r) => r.total_active_minutes ?? 0);
  const logIdleSeries = logTop.map((r) => r.total_idle_minutes ?? 0);

  const tabs = [
    { label: "Activity Logs", count: logs.length },
    { label: "Time Breakdown", count: breakdown?.total_rows ?? 0 },
    { label: "Call Analysis", count: totalCalls },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => { logQuery.refetch(); breakQuery.refetch(); callQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To" value={toDate} onChange={setTo} />
      </FilterRow>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Active" value={fmtMins(totalActive)} color="#10b981" icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Total Idle" value={fmtMins(totalIdle)} color="#f59e0b" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Unauthorized" value={totalUnauth} color="#ef4444" icon={<Globe className="h-4 w-4" />} />
        <StatCard label="Calls Dialed" value={totalCalls} color="#6366f1" icon={<Phone className="h-4 w-4" />} />
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Active vs Idle Minutes" subtitle="Top 12 employees" />
              <div className="px-4 pb-4">
                {logQuery.isLoading ? <LoadingBlock /> : logTop.length === 0 ? <EmptyBlock /> : (
                  <ColumnChart categories={logBarCats} series={[
                    { name: "Active", data: logActiveSeries, color: "#10b981" },
                    { name: "Idle", data: logIdleSeries, color: "#f59e0b" },
                  ]} height={300} />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Productivity Score" subtitle="Per employee avg" />
              <div className="px-4 pb-4">
                {logQuery.isLoading ? <LoadingBlock /> : logTop.length === 0 ? <EmptyBlock /> : (
                  <BarChart categories={logBarCats} series={[
                    { name: "Productivity %", data: logTop.map((r) => r.productivity_score ?? 0), color: "#8b5cf6" },
                  ]} height={300} />
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Employee Activity Logs" action={<span className="gc-badge-indigo">{logs.length} rows</span>} />
            <div className="px-4 pb-4">
              {logQuery.isLoading ? <LoadingBlock /> : logs.length === 0 ? <EmptyBlock /> : (
                <DataTable
                  cols={[
                    { key: "date", label: "Date", width: "90px" },
                    { key: "employee_name", label: "Employee" },
                    { key: "department", label: "Dept" },
                    { key: "total_active_minutes", label: "Active", align: "right",
                      render: (r) => <span className="text-emerald-600 font-medium">{fmtMins(r.total_active_minutes ?? 0)}</span> },
                    { key: "total_idle_minutes", label: "Idle", align: "right",
                      render: (r) => <span className="text-amber-500">{fmtMins(r.total_idle_minutes ?? 0)}</span> },
                    { key: "total_calls_today", label: "Calls", align: "right" },
                    { key: "unauthorized_site_hits", label: "Unauth", align: "right",
                      render: (r) => (r.unauthorized_site_hits ?? 0) > 0
                        ? <span className="gc-badge-red">{r.unauthorized_site_hits}</span>
                        : <span className="text-xs text-muted">0</span> },
                    { key: "productivity_score", label: "Prod%", align: "right",
                      render: (r) => {
                        const s = r.productivity_score ?? 0;
                        return <span className={s >= 70 ? "gc-badge-green" : s >= 40 ? "gc-badge-yellow" : "gc-badge-red"}>{s}%</span>;
                      }},
                    { key: "status", label: "Status" },
                  ]}
                  rows={logs}
                  keyField="name"
                />
              )}
            </div>
          </Card>
        </>
      )}

      {activeTab === 1 && (
        <>
          {breakQuery.isLoading ? <LoadingBlock /> : breakdown ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader title="Time by Activity Type" subtitle="Where time was spent" icon={<Activity className="h-4 w-4" />} />
                <div className="px-4 pb-4">
                  {breakdown.by_event_type.length === 0 ? <EmptyBlock /> : (
                    <DonutChart
                      title="Activity Type"
                      categories={breakdown.by_event_type.map((r) => r.event_type)}
                      series={breakdown.by_event_type.map((r) => r.total_minutes)}
                      height={280}
                    />
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader title="Time by Application" subtitle="Top apps used" icon={<Monitor className="h-4 w-4" />} />
                <div className="px-4 pb-4 max-h-80 overflow-y-auto space-y-2">
                  {breakdown.by_app.length === 0 ? <EmptyBlock /> : breakdown.by_app.map((app) => (
                    <div key={app.active_app} className="flex items-center justify-between rounded-[6px] bg-[var(--gc-surface)] px-3 py-2 text-sm">
                      <span className="font-medium truncate">{app.active_app}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-[var(--gc-muted)]">{app.count} events</span>
                        <span className="font-semibold text-emerald-600">{fmtMins(app.total_minutes)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader title="Time by Domain" subtitle="Where online time was spent" icon={<Globe className="h-4 w-4" />} />
                  <div className="gc-card-body">
                    {breakdown.by_domain.length === 0 ? <EmptyBlock /> : (
                      <DataTable
                        cols={[
                          { key: "domain", label: "Domain" },
                          { key: "total_minutes", label: "Time", align: "right",
                            render: (r) => <span className="font-medium">{fmtMins(r.total_minutes)}</span> },
                          { key: "avg_productivity", label: "Productivity", align: "right",
                            render: (r) => <span className={r.avg_productivity >= 70 ? "gc-badge-green" : "gc-badge-yellow"}>{r.avg_productivity}</span> },
                          { key: "unauthorized_pct", label: "Unauth %", align: "right",
                            render: (r) => r.unauthorized_pct > 0
                              ? <span className="gc-badge-red">{r.unauthorized_pct}%</span>
                              : <span className="text-xs text-muted">0%</span> },
                        ]}
                        rows={breakdown.by_domain}
                        keyField="domain"
                      />
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Per-Employee Summary" subtitle="Productivity across period" />
                  <div className="gc-card-body">
                    {breakdown.productivity_summary.length === 0 ? <EmptyBlock /> : (
                      <DataTable
                        cols={[
                          { key: "employee", label: "Employee" },
                          { key: "days_tracked", label: "Days", align: "right" },
                          { key: "total_active_minutes", label: "Active", align: "right",
                            render: (r) => <span className="text-emerald-600">{fmtMins(r.total_active_minutes)}</span> },
                          { key: "total_idle_minutes", label: "Idle", align: "right",
                            render: (r) => <span className="text-amber-500">{fmtMins(r.total_idle_minutes)}</span> },
                          { key: "avg_productivity", label: "Prod%", align: "right",
                            render: (r) => {
                              const s = r.avg_productivity ?? 0;
                              return <span className={s >= 70 ? "gc-badge-green" : s >= 40 ? "gc-badge-yellow" : "gc-badge-red"}>{s}%</span>;
                            }},
                        ]}
                        rows={breakdown.productivity_summary}
                        keyField="employee"
                      />
                    )}
                  </div>
                </Card>
              </div>
            </div>
          ) : <EmptyBlock />}
        </>
      )}

      {activeTab === 2 && (
        <>
          {callQuery.isLoading ? <LoadingBlock /> : calls ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Outbound Calls" value={outboundCalls} color="#6366f1" icon={<Phone className="h-4 w-4" />} />
                <StatCard label="Inbound Calls" value={inboundCalls} color="#10b981" icon={<Phone className="h-4 w-4" />} />
              </div>
              <Card>
                <CardHeader title="Daily Call Summary" subtitle={`${fromDate} to ${toDate}`} action={<span className="gc-badge-indigo">{calls.daily_summary.length} days</span>} />
                <div className="gc-card-body">
                  {calls.daily_summary.length === 0 ? <EmptyBlock msg="No call records found" /> : (
                    <DataTable
                      cols={[
                        { key: "date", label: "Date" },
                        { key: "employee", label: "Employee" },
                        { key: "total_calls", label: "Total", align: "right" },
                        { key: "answered_calls", label: "Answered", align: "right" },
                        { key: "missed_calls", label: "Missed", align: "right",
                          render: (r) => r.missed_calls > 0 ? <span className="gc-badge-red">{r.missed_calls}</span> : <span className="text-xs text-muted">0</span> },
                        { key: "rejected_calls", label: "Rejected", align: "right",
                          render: (r) => r.rejected_calls > 0 ? <span className="gc-badge-yellow">{r.rejected_calls}</span> : <span className="text-xs text-muted">0</span> },
                        { key: "total_talk_time_seconds", label: "Talk Time", align: "right",
                          render: (r) => fmtMins(Math.round((r.total_talk_time_seconds ?? 0) / 60)) },
                        { key: "average_call_seconds", label: "Avg (sec)", align: "right" },
                      ]}
                      rows={calls.daily_summary}
                      keyField={(r) => `${r.employee}-${r.date}`}
                    />
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader title="Call Direction Breakdown" />
                <div className="gc-card-body">
                  {calls.direction_breakdown.length === 0 ? <EmptyBlock msg="No direction data" /> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {calls.direction_breakdown.map((d) => (
                        <div key={d.direction} className="rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-surface)] p-4 text-center">
                          <div className="text-2xl font-bold text-[var(--gc-text)]">{d.count}</div>
                          <div className="text-xs text-[var(--gc-muted)]">{d.direction} calls</div>
                          <div className="mt-1 text-xs text-[var(--gc-muted)]">Avg {Math.round(d.avg_duration_seconds)}s per call</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : <EmptyBlock />}
        </>
      )}
    </div>
  );
}
