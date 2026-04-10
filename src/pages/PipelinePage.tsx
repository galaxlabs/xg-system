import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPipelineSnapshot, fetchStageVelocity, fetchLedgerTrend, thisMonthRange } from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, ProgressBar, Badge,
} from "../components/ui/index";
import { DonutChart, BarChart, ColumnChart } from "../components/charts/index";
import type { VelocityRow } from "../lib/types";

const STAGE_ORDER = ["Fresh", "Qualifying", "Prospecting", "Agreed", "Submitted", "Approved", "Agreement Sent", "Signed", "Converted", "Installed", "Rejected"];

const stageColor = (state: string) => {
  const m: Record<string, string> = {
    Fresh: "#94a3b8", Qualifying: "#64748b", Prospecting: "#6366f1",
    Agreed: "#a78bfa", Submitted: "#f59e0b", Approved: "#0ea5e9",
    "Agreement Sent": "#f97316", Signed: "#10b981", Converted: "#22c55e",
    Installed: "#16a34a", Rejected: "#ef4444",
  };
  return m[state] ?? "#6b7280";
};

export default function PipelinePage() {
  const { from, to } = thisMonthRange();
  const [company, setCompany] = useState("");

  const snap = useQuery({
    queryKey: ["pipeline_snap", company],
    queryFn: () => fetchPipelineSnapshot({ company: company || undefined }),
  });

  const vel = useQuery({
    queryKey: ["velocity", from, to, company],
    queryFn: () => fetchStageVelocity({ from_date: from, to_date: to, ...(company ? { company } : {}) }),
  });

  const trend = useQuery({
    queryKey: ["ledger_trend", company],
    queryFn: () => fetchLedgerTrend({ months_back: 12, company: company || undefined }),
  });

  // Sort states by funnel order
  const sortedStates = [...(snap.data?.states ?? [])].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.state);
    const bi = STAGE_ORDER.indexOf(b.state);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const donutData = sortedStates.map((s) => ({
    name: s.state,
    y: s.count,
    color: stageColor(s.state),
  }));

  const total    = snap.data?.total ?? 0;
  const signRate = snap.data?.sign_rate ?? 0;
  const convRate = snap.data?.conversion_rate ?? 0;
  const rejRate  = snap.data?.rejection_rate ?? 0;

  const maxVel = Math.max(...(vel.data ?? []).map((v) => v.avg_days), 1);
  const velColor = (d: number) => d > 14 ? "#ef4444" : d > 7 ? "#f59e0b" : "#10b981";

  const trendCats   = trend.data?.categories ?? [];
  const trendSeries = (trend.data?.series ?? []).map((s) => ({ name: s.name, data: s.data, color: s.color }));

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => { snap.refetch(); vel.refetch(); trend.refetch(); }}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input className="gc-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="All companies" />
        </label>
      </FilterRow>

      {/* Summary cards */}
      {snap.isLoading ? <LoadingBlock /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Active"         value={total}              color="#6366f1" />
          <StatCard label="Sign Rate"            value={`${signRate}%`}     color="#10b981" />
          <StatCard label="Conversion Rate"      value={`${convRate}%`}     color="#0ea5e9" />
          <StatCard label="Rejection Rate"       value={`${rejRate}%`}      color="#ef4444" />
        </div>
      )}

      {/* Funnel table + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader title="Pipeline Funnel" subtitle="Live lead counts by stage"
            action={total > 0 ? <span className="gc-badge-indigo">{total} total</span> : undefined} />
          <div className="px-5 pb-5 space-y-2 overflow-auto max-h-[420px]">
            {snap.isLoading ? <LoadingBlock /> : sortedStates.length === 0 ? <EmptyBlock /> : (
              sortedStates.map((s) => {
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.state} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: stageColor(s.state) }}
                    />
                    <span className="w-36 text-xs text-text truncate" title={s.state}>{s.state}</span>
                    <ProgressBar value={s.count} max={total || 1} color={stageColor(s.state)} />
                    <span className="w-10 text-xs font-bold text-right" style={{ color: stageColor(s.state) }}>
                      {s.count}
                    </span>
                    <span className="w-8 text-xs text-muted text-right">{pct}%</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Donut */}
        <Card>
          <CardHeader title="Stage Distribution" />
          <div className="px-4 pb-4">
            {donutData.length > 0
              ? <DonutChart data={donutData} height={380} />
              : <LoadingBlock />}
          </div>
        </Card>
      </div>

      {/* Stage velocity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Stage Velocity" subtitle="Average days from entry to exit per stage" />
          <div className="px-5 pb-5 space-y-2 overflow-auto max-h-80">
            {vel.isLoading ? <LoadingBlock /> : (vel.data?.length ?? 0) === 0 ? <EmptyBlock /> : (
              (vel.data ?? []).slice(0, 15).map((v: VelocityRow) => (
                <div key={v.state} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-text truncate">{v.state}</span>
                  <ProgressBar value={v.avg_days} max={maxVel} color={velColor(v.avg_days)} />
                  <span className="w-14 text-xs font-bold text-right" style={{ color: velColor(v.avg_days) }}>
                    {v.avg_days}d
                  </span>
                  <span className="w-16 text-xs text-muted text-right">{v.transitions} transitions</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Velocity bar chart */}
        <Card>
          <CardHeader title="Velocity Chart" />
          <div className="px-4 pb-4">
            {vel.isLoading ? <LoadingBlock /> : (vel.data?.length ?? 0) === 0 ? <EmptyBlock /> : (
              <BarChart
                categories={(vel.data ?? []).slice(0, 12).map((v: VelocityRow) => v.state)}
                series={[
                  {
                    name: "Avg Days",
                    data: (vel.data ?? []).slice(0, 12).map((v: VelocityRow) => v.avg_days),
                    color: "#6366f1",
                  },
                ]}
                height={300}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Historical trend */}
      {trendCats.length > 0 && (
        <Card>
          <CardHeader title="12-Month Approval/Rejection/Signed Trend" subtitle="From Agent Stage Ledger" />
          <div className="px-4 pb-4">
            <ColumnChart categories={trendCats} series={trendSeries} height={280} />
          </div>
        </Card>
      )}

      {/* State breakdown table */}
      {sortedStates.length > 0 && (
        <Card>
          <CardHeader title="Stage Summary Table" />
          <div className="px-4 pb-4">
            <DataTable
              cols={[
                { key: "state", label: "Stage",
                  render: (r: { state: string; count: number }) => (
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: stageColor(r.state) }} />
                      {r.state}
                    </span>
                  ) },
                { key: "count", label: "Leads", align: "right" as const,
                  render: (r: { state: string; count: number }) => <span className="font-bold">{r.count}</span> },
                { key: "count", label: "% of Total", align: "right" as const,
                  render: (r: { state: string; count: number }) => (
                    <span className="text-muted text-xs">
                      {total > 0 ? Math.round((r.count / total) * 100) : 0}%
                    </span>
                  ) },
              ]}
              rows={sortedStates}
              keyField="state"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
