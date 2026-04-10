import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  fetchActivityLogs, fetchCallSummary, fetchEmployees, fetchAttendance,
  createAttendance, fmtMins, thisMonthRange,
  type AttendanceRow,
} from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, ProgressBar, Modal, FormField, Tabs,
} from "../components/ui/index";
import { ColumnChart, BarChart } from "../components/charts/index";
import type { ActivityLogRow, EmployeeRow } from "../lib/types";

// Today as YYYY-MM-DD
const today = () => new Date().toISOString().split("T")[0];

type AttStatus = "Present" | "Absent" | "Half Day" | "Work From Home" | "On Leave";
const STATUS_COLORS: Record<AttStatus, string> = {
  Present:         "gc-badge-green",
  Absent:          "gc-badge-red",
  "Half Day":      "gc-badge-yellow",
  "Work From Home":"gc-badge-sky",
  "On Leave":      "gc-badge-gray",
};

// ── Mark Attendance Modal ─────────────────────────────────────────────────
function MarkModal({
  employee, open, onClose,
}: { employee: EmployeeRow | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate]       = useState(today());
  const [status, setStatus]   = useState<AttStatus>("Present");
  const [company, setCompany] = useState(employee?.company ?? "");

  const mut = useMutation({
    mutationFn: () => createAttendance({
      employee: employee!.name,
      attendance_date: date,
      status,
      company: company || employee?.company,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      onClose();
    },
  });

  if (!employee) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Mark Attendance — ${employee.employee_name ?? employee.name}`} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button className="gc-btn gc-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="gc-btn gc-btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 p-1">
        {mut.isError && <div className="gc-badge-red text-xs px-2 py-1">{String(mut.error)}</div>}
        <FormField label="Date" required>
          <input type="date" className="gc-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Status" required>
          <select className="gc-input" value={status} onChange={(e) => setStatus(e.target.value as AttStatus)}>
            {(["Present","Absent","Half Day","Work From Home","On Leave"] as AttStatus[]).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Company">
          <input className="gc-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" />
        </FormField>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo]     = useState(to);
  const [search, setSearch] = useState("");
  const [activeTab, setTab] = useState(0);

  // Mark attendance modal state
  const [markEmp, setMarkEmp] = useState<EmployeeRow | null>(null);
  const [markOpen, setMarkOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const logQuery = useQuery({
    queryKey: ["activity_logs", fromDate, toDate],
    queryFn: () => fetchActivityLogs({ from_date: fromDate, to_date: toDate }),
  });

  const callQuery = useQuery({
    queryKey: ["call_summary", fromDate, toDate],
    queryFn: () => fetchCallSummary({ from_date: fromDate, to_date: toDate }),
  });

  const empQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees({ status: "Active" }),
  });

  const attQuery = useQuery({
    queryKey: ["attendance", fromDate, toDate],
    queryFn: () => fetchAttendance({ from_date: fromDate, to_date: toDate }),
  });

  const logs     = logQuery.data  ?? [];
  const calls    = callQuery.data ?? [];
  const employees: EmployeeRow[] = Array.isArray(empQuery.data) ? empQuery.data : [];
  const attendance: AttendanceRow[] = Array.isArray(attQuery.data) ? attQuery.data : [];

  // ── Attendance lookup: last status per employee for selected period ──────
  const attMap = useMemo(() => {
    const m = new Map<string, AttendanceRow>();
    for (const a of attendance) {
      const existing = m.get(a.employee);
      if (!existing || a.attendance_date > existing.attendance_date) {
        m.set(a.employee, a);
      }
    }
    return m;
  }, [attendance]);

  // ── Activity log aggregation ─────────────────────────────────────────────
  const filteredLogs = logs.filter((r) =>
    !search || r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.employee?.toLowerCase().includes(search.toLowerCase())
  );

  const employeeMap = useMemo(() => {
    const m = new Map<string, { name: string; id: string; active: number; idle: number; unauth: number; days: Set<string> }>();
    for (const row of logs) {
      const key = row.employee ?? "";
      if (!m.has(key)) m.set(key, { name: row.employee_name ?? key, id: key, active: 0, idle: 0, unauth: 0, days: new Set() });
      const e = m.get(key)!;
      e.active += row.active_time_mins ?? 0;
      e.idle   += row.idle_time_mins   ?? 0;
      e.unauth += row.unauthorized_hits ?? 0;
      if (row.log_date) e.days.add(row.log_date);
    }
    return m;
  }, [logs]);

  const empList = [...employeeMap.values()]
    .sort((a, b) => b.active - a.active)
    .filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase()));

  // ── Employee list (cross-ref with activity logs) ─────────────────────────
  const filteredEmployees = useMemo(() => {
    const activityIds = new Set(logs.map((r) => r.employee).filter(Boolean));
    return employees.filter((e) =>
      !search ||
      e.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.department?.toLowerCase().includes(search.toLowerCase())
    ).map((e) => ({
      ...e,
      hasActivity: activityIds.has(e.name),
      lastAtt: attMap.get(e.name),
    }));
  }, [employees, logs, search, attMap]);

  // ── Attendance summary for today ─────────────────────────────────────────
  const todayStr = today();
  const todayAtt = attendance.filter((a) => a.attendance_date === todayStr);
  const presentToday  = todayAtt.filter((a) => a.status === "Present" || a.status === "Work From Home").length;
  const absentToday   = todayAtt.filter((a) => a.status === "Absent").length;
  const markedToday   = todayAtt.length;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEmployees = employeeMap.size;
  const totalActive    = [...employeeMap.values()].reduce((s, e) => s + e.active, 0);
  const totalIdle      = [...employeeMap.values()].reduce((s, e) => s + e.idle,   0);
  const totalUnauth    = [...employeeMap.values()].reduce((s, e) => s + e.unauth, 0);

  const top12   = empList.slice(0, 12);
  const barCats = top12.map((e) => e.name);

  const actPct = (active: number, idle: number) => {
    const total = active + idle;
    if (total === 0) return <span className="gc-badge-gray">—</span>;
    const pct = Math.round((active / total) * 100);
    if (pct >= 70) return <span className="gc-badge-green">{pct}%</span>;
    if (pct >= 40) return <span className="gc-badge-yellow">{pct}%</span>;
    return <span className="gc-badge-red">{pct}%</span>;
  };

  const openMark = (emp: EmployeeRow) => { setMarkEmp(emp); setMarkOpen(true); };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs = [
    { label: "Activity Logs",   count: logs.length },
    { label: "Employees",       count: employees.length },
    { label: "Attendance",      count: attendance.length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterRow onRefresh={() => { logQuery.refetch(); callQuery.refetch(); empQuery.refetch(); attQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <input className="gc-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID or dept" />
        </label>
      </FilterRow>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Employees Registered" value={employees.length}      color="#6366f1" />
        <StatCard label="Present Today"         value={presentToday}          color="#10b981" />
        <StatCard label="Absent Today"          value={absentToday}           color="#ef4444" />
        <StatCard label="Marked Today"          value={`${markedToday}/${employees.length}`} color="#f59e0b" />
      </div>

      {/* Tabs */}
      <div className="gc-tabs">
        {tabs.map((t, i) => (
          <button key={t.label} className={`gc-tab${activeTab === i ? " active" : ""}`} onClick={() => setTab(i)}>
            {t.label}
            {t.count > 0 && <span className={`gc-tab-count${activeTab === i ? " active" : ""}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Activity Logs ─── */}
      {activeTab === 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Employees Tracked" value={totalEmployees} color="#6366f1" />
            <StatCard label="Total Active Time"  value={fmtMins(totalActive)} color="#10b981" />
            <StatCard label="Total Idle Time"    value={fmtMins(totalIdle)}   color="#f59e0b" />
            <StatCard label="Unauthorized Hits"  value={totalUnauth}          color="#ef4444" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Active vs Idle Time (Top 12)" subtitle="Minutes" />
              <div className="px-4 pb-4">
                {logQuery.isLoading ? <LoadingBlock /> : top12.length === 0 ? <EmptyBlock /> : (
                  <ColumnChart categories={barCats} series={[
                    { name: "Active (mins)", data: top12.map((e) => e.active), color: "#10b981" },
                    { name: "Idle (mins)",   data: top12.map((e) => e.idle),   color: "#f59e0b" },
                  ]} height={300} />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Unauthorized Hits (Top 12)" />
              <div className="px-4 pb-4">
                {logQuery.isLoading ? <LoadingBlock /> : top12.length === 0 ? <EmptyBlock /> : (
                  <BarChart categories={barCats} series={[
                    { name: "Unauthorized Hits", data: top12.map((e) => e.unauth), color: "#ef4444" },
                  ]} height={300} />
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Days Active in Period" />
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
            <Card>
              <CardHeader title="Call Summary" />
              <div className="px-4 pb-4 overflow-auto max-h-80">
                {callQuery.isLoading ? <LoadingBlock /> : calls.length === 0 ? <EmptyBlock msg="No call data" /> : (
                  <DataTable<Record<string, unknown>>
                    cols={[
                      { key: "name",          label: "Date/ID" },
                      { key: "employee_name", label: "Employee" },
                      { key: "total_calls",   label: "Calls",    align: "right" as const },
                      { key: "duration_mins", label: "Duration", align: "right" as const,
                        render: (r) => <span className="text-xs">{fmtMins(Number(r.duration_mins ?? 0))}</span> },
                    ]}
                    rows={calls as Record<string, unknown>[]}
                    keyField="name"
                  />
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Daily Activity Log" action={<span className="gc-badge-indigo">{filteredLogs.length} rows</span>} />
            <div className="px-4 pb-4">
              {logQuery.isLoading ? <LoadingBlock /> : filteredLogs.length === 0 ? <EmptyBlock /> : (
                <DataTable<ActivityLogRow>
                  cols={[
                    { key: "log_date",         label: "Date",    width: "90px" },
                    { key: "employee_name",    label: "Employee" },
                    { key: "employee",         label: "ID",      width: "80px",
                      render: (r) => <span className="text-xs text-muted font-mono">{r.employee}</span> },
                    { key: "active_time_mins", label: "Active",  align: "right" as const,
                      render: (r) => <span className="text-emerald-600 font-medium">{fmtMins(r.active_time_mins ?? 0)}</span> },
                    { key: "idle_time_mins",   label: "Idle",    align: "right" as const,
                      render: (r) => <span className="text-amber-500">{fmtMins(r.idle_time_mins ?? 0)}</span> },
                    { key: "unauthorized_hits",label: "Unauth",  align: "right" as const,
                      render: (r) => (r.unauthorized_hits ?? 0) > 0
                        ? <span className="gc-badge-red">{r.unauthorized_hits}</span>
                        : <span className="text-xs text-muted">0</span> },
                    { key: "active_time_mins", label: "Activity %",
                      render: (r) => actPct(r.active_time_mins ?? 0, r.idle_time_mins ?? 0) },
                  ]}
                  rows={filteredLogs}
                  keyField="name"
                />
              )}
            </div>
          </Card>
        </>
      )}

      {/* ── Tab 1: Employees ─── */}
      {activeTab === 1 && (
        <Card>
          <CardHeader
            title="All Employees"
            subtitle="Active employees — sales agents cross-matched with ERPNext Employee list"
            action={
              <span className="gc-badge-indigo">{filteredEmployees.length} employees</span>
            }
          />
          <div className="px-4 pb-4">
            {empQuery.isLoading ? <LoadingBlock /> : filteredEmployees.length === 0 ? <EmptyBlock msg="No employees found" /> : (
              <DataTable<typeof filteredEmployees[0]>
                cols={[
                  { key: "name",          label: "Employee ID", width: "110px",
                    render: (r) => <span className="text-xs font-mono text-muted">{r.name}</span> },
                  { key: "employee_name", label: "Name",
                    render: (r) => (
                      <span className="font-medium text-sm text-text">{r.employee_name ?? r.name}</span>
                    ) },
                  { key: "designation",  label: "Designation" },
                  { key: "department",   label: "Department" },
                  { key: "branch",       label: "Branch" },
                  { key: "hasActivity",  label: "Activity",
                    render: (r) => r.hasActivity
                      ? <span className="gc-badge-green">Logged</span>
                      : <span className="gc-badge-gray">None</span> },
                  { key: "lastAtt",      label: "Last Attendance",
                    render: (r) => {
                      const a = r.lastAtt;
                      if (!a) return <span className="text-xs text-muted">—</span>;
                      const cls = STATUS_COLORS[a.status as AttStatus] ?? "gc-badge-gray";
                      return (
                        <div className="flex items-center gap-1">
                          <span className={cls}>{a.status}</span>
                          <span className="text-xs text-muted">{a.attendance_date}</span>
                        </div>
                      );
                    } },
                  { key: "name",         label: "",
                    render: (r) => (
                      <button
                        className="gc-btn gc-btn-primary"
                        style={{ padding: "2px 10px", fontSize: "0.75rem" }}
                        onClick={() => openMark(r as unknown as EmployeeRow)}
                      >
                        Mark
                      </button>
                    ) },
                ]}
                rows={filteredEmployees}
                keyField="name"
              />
            )}
          </div>
        </Card>
      )}

      {/* ── Tab 2: Attendance Records ─── */}
      {activeTab === 2 && (
        <Card>
          <CardHeader
            title="Attendance Records"
            subtitle={`${fromDate} to ${toDate}`}
            action={<span className="gc-badge-indigo">{attendance.length} records</span>}
          />
          <div className="px-4 pb-4">
            {attQuery.isLoading ? <LoadingBlock /> : attendance.length === 0 ? <EmptyBlock msg="No attendance records in this period" /> : (
              <>
                {/* Summary pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["Present","Work From Home","Half Day","Absent","On Leave"] as AttStatus[]).map((s) => {
                    const cnt = attendance.filter((a) => a.status === s).length;
                    if (!cnt) return null;
                    return (
                      <span key={s} className={`${STATUS_COLORS[s]} px-3 py-1 rounded-full text-xs font-semibold`}>
                        {s}: {cnt}
                      </span>
                    );
                  })}
                </div>
                <DataTable<AttendanceRow>
                  cols={[
                    { key: "attendance_date", label: "Date",       width: "100px" },
                    { key: "employee_name",   label: "Employee" },
                    { key: "employee",        label: "ID",         width: "90px",
                      render: (r) => <span className="text-xs font-mono text-muted">{r.employee}</span> },
                    { key: "department",      label: "Department" },
                    { key: "status",          label: "Status",
                      render: (r) => {
                        const cls = STATUS_COLORS[r.status as AttStatus] ?? "gc-badge-gray";
                        return <span className={cls}>{r.status}</span>;
                      } },
                    { key: "docstatus",       label: "Doc",        width: "70px",
                      render: (r) => r.docstatus === 1
                        ? <span className="gc-badge-green">Submitted</span>
                        : <span className="gc-badge-gray">Draft</span> },
                  ]}
                  rows={attendance}
                  keyField="name"
                />
              </>
            )}
          </div>
        </Card>
      )}

      {/* Mark Attendance Modal */}
      <MarkModal employee={markEmp} open={markOpen} onClose={() => setMarkOpen(false)} />
    </div>
  );
}
