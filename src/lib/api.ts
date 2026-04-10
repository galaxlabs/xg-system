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
export const fetchStateByExecutive = (p: Record<string, unknown> = {}) =>
  callFrappe<StateByExecRow[]>(`${RPT}.state_by_executive.get_state_counts_by_executive`, p);

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
