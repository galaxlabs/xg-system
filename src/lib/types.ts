// ── Overview / Pipeline ───────────────────────────────────────────────────
export interface OverviewCounts {
  submitted: number;
  approved: number;
  agreement_sent: number;
  signed: number;
  converted: number;
  installed: number;
  rejected: number;
  cancelled: number;
  disputed: number;
  net_signed: number;
}

export interface OverviewResponse {
  counts: OverviewCounts;
  status_snapshot: { label: string; value: number }[];
}

// ── Company breakdown ─────────────────────────────────────────────────────
export interface CompanyRow {
  operator_company: string;
  submitted?: number;
  approved?: number;
  agreement_sent?: number;
  signed?: number;
  converted?: number;
  installed?: number;
  rejected?: number;
  cancelled?: number;
  net_signed?: number;
  [key: string]: unknown;
}

// ── Agent breakdown ───────────────────────────────────────────────────────
export interface AgentRow {
  agent: string;
  display_name?: string;
  company?: string;
  total_submitted?: number;
  total_approved?: number;
  total_agreement_sent?: number;
  total_signs?: number;
  total_converted?: number;
  total_installed?: number;
  total_rejected?: number;
  total_cancelled?: number;
  net_signed?: number;
  sign_rate?: number;
  approval_rate?: number;
  [key: string]: unknown;
}

// ── Trend ─────────────────────────────────────────────────────────────────
export interface TrendSeries {
  name: string;
  data: number[];
}
export interface TrendResponse {
  categories: string[];
  series: TrendSeries[];
}

// ── Recent signed ─────────────────────────────────────────────────────────
export interface RecentSignedRow {
  name: string;
  business_name: string;
  executive_name: string;
  company: string;
  sign_date: string;
  state_code: string;
  city: string;
  [key: string]: unknown;
}

// ── Signs dashboard ───────────────────────────────────────────────────────
export interface SignsSummary {
  total_signs: number;
  pending_attribution: number;
  attributed: number;
  pending_records: PendingSignRow[];
}

export interface PendingSignRow {
  name: string;
  atm_leads?: string;
  sign_date?: string;
  lead_agent?: string;
  closing_agent?: string | null;
  company?: string;
  branch?: string;
  business_name?: string;
  state_code?: string;
  [key: string]: unknown;
}

// ── Stage velocity ────────────────────────────────────────────────────────
export interface VelocityRow {
  state: string;
  avg_days: number;
  transitions: number;
  min_days: number;
  max_days: number;
}

// ── Pipeline snapshot ─────────────────────────────────────────────────────
export interface PipelineSnapshot {
  states: { state: string; count: number }[];
  total: number;
  sign_rate: number;
  approval_rate: number;
  rejection_rate: number;
  conversion_rate: number;
  install_rate: number;
}

// ── Approval/rejection trend ──────────────────────────────────────────────
export interface LedgerTrend {
  categories: string[];
  series: { name: string; data: number[]; color: string }[];
}

// ── Agent attribution ─────────────────────────────────────────────────────
export interface AttributionRow {
  agent: string;
  display_name: string;
  as_lead_agent: number;
  as_closing_agent: number;
  diff: number;
  [key: string]: unknown;
}

// ── Attendance (Employee Activity Log via frappe.client) ──────────────────
export interface ActivityLogRow {
  name: string;
  employee: string;
  employee_name?: string;
  log_date?: string;
  date?: string;
  active_time_mins?: number;
  idle_time_mins?: number;
  unauthorized_hits?: number;
  unauthorized_site_hits?: number;
  [key: string]: unknown;
}

// ── State by executive ────────────────────────────────────────────────────
export interface StateByExecRow {
  state?: string;
  state_code?: string;
  executive?: string;
  executive_name?: string;
  submitted?: number;
  approved?: number;
  signed?: number;
  installed?: number;
  rejected?: number;
  total?: number;
  [key: string]: unknown;
}

