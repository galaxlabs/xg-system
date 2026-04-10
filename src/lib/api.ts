import { callFrappe } from "./frappe";
import type {
  OverviewResponse,
  CompanyRow,
  AgentRow,
  TrendResponse,
  RecentSignedRow,
  SignsSummary,
  VelocityRow,
  PipelineSnapshot,
  LedgerTrend,
  AttributionRow,
  ActivityLogRow,
  StateByExecRow,
  AgentPerfRow,
  ATMLeadRow,
  ProjectRow,
  TaskRow,
  GLEntryRow,
  AccountRow,
  SalarySlipRow,
  PayrollEntryRow,
  EmployeeRow,
} from "./types";

// ── Base paths ────────────────────────────────────────────────────────────
const PR  = "cclms.api.page_reporting";
const SD  = "cclms.call_centre_lead_management_system.page.signs_dashboard.signs_dashboard";
const RPT = "cclms.api.reports";

// ── Overview / Pipeline ───────────────────────────────────────────────────
export const fetchOverview = (p: Record<string, unknown> = {}) =>
  callFrappe<OverviewResponse>(`${PR}.overview`, p);

export const fetchCompanyBreakdown = (p: Record<string, unknown> = {}) =>
  callFrappe<CompanyRow[]>(`${PR}.company_breakdown`, p);

export const fetchAgentBreakdown = (p: Record<string, unknown> = {}) =>
  callFrappe<AgentRow[]>(`${PR}.agent_breakdown`, p);

export const fetchMultiTrend = (p: Record<string, unknown> = {}) =>
  callFrappe<TrendResponse>(`${PR}.multi_trend`, p);

export const fetchRecentSigned = (p: Record<string, unknown> = {}) =>
  callFrappe<RecentSignedRow[]>(`${PR}.recent_signed`, p);

// ── Signs dashboard ───────────────────────────────────────────────────────
export const fetchSignsSummary = (p: Record<string, unknown> = {}) =>
  callFrappe<SignsSummary>(`${SD}.get_signs_summary`, p);

export const fetchStageVelocity = (p: Record<string, unknown> = {}) =>
  callFrappe<VelocityRow[]>(`${SD}.get_stage_velocity`, p);

export const fetchPipelineSnapshot = (p: Record<string, unknown> = {}) =>
  callFrappe<PipelineSnapshot>(`${SD}.get_pipeline_snapshot`, p);

export const fetchLedgerTrend = (p: Record<string, unknown> = {}) =>
  callFrappe<LedgerTrend>(`${SD}.get_approval_rejection_trend`, p);

export const fetchAgentAttribution = (p: Record<string, unknown> = {}) =>
  callFrappe<AttributionRow[]>(`${SD}.get_agent_attribution`, p);

// ── Direction report ──────────────────────────────────────────────────────
// Backend returns a pivot: { categories: string[], series: {name,data[]}[], states: string[] }
// We normalise it to a flat StateByExecRow[] so the page can iterate safely.
export const fetchStateByExecutive = async (p: Record<string, unknown> = {}): Promise<StateByExecRow[]> => {
  // Map from_date/to_date → start_date/end_date for the backend
  const apiArgs: Record<string, unknown> = { ...p };
  if (p.from_date) { apiArgs.start_date = p.from_date; delete apiArgs.from_date; }
  if (p.to_date)   { apiArgs.end_date   = p.to_date;   delete apiArgs.to_date; }

  type PivotResp = { categories?: string[]; series?: { name: string; data: number[] }[]; states?: string[] };
  const res = await callFrappe<StateByExecRow[] | PivotResp>(
    `${RPT}.state_by_executive.get_state_counts_by_executive`, apiArgs
  );
  if (Array.isArray(res)) return res;

  // Transform pivot → flat rows (one row per executive)
  const pivot = res as PivotResp;
  const cats   = pivot.categories ?? [];
  const series = pivot.series     ?? [];
  return cats.map((exec, i) => {
    const row: StateByExecRow = { executive: exec, executive_name: exec };
    for (const s of series) {
      const key = s.name.toLowerCase().replace(/\s+/g, "_");
      (row as Record<string, unknown>)[key] = s.data[i] ?? 0;
    }
    return row;
  });
};

export const fetchAgentPerformance = (p: Record<string, unknown> = {}) =>
  callFrappe<AgentPerfRow[]>(`${RPT}.agent_performance.get_agent_performance`, p);

