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
