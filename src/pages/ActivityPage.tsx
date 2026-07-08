import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchActivityLogsExtended, fetchActivityEntryBreakdown, fetchCallAnalysis,
  thisMonthRange, fmtMins,
} from "../lib/api";
import {
  Card, CardHeader, DataTable, LoadingBlock, EmptyBlock, StatCard,
  FilterRow, DateInput,
} from "../components/ui/index";
import { ColumnChart, BarChart, DonutChart } from "../components/charts/index";
import { Phone, Clock, Monitor, Globe } from "lucide-react";

export default function ActivityPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo] = useState(to);
  const [activeTab, setTab] = useState("logs");

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
    { key: "logs", label: "Activity Logs", count: logs.length },
    { key: "breakdown", label: "Time Breakdown", count: breakdown?.total_rows ?? 0 },
    { key: "calls", label: "Call Analysis", count: totalCalls },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => { logQuery.refetch(); breakQuery.refetch(); callQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To" value={toDate} onChange={setTo} />
      </FilterRow>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Active" value={fmtMins(totalActive)} color="#10b981" icon={<ActivityIcon />} />
        <StatCard label="Total Idle" value={fmtMins(totalIdle)} color="#f59e0b" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Unauthorized" value={totalUnauth} color="#ef4444" icon={<Globe className="h-4 w-4" />} />
        <StatCard label="Calls Dialed" value={totalCalls} color="#6366f1" icon={<Phone className="h-4 w-4" />} />
      </div>

      {tabs.length > 0 && (
        <div className="gc-tabs">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`gc-tab ${activeTab === t.key ? "active" : ""}`}>
              {t.label}
              {t.count !== undefined && <span className={`gc-tab-count ${activeTab === t.key ? "active" : ""}`}>{t.count}</span>}
            </button>
          ))}
        </div>
      )}

      {activeTab === "logs" && (
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
                    { key: "total_active_minutes", label: "Active", align: "right" as const,
                      render: (r: Record<string, unknown>) => <span className="text-emerald-600 font-medium">{fmtMins(Number(r.total_active_minutes ?? 0))}</span> },
                    { key: "total_idle_minutes", label: "Idle", align: "right" as const,
                      render: (r: Record<string, unknown>) => <span className="text-amber-500">{fmtMins(Number(r.total_idle_minutes ?? 0))}</span> },
                    { key: "total_calls_today", label: "Calls", align: "right" as const },
                    { key: "unauthorized_site_hits", label: "Unauth", align: "right" as const,
                      render: (r: Record<string, unknown>) => (Number(r.unauthorized_site_hits) ?? 0) > 0
                        ? <span className="gc-badge-red">{String(r.unauthorized_site_hits)}</span>
                        : <span className="text-xs text-muted">0</span> },
                    { key: "productivity_score", label: "Prod%", align: "right" as const,
                      render: (r: Record<string, unknown>) => {
                        const s = Number(r.productivity_score) ?? 0;
                        return <span className={s >= 70 ? "gc-badge-green" : s >= 40 ? "gc-badge-yellow" : "gc-badge-red"}>{s}%</span>;
                      }},
                    { key: "status", label: "Status" },
                  ]}
                  rows={logs as unknown as Record<string, unknown>[]}
                  keyField="name"
                />
              )}
            </div>
          </Card>
        </>
      )}

      {activeTab === "breakdown" && (
        <>
          {breakQuery.isLoading ? <LoadingBlock /> : breakdown ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader title="Time by Activity Type" subtitle="Where time was spent" />
                <div className="px-4 pb-4">
                  {breakdown.by_event_type.length === 0 ? <EmptyBlock /> : (
                    <DonutChart
                      title="Activity Type"
                      data={breakdown.by_event_type.map((r) => ({ name: r.event_type, y: r.total_minutes }))}
                      height={280}
                    />
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader title="Time by Application" subtitle="Top apps used" />
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
                  <CardHeader title="Time by Domain" subtitle="Where online time was spent" />
                  <div className="gc-card-body">
                    {breakdown.by_domain.length === 0 ? <EmptyBlock /> : (
                      <DataTable
                        cols={[
                          { key: "domain", label: "Domain" },
                          { key: "total_minutes", label: "Time", align: "right" as const,
                            render: (r: Record<string, unknown>) => <span className="font-medium">{fmtMins(Number(r.total_minutes))}</span> },
                          { key: "avg_productivity", label: "Productivity", align: "right" as const,
                            render: (r: Record<string, unknown>) => {
                              const s = Number(r.avg_productivity);
                              return <span className={s >= 70 ? "gc-badge-green" : "gc-badge-yellow"}>{s}</span>;
                            }},
                          { key: "unauthorized_pct", label: "Unauth %", align: "right" as const,
                            render: (r: Record<string, unknown>) => Number(r.unauthorized_pct) > 0
                              ? <span className="gc-badge-red">{String(r.unauthorized_pct)}%</span>
                              : <span className="text-xs text-muted">0%</span> },
                        ]}
                        rows={breakdown.by_domain as unknown as Record<string, unknown>[]}
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
                          { key: "days_tracked", label: "Days", align: "right" as const },
                          { key: "total_active_minutes", label: "Active", align: "right" as const,
                            render: (r: Record<string, unknown>) => <span className="text-emerald-600">{fmtMins(Number(r.total_active_minutes))}</span> },
                          { key: "total_idle_minutes", label: "Idle", align: "right" as const,
                            render: (r: Record<string, unknown>) => <span className="text-amber-500">{fmtMins(Number(r.total_idle_minutes))}</span> },
                          { key: "avg_productivity", label: "Prod%", align: "right" as const,
                            render: (r: Record<string, unknown>) => {
                              const s = Number(r.avg_productivity) ?? 0;
                              return <span className={s >= 70 ? "gc-badge-green" : s >= 40 ? "gc-badge-yellow" : "gc-badge-red"}>{s}%</span>;
                            }},
                        ]}
                        rows={breakdown.productivity_summary as unknown as Record<string, unknown>[]}
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

      {activeTab === "calls" && (
        <>
          {callQuery.isLoading ? <LoadingBlock /> : calls ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Outbound Calls" value={outboundCalls} color="#6366f1" icon={<IconComponent />} />
                <StatCard label="Inbound Calls" value={inboundCalls} color="#10b981" icon={<IconComponent />} />
              </div>
              <Card>
                <CardHeader title="Daily Call Summary" subtitle={`${fromDate} to ${toDate}`} action={<span className="gc-badge-indigo">{calls.daily_summary.length} days</span>} />
                <div className="gc-card-body">
                  {calls.daily_summary.length === 0 ? <EmptyBlock msg="No call records found" /> : (
                    <DataTable
                      cols={[
                        { key: "date", label: "Date" },
                        { key: "employee", label: "Employee" },
                        { key: "total_calls", label: "Total", align: "right" as const },
                        { key: "answered_calls", label: "Answered", align: "right" as const },
                        { key: "missed_calls", label: "Missed", align: "right" as const,
                          render: (r: Record<string, unknown>) => Number(r.missed_calls) > 0 ? <span className="gc-badge-red">{String(r.missed_calls)}</span> : <span className="text-xs text-muted">0</span> },
                        { key: "rejected_calls", label: "Rejected", align: "right" as const,
                          render: (r: Record<string, unknown>) => Number(r.rejected_calls) > 0 ? <span className="gc-badge-yellow">{String(r.rejected_calls)}</span> : <span className="text-xs text-muted">0</span> },
                        { key: "total_talk_time_seconds", label: "Talk Time", align: "right" as const,
                          render: (r: Record<string, unknown>) => fmtMins(Math.round(Number(r.total_talk_time_seconds ?? 0) / 60)) },
                        { key: "average_call_seconds", label: "Avg (sec)", align: "right" as const },
                      ]}
                      rows={calls.daily_summary as unknown as Record<string, unknown>[]}
                      keyField="date"
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

function ActivityIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconComponent() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
