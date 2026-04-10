import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  fetchSalarySlips, fetchPayrollEntries, fetchEmployees, createPayrollEntry,
  thisMonthRange,
} from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, StatusPill, Modal, FormField, FormGrid, ConfirmDialog,
} from "../components/ui/index";
import { ColumnChart, DonutChart } from "../components/charts/index";
import type { SalarySlipRow, PayrollEntryRow } from "../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtCur(n?: number) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SLIP_STATUS_COLORS: Record<string, string> = {
  Draft:     "#94a3b8",
  Submitted: "#10b981",
  Cancelled: "#ef4444",
};

// ── Payroll Entry Form ────────────────────────────────────────────────────
function PayrollEntryForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (data: Partial<PayrollEntryRow>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { from, to } = thisMonthRange();

  const [form, setForm] = useState<Partial<PayrollEntryRow>>({
    start_date:          from,
    end_date:            to,
    posting_date:        today,
    payment_date:        today,
    payroll_frequency:   "Monthly",
  });
  const set = (k: keyof PayrollEntryRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-5">
      {/* Period */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Payroll Period</p>
        <FormGrid cols={2}>
          <FormField label="Start Date" required>
            <input type="date" className="gc-input" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} required />
          </FormField>
          <FormField label="End Date" required>
            <input type="date" className="gc-input" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} required />
          </FormField>
          <FormField label="Posting Date">
            <input type="date" className="gc-input" value={form.posting_date ?? ""} onChange={(e) => set("posting_date", e.target.value)} />
          </FormField>
          <FormField label="Payment Date">
            <input type="date" className="gc-input" value={form.payment_date ?? ""} onChange={(e) => set("payment_date", e.target.value)} />
          </FormField>
        </FormGrid>
      </div>

      {/* Scope */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Scope</p>
        <FormGrid cols={2}>
          <FormField label="Company">
            <input className="gc-input" value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />
          </FormField>
          <FormField label="Branch">
            <input className="gc-input" value={form.branch ?? ""} onChange={(e) => set("branch", e.target.value)} />
          </FormField>
          <FormField label="Department">
            <input className="gc-input" value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} />
          </FormField>
          <FormField label="Frequency">
            <select className="gc-select" value={form.payroll_frequency ?? "Monthly"} onChange={(e) => set("payroll_frequency", e.target.value)}>
              {["Weekly","Biweekly","Monthly","Fortnightly","Daily"].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </FormField>
        </FormGrid>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" className="gc-btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="gc-btn-primary" disabled={saving}>
          {saving ? "Creating…" : "Create Payroll Entry"}
        </button>
      </div>
    </form>
  );
}

