import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Database, RefreshCw, Search } from "lucide-react";

import { fetchDoctypeAnalytics, type DoctypeAnalyticsSpec } from "../lib/api";
import { Badge, Card, CardHeader, DataTable, LoadingBlock, StatCard } from "../components/ui/index";

const DOCTYPE_SPECS: DoctypeAnalyticsSpec[] = [
  { module: "CCLMS", doctype: "ATM Leads", label: "ATM Leads", fields: ["workflow_state", "company", "business_name"], dateField: "modified" },
  { module: "CCLMS", doctype: "Operator Deal", label: "Operator Deals", fields: ["status", "operator_company", "location"], dateField: "modified" },
  { module: "CCLMS", doctype: "Signs", label: "Signs", fields: ["company", "branch", "sign_date"], dateField: "modified" },
  { module: "CCLMS", doctype: "Sales Agent", label: "Sales Agents", fields: ["agent_name", "user"], dateField: "modified" },
  { module: "CRM", doctype: "Lead", label: "CRM Leads", fields: ["lead_name", "status", "company_name"], dateField: "modified" },
  { module: "CRM", doctype: "Opportunity", label: "Opportunities", fields: ["opportunity_from", "status", "party_name"], dateField: "modified" },
  { module: "CRM", doctype: "Customer", label: "Customers", fields: ["customer_name", "customer_group", "territory"], dateField: "modified" },
  { module: "Projects", doctype: "Project", label: "Projects", fields: ["project_name", "status", "percent_complete"], dateField: "modified" },
  { module: "Projects", doctype: "Task", label: "Tasks", fields: ["subject", "status", "project"], dateField: "modified" },
  { module: "Accounting", doctype: "Sales Invoice", label: "Sales Invoices", fields: ["customer", "grand_total", "status"], dateField: "modified" },
  { module: "Accounting", doctype: "GL Entry", label: "GL Entries", fields: ["account", "debit", "credit"], dateField: "modified" },
  { module: "Accounting", doctype: "Payment Entry", label: "Payment Entries", fields: ["party", "paid_amount", "payment_type"], dateField: "modified" },
  { module: "HR", doctype: "Employee", label: "Employees", fields: ["employee_name", "status", "department"], dateField: "modified" },
  { module: "HR", doctype: "Attendance", label: "Attendance", fields: ["employee", "status", "attendance_date"], dateField: "modified" },
  { module: "HR", doctype: "Salary Slip", label: "Salary Slips", fields: ["employee", "net_pay", "status"], dateField: "modified" },
  { module: "HR", doctype: "Employee Activity Log", label: "Activity Logs", fields: ["employee", "date", "total_active_minutes"], dateField: "modified" },
  { module: "HR", doctype: "Call Daily Summary", label: "Call Summary", fields: ["employee", "date", "total_calls"], dateField: "modified" },
];

