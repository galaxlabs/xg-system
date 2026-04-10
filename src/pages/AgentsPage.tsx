import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAgentBreakdown, fetchAgentPerformance, fetchMultiTrend, thisMonthRange } from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, SectionTitle, Badge,
} from "../components/ui/index";
import { ColumnChart, BarChart } from "../components/charts/index";
import type { AgentRow, AgentPerfRow, TrendSeries } from "../lib/types";

const SORT_OPTIONS = ["total_signs", "total_approved", "total_rejected", "net_commission"] as const;
type SortField = typeof SORT_OPTIONS[number];

export default function AgentsPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo]   = useState(to);
  const [company, setCompany] = useState("");
  const [sortField, setSortField] = useState<SortField>("total_signs");
  const [topN, setTopN] = useState(10);

  const args = { from_date: fromDate, to_date: toDate, ...(company ? { company } : {}) };

  const { data: agentRows = [], isLoading: abLoading } = useQuery({
    queryKey: ["agent_breakdown", fromDate, toDate, company],
    queryFn: () => fetchAgentBreakdown(args),
  });

  const { data: perfRows = [], isLoading: perfLoading } = useQuery({
    queryKey: ["agent_perf", fromDate, toDate, company],
    queryFn: () => fetchAgentPerformance(args),
  });

  const { data: trendData } = useQuery({
    queryKey: ["multi_trend", fromDate, toDate, company],
    queryFn: () => fetchMultiTrend({ ...args, months_back: 6 }),
  });

  // Sort agent rows
  const sorted = [...agentRows].sort((a, b) => {
    const aVal = (a[sortField] as number) ?? 0;
    const bVal = (b[sortField] as number) ?? 0;
    return bVal - aVal;
  }).slice(0, topN);

  // Top performers for bar charts
  const topBySign     = [...agentRows].sort((a, b) => ((b.total_signs    as number) ?? 0) - ((a.total_signs    as number) ?? 0)).slice(0, 10);
  const topByApproved = [...agentRows].sort((a, b) => ((b.total_approved as number) ?? 0) - ((a.total_approved as number) ?? 0)).slice(0, 10);

  // Sign rate badge
  const signRateBadge = (rate: number | undefined) => {
    const r = rate ?? 0;
    if (r >= 40) return <span className="gc-badge-green">{r}%</span>;
    if (r >= 20) return <span className="gc-badge-yellow">{r}%</span>;
    return <span className="gc-badge-red">{r}%</span>;
  };

  // Summary KPIs
  const totalAgents     = agentRows.length;
  const totalSigns      = agentRows.reduce((s, a) => s + (a.total_signs    ?? 0), 0);
  const totalApproved   = agentRows.reduce((s, a) => s + (a.total_approved ?? 0), 0);
  const totalConverted  = agentRows.reduce((s, a) => s + (a.total_converted ?? 0), 0);
  const topAgent        = topBySign[0]?.display_name ?? "—";

  // Trend series
  const trendCats   = trendData?.categories ?? [];
  const trendSeries: TrendSeries[] = trendData?.series ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => {}}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input className="gc-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="All" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Sort by</span>
          <select className="gc-select" value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
            <option value="total_signs">Signs</option>
            <option value="total_approved">Approved</option>
            <option value="total_rejected">Rejected</option>
            <option value="net_commission">Commission</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Show Top</span>
          <select className="gc-select" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </FilterRow>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Agents"   value={totalAgents}   color="#6366f1" />
        <StatCard label="Total Signs"     value={totalSigns}    color="#10b981" />
        <StatCard label="Total Approved"  value={totalApproved} color="#f59e0b" />
        <StatCard label="Top Performer"   value={topAgent}      color="#0ea5e9" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Top Agents by Signs" />
          <div className="px-4 pb-4">
            {abLoading ? <LoadingBlock /> : topBySign.length === 0 ? <EmptyBlock /> : (
              <BarChart
                categories={topBySign.map((a) => a.display_name ?? a.agent)}
                series={[
                  { name: "Signs",    data: topBySign.map((a) => a.total_signs    ?? 0), color: "#10b981" },
                  { name: "Approved", data: topBySign.map((a) => a.total_approved ?? 0), color: "#6366f1" },
                ]}
                height={300}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Agents by Approved" />
          <div className="px-4 pb-4">
            {abLoading ? <LoadingBlock /> : topByApproved.length === 0 ? <EmptyBlock /> : (
              <BarChart
                categories={topByApproved.map((a) => a.display_name ?? a.agent)}
                series={[
                  { name: "Approved",  data: topByApproved.map((a) => a.total_approved  ?? 0), color: "#6366f1" },
                  { name: "Converted", data: topByApproved.map((a) => a.total_converted ?? 0), color: "#f59e0b" },
                ]}
                height={300}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Multi-trend */}
      {trendCats.length > 0 && (
        <Card>
          <CardHeader title="Company + Agent Trend (6 Months)" subtitle="Stacked column by tracked companies" />
          <div className="px-4 pb-4">
            <ColumnChart
              categories={trendCats}
              series={trendSeries.map((s) => ({ name: s.name, data: s.data }))}
              height={280}
              stacked
            />
          </div>
        </Card>
      )}

      {/* Full agent breakdown table */}
      <Card>
        <CardHeader
          title="Multi-Dimensional Agent Breakdown"
          subtitle={`${sorted.length} of ${totalAgents} agents • sorted by ${sortField.replace(/_/g, " ")}`}
        />
        <div className="px-4 pb-4">
          {abLoading ? <LoadingBlock /> : sorted.length === 0 ? <EmptyBlock /> : (
            <DataTable<AgentRow>
              cols={[
                { key: "display_name", label: "Agent",
                  render: (r) => <span className="font-medium">{r.display_name ?? r.agent}</span> },
                { key: "company",         label: "Company", width: "120px" },
                { key: "total_submitted", label: "Submitted", align: "right" as const },
                { key: "total_approved",  label: "Approved",  align: "right" as const },
                { key: "total_signs",     label: "Signs",     align: "right" as const,
                  render: (r) => <span className="font-bold text-emerald-600">{r.total_signs ?? 0}</span> },
                { key: "total_converted", label: "Converted", align: "right" as const },
                { key: "total_installed", label: "Installed", align: "right" as const },
                { key: "total_rejected",  label: "Rejected",  align: "right" as const,
                  render: (r) => <span className="text-red-500">{r.total_rejected ?? 0}</span> },
                { key: "sign_rate",  label: "Sign Rate",
                  render: (r) => signRateBadge(r.sign_rate as number | undefined) },
                { key: "approval_rate", label: "Appr Rate",
                  render: (r) => <span className="text-xs text-muted">{r.approval_rate ?? 0}%</span> },
              ]}
              rows={sorted}
              keyField="agent"
            />
          )}
        </div>
      </Card>

      {/* Agent Performance (deep metric) */}
      {(perfRows.length > 0 || perfLoading) && (
        <Card>
          <CardHeader title="Agent Performance Report" subtitle="Response time, follow-up rate, conversion efficiency" />
          <div className="px-4 pb-4">
            {perfLoading ? <LoadingBlock /> : perfRows.length === 0 ? <EmptyBlock /> : (
              <DataTable<AgentPerfRow>
                cols={[
                  { key: "agent_name",       label: "Agent" },
                  { key: "total_leads",       label: "Leads",     align: "right" as const },
                  { key: "signed",            label: "Signed",    align: "right" as const,
                    render: (r) => <span className="font-bold text-emerald-600">{r.signed}</span> },
                  { key: "approved",          label: "Approved",  align: "right" as const },
                  { key: "rejected",          label: "Rejected",  align: "right" as const,
                    render: (r) => <span className="text-red-500">{r.rejected}</span> },
                  { key: "sign_rate",         label: "Sign %",
                    render: (r) => signRateBadge(r.sign_rate as number | undefined) },
                  { key: "avg_response_days", label: "Avg Response",
                    render: (r) => <span className="text-xs">{r.avg_response_days ?? "—"}d</span> },
                ]}
                rows={perfRows}
                keyField="agent_name"
              />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
