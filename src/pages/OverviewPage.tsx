import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchOverview, fetchCompanyBreakdown, fetchAgentBreakdown,
  fetchMultiTrend, fetchRecentSigned, thisMonthRange, fmtPct,
} from "../lib/api";
import { StatCard, Card, CardHeader, DataTable, LoadingBlock, FilterRow, DateInput, Badge } from "../components/ui/index";
import { ColumnChart, AreaChart } from "../components/charts/index";
import type { CompanyRow, AgentRow } from "../lib/types";

const STATE_COLORS: Record<string, string> = {
  Signed:    "#10b981", Installed: "#22c55e", Converted: "#0ea5e9",
  Approved:  "#f59e0b", Rejected:  "#ef4444", Cancelled: "#9ca3af",
  Disputed:  "#8b5cf6", Draft:     "#6b7280",
};

function stateBadge(state: string) {
  const c = STATE_COLORS[state] ?? "#6b7280";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${c}22`, color: c }}>
      {state}
    </span>
  );
}

export default function OverviewPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo] = useState(to);

  const args = { from_date: fromDate, to_date: toDate };

  const { data: overview, isLoading: ovLoading, refetch: ovRefetch } = useQuery({
    queryKey: ["overview", fromDate, toDate],
    queryFn: () => fetchOverview(args),
  });

  const { data: companies = [], isLoading: coLoading } = useQuery({
    queryKey: ["companies", fromDate, toDate],
    queryFn: () => fetchCompanyBreakdown(args),
  });

  const { data: agents = [], isLoading: agLoading } = useQuery({
    queryKey: ["agents", fromDate, toDate],
    queryFn: () => fetchAgentBreakdown(args),
  });

  const { data: trend } = useQuery({
    queryKey: ["trend"],
    queryFn: () => fetchMultiTrend({ months_back: 12 }),
  });

  const { data: recentSigned = [] } = useQuery({
    queryKey: ["recent_signed", fromDate, toDate],
    queryFn: () => fetchRecentSigned({ ...args, limit: 15 }),
  });

  const counts = overview?.counts;

  const statCards = [
    { label: "Submitted",      value: counts?.submitted      ?? "—", color: "#6366f1" },
    { label: "Approved",       value: counts?.approved       ?? "—", color: "#f59e0b" },
    { label: "Agreement Sent", value: counts?.agreement_sent ?? "—", color: "#0ea5e9" },
    { label: "Signed",         value: counts?.signed         ?? "—", color: "#10b981" },
    { label: "Converted",      value: counts?.converted      ?? "—", color: "#22c55e" },
    { label: "Installed",      value: counts?.installed      ?? "—", color: "#14b8a6" },
    { label: "Rejected",       value: counts?.rejected       ?? "—", color: "#ef4444" },
    { label: "Net Signed",     value: counts?.net_signed     ?? "—", color: "#8b5cf6" },
  ];

  // Conversion rates
  const sub = counts?.submitted ?? 0;
  const signRate    = fmtPct(counts?.signed    ?? 0, sub);
  const approvalRate = fmtPct(counts?.approved  ?? 0, sub);
  const rejectRate  = fmtPct(counts?.rejected  ?? 0, sub);

  // Trend chart
  const trendCategories = trend?.categories ?? [];
  const trendSeries = (trend?.series ?? []).map((s) => ({
    name: s.name,
    data: s.data,
    color: STATE_COLORS[s.name],
  }));

  // Company table
  const companyCols = [
    { key: "operator_company", label: "Company", width: "180px" },
    { key: "submitted",        label: "Sub",    align: "right" as const },
    { key: "approved",         label: "Appr",   align: "right" as const },
    { key: "signed",           label: "Signed", align: "right" as const,
      render: (r: CompanyRow) => <span className="font-bold text-emerald-600">{r.signed}</span> },
    { key: "installed",        label: "Inst",   align: "right" as const },
    { key: "rejected",         label: "Rej",    align: "right" as const,
      render: (r: CompanyRow) => <span className="text-red-500">{r.rejected}</span> },
    { key: "net_signed",       label: "Net",    align: "right" as const,
      render: (r: CompanyRow) => <span className="font-bold text-indigo-600">{r.net_signed}</span> },
  ];

  const agentCols = [
    { key: "agent",      label: "Agent",  width: "160px" },
    { key: "submitted",  label: "Sub",    align: "right" as const },
    { key: "signed",     label: "Signed", align: "right" as const,
      render: (r: AgentRow) => <span className="font-bold text-emerald-600">{r.signed as number}</span> },
    { key: "installed",  label: "Inst",   align: "right" as const },
    { key: "rejected",   label: "Rej",    align: "right" as const,
      render: (r: AgentRow) => <span className="text-red-500">{r.rejected as number}</span> },
    { key: "net_signed", label: "Net",    align: "right" as const },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <FilterRow onRefresh={() => ovRefetch()}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
      </FilterRow>

      {/* Rate badges */}
      <div className="flex flex-wrap gap-3">
        <span className="gc-badge-green">Sign Rate: {signRate}</span>
        <span className="gc-badge-yellow">Approval Rate: {approvalRate}</span>
        <span className="gc-badge-red">Rejection Rate: {rejectRate}</span>
      </div>

      {/* KPI cards */}
      {ovLoading ? <LoadingBlock /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
          {statCards.map((c) => (
            <StatCard key={c.label} label={c.label} value={c.value} color={c.color} />
          ))}
        </div>
      )}

      {/* Trend + Pipeline donut */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="12-Month Milestone Trend" />
          <div className="px-4 pb-4">
            {trendSeries.length > 0
              ? <AreaChart categories={trendCategories} series={trendSeries} height={260} />
              : <LoadingBlock />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Current Pipeline — Status Snapshot" />
          <div className="px-4 pb-4 overflow-auto max-h-64">
            {overview?.status_snapshot?.length ? (
              <table className="gc-table">
                <thead><tr><th>Status</th><th style={{ textAlign: "right" }}>Count</th></tr></thead>
                <tbody>
                  {overview.status_snapshot.map((r) => (
                    <tr key={r.label}>
                      <td>{stateBadge(r.label ?? "")}</td>
                      <td style={{ textAlign: "right" }} className="font-semibold">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <LoadingBlock />}
          </div>
        </Card>
      </div>

      {/* Stacked column chart by month */}
      {trendSeries.length > 0 && (
        <Card>
          <CardHeader title="Milestone Comparison — Bar View" />
          <div className="px-4 pb-4">
            <ColumnChart categories={trendCategories} series={trendSeries} height={260} stacked />
          </div>
        </Card>
      )}

      {/* Company + Agent tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Company Breakdown" subtitle={`${fromDate} → ${toDate}`} />
          <div className="px-4 pb-4 overflow-auto max-h-72">
            {coLoading ? <LoadingBlock /> : (
              <DataTable<CompanyRow> cols={companyCols} rows={companies} keyField="operator_company" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Agent Breakdown" subtitle={`${fromDate} → ${toDate}`} />
          <div className="px-4 pb-4 overflow-auto max-h-72">
            {agLoading ? <LoadingBlock /> : (
              <DataTable<AgentRow> cols={agentCols} rows={agents} keyField="agent" />
            )}
          </div>
        </Card>
      </div>

      {/* Recent Signed */}
      <Card>
        <CardHeader title="Recent Signed Deals" subtitle="Latest 15 signed leads" />
        <div className="px-4 pb-4 overflow-auto max-h-72">
          <DataTable
            cols={[
              { key: "name",           label: "Lead ID",  width: "140px",
                render: (r) => (
                  <a href={`${window.location.origin}/app/atm-leads/${r.name}`}
                     target="_blank" rel="noreferrer"
                     className="text-primary font-mono text-xs hover:underline">{String(r.name)}</a>
                ) },
              { key: "business_name",  label: "Business" },
              { key: "company",        label: "Company" },
              { key: "executive_name", label: "Agent" },
              { key: "state_code",     label: "State",  width: "60px" },
              { key: "sign_date",      label: "Signed", width: "100px" },
            ]}
            rows={recentSigned}
            keyField="name"
          />
        </div>
      </Card>

      {/* Unused variable suppression */}
      <div style={{ display: "none" }}>{agLoading ? "" : ""}{coLoading ? "" : ""}</div>
      {void Badge}
    </div>
  );
}
