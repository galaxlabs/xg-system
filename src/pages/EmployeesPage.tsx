import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Building2, MapPin, Phone, Search, User, BadgeCheck, XCircle } from "lucide-react";
import { fetchEmployees } from "../lib/api";
import { Badge, Card, CardHeader, DataTable, LoadingBlock, StatCard } from "../components/ui/index";

const DEPT_COLORS: Record<string, string> = {
  "Management": "#6366f1",
  "Sales": "#f59e0b",
  "Operations": "#0ea5e9",
  "HR": "#10b981",
  "Finance": "#8b5cf6",
  "IT": "#06b6d4",
};

function deptBadge(dept: string) {
  const c = DEPT_COLORS[dept] || "#6b7280";
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${c}22`, color: c }}>{dept}</span>;
}

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Active");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", statusFilter],
    queryFn: () => fetchEmployees({ status: statusFilter === "All" ? undefined : statusFilter }),
  });

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return ["All", ...Array.from(depts).sort()];
  }, [employees]);

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (q && !`${e.employee_name} ${e.department} ${e.designation} ${e.branch}`.toLowerCase().includes(q)) return false;
    if (deptFilter !== "All" && e.department !== deptFilter) return false;
    return true;
  });

  const activeCount = employees.filter((e) => e.status === "Active").length;
  const deptBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((e) => { if (e.department) map[e.department] = (map[e.department] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [employees]);

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--gc-border)] bg-[var(--gc-card)] px-3 py-1 text-xs font-semibold text-[var(--gc-muted)]">
            <BriefcaseBusiness className="h-3.5 w-3.5" /> HR Module
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-[var(--gc-text)]">Employees</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--gc-muted)]">{employees.length} total · {activeCount} active</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees" value={employees.length} color="#6366f1" icon={<User className="h-4 w-4" />} />
        <StatCard label="Active" value={activeCount} color="#10b981" icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label="Inactive" value={employees.length - activeCount} color="#ef4444" icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="Departments" value={departments.length - 1} color="#f59e0b" icon={<Building2 className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader title="Departments" subtitle={`${deptBreakdown.length} departments`} />
          <div className="gc-card-body space-y-2">
            {deptBreakdown.map(([dept, count]) => (
              <button key={dept} onClick={() => setDeptFilter(dept === deptFilter ? "All" : dept)}
                className={`flex w-full items-center justify-between rounded-[6px] px-3 py-2 text-sm transition-colors ${deptFilter === dept ? "bg-[var(--gc-primary)]/10 font-semibold" : "hover:bg-[var(--gc-surface)]"}`}>
                <span className="flex items-center gap-2">{deptBadge(dept)}</span>
                <span className="text-xs text-[var(--gc-muted)]">{count}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex h-10 items-center gap-2 rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-card)] px-3 text-sm flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-[var(--gc-muted)]" />
              <input className="min-w-0 flex-1 bg-transparent outline-none text-[var(--gc-text)] placeholder:text-[var(--gc-muted)]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, department..." />
            </label>
            <select className="gc-input h-10 w-40 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="All">All Status</option>
            </select>
          </div>

          <Card>
            <CardHeader title={`${filtered.length} employees`} subtitle={deptFilter !== "All" ? `Filtered by ${deptFilter}` : undefined} />
            <div className="gc-card-body">
              <table className="gc-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Branch</th>
                    <th>Contact</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr key={emp.name}>
                      <td className="font-medium">{emp.employee_name || emp.name}</td>
                      <td>{emp.department ? deptBadge(emp.department) : <span className="text-xs text-[var(--gc-muted)]">—</span>}</td>
                      <td className="text-sm text-[var(--gc-muted)]">{emp.designation || "—"}</td>
                      <td className="text-sm text-[var(--gc-muted)]">{emp.branch || "—"}</td>
                      <td>
                        {emp.cell_number ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--gc-muted)]">
                            <Phone className="h-3 w-3" /> {emp.cell_number}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${emp.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {emp.status === "Active" ? <BadgeCheck className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {emp.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-sm text-[var(--gc-muted)] py-8">No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