// ── Attendance (Employee Activity Log via frappe.client.get_list) ─────────
export const fetchActivityLogs = (p: {
  from_date: string;
  to_date: string;
  employee?: string;
}) =>
  callFrappe<ActivityLogRow[]>("frappe.client.get_list", {
    doctype: "Employee Activity Log",
    filters: JSON.stringify([
      ["date", "between", [p.from_date, p.to_date]],
      ...(p.employee ? [["employee", "=", p.employee]] : []),
    ]),
    fields: JSON.stringify([
      "name", "employee", "date",
      "total_active_minutes", "total_idle_minutes", "unauthorized_site_hits",
    ]),
    limit_page_length: 500,
    order_by: "date desc",
  });

export const fetchCallSummary = (p: {
  from_date: string;
  to_date: string;
  employee?: string;
}) =>
  callFrappe<{ employee: string; date: string; total_calls: number; total_talk_time_seconds: number }[]>(
    "frappe.client.get_list",
    {
      doctype: "Call Daily Summary",
      filters: JSON.stringify([
        ["date", "between", [p.from_date, p.to_date]],
        ...(p.employee ? [["employee", "=", p.employee]] : []),
      ]),
      fields: JSON.stringify([
        "employee", "date", "total_calls", "total_talk_time_seconds",
      ]),
      limit_page_length: 500,
      order_by: "date desc",
    }
  );

// ── Helpers ───────────────────────────────────────────────────────────────
export function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