function valuePreview(row: Record<string, unknown>) {
  const entries = Object.entries(row).filter(([key, value]) => !["name", "owner", "modified"].includes(key) && value != null && value !== "");
  if (!entries.length) return "No fields returned";
  return entries.slice(0, 3).map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`).join(" | ");
}

export default function AnalyticsPage() {
  const [module, setModule] = useState("All");
  const [search, setSearch] = useState("");
  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["doctype-analytics"],
    queryFn: () => fetchDoctypeAnalytics(DOCTYPE_SPECS, 5),
  });

  const modules = useMemo(() => ["All", ...Array.from(new Set(DOCTYPE_SPECS.map((item) => item.module)))], []);
  const filtered = data.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesModule = module === "All" || item.module === module;
    const matchesSearch = !q || `${item.label ?? item.doctype} ${item.doctype} ${item.module}`.toLowerCase().includes(q);
    return matchesModule && matchesSearch;
  });
  const readable = data.filter((item) => item.count !== null);
  const totalRecords = readable.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
  const blocked = data.length - readable.length;
  const topDoctypes = [...readable].sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0)).slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--gc-border)] bg-[var(--gc-card)] px-3 py-1 text-xs font-semibold text-[var(--gc-muted)]">
            <Database className="h-3.5 w-3.5" /> Live Frappe DocTypes
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--gc-text)]">Analytics coverage</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--gc-muted)]">Counts and recent rows come from the same Frappe permission layer as CCLMS and ERPNext.</p>
        </div>
        <button className="gc-btn-outline self-start lg:self-auto" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Readable DocTypes" value={readable.length} sub={`${DOCTYPE_SPECS.length} configured`} color="#0f766e" />
        <StatCard label="Visible Records" value={totalRecords.toLocaleString()} sub="Permission-scoped total" color="#84cc16" />
        <StatCard label="Needs Permission" value={blocked} sub="Hidden by role or missing DocType" color="#f59e0b" />
      </div>

      <Card>
        <CardHeader
          title="ERP module coverage"
          subtitle="Search the modules this frontend can query"
          action={
            <div className="flex flex-wrap gap-2">
              {modules.map((name) => (
                <button key={name} className={`gc-chip ${module === name ? "active" : ""}`} onClick={() => setModule(name)}>{name}</button>
              ))}
            </div>
          }
        />
        <div className="px-4 pb-4">
          <label className="mb-4 flex h-10 max-w-md items-center gap-2 rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-surface)] px-3 text-[var(--gc-muted)]">
            <Search className="h-4 w-4" />
            <input className="min-w-0 flex-1 bg-transparent text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-muted)]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search DocTypes" />
          </label>
          {isLoading ? <LoadingBlock /> : (
            <DataTable
              rows={filtered}
              keyField="doctype"
              cols={[
                { key: "label", label: "DocType", render: (row) => <div><div className="font-semibold">{row.label ?? row.doctype}</div><div className="text-xs text-muted">{row.doctype}</div></div> },
                { key: "module", label: "Module", width: "120px", render: (row) => <Badge variant={row.module === "CCLMS" ? "green" : row.module === "Accounting" ? "blue" : "gray"}>{row.module}</Badge> },
                { key: "count", label: "Records", align: "right", width: "110px", render: (row) => row.count === null ? <span className="text-xs text-amber-600">No access</span> : <span className="font-semibold">{Number(row.count).toLocaleString()}</span> },
                { key: "error", label: "Status", render: (row) => row.error ? <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertCircle className="h-3.5 w-3.5" /> Permission or schema unavailable</span> : <span className="text-xs text-emerald-600">Readable</span> },
              ]}
            />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Largest readable DocTypes" subtitle="Top record counts from this session" />
          <div className="space-y-3 px-4 pb-4">
            {topDoctypes.map((item) => {
              const max = Math.max(...topDoctypes.map((row) => Number(row.count ?? 0)), 1);
              const pct = Math.round((Number(item.count ?? 0) / max) * 100);
              return (
                <div key={item.doctype}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{item.label ?? item.doctype}</span>
                    <span className="text-xs text-muted">{Number(item.count ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--gc-border)]"><div className="h-full rounded-full bg-[var(--gc-primary-strong)]" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent rows" subtitle="Latest records returned by Frappe" />
          <div className="max-h-[520px] space-y-3 overflow-auto px-4 pb-4">
            {filtered.filter((item) => item.recent.length).slice(0, 8).map((item) => (
              <div key={item.doctype} className="rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-surface)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-semibold">{item.label ?? item.doctype}</div>
                  <Badge variant="gray">{item.recent.length} latest</Badge>
                </div>
                <div className="space-y-2">
                  {item.recent.map((row) => (
                    <div key={`${item.doctype}-${row.name}`} className="rounded-[6px] bg-[var(--gc-card)] px-3 py-2 text-xs">
                      <div className="font-mono font-semibold text-[var(--gc-text)]">{row.name}</div>
                      <div className="mt-1 truncate text-[var(--gc-muted)]">{valuePreview(row)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
