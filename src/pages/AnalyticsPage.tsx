import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchOverview, fetchCompanyBreakdown, fetchEmployees,
  fetchProjects, fetchSalarySlips, fetchATMLeads,
  fetchStateCounts, thisMonthRange,
  fetchMultiTrend,
} from "../lib/api";
import {
  Card, CardHeader, StatCard, LoadingBlock, EmptyBlock, DataTable,
  DateInput, FilterRow,
} from "../components/ui/index";
import { ColumnChart, DonutChart } from "../components/charts/index";
import { BarChart3, TrendingUp, Users, Building2, BriefcaseBusiness, DollarSign, Phone } from "lucide-react";

export default function AnalyticsPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo] = useState(to);

  const overviewQuery = useQuery({
    queryKey: ["overview", fromDate, toDate],
    queryFn: () => fetchOverview({ start_date: fromDate, end_date: toDate }),
  });
  const companyQuery = useQuery({
    queryKey: ["company-breakdown", fromDate, toDate],
    queryFn: () => fetchCompanyBreakdown({ start_date: fromDate, end_date: toDate }),
  });
  const empQuery = useQuery({
    queryKey: ["employees-all"],
    queryFn: () => fetchEmployees({}),
  });
  const projQuery = useQuery({
    queryKey: ["projects-all"],
    queryFn: () => fetchProjects({}),
  });
  const salaryQuery = useQuery({
    queryKey: ["salary-slips", fromDate, toDate],
    queryFn: () => fetchSalarySlips({ start_date: fromDate, end_date: toDate }),
  });
  const trendQuery = useQuery({
    queryKey: ["multi-trend"],
    queryFn: () => fetchMultiTrend({ months_back: 12 }),
  });
  const stateCountsQuery = useQuery({
    queryKey: ["lead-states"],
    queryFn: () => fetchStateCounts({}),
  });

  const overview = overviewQuery.data;
  const companies = companyQuery.data ?? [];
  const employees = empQuery.data ?? [];
  const projects = projQuery.data ?? [];
  const salaries = salaryQuery.data ?? [];
  const trend = trendQuery.data;
  const stateCounts = stateCountsQuery.data ?? {};

  const activeEmployees = Array.isArray(employees)
    ? employees.filter((e: Record<string, unknown>) => e.status === "Active").length
    : 0;
  const totalProjects = Array.isArray(projects) ? projects.length : 0;
  const openProjects = Array.isArray(projects)
    ? projects.filter((p: Record<string, unknown>) => p.status === "Open").length
    : 0;
  const totalSalary = Array.isArray(salaries)
    ? salaries.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.net_pay) || 0), 0)
    : 0;

  const leadStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
  const totalLeads = leadStates.reduce((s, [, c]) => s + c, 0);
  const stageCounts = ["Pending","Approved","Agreement Sent","Pending Sign","Signed","Installed","Converted","Rejected","Cancelled"]
    .map((s) => ({ stage: s, count: stateCounts[s] ?? 0 }))
    .filter((s) => s.count > 0);

  const piplineDonut = stageCounts.filter((s) => !["Rejected","Cancelled"].includes(s.stage));
  const rejectedCount = stageCounts.filter((s) => ["Rejected","Cancelled"].includes(s.stage)).reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--gc-border)] bg-[var(--gc-card)] px-3 py-1 text-xs font-semibold text-[var(--gc-muted)]">
            <BarChart3 className="h-3.5 w-3.5" /> Business Analytics
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--gc-text)]">Analytics</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--gc-muted)]">Real-time KPIs across all business modules</p>
        </div>
      </div>

      <FilterRow onRefresh={() => { overviewQuery.refetch(); companyQuery.refetch(); empQuery.refetch(); projQuery.refetch(); salaryQuery.refetch(); trendQuery.refetch(); stateCountsQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To" value={toDate} onChange={setTo} />
      </FilterRow>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={totalLeads} color="#6366f1" icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <StatCard label="Active Employees" value={activeEmployees} color="#10b981" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Open Projects" value={openProjects} color="#f59e0b" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Payroll (MTD)" value={`$${Math.round(totalSalary).toLocaleString()}`} color="#16a34a" icon={<DollarSign className="h-4 w-4" />} />
      </div>

      {/* Pipeline + Trends row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Pipeline Workflow" subtitle={`${totalLeads} total leads across stages`} />
          <div className="px-4 pb-4">
            {stateCountsQuery.isLoading ? <LoadingBlock /> : piplineDonut.length === 0 ? <EmptyBlock /> : (
              <DonutChart
                title="Pipeline Stage"
                data={piplineDonut.map((s) => ({ name: s.stage, y: s.count }))}
                height={280}
              />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly Trend" subtitle="Approved, Signed, Installed (12 months)" />
          <div className="px-4 pb-4">
            {trendQuery.isLoading ? <LoadingBlock /> : !trend ? <EmptyBlock /> : (
              <ColumnChart
                categories={trend.categories}
                series={trend.series.filter((s) => ["Approved","Signed","Installed"].includes(s.name)).slice(0, 3)}
                height={280}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Operator breakdown */}
      <Card>
        <CardHeader title="Operator Company Breakdown" subtitle={`${companies.length} companies`} />
        <div className="gc-card-body">
          {companyQuery.isLoading ? <LoadingBlock /> : companies.length === 0 ? <EmptyBlock /> : (
            <DataTable
              cols={[
                { key: "operator_company", label: "Company" },
                { key: "submitted", label: "Submitted", align: "right" },
                { key: "approved", label: "Approved", align: "right" },
                { key: "agreement_sent", label: "Agmt Sent", align: "right" },
                { key: "signed", label: "Signed", align: "right" },
                { key: "installed", label: "Installed", align: "right" },
                { key: "rejected", label: "Rejected", align: "right" },
                { key: "cancelled", label: "Cancelled", align: "right" },
                { key: "total_deals", label: "Total", align: "right" },
              ]}
              rows={companies}
              keyField="operator_company"
            />
          )}
        </div>
      </Card>

      {/* Lead state distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Lead Stage Distribution" subtitle="All workflow states" />
          <div className="gc-card-body">
            {stateCountsQuery.isLoading ? <LoadingBlock /> : leadStates.length === 0 ? <EmptyBlock /> : (
              <div className="space-y-2">
                {leadStates.map(([state, count]) => {
                  const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                  const colorMap: Record<string, string> = {
                    "Pending": "#f59e0b", "Approved": "#86efac", "Agreement Sent": "#0ea5e9",
                    "Pending Sign": "#f59e0b", "Signed": "#16a34a", "Installed": "#2563eb",
                    "Converted": "#2563eb", "Rejected": "#ef4444", "Cancelled": "#6b7280",
                    "Draft": "#6b7280", "Re Approval": "#f97316", "Signed Rejected": "#ef4444",
                    "Not Qualified": "#ef4444", "Needs Reanalysis": "#f97316",
                  };
                  const c = colorMap[state] ?? "#6b7280";
                  return (
                    <div key={state} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-[var(--gc-text)] truncate">{state}</span>
                      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: `${c}22` }}>
                        <div className="h-full rounded-full flex items-center justify-end px-2 text-[10px] font-bold text-white"
                          style={{ width: `${pct}%`, background: c, minWidth: pct > 0 ? "fit-content" : undefined }}>
                          {pct > 8 ? `${pct}%` : ""}
                        </div>
                      </div>
                      <span className="w-16 text-xs font-semibold text-right text-[var(--gc-text)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly Overview" subtitle="Aggregated counts" />
          <div className="gc-card-body space-y-4">
            {overviewQuery.isLoading ? <LoadingBlock /> : !overview ? <EmptyBlock /> : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(overview.counts).filter(([k]) => !["net_signed"].includes(k)).map(([key, value]) => (
                    <div key={key} className="rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-surface)] p-3 text-center">
                      <div className="text-lg font-bold text-[var(--gc-text)]">{value as number}</div>
                      <div className="text-[10px] text-[var(--gc-muted)] uppercase">{key.replace(/_/g, " ")}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-[8px] bg-emerald-50 border border-emerald-200 p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">{overview.counts.net_signed}</div>
                  <div className="text-xs text-emerald-600 font-semibold uppercase">Net Signed</div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Status snapshot */}
      <Card>
        <CardHeader title="Status Snapshot" subtitle="Current state of all deals" />
        <div className="gc-card-body">
          {overviewQuery.isLoading ? <LoadingBlock /> : !overview?.status_snapshot ? <EmptyBlock /> : (
            <div className="flex flex-wrap gap-3">
              {overview.status_snapshot.map((s: Record<string, unknown>) => (
                <div key={String(s.label)} className="rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-surface)] px-4 py-3 text-center min-w-[100px]">
                  <div className="text-lg font-bold text-[var(--gc-text)]">{String(s.value)}</div>
                  <div className="text-xs text-[var(--gc-muted)]">{String(s.label)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