export function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fmtPct(n: number, d: number): string {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

// ── ATM Leads CRUD ────────────────────────────────────────────────────────
const ATM_FIELDS = JSON.stringify([
  "name","business_name","owner_name","company","executive_name","branch",
  "state_code","state","city","address","zip_code","email",
  "business_phone_number","personal_cell_phone","business_type",
  "contract_length","base_rent","hours","percentage","post_date",
  "approve_date","agreement_sent_date","sign_date","convert_date",
  "install_date","remove_date","status","lead_owner","is_duplicate",
  "latitude","longitude","ai_core",
]);

export const fetchATMLeads = (p: {
  status?: string;
  company?: string;
  branch?: string;
  executive_name?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  const filters: unknown[][] = [];
  if (p.status)         filters.push(["status", "=", p.status]);
  if (p.company)        filters.push(["company", "=", p.company]);
  if (p.branch)         filters.push(["branch", "=", p.branch]);
  if (p.executive_name) filters.push(["executive_name", "=", p.executive_name]);
  if (p.from_date)      filters.push(["post_date", ">=", p.from_date]);
  if (p.to_date)        filters.push(["post_date", "<=", p.to_date]);
  if (p.search)         filters.push(["business_name", "like", `%${p.search}%`]);

  return callFrappe<ATMLeadRow[]>("frappe.client.get_list", {
    doctype: "ATM Leads",
    filters: JSON.stringify(filters),
    fields: ATM_FIELDS,
    limit_page_length: p.page_size ?? 50,
    limit_start: ((p.page ?? 1) - 1) * (p.page_size ?? 50),
    order_by: "post_date desc",
  });
};

export const fetchATMLead = (name: string) =>
  callFrappe<ATMLeadRow>("frappe.client.get", { doctype: "ATM Leads", name });

export const createATMLead = (data: Partial<ATMLeadRow>) =>
  callFrappe<{ name: string }>("frappe.client.insert", {
    doc: JSON.stringify({ doctype: "ATM Leads", ...data }),
  });

export const updateATMLead = (name: string, data: Partial<ATMLeadRow>) =>
  callFrappe("frappe.client.set_value", {
    doctype: "ATM Leads",
    name,
    fieldname: JSON.stringify(data),
  });

export const deleteATMLead = (name: string) =>
  callFrappe("frappe.client.delete", { doctype: "ATM Leads", name });

export const countATMLeads = (p: { status?: string; company?: string } = {}) => {
  const filters: unknown[][] = [];
  if (p.status)  filters.push(["status", "=", p.status]);
  if (p.company) filters.push(["company", "=", p.company]);
  return callFrappe<number>("frappe.client.get_count", {
    doctype: "ATM Leads",
    filters: JSON.stringify(filters),
  });
};

// ── Projects ──────────────────────────────────────────────────────────────
const PROJECT_FIELDS = JSON.stringify([
  "name","project_name","status","priority","percent_complete",
  "expected_start_date","expected_end_date","actual_start_date","actual_end_date",
  "company","department","customer","estimated_costing","total_costing_amount",
  "gross_margin","per_gross_margin","is_active",
]);

const TASK_FIELDS = JSON.stringify([
  "name","subject","project","status","priority","progress",
  "exp_start_date","exp_end_date","act_start_date","act_end_date",
  "is_milestone","is_group","color","expected_time","actual_time",
]);

export const fetchProjects = (p: { status?: string; company?: string; search?: string } = {}) => {
  const filters: unknown[][] = [];
  if (p.status)  filters.push(["status", "=", p.status]);
  if (p.company) filters.push(["company", "=", p.company]);
  if (p.search)  filters.push(["project_name", "like", `%${p.search}%`]);
  return callFrappe<ProjectRow[]>("frappe.client.get_list", {
    doctype: "Project",
    filters: JSON.stringify(filters),
    fields: PROJECT_FIELDS,
    limit_page_length: 100,
    order_by: "expected_start_date asc",
  });
};

export const fetchTasks = (p: { project?: string; status?: string } = {}) => {
  const filters: unknown[][] = [];
  if (p.project) filters.push(["project", "=", p.project]);
  if (p.status)  filters.push(["status", "=", p.status]);
  return callFrappe<TaskRow[]>("frappe.client.get_list", {
    doctype: "Task",
    filters: JSON.stringify(filters),
    fields: TASK_FIELDS,
    limit_page_length: 200,
    order_by: "exp_start_date asc",
  });
};

export const createProject = (data: Partial<ProjectRow>) =>
  callFrappe<{ name: string }>("frappe.client.insert", {
    doc: JSON.stringify({ doctype: "Project", ...data }),
  });

export const updateProject = (name: string, data: Partial<ProjectRow>) =>
  callFrappe("frappe.client.set_value", {
    doctype: "Project",
    name,
    fieldname: JSON.stringify(data),
  });

export const createTask = (data: Partial<TaskRow>) =>
  callFrappe<{ name: string }>("frappe.client.insert", {
    doc: JSON.stringify({ doctype: "Task", ...data }),
  });

export const updateTask = (name: string, data: Partial<TaskRow>) =>
  callFrappe("frappe.client.set_value", {
    doctype: "Task",
    name,
    fieldname: JSON.stringify(data),
  });

export const deleteTask = (name: string) =>
  callFrappe("frappe.client.delete", { doctype: "Task", name });

// ── GL / Financials ───────────────────────────────────────────────────────
export const fetchGLEntries = (p: {
  from_date: string;
  to_date: string;
  account?: string;
  company?: string;
  voucher_type?: string;
}) => {
  const filters: unknown[][] = [
    ["posting_date", "between", [p.from_date, p.to_date]],
    ["is_cancelled", "=", 0],
  ];
  if (p.account)      filters.push(["account", "=", p.account]);
  if (p.company)      filters.push(["company", "=", p.company]);
  if (p.voucher_type) filters.push(["voucher_type", "=", p.voucher_type]);
  return callFrappe<GLEntryRow[]>("frappe.client.get_list", {
    doctype: "GL Entry",
    filters: JSON.stringify(filters),
    fields: JSON.stringify([
      "name","account","account_type","posting_date","debit","credit",
      "voucher_type","voucher_no","party_type","party","remarks","company",
    ]),
    limit_page_length: 500,
    order_by: "posting_date desc",
  });
};

export const fetchAccounts = (p: { root_type?: string; company?: string; account_type?: string } = {}) => {
  const filters: unknown[][] = [["is_group", "=", 0]];
  if (p.root_type)    filters.push(["root_type", "=", p.root_type]);
  if (p.company)      filters.push(["company", "=", p.company]);
  if (p.account_type) filters.push(["account_type", "=", p.account_type]);
  return callFrappe<AccountRow[]>("frappe.client.get_list", {
    doctype: "Account",
    filters: JSON.stringify(filters),
    fields: JSON.stringify(["name","account_name","account_type","root_type","parent_account","company"]),
    limit_page_length: 200,
    order_by: "name asc",
  });
};

export const fetchTrialBalance = (p: { company: string; from_date: string; to_date: string }) =>
  callFrappe<{ message: unknown[] }>("erpnext.accounts.report.trial_balance.trial_balance.execute", {
    filters: JSON.stringify({
      company: p.company,
      from_date: p.from_date,
      to_date: p.to_date,
      show_zero_values: 0,
    }),
  });

// ── Payroll ───────────────────────────────────────────────────────────────
export const fetchSalarySlips = (p: {
  start_date?: string;
  end_date?: string;
  employee?: string;
  department?: string;
  company?: string;
  status?: string;
  branch?: string;
}) => {
  const filters: unknown[][] = [];
  if (p.start_date)  filters.push(["start_date", ">=", p.start_date]);
  if (p.end_date)    filters.push(["end_date", "<=", p.end_date]);
  if (p.employee)    filters.push(["employee", "=", p.employee]);
  if (p.department)  filters.push(["department", "=", p.department]);
  if (p.company)     filters.push(["company", "=", p.company]);
  if (p.status)      filters.push(["status", "=", p.status]);
  if (p.branch)      filters.push(["branch", "=", p.branch]);
  return callFrappe<SalarySlipRow[]>("frappe.client.get_list", {
    doctype: "Salary Slip",
    filters: JSON.stringify(filters),
    fields: JSON.stringify([
      "name","employee","employee_name","department","designation","branch",
      "start_date","end_date","posting_date","status","salary_structure",
      "payroll_entry","gross_pay","total_deduction","net_pay",
      "payment_days","total_working_days","company",
    ]),
    limit_page_length: 200,
    order_by: "posting_date desc",
  });
};

export const fetchPayrollEntries = (p: {
  company?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
} = {}) => {
  const filters: unknown[][] = [];
  if (p.company)    filters.push(["company", "=", p.company]);
  if (p.from_date)  filters.push(["start_date", ">=", p.from_date]);
  if (p.to_date)    filters.push(["end_date",   "<=", p.to_date]);
  if (p.status)     filters.push(["docstatus", "=", p.status === "Submitted" ? 1 : 0]);
  return callFrappe<PayrollEntryRow[]>("frappe.client.get_list", {
    doctype: "Payroll Entry",
    filters: JSON.stringify(filters),
    fields: JSON.stringify([
      "name","company","branch","department","payroll_frequency",
      "start_date","end_date","posting_date","payment_date",
      "total_salary_amount","docstatus",
    ]),
    limit_page_length: 50,
    order_by: "posting_date desc",
  });
};

export const fetchEmployees = (p: { company?: string; department?: string; branch?: string; status?: string } = {}) => {
  const filters: unknown[][] = [];
  if (p.company)    filters.push(["company", "=", p.company]);
  if (p.department) filters.push(["department", "=", p.department]);
  if (p.branch)     filters.push(["branch", "=", p.branch]);
  if (p.status)     filters.push(["status", "=", p.status]);
  else              filters.push(["status", "=", "Active"]);
  return callFrappe<EmployeeRow[]>("frappe.client.get_list", {
    doctype: "Employee",
    filters: JSON.stringify(filters),
    fields: JSON.stringify([
      "name","employee_name","department","designation","branch","company","status",
      "cell_number","user_id",
    ]),
    limit_page_length: 500,
    order_by: "employee_name asc",
  });
};

export const createPayrollEntry = (data: Partial<PayrollEntryRow>) =>
  callFrappe<{ name: string }>("frappe.client.insert", {
    doc: JSON.stringify({ doctype: "Payroll Entry", ...data }),
  });

// ── Attendance CRUD ───────────────────────────────────────────────────────
export interface AttendanceRow {
  name?: string;
  employee: string;
  employee_name?: string;
  attendance_date: string;
  status: "Present" | "Absent" | "Half Day" | "Work From Home" | "On Leave";
  company?: string;
  department?: string;
  docstatus?: number;
}

export const fetchAttendance = (p: {
  from_date: string;
  to_date: string;
  employee?: string;
  company?: string;
  department?: string;
}) => {
  const filters: unknown[][] = [
    ["attendance_date", "between", [p.from_date, p.to_date]],
  ];
  if (p.employee)   filters.push(["employee", "=", p.employee]);
  if (p.company)    filters.push(["company", "=", p.company]);
  if (p.department) filters.push(["department", "=", p.department]);
  return callFrappe<AttendanceRow[]>("frappe.client.get_list", {
    doctype: "Attendance",
    filters: JSON.stringify(filters),
    fields: JSON.stringify([
      "name","employee","employee_name","attendance_date","status","company","department","docstatus",
    ]),
    limit_page_length: 1000,
    order_by: "attendance_date desc",
  });
};

export const createAttendance = (data: Partial<AttendanceRow>) =>
  callFrappe<{ name: string }>("frappe.client.insert", {
    doc: JSON.stringify({ doctype: "Attendance", ...data }),
  });

export const updateAttendance = (name: string, data: Partial<AttendanceRow>) =>
  callFrappe<{ name: string }>("frappe.client.set_value", {
    doctype: "Attendance",
    name,
    fieldname: JSON.stringify(data),
  });