// ── Agent performance ─────────────────────────────────────────────────────
export interface AgentPerfRow {
  agent_name: string;
  executive_name?: string;
  total_leads?: number;
  signed?: number;
  approved?: number;
  rejected?: number;
  sign_rate?: number;
  avg_response_days?: number;
  [key: string]: unknown;
}

// ── Filters (shared) ──────────────────────────────────────────────────────
export interface GlobalFilters {
  from_date?: string;
  to_date?: string;
  month?: string;
  company?: string;
  branch?: string;
  agent?: string;
}

// ── ATM Leads ─────────────────────────────────────────────────────────────
export interface ATMLeadRow {
  name: string;
  business_name?: string;
  owner_name?: string;
  company?: string;
  executive_name?: string;
  branch?: string;
  state_code?: string;
  state?: string;
  city?: string;
  address?: string;
  zip_code?: string;
  email?: string;
  business_phone_number?: string;
  personal_cell_phone?: string;
  business_type?: string;
  contract_length?: string;
  base_rent?: string;
  hours?: string;
  percentage?: string;
  post_date?: string;
  approve_date?: string;
  agreement_sent_date?: string;
  sign_date?: string;
  convert_date?: string;
  install_date?: string;
  remove_date?: string;
  status?: string;
  workflow_state?: string;
  lead_owner?: string;
  is_duplicate?: 0 | 1;
  latitude?: number;
  longitude?: number;
  ai_core?: number;
  [key: string]: unknown;
}

// ── Projects ──────────────────────────────────────────────────────────────
export interface ProjectRow {
  name: string;
  project_name: string;
  status?: string;
  priority?: string;
  percent_complete?: number;
  expected_start_date?: string;
  expected_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  company?: string;
  department?: string;
  customer?: string;
  estimated_costing?: number;
  total_costing_amount?: number;
  gross_margin?: number;
  per_gross_margin?: number;
  is_active?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface TaskRow {
  name: string;
  subject: string;
  project?: string;
  status?: string;
  priority?: string;
  progress?: number;
  exp_start_date?: string;
  exp_end_date?: string;
  act_start_date?: string;
  act_end_date?: string;
  is_milestone?: 0 | 1;
  is_group?: 0 | 1;
  color?: string;
  description?: string;
  expected_time?: number;
  actual_time?: number;
  [key: string]: unknown;
}

// ── GL / Financials ───────────────────────────────────────────────────────
export interface GLEntryRow {
  name: string;
  account?: string;
  account_type?: string;
  posting_date?: string;
  debit?: number;
  credit?: number;
  debit_in_account_currency?: number;
  credit_in_account_currency?: number;
  voucher_type?: string;
  voucher_no?: string;
  party_type?: string;
  party?: string;
  cost_center?: string;
  project?: string;
  remarks?: string;
  company?: string;
  [key: string]: unknown;
}

export interface AccountRow {
  name: string;
  account_name?: string;
  account_type?: string;
  root_type?: string;
  parent_account?: string;
  company?: string;
  balance?: number;
  [key: string]: unknown;
}

// ── Payroll ───────────────────────────────────────────────────────────────
export interface SalarySlipRow {
  name: string;
  employee?: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  branch?: string;
  start_date?: string;
  end_date?: string;
  posting_date?: string;
  status?: string;
  salary_structure?: string;
  payroll_entry?: string;
  gross_pay?: number;
  total_deduction?: number;
  net_pay?: number;
  payment_days?: number;
  total_working_days?: number;
  company?: string;
  [key: string]: unknown;
}

export interface PayrollEntryRow {
  name: string;
  company?: string;
  branch?: string;
  department?: string;
  payroll_frequency?: string;
  start_date?: string;
  end_date?: string;
  posting_date?: string;
  status?: string;
  payment_date?: string;
  salary_slip_based_on_timesheet?: 0 | 1;
  total_salary_amount?: number;
  [key: string]: unknown;
}

export interface EmployeeRow {
  name: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  branch?: string;
  company?: string;
  status?: string;
  cell_number?: string;
  user_id?: string;
  salary_mode?: string;
  bank_account?: string;
  [key: string]: unknown;
}
