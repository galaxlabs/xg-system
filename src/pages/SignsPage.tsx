import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchSignsSummary, fetchStageVelocity, fetchPipelineSnapshot,
  fetchLedgerTrend, fetchAgentAttribution, thisMonthRange,
} from "../lib/api";
import {
  StatCard, Card, CardHeader, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, ProgressBar, Button,
} from "../components/ui/index";
import { BarChart, DonutChart, LineChart } from "../components/charts/index";
import { callFrappe } from "../lib/frappe";
import type { PendingSignRow, VelocityRow, AttributionRow } from "../lib/types";

const STATE_COLORS: Record<string, string> = {
  Signed: "#10b981", Installed: "#22c55e", Converted: "#0ea5e9",
  Approved: "#f59e0b", Rejected: "#ef4444", Draft: "#6b7280",
};

export default function SignsPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo]   = useState(to);
  const [company, setCompany] = useState("");
  const [assignTarget, setAssignTarget] = useState<PendingSignRow | null>(null);
  const [closingAgent, setClosingAgent] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const qc = useQueryClient();

  const args = { from_date: fromDate, to_date: toDate, ...(company ? { company } : {}) };

  const { data: summary, isLoading: sumLoading, refetch } = useQuery({
    queryKey: ["signs_summary", fromDate, toDate, company],
    queryFn: () => fetchSignsSummary(args),
  });

  const { data: velocity = [], isLoading: velLoading } = useQuery({
    queryKey: ["velocity", fromDate, toDate, company],
    queryFn: () => fetchStageVelocity(args),
  });

  const { data: pipeline } = useQuery({
    queryKey: ["pipeline_snap", company],
    queryFn: () => fetchPipelineSnapshot({ company: company || undefined }),
  });

  const { data: ledgerTrend } = useQuery({
    queryKey: ["ledger_trend", company],
    queryFn: () => fetchLedgerTrend({ months_back: 6, company: company || undefined }),
  });

  const { data: attribution = [], isLoading: attLoading } = useQuery({
    queryKey: ["attribution", fromDate, toDate, company],
    queryFn: () => fetchAgentAttribution(args),
  });

  // Quick-assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ name, agent, notes }: { name: string; agent: string; notes: string }) => {
      await callFrappe("frappe.client.set_value", {
        doctype: "Signs",
        name,
        fieldname: JSON.stringify({ closing_agent: agent, closing_notes: notes }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signs_summary"] });
      qc.invalidateQueries({ queryKey: ["attribution"] });
      setAssignTarget(null);
      setClosingAgent("");
      setClosingNotes("");
    },
  });

  // Velocity bars
  const maxAvg = Math.max(...velocity.map((v) => v.avg_days), 1);
  const velColor = (d: number) => d > 14 ? "#ef4444" : d > 7 ? "#f59e0b" : "#10b981";

  // Pipeline donut
  const donutData = (pipeline?.states ?? []).map((s) => ({
    name: s.state,
    y: s.count,
    color: STATE_COLORS[s.state] ?? "#6b7280",
  }));

  // Ledger trend
  const trendCats = ledgerTrend?.categories ?? [];
  const trendSeries = (ledgerTrend?.series ?? []).map((s) => ({ name: s.name, data: s.data, color: s.color }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <FilterRow onRefresh={() => refetch()}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input
            className="gc-input"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="All companies"
          />
        </label>
      </FilterRow>

      {/* Summary stat cards */}
      {sumLoading ? <LoadingBlock /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Signs This Period"   value={summary?.total_signs ?? 0}       color="#10b981" />
          <StatCard label="Pending Attribution" value={summary?.pending_attribution ?? 0} color="#ef4444"
            sub="no closing agent" />
          <StatCard label="Attribution Done"    value={summary?.attributed ?? 0}         color="#6366f1" />
          <StatCard label="Sign Rate"           value={(pipeline?.sign_rate ?? 0) + "%"} color="#f59e0b" />
          <StatCard label="Rejection Rate"      value={(pipeline?.rejection_rate ?? 0) + "%"} color="#ef4444" />
          <StatCard label="Total Active Leads"  value={pipeline?.total ?? 0}             color="#0ea5e9" />
        </div>
      )}

      {/* Stage velocity + pipeline donut */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Avg Days Per Stage" subtitle="From Agent Stage Ledger — how long leads sit at each state" />
          <div className="px-5 pb-5 space-y-2 overflow-auto max-h-80">
            {velLoading ? <LoadingBlock /> : velocity.length === 0 ? <EmptyBlock /> : (
              velocity.slice(0, 15).map((v) => (
                <div key={v.state} className="flex items-center gap-3">
                  <span className="w-40 text-xs text-text truncate" title={v.state}>{v.state}</span>
                  <ProgressBar value={v.avg_days} max={maxAvg} color={velColor(v.avg_days)} />
                  <span className="w-16 text-xs font-bold text-right" style={{ color: velColor(v.avg_days) }}>
                    {v.avg_days}d avg
                  </span>
                  <span className="w-10 text-xs text-muted text-right">({v.transitions})</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Live Pipeline Distribution" />
          <div className="px-4 pb-4">
            {donutData.length > 0
              ? <DonutChart data={donutData} height={320} />
              : <LoadingBlock />}
          </div>
        </Card>
      </div>

      {/* Ledger trend */}
      {trendCats.length > 0 && (
        <Card>
          <CardHeader title="Approval / Rejection / Signed Trend (6 months)" subtitle="From Agent Stage Ledger" />
          <div className="px-4 pb-4">
            <LineChart categories={trendCats} series={trendSeries} height={240} />
          </div>
        </Card>
      )}

      {/* Attribution table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Agent Attribution" subtitle="Lead Agent (sourced) vs Closing Agent (commission)" />
          <div className="px-4 pb-4 overflow-auto max-h-80">
            {attLoading ? <LoadingBlock /> : (
              <>
                {attribution.length > 0 && (
                  <BarChart
                    categories={attribution.slice(0, 10).map((r) => r.display_name)}
                    series={[
                      { name: "Lead Agent",    data: attribution.slice(0, 10).map((r) => r.as_lead_agent),    color: "#6366f1" },
                      { name: "Closing Agent", data: attribution.slice(0, 10).map((r) => r.as_closing_agent), color: "#10b981" },
                    ]}
                    height={240}
                  />
                )}
                <DataTable<AttributionRow>
                  cols={[
                    { key: "display_name",    label: "Agent" },
                    { key: "as_lead_agent",   label: "Lead Agent",    align: "right" as const },
                    { key: "as_closing_agent",label: "Closer",        align: "right" as const,
                      render: (r) => <span className="font-bold text-emerald-600">{r.as_closing_agent}</span> },
                    { key: "diff", label: "Δ", align: "right" as const,
                      render: (r) => (
                        <span className={`font-bold ${r.diff > 0 ? "text-emerald-600" : r.diff < 0 ? "text-red-500" : "text-muted"}`}>
                          {r.diff > 0 ? `+${r.diff}` : r.diff}
                        </span>
                      ) },
                  ]}
                  rows={attribution}
                  keyField="agent"
                />
              </>
            )}
          </div>
        </Card>

        {/* Pending attribution */}
        <Card>
          <CardHeader
            title="Pending Commission Attribution"
            action={
              (summary?.pending_attribution ?? 0) > 0
                ? <span className="gc-badge-red">{summary?.pending_attribution} pending</span>
                : <span className="gc-badge-green">All assigned ✓</span>
            }
          />
          <div className="px-4 pb-4 overflow-auto max-h-80">
            {(summary?.pending_records?.length ?? 0) === 0
              ? <EmptyBlock msg="All signs have a closing agent assigned!" />
              : (
                <DataTable<PendingSignRow>
                  cols={[
                    { key: "name",          label: "Signs Record",
                      render: (r) => (
                        <a href={`/app/signs/${r.name}`} target="_blank" rel="noreferrer"
                           className="text-primary text-xs hover:underline font-mono">{r.name}</a>
                      ) },
                    { key: "business_name", label: "Business" },
                    { key: "lead_agent",    label: "Lead Agent" },
                    { key: "sign_date",     label: "Date",   width: "90px" },
                    { key: "name",          label: "Action",
                      render: (r) => (
                        <Button size="sm" variant="outline" onClick={() => setAssignTarget(r)}>
                          Assign
                        </Button>
                      ) },
                  ]}
                  rows={summary?.pending_records ?? []}
                  keyField="name"
                />
              )}
          </div>
        </Card>
      </div>

      {/* Stage velocity bar chart */}
      {velocity.length > 0 && (
        <Card>
          <CardHeader title="Stage Velocity — Bar Chart" subtitle="Average days a lead spends before moving to each state" />
          <div className="px-4 pb-4">
            <BarChart
              categories={velocity.slice(0, 12).map((v: VelocityRow) => v.state)}
              series={[
                { name: "Avg Days", data: velocity.slice(0, 12).map((v: VelocityRow) => v.avg_days), color: "#6366f1" },
              ]}
              height={300}
            />
          </div>
        </Card>
      )}

      {/* Assign dialog (modal-like) */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="gc-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <h3 className="text-base font-bold text-text">Assign Closing Agent</h3>
            <p className="text-sm text-muted">Signs record: <span className="font-mono text-primary">{assignTarget.name}</span></p>
            <p className="text-xs text-muted">Business: {assignTarget.business_name}</p>

            <label className="block">
              <span className="text-xs font-medium text-muted mb-1 block">Closing Agent (Commission) *</span>
              <input className="gc-input w-full" value={closingAgent}
                onChange={(e) => setClosingAgent(e.target.value)}
                placeholder="Sales Agent ID" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted mb-1 block">Notes</span>
              <textarea className="gc-input w-full" rows={2} value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)} />
            </label>

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setAssignTarget(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!closingAgent || assignMutation.isPending}
                onClick={() => assignMutation.mutate({ name: assignTarget.name, agent: closingAgent, notes: closingNotes })}
              >
                {assignMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