// ── Salary Slip Detail ────────────────────────────────────────────────────
function SalarySlipDetail({ slip, onClose }: { slip: SalarySlipRow; onClose: () => void }) {
  const statusColor = SLIP_STATUS_COLORS[slip.status ?? ""] ?? "#94a3b8";
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-text">{slip.employee_name}</h4>
          <p className="text-xs text-muted">{slip.employee} · {slip.designation ?? "—"} · {slip.department ?? "—"}</p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `${statusColor}22`, color: statusColor }}
        >
          {slip.status ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="gc-card p-4 space-y-1">
          <p className="text-xs text-muted">Gross Pay</p>
          <p className="text-2xl font-bold text-emerald-600">{fmtCur(slip.gross_pay)}</p>
        </div>
        <div className="gc-card p-4 space-y-1">
          <p className="text-xs text-muted">Net Pay</p>
          <p className="text-2xl font-bold text-primary">{fmtCur(slip.net_pay)}</p>
        </div>
        <div className="gc-card p-4 space-y-1">
          <p className="text-xs text-muted">Total Deduction</p>
          <p className="text-xl font-bold text-red-600">{fmtCur(slip.total_deduction)}</p>
        </div>
        <div className="gc-card p-4 space-y-1">
          <p className="text-xs text-muted">Payment Days</p>
          <p className="text-xl font-bold text-text">{slip.payment_days ?? "—"} / {slip.total_working_days ?? "—"}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Period", `${slip.start_date ?? "—"} → ${slip.end_date ?? "—"}`],
          ["Salary Structure", slip.salary_structure],
          ["Payroll Entry", slip.payroll_entry],
          ["Company", slip.company],
          ["Branch", slip.branch],
        ].map(([k, v]) => v ? (
          <div key={k}>
            <dt className="text-xs text-muted uppercase tracking-wide">{k}</dt>
            <dd className="font-medium text-text mt-0.5">{v}</dd>
          </div>
        ) : null)}
      </dl>

      <div className="flex justify-end pt-2 border-t border-border">
        <button className="gc-btn-outline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom]   = useState(from);
  const [toDate, setTo]       = useState(to);
  const [company, setCompany] = useState("");
  const [department, setDept] = useState("");
  const [statusFilter, setStat] = useState("");
  const [search, setSearch]   = useState("");
  const [tab, setTab]         = useState<"slips" | "entries" | "employees">("slips");

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [viewSlip, setViewSlip]         = useState<SalarySlipRow | null>(null);

  const qc = useQueryClient();

  // Queries
  const slipParams = {
    start_date: fromDate,
    end_date:   toDate,
    company:    company || undefined,
    department: department || undefined,
    status:     statusFilter || undefined,
  };

  const slipsQuery = useQuery({
    queryKey: ["salary_slips", slipParams],
    queryFn: () => fetchSalarySlips(slipParams),
  });

  const entriesQuery = useQuery({
    queryKey: ["payroll_entries", fromDate, toDate, company],
    queryFn: () => fetchPayrollEntries({ company: company || undefined, from_date: fromDate, to_date: toDate }),
  });

  const empQuery = useQuery({
    queryKey: ["employees", company, department],
    queryFn: () => fetchEmployees({ company: company || undefined, department: department || undefined }),
  });

  const slips   = slipsQuery.data   ?? [];
  const entries = entriesQuery.data ?? [];
  const emps    = empQuery.data     ?? [];

  // KPIs
  const totalGross    = slips.reduce((s, r) => s + (r.gross_pay         ?? 0), 0);
  const totalNet      = slips.reduce((s, r) => s + (r.net_pay           ?? 0), 0);
  const totalDeduct   = slips.reduce((s, r) => s + (r.total_deduction   ?? 0), 0);
  const submittedCount = slips.filter((s) => s.status === "Submitted").length;

  // By department
  const byDept = useMemo(() => {
    const m = new Map<string, { dept: string; count: number; gross: number; net: number }>();
    for (const s of slips) {
      const k = s.department ?? "Unknown";
      if (!m.has(k)) m.set(k, { dept: k, count: 0, gross: 0, net: 0 });
      const x = m.get(k)!;
      x.count += 1;
      x.gross += s.gross_pay ?? 0;
      x.net   += s.net_pay   ?? 0;
    }
    return [...m.values()].sort((a, b) => b.gross - a.gross);
  }, [slips]);

  // Chart: net pay by dept donut
  const deptDonutData = byDept.slice(0, 8).map((d, i) => ({
    name: d.dept,
    y: +(d.net.toFixed(2)),
    color: ["#6366f1","#10b981","#0ea5e9","#f59e0b","#ef4444","#8b5cf6","#f97316","#14b8a6"][i % 8],
  }));

  // Monthly payroll trend from entries
  const monthlyTrend = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const k = (e.posting_date ?? "").slice(0, 7);
      if (k) m.set(k, (m.get(k) ?? 0) + (e.total_salary_amount ?? 0));
    }
    const sorted = [...m.entries()].sort(([a],[b]) => a.localeCompare(b));
    return { cats: sorted.map(([k]) => k), data: sorted.map(([,v]) => +v.toFixed(2)) };
  }, [entries]);

  // Filter slips for table
  const filteredSlips = slips.filter((s) =>
    !search || (s.employee_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.employee ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Mutation
  const createEntryMut = useMutation({
    mutationFn: createPayrollEntry,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_entries"] }); setShowNewEntry(false); },
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Filter bar */}
      <FilterRow onRefresh={() => { slipsQuery.refetch(); entriesQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input className="gc-input w-36" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="All" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Department</span>
          <input className="gc-input w-36" value={department} onChange={(e) => setDept(e.target.value)} placeholder="All" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Status</span>
          <select className="gc-select" value={statusFilter} onChange={(e) => setStat(e.target.value)}>
            <option value="">All</option>
            {["Draft","Submitted","Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className="gc-btn-primary self-end" onClick={() => setShowNewEntry(true)}>
          + New Payroll Run
        </button>
      </FilterRow>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Slips"    value={slips.length}         color="#6366f1" />
        <StatCard label="Gross Payroll"  value={"$" + (totalGross / 1000).toFixed(1) + "K"} color="#0ea5e9" />
        <StatCard label="Net Payroll"    value={"$" + (totalNet   / 1000).toFixed(1) + "K"} color="#10b981" />
        <StatCard label="Submitted"      value={submittedCount}       color="#22c55e" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {monthlyTrend.cats.length > 0 && (
          <Card className="xl:col-span-2">
            <CardHeader title="Monthly Payroll Cost" subtitle="Total salary amount by month" />
            <div className="px-4 pb-4">
              <ColumnChart
                categories={monthlyTrend.cats}
                series={[{ name: "Payroll Cost", data: monthlyTrend.data, color: "#6366f1" }]}
                height={260}
              />
            </div>
          </Card>
        )}

        {deptDonutData.length > 0 && (
          <Card>
            <CardHeader title="By Department" />
            <div className="px-4 pb-4">
              <DonutChart data={deptDonutData} height={260} />
            </div>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <div className="gc-tabs border-b border-border pb-0">
        {([
          { key: "slips",     label: "Salary Slips",    count: slips.length },
          { key: "entries",   label: "Payroll Entries", count: entries.length },
          { key: "employees", label: "Employees",       count: emps.length },
        ] as { key: "slips"|"entries"|"employees"; label: string; count: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`gc-tab ${tab === t.key ? "active" : ""}`}
          >
            {t.label}
            <span className={`gc-tab-count ${tab === t.key ? "active" : ""}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Salary Slips Tab */}
      {tab === "slips" && (
        <Card>
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-text">{filteredSlips.length} slips</span>
            <input
              className="gc-input text-xs w-44"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee…"
            />
          </div>
          <div className="px-4 pb-4">
            {slipsQuery.isLoading ? <LoadingBlock /> : filteredSlips.length === 0 ? <EmptyBlock /> : (
              <DataTable
                keyField="name"
                rows={filteredSlips}
                cols={[
                  {
                    key: "employee_name",
                    label: "Employee",
                    render: (r) => (
                      <button
                        className="font-semibold text-primary hover:underline text-left"
                        onClick={() => setViewSlip(r)}
                      >
                        {r.employee_name ?? r.employee}
                      </button>
                    ),
                  },
                  { key: "department",    label: "Department" },
                  { key: "branch",        label: "Branch" },
                  { key: "start_date",    label: "From" },
                  { key: "end_date",      label: "To" },
                  {
                    key: "gross_pay",
                    label: "Gross",
                    align: "right",
                    render: (r) => <span className="font-mono text-xs text-emerald-600">{fmtCur(r.gross_pay)}</span>,
                  },
                  {
                    key: "total_deduction",
                    label: "Deductions",
                    align: "right",
                    render: (r) => <span className="font-mono text-xs text-red-600">{fmtCur(r.total_deduction)}</span>,
                  },
                  {
                    key: "net_pay",
                    label: "Net Pay",
                    align: "right",
                    render: (r) => <span className="font-mono text-xs font-bold text-primary">{fmtCur(r.net_pay)}</span>,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => {
                      const c = SLIP_STATUS_COLORS[r.status ?? ""] ?? "#94a3b8";
                      return (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: `${c}22`, color: c }}
                        >
                          {r.status ?? "—"}
                        </span>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>

          {/* Department breakdown */}
          {byDept.length > 0 && (
            <div className="px-4 pb-4 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Department Summary</p>
              <DataTable
                keyField="dept"
                rows={byDept}
                cols={[
                  { key: "dept",  label: "Department" },
                  { key: "count", label: "Employees", align: "right" },
                  { key: "gross", label: "Gross Pay", align: "right",
                    render: (r) => <span className="text-emerald-600 font-semibold">{fmtCur(r.gross)}</span> },
                  { key: "net",   label: "Net Pay",   align: "right",
                    render: (r) => <span className="text-primary font-bold">{fmtCur(r.net)}</span> },
                ]}
              />
            </div>
          )}
        </Card>
      )}

      {/* Payroll Entries Tab */}
      {tab === "entries" && (
        <Card>
          <CardHeader title="Payroll Entries" subtitle={`${entries.length} entries`} />
          <div className="px-4 pb-4">
            {entriesQuery.isLoading ? <LoadingBlock /> : entries.length === 0 ? <EmptyBlock /> : (
              <DataTable
                keyField="name"
                rows={entries}
                cols={[
                  { key: "name",           label: "Entry ID" },
                  { key: "company",        label: "Company" },
                  { key: "branch",         label: "Branch" },
                  { key: "department",     label: "Department" },
                  { key: "payroll_frequency", label: "Frequency" },
                  { key: "start_date",     label: "From" },
                  { key: "end_date",       label: "To" },
                  { key: "posting_date",   label: "Posted" },
                  {
                    key: "total_salary_amount",
                    label: "Total",
                    align: "right",
                    render: (r) => <span className="font-bold font-mono text-primary">{fmtCur(r.total_salary_amount)}</span>,
                  },
                  {
                    key: "docstatus",
                    label: "Status",
                    render: (r) => {
                      const status = r.docstatus === 1 ? "Submitted" : "Draft";
                      const c = SLIP_STATUS_COLORS[status];
                      return (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: `${c}22`, color: c }}
                        >
                          {status}
                        </span>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>
        </Card>
      )}

      {/* Employees Tab */}
      {tab === "employees" && (
        <Card>
          <CardHeader title="Active Employees" subtitle={`${emps.length} employees`} />
          <div className="px-4 pb-4">
            {empQuery.isLoading ? <LoadingBlock /> : emps.length === 0 ? <EmptyBlock /> : (
              <DataTable
                keyField="name"
                rows={emps}
                cols={[
                  { key: "name",           label: "ID" },
                  { key: "employee_name",  label: "Name" },
                  { key: "department",     label: "Department" },
                  { key: "designation",    label: "Designation" },
                  { key: "branch",         label: "Branch" },
                  { key: "company",        label: "Company" },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => {
                      const c = r.status === "Active" ? "#10b981" : "#ef4444";
                      return (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: `${c}22`, color: c }}>
                          {r.status}
                        </span>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>
        </Card>
      )}

      {/* Create Payroll Entry Modal */}
      <Modal open={showNewEntry} onClose={() => setShowNewEntry(false)} title="New Payroll Run" size="md">
        <PayrollEntryForm
          onSave={(data) => createEntryMut.mutate(data)}
          onCancel={() => setShowNewEntry(false)}
          saving={createEntryMut.isPending}
        />
        {createEntryMut.isError && (
          <p className="text-red-600 text-xs mt-2">{String((createEntryMut.error as Error).message)}</p>
        )}
      </Modal>

      {/* Salary Slip Detail Modal */}
      <Modal open={!!viewSlip} onClose={() => setViewSlip(null)} title="Salary Slip" size="md">
        {viewSlip && <SalarySlipDetail slip={viewSlip} onClose={() => setViewSlip(null)} />}
      </Modal>
    </div>
  );
}
