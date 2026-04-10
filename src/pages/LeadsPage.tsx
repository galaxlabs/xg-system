import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  fetchATMLeads, fetchATMLeadFull, createATMLead, updateATMLead, deleteATMLead,
  applyWorkflowAction, checkLocationConflict, getCompanyAvailability,
  fetchOperatorCompanies, thisMonthRange,
  type DedupConflict, type CompanyAvailability, type StateHistoryRow,
} from "../lib/api";
import {
  Card, StatCard, DataTable, LoadingBlock, EmptyBlock,
  DateInput, Modal, FormField, FormGrid,
  Pagination, ConfirmDialog,
} from "../components/ui/index";
import type { ATMLeadRow } from "../lib/types";

// ── Workflow "Track" — all states from Frappe DB ─────────────────────────
export const WF_STATES = [
  "Draft","Pending","Approved","Requested for Agreement Sent","Agreement Sent",
  "Pending Sign","Signed","Installed","Converted","Call Back","Called",
  "Interested","Not Interested","Cancelled","Rejected","Not Qualified",
  "Re Approval","Signed Rejected","Needs Reanalysis","Disputed",
  "Resigned","installed/Removed","Hide",
] as const;
export type WFState = (typeof WF_STATES)[number];

// Happy-path pipeline stages (left → right progression)
const PIPELINE: WFState[] = [
  "Draft","Pending","Approved","Requested for Agreement Sent",
  "Agreement Sent","Pending Sign","Signed","Installed","Converted",
];

// Exact colours from atm_leads.js (the actual Frappe client script)
const STATE_COLOR: Record<string, string> = {
  "Draft":                         "#6b7280",
  "Pending":                       "#f59e0b",
  "Approved":                      "#16a34a",
  "Requested for Agreement Sent":  "#a78bfa",
  "Agreement Sent":                "#0ea5e9",
  "Pending Sign":                  "#f59e0b",
  "Signed":                        "#16a34a",
  "Installed":                     "#2563eb",
  "Converted":                     "#2563eb",
  "Call Back":                     "#8b5cf6",
  "Called":                        "#6366f1",
  "Interested":                    "#10b981",
  "Not Interested":                "#ef4444",
  "Cancelled":                     "#6b7280",
  "Rejected":                      "#ef4444",
  "Not Qualified":                 "#ef4444",
  "Re Approval":                   "#f97316",
  "Signed Rejected":               "#ef4444",
  "Needs Reanalysis":              "#f97316",
  "Disputed":                      "#dc2626",
  "Resigned":                      "#9ca3af",
  "installed/Removed":             "#9ca3af",
  "Hide":                          "#d1d5db",
};

// ── Full "Track" workflow transitions ─────────────────────────────────────
// source: `bench --site crm.galaxylabs.online execute "frappe.get_doc" --args '["Workflow","Track"]'`
const TRANSITIONS: Record<string, { action: string; to: string; role: string }[]> = {
  "Draft": [
    { action: "Submit",         to: "Pending",             role: "Sales Agent" },
    { action: "Call Back",      to: "Call Back",           role: "Sales Agent" },
    { action: "Approve",        to: "Approved",            role: "Data Executive" },
    { action: "Reject",         to: "Rejected",            role: "Data Executive" },
    { action: "Sign",           to: "Signed",              role: "Data Executive" },
    { action: "Install",        to: "Installed",           role: "Data Executive" },
    { action: "Sign Rejected",  to: "Signed Rejected",     role: "Administrator" },
    { action: "Re Approval",    to: "Re Approval",         role: "Administrator" },
  ],
  "Call Back":    [{ action: "Call",            to: "Called",           role: "Sales Agent" }],
  "Called": [
    { action: "Interest",       to: "Interested",          role: "Sales Agent" },
    { action: "Not Interest",   to: "Not Interested",      role: "Sales Agent" },
  ],
  "Not Interested": [{ action: "Cancel",        to: "Cancelled",        role: "Sales Agent" }],
  "Interested":     [{ action: "Submit",        to: "Pending",          role: "Sales Agent" }],
  "Pending": [
    { action: "Approve",        to: "Approved",            role: "Data Executive" },
    { action: "Reject",         to: "Rejected",            role: "Data Executive" },
    { action: "Reject",         to: "Not Qualified",       role: "Data Executive" },
    { action: "Cancel",         to: "Draft",               role: "Data Executive" },
    { action: "Install",        to: "Installed",           role: "Data Executive" },
    { action: "Sign",           to: "Signed",              role: "Data Executive" },
    { action: "Re Approval",    to: "Re Approval",         role: "Sales User" },
    { action: "Approve",        to: "Approved",            role: "OC" },
    { action: "Reject",         to: "Rejected",            role: "OC" },
    { action: "In Active",      to: "Hide",                role: "Administrator" },
  ],
  "Approved": [
    { action: "Request For Agreement", to: "Requested for Agreement Sent", role: "Sales Agent" },
    { action: "Cancel",         to: "Pending",             role: "Data Executive" },
    { action: "Needs Reanalysis",to:"Needs Reanalysis",    role: "Data Executive" },
    { action: "In Active",      to: "Hide",                role: "Administrator" },
  ],
  "Requested for Agreement Sent": [
    { action: "Sent Agreement", to: "Agreement Sent",      role: "Sales Agent" },
    { action: "Cancel",         to: "Approved",            role: "Data Executive" },
  ],
  "Agreement Sent": [
    { action: "Sign",           to: "Pending Sign",        role: "Sales Agent" },
    { action: "Cancel",         to: "Approved",            role: "Data Executive" },
    { action: "In Active",      to: "Hide",                role: "Administrator" },
  ],
  "Pending Sign": [{ action: "Sign",            to: "Signed",           role: "Data Executive" }],
  "Signed": [
    { action: "Install",        to: "Installed",           role: "Data Executive" },
    { action: "Convert",        to: "Converted",           role: "Onboarding Executive" },
    { action: "Cancel",         to: "Agreement Sent",      role: "Data Executive" },
    { action: "Reject",         to: "Signed Rejected",     role: "Data Executive" },
    { action: "Resign",         to: "Resigned",            role: "Data Executive" },
    { action: "Cancel",         to: "Draft",               role: "Administrator" },
    { action: "In Active",      to: "Hide",                role: "Administrator" },
  ],
  "Installed": [
    { action: "Cancel",         to: "Signed",              role: "Administrator" },
    { action: "Remove",         to: "installed/Removed",   role: "Administrator" },
  ],
  "Converted": [
    { action: "Install",        to: "Installed",           role: "Data Executive" },
    { action: "Reject",         to: "Signed Rejected",     role: "Data Executive" },
  ],
  "Rejected": [
    { action: "Review",         to: "Pending",             role: "Data Executive" },
    { action: "Re Approval",    to: "Re Approval",         role: "Sales Agent" },
    { action: "Needs Reanalysis",to:"Needs Reanalysis",    role: "Data Executive" },
    { action: "Dispute",        to: "Disputed",            role: "Sales Agent" },
    { action: "In Active",      to: "Hide",                role: "Administrator" },
  ],
  "Re Approval": [
    { action: "Approve",        to: "Approved",            role: "Data Executive" },
    { action: "Reject",         to: "Rejected",            role: "Data Executive" },
  ],
  "Needs Reanalysis": [{ action: "Cancel",  to: "Draft",              role: "Data Executive" }],
  "Signed Rejected":  [{ action: "Cancel",  to: "Signed",             role: "Administrator" }],
  "installed/Removed":[{ action: "Cancel",  to: "Installed",          role: "Administrator" }],
  "Disputed": [
    { action: "Approve",        to: "Approved",            role: "Data Executive" },
    { action: "Reject",         to: "Rejected",            role: "Data Executive" },
  ],
};

// ── Helper: get current display state ────────────────────────────────────
const getState = (r: ATMLeadRow): string => r.workflow_state ?? r.status ?? "Draft";

// ─────────────────────────────────────────────────────────────────────────
// Phone normaliser (mirrors atm_leads.py)
// ─────────────────────────────────────────────────────────────────────────
function normalizePhone(value: string): string {
  if (!value) return value;
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `${digits[0]}-${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string | null }) {
  const c = STATE_COLOR[status ?? ""] ?? "#6b7280";
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${c}22`, color: c }}>
      {status ?? "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Workflow Pipeline Bar — shows happy-path stages; highlights current
// ─────────────────────────────────────────────────────────────────────────
function WorkflowPipelineBar({ currentState }: { currentState: string }) {
  const idx      = PIPELINE.indexOf(currentState as WFState);
  const isOnPath = idx >= 0;
  const LABELS: Record<string, string> = {
    "Draft": "Draft",
    "Pending": "Pending",
    "Approved": "Approved",
    "Requested for Agreement Sent": "Req'd Agmt",
    "Agreement Sent": "Agmt Sent",
    "Pending Sign": "Pend. Sign",
    "Signed": "Signed",
    "Installed": "Installed",
    "Converted": "Converted",
  };
  return (
    <div className="mb-4">
      {!isOnPath && (
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold rounded-full px-3 py-1"
            style={{ background: `${STATE_COLOR[currentState] ?? "#6b7280"}22`, color: STATE_COLOR[currentState] ?? "#6b7280", border: `1px solid ${STATE_COLOR[currentState] ?? "#6b7280"}44` }}>
            ⚡ {currentState}
          </span>
          <span className="text-xs text-muted">(off main pipeline)</span>
        </div>
      )}
      <div className="flex items-center overflow-x-auto pb-1" style={{ gap: 0 }}>
        {PIPELINE.map((stage, i) => {
          const isCompleted = isOnPath && i < idx;
          const isCurrent   = isOnPath && i === idx;
          const color        = STATE_COLOR[stage];
          return (
            <div key={stage} className="flex items-center flex-shrink-0">
              {/* Node */}
              <div className="flex flex-col items-center" style={{ minWidth: 64 }}>
                <div className="flex items-center justify-center rounded-full font-bold text-xs"
                  style={{
                    width: isCurrent ? 28 : 22,
                    height: isCurrent ? 28 : 22,
                    background: isCompleted ? color : isCurrent ? color : `${color}22`,
                    color: isCompleted || isCurrent ? "#fff" : color,
                    border: `2px solid ${color}`,
                    boxShadow: isCurrent ? `0 0 0 3px ${color}44` : "none",
                    transition: "all .2s",
                  }}>
                  {isCompleted ? "✓" : i + 1}
                </div>
                <span className="mt-1 text-center leading-tight"
                  style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? color : "#9ca3af", maxWidth: 60 }}>
                  {LABELS[stage]}
                </span>
              </div>
              {/* Connector */}
              {i < PIPELINE.length - 1 && (
                <div style={{ height: 2, width: 20, flexShrink: 0, marginBottom: 16,
                  background: isOnPath && i < idx ? STATE_COLOR[PIPELINE[i + 1]] : "#e5e7eb" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Workflow Action Buttons
// ─────────────────────────────────────────────────────────────────────────
type ActionType = "progress" | "cancel" | "danger" | "neutral";
const ACTION_TYPE: Record<string, ActionType> = {
  "Submit":               "progress",
  "Approve":              "progress",
  "Install":              "progress",
  "Convert":              "progress",
  "Sign":                 "progress",
  "Request For Agreement":"progress",
  "Sent Agreement":       "progress",
  "Interest":             "progress",
  "Call":                 "progress",
  "Review":               "progress",
  "Dispute":              "neutral",
  "Re Approval":          "neutral",
  "Not Interest":         "danger",
  "Reject":               "danger",
  "Reject (Not Qualified)":"danger",
  "Cancel":               "cancel",
  "In Active":            "danger",
  "Resign":               "cancel",
  "Remove":               "danger",
  "Sign Rejected":        "danger",
  "Needs Reanalysis":     "neutral",
  "Call Back":            "neutral",
};

const ACTION_STYLE: Record<ActionType, string> = {
  progress: "background:#f0fdf4;color:#16a34a;border:1px solid #86efac",
  cancel:   "background:#fffbeb;color:#d97706;border:1px solid #fcd34d",
  danger:   "background:#fef2f2;color:#dc2626;border:1px solid #fca5a5",
  neutral:  "background:#eff6ff;color:#2563eb;border:1px solid #93c5fd",
};

function WorkflowActions({ lead, onDone }: { lead: ATMLeadRow; onDone: () => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const currentState = getState(lead);
  const transitions = TRANSITIONS[currentState] ?? [];

  // De-duplicate actions (same action may appear with different roles)
  const seen = new Set<string>();
  const unique = transitions.filter((t) => {
    const key = `${t.action}→${t.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!unique.length) return (
    <p className="text-xs text-muted italic">No workflow actions available for this state.</p>
  );

  const apply = async (action: string) => {
    setLoading(action);
    setErr(null);
    try {
      await applyWorkflowAction(lead.name, action);
      qc.invalidateQueries({ queryKey: ["atm_leads"] });
      qc.invalidateQueries({ queryKey: ["atm_lead_full", lead.name] });
      onDone();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">Workflow Actions</p>
      {err && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{err}</div>}
      <div className="flex flex-wrap gap-2">
        {unique.map((t) => {
          const type = ACTION_TYPE[t.action] ?? "neutral";
          const style = ACTION_STYLE[type];
          const isLoading = loading === t.action;
          return (
            <button key={`${t.action}→${t.to}`}
              disabled={!!loading}
              onClick={() => apply(t.action)}
              className="gc-btn text-xs font-semibold rounded-lg px-3 py-1.5 transition-all"
              style={{ ...(Object.fromEntries(style.split(";").map(s => s.split(":").map(x=>x.trim())).filter(([k])=>k))), opacity: loading && !isLoading ? 0.6 : 1 }}
              title={`Role: ${t.role} → ${t.to}`}>
              {isLoading ? "…" : t.action}
              <span className="ml-1.5 text-xs opacity-60">→ {t.to}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dedup Banner
// ─────────────────────────────────────────────────────────────────────────
function DedupBanner({ conflict, onDismiss }: { conflict: DedupConflict; onDismiss: () => void }) {
  const isPermanent = conflict.type === "permanent";
  const bg     = isPermanent ? "#fef2f2" : "#fffbeb";
  const border = isPermanent ? "#fca5a5" : "#fcd34d";
  const color  = isPermanent ? "#b91c1c" : "#92400e";
  const icon   = isPermanent ? "⛔" : "⚠️";
  const pct    = !isPermanent && conflict.remaining_days != null
    ? Math.min(100, Math.round(((conflict.window - conflict.remaining_days) / conflict.window) * 100)) : 0;
  const barColor = !isPermanent ? (conflict.remaining_days ?? 0) <= 3 ? "#ef4444" : (conflict.remaining_days ?? 0) <= 7 ? "#f97316" : "#f59e0b" : "#ef4444";
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        <div className="flex-1">
          <div style={{ fontWeight: 700, color, fontSize: 14 }}>
            {isPermanent ? "Location Permanently Locked" : `Location Locked – ${conflict.window}-Day Window`}
          </div>
          <div className="mt-1 text-xs space-y-1" style={{ color: "#4b5563" }}>
            <div>Lead: <strong>{conflict.lead}</strong></div>
            <div className="flex items-center gap-2">State: <StatusBadge status={conflict.state} /> Company: <strong>{conflict.company}</strong></div>
            {!isPermanent && conflict.age_days != null && (
              <div>Created <strong>{conflict.age_days}</strong>d ago — <strong style={{ color: barColor }}>{conflict.remaining_days}d remaining</strong></div>
            )}
          </div>
          {!isPermanent && (
            <div style={{ marginTop: 8, background: `${barColor}22`, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{ background: barColor, width: `${pct}%`, height: "100%", borderRadius: 999 }} />
            </div>
          )}
        </div>
        <button onClick={onDismiss} className="text-xs text-muted">✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Duplicate for Companies modal
// ─────────────────────────────────────────────────────────────────────────
function DuplicateCompaniesModal({ lead, open, onClose }: { lead: ATMLeadRow; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ name: string; ok: boolean; err?: string }[] | null>(null);
  const [duping, setDuping] = useState(false);
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["co_availability", lead.name],
    queryFn: () => getCompanyAvailability({ lead_name: lead.name, full_address: lead.full_address as string ?? "", address: lead.address ?? "", zip_code: lead.zip_code ?? "", latitude: lead.latitude, longitude: lead.longitude, source_company: lead.company ?? "" }),
    enabled: open,
  });
  const STATUS_CFG: Record<CompanyAvailability["status"], { icon: string; color: string; bg: string; border: string; label: string; selectable: boolean }> = {
    available: { icon: "✅", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", label: "Available",    selectable: true  },
    source:    { icon: "📌", color: "#2563eb", bg: "#eff6ff", border: "#93c5fd", label: "Current Lead", selectable: false },
    locked:    { icon: "⏱",  color: "#d97706", bg: "#fffbeb", border: "#fcd34d", label: "Locked",       selectable: false },
    committed: { icon: "🔒", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", label: "Committed",    selectable: false },
  };
  const filtered  = companies.filter((c) => !search || c.operator_name.toLowerCase().includes(search.toLowerCase()));
  const available = filtered.filter((c) => c.status === "available");
  const toggle = (name: string) => setSelected((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const handleDuplicate = async () => {
    if (!selected.size) return;
    setDuping(true);
    const res: { name: string; ok: boolean; err?: string }[] = [];
    for (const coName of [...selected]) {
      try {
        const copy: Partial<ATMLeadRow> = { ...lead }; delete copy.name;
        await createATMLead({ ...copy, company: coName, workflow_state: "Draft", status: "Draft" });
        res.push({ name: coName, ok: true });
      } catch (e) { res.push({ name: coName, ok: false, err: String(e) }); }
    }
    setResults(res); setDuping(false); qc.invalidateQueries({ queryKey: ["atm_leads"] });
  };
  const handleClose = () => { setSelected(new Set()); setSearch(""); setResults(null); onClose(); };
  return (
    <Modal open={open} onClose={handleClose} title="Duplicate Lead for Companies" size="lg"
      footer={results ? <button className="gc-btn gc-btn-primary" onClick={handleClose}>Close</button> : (
        <div className="flex gap-2 justify-end">
          <button className="gc-btn gc-btn-ghost" onClick={handleClose}>Cancel</button>
          <button className="gc-btn gc-btn-primary" onClick={handleDuplicate} disabled={!selected.size || duping}>
            {duping ? "Duplicating…" : `Duplicate${selected.size ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      )}>
      <div className="p-1">
        {results ? (
          <div className="space-y-2">
            <div className="rounded-lg p-3 text-sm font-semibold" style={{ background: results.every(r=>r.ok)?"#f0fdf4":results.every(r=>!r.ok)?"#fef2f2":"#fffbeb", color: results.every(r=>r.ok)?"#16a34a":results.every(r=>!r.ok)?"#dc2626":"#d97706" }}>
              {results.every(r=>r.ok)?`✅ All ${results.length} duplicated!`:results.every(r=>!r.ok)?"❌ All failed.":`⚠️ ${results.filter(r=>r.ok).length} ok, ${results.filter(r=>!r.ok).length} failed.`}
            </div>
            {results.map(r=><div key={r.name} className="flex items-center gap-2 py-2 border-b border-border text-sm"><span>{r.ok?"✅":"❌"}</span><span className="font-medium flex-1 truncate">{r.name}</span>{!r.ok&&<span className="text-red-600 text-xs">{r.err}</span>}</div>)}
          </div>
        ) : isLoading ? <LoadingBlock /> : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["available","locked","committed","source"] as const).map(s=>{const cnt=companies.filter(c=>c.status===s).length;if(!cnt)return null;const cfg=STATUS_CFG[s];return<span key={s} className="text-xs font-semibold rounded-full px-3 py-1" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`}}>{cnt} {cfg.label}</span>;})}
            </div>
            <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">🔍</span><input className="gc-input pl-8" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies…" /></div>
            <div className="flex gap-3 text-xs"><button className="text-blue-600 font-semibold hover:underline" onClick={()=>setSelected(new Set(available.map(c=>c.name)))}>Select All Available</button><span className="text-border">|</span><button className="text-muted hover:underline" onClick={()=>setSelected(new Set())}>Clear</button><span className="ml-auto text-muted">{selected.size} selected</span></div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filtered.map(co=>{const cfg=STATUS_CFG[co.status];const isSel=selected.has(co.name);return(
                <label key={co.name} className="flex items-start gap-3 rounded-xl p-3" style={{background:cfg.bg,border:`1px solid ${isSel?cfg.color:cfg.border}`,opacity:cfg.selectable?1:0.65,cursor:cfg.selectable?"pointer":"default"}}>
                  <input type="checkbox" disabled={!cfg.selectable} checked={isSel} onChange={()=>toggle(co.name)} className="mt-0.5 w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-sm">{cfg.icon} {co.operator_name}</span><span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{background:`${cfg.color}22`,color:cfg.color}}>{cfg.label}</span></div>
                    {co.status==="locked"&&<div className="mt-1 text-xs" style={{color:cfg.color}}>Locked — {co.remaining_days}d remaining{co.lead?` · ${co.lead}`:""}</div>}
                    {co.status==="committed"&&co.lead&&<div className="mt-1 text-xs" style={{color:cfg.color}}>Committed: <strong>{co.lead}</strong> <StatusBadge status={co.lead_state}/></div>}
                  </div>
                </label>
              );})}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Advanced Filter Panel
// ─────────────────────────────────────────────────────────────────────────
interface Filters {
  search: string;
  status: string;
  company: string;
  branch: string;
  stateCode: string;
  executive: string;
  dateField: "post_date" | "approve_date" | "sign_date" | "install_date";
  fromDate: string;
  toDate: string;
  isDuplicate: "" | "1" | "0";
  aiMin: string;
  aiMax: string;
}

function AdvancedFilters({ filters, onChange, onRefresh, onNewLead, companiesList }:{
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  onRefresh: () => void;
  onNewLead: () => void;
  companiesList: { name: string; operator_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const { from, to } = thisMonthRange();
  const hasAdvanced = !!(filters.company || filters.branch || filters.stateCode || filters.executive ||
    filters.isDuplicate !== "" || filters.aiMin || filters.aiMax || filters.dateField !== "post_date");

  return (
    <div className="space-y-3">
      {/* Main row */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <input className="gc-input w-52" value={filters.search} onChange={e=>onChange({search:e.target.value})} placeholder="Business name / address…" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Workflow State</span>
          <select className="gc-input" value={filters.status} onChange={e=>onChange({status:e.target.value})}>
            <option value="">All states</option>
            {WF_STATES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <DateInput label="From" value={filters.fromDate} onChange={v=>onChange({fromDate:v})} />
        <DateInput label="To"   value={filters.toDate}   onChange={v=>onChange({toDate:v})} />
        <div className="flex items-end gap-2">
          <button className={`gc-btn text-xs font-semibold flex items-center gap-1.5 self-end ${open || hasAdvanced ? "gc-btn-primary" : "gc-btn-ghost"}`}
            onClick={()=>setOpen(p=>!p)}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
            Filters {hasAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90 inline-block" />}
          </button>
          <button className="gc-btn gc-btn-ghost self-end" title="Refresh" onClick={onRefresh}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <button className="gc-btn gc-btn-primary self-end" onClick={onNewLead}>+ New Lead</button>
        </div>
      </div>

      {/* Advanced panel */}
      {open && (
        <div className="rounded-xl border border-border p-4 space-y-4" style={{ background: "var(--surface, #f8fafc)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Advanced Filters</span>
            {hasAdvanced && (
              <button className="text-xs text-red-500 font-semibold hover:underline"
                onClick={() => onChange({ company:"", branch:"", stateCode:"", executive:"", isDuplicate:"", aiMin:"", aiMax:"", dateField:"post_date", fromDate:from, toDate:to })}>
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Company</span>
              <select className="gc-input" value={filters.company} onChange={e=>onChange({company:e.target.value})}>
                <option value="">All companies</option>
                {companiesList.map(c=><option key={c.name} value={c.name}>{c.operator_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Branch</span>
              <input className="gc-input" value={filters.branch} onChange={e=>onChange({branch:e.target.value})} placeholder="Branch name…" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">State Code</span>
              <input className="gc-input uppercase" value={filters.stateCode} onChange={e=>onChange({stateCode:e.target.value.toUpperCase()})} placeholder="TX, CA, NY…" maxLength={2} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Executive</span>
              <input className="gc-input" value={filters.executive} onChange={e=>onChange({executive:e.target.value})} placeholder="Name contains…" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Date Field</span>
              <select className="gc-input" value={filters.dateField} onChange={e=>onChange({dateField:e.target.value as Filters["dateField"]})}>
                <option value="post_date">Posted Date</option>
                <option value="approve_date">Approved Date</option>
                <option value="sign_date">Sign Date</option>
                <option value="install_date">Install Date</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Duplicate Only</span>
              <select className="gc-input" value={filters.isDuplicate} onChange={e=>onChange({isDuplicate:e.target.value as Filters["isDuplicate"]})}>
                <option value="">All leads</option>
                <option value="1">Duplicates only</option>
                <option value="0">Originals only</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">AI Score Min</span>
              <input type="number" className="gc-input" value={filters.aiMin} onChange={e=>onChange({aiMin:e.target.value})} placeholder="0" min={0} max={10} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">AI Score Max</span>
              <input type="number" className="gc-input" value={filters.aiMax} onChange={e=>onChange({aiMax:e.target.value})} placeholder="10" min={0} max={10} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lead Form
// ─────────────────────────────────────────────────────────────────────────
function LeadForm({ initial, onSave, onCancel, saving }: {
  initial: Partial<ATMLeadRow>;
  onSave: (data: Partial<ATMLeadRow>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<ATMLeadRow>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<DedupConflict | null>(null);
  const [checking, setChecking] = useState(false);
  const [dedupDismissed, setDedupDismissed] = useState(false);
  const { data: companies = [] } = useQuery({ queryKey: ["operator_companies"], queryFn: fetchOperatorCompanies });

  const set = (k: keyof ATMLeadRow, v: unknown) => {
    setForm(f=>({...f,[k]:v}));
    setErrors(e=>{const n={...e};delete n[k as string];return n;});
    if (["address","zip_code","latitude","longitude"].includes(k as string)) { setDedupDismissed(false); setConflict(null); }
  };
  const onPhoneBlur = (k: "business_phone_number"|"personal_cell_phone") => { const v=form[k] as string|undefined; if(v) set(k, normalizePhone(v)); };
  const runDedupCheck = useCallback(async (f: Partial<ATMLeadRow>) => {
    if (!f.address && !f.zip_code && !f.latitude && !f.longitude) return;
    setChecking(true);
    try { setConflict((await checkLocationConflict({ address:f.address, zip_code:f.zip_code, latitude:f.latitude as number, longitude:f.longitude as number, company:f.company, lead_name:f.name ?? "__new__" })) ?? null); }
    catch { /* ignore */ } finally { setChecking(false); }
  }, []);
  const onLocationBlur = () => { if (!dedupDismissed) runDedupCheck(form); };
  const validate = (): boolean => {
    const errs: Record<string,string> = {};
    if (!form.company)       errs.company       = "Company is required";
    if (!form.address)       errs.address       = "Address is required";
    if (!form.business_name) errs.business_name = "Business name is required";
    setErrors(errs); return !Object.keys(errs).length;
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!validate()) return;
    onSave({ ...form, business_phone_number: normalizePhone(form.business_phone_number as string ?? ""), personal_cell_phone: normalizePhone(form.personal_cell_phone as string ?? "") });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {conflict && !dedupDismissed && <DedupBanner conflict={conflict} onDismiss={()=>setDedupDismissed(true)} />}
      {checking && <div className="text-xs text-muted px-1 animate-pulse">Checking location…</div>}

      <div><p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Business Info</p>
        <FormGrid cols={2}>
          <FormField label="Business Name" required><input className={`gc-input${errors.business_name?" border-red-500":""}`} value={form.business_name??""} onChange={e=>set("business_name",e.target.value)} />{errors.business_name&&<span className="text-red-500 text-xs">{errors.business_name}</span>}</FormField>
          <FormField label="Owner Name"><input className="gc-input" value={form.owner_name??""} onChange={e=>set("owner_name",e.target.value)} /></FormField>
          <FormField label="Business Type"><input className="gc-input" value={form.business_type??""} onChange={e=>set("business_type",e.target.value)} /></FormField>
          <FormField label="Workflow State"><select className="gc-input" value={getState(form as ATMLeadRow)} onChange={e=>{set("workflow_state",e.target.value);set("status",e.target.value);}}>
            {WF_STATES.map(s=><option key={s} value={s}>{s}</option>)}
          </select></FormField>
        </FormGrid></div>

      <div><p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contact</p>
        <FormGrid cols={2}>
          <FormField label="Email"><input type="email" className="gc-input" value={form.email??""} onChange={e=>set("email",e.target.value)} /></FormField>
          <FormField label="Business Phone"><input className="gc-input" value={form.business_phone_number??""} onChange={e=>set("business_phone_number",e.target.value)} onBlur={()=>onPhoneBlur("business_phone_number")} placeholder="e.g. 5558675309" /></FormField>
          <FormField label="Personal Cell"><input className="gc-input" value={form.personal_cell_phone??""} onChange={e=>set("personal_cell_phone",e.target.value)} onBlur={()=>onPhoneBlur("personal_cell_phone")} placeholder="e.g. 5558675309" /></FormField>
          <FormField label="Lead Owner"><input className="gc-input" value={form.lead_owner??""} onChange={e=>set("lead_owner",e.target.value)} /></FormField>
        </FormGrid></div>

      <div><p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Location</p>
        <FormGrid cols={2}>
          <FormField label="Address" required><input className={`gc-input${errors.address?" border-red-500":""}`} value={form.address??""} onChange={e=>set("address",e.target.value)} onBlur={onLocationBlur} />{errors.address&&<span className="text-red-500 text-xs">{errors.address}</span>}</FormField>
          <FormField label="City"><input className="gc-input" value={form.city??""} onChange={e=>set("city",e.target.value)} /></FormField>
          <FormField label="State"><input className="gc-input" value={form.state??""} onChange={e=>set("state",e.target.value)} /></FormField>
          <FormField label="State Code"><input className="gc-input uppercase" value={form.state_code??""} onChange={e=>set("state_code",e.target.value.toUpperCase())} maxLength={2} placeholder="TX" /></FormField>
          <FormField label="Zip Code"><input className="gc-input" value={form.zip_code??""} onChange={e=>set("zip_code",e.target.value)} onBlur={onLocationBlur} /></FormField>
          <FormField label="Full Address"><input className="gc-input" value={form.full_address as string??""} onChange={e=>set("full_address",e.target.value)} /></FormField>
          <FormField label="Latitude"><input type="number" step="0.000001" className="gc-input" value={form.latitude??""} onChange={e=>set("latitude",e.target.value)} onBlur={onLocationBlur} /></FormField>
          <FormField label="Longitude"><input type="number" step="0.000001" className="gc-input" value={form.longitude??""} onChange={e=>set("longitude",e.target.value)} onBlur={onLocationBlur} /></FormField>
        </FormGrid></div>

      <div><p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Deal Info</p>
        <FormGrid cols={2}>
          <FormField label="Company" required><select className={`gc-input${errors.company?" border-red-500":""}`} value={form.company??""} onChange={e=>set("company",e.target.value)}><option value="">Select company</option>{companies.map(c=><option key={c.name} value={c.name}>{c.operator_name}</option>)}</select>{errors.company&&<span className="text-red-500 text-xs">{errors.company}</span>}</FormField>
          <FormField label="Branch"><input className="gc-input" value={form.branch??""} onChange={e=>set("branch",e.target.value)} /></FormField>
          <FormField label="Executive"><input className="gc-input" value={form.executive_name??""} onChange={e=>set("executive_name",e.target.value)} /></FormField>
          <FormField label="Contract Length"><input className="gc-input" value={form.contract_length??""} onChange={e=>set("contract_length",e.target.value)} /></FormField>
          <FormField label="Base Rent ($)"><input type="number" step="0.01" className="gc-input" value={form.base_rent??""} onChange={e=>set("base_rent",e.target.value)} /></FormField>
          <FormField label="Percentage (%)"><input type="number" step="0.01" className="gc-input" value={form.percentage??""} onChange={e=>set("percentage",e.target.value)} /></FormField>
          <FormField label="Hours"><input className="gc-input" value={form.hours??""} onChange={e=>set("hours",e.target.value)} placeholder="24/7" /></FormField>
        </FormGrid></div>

      <div><p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Key Dates</p>
        <FormGrid cols={3}>
          <FormField label="Post Date"><input type="date" className="gc-input" value={form.post_date??""} onChange={e=>set("post_date",e.target.value)} /></FormField>
          <FormField label="Approve Date"><input type="date" className="gc-input" value={form.approve_date??""} onChange={e=>set("approve_date",e.target.value)} /></FormField>
          <FormField label="Agreement Sent"><input type="date" className="gc-input" value={form.agreement_sent_date??""} onChange={e=>set("agreement_sent_date",e.target.value)} /></FormField>
          <FormField label="Sign Date"><input type="date" className="gc-input" value={form.sign_date??""} onChange={e=>set("sign_date",e.target.value)} /></FormField>
          <FormField label="Convert Date"><input type="date" className="gc-input" value={form.convert_date??""} onChange={e=>set("convert_date",e.target.value)} /></FormField>
          <FormField label="Install Date"><input type="date" className="gc-input" value={form.install_date??""} onChange={e=>set("install_date",e.target.value)} /></FormField>
          <FormField label="Remove Date"><input type="date" className="gc-input" value={form.remove_date??""} onChange={e=>set("remove_date",e.target.value)} /></FormField>
        </FormGrid></div>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <button type="button" className="gc-btn gc-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="gc-btn gc-btn-primary" disabled={saving}>{saving?"Saving…":form.name?"Update Lead":"Create Lead"}</button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lead Detail
// ─────────────────────────────────────────────────────────────────────────
function LeadDetail({ leadName, onEdit, onDelete, onDuplicate, onClose }: {
  leadName: string; onEdit: ()=>void; onDelete: ()=>void; onDuplicate: ()=>void; onClose: ()=>void;
}) {
  const { data: lead, isLoading, refetch } = useQuery({
    queryKey: ["atm_lead_full", leadName],
    queryFn:  () => fetchATMLeadFull(leadName),
  });
  if (isLoading) return <LoadingBlock />;
  if (!lead) return <EmptyBlock msg="Lead not found" />;

  const currentState = getState(lead);
  const statusColor  = STATE_COLOR[currentState] ?? "#6b7280";
  const field = (label: string, val: unknown) => val != null && val !== "" ? (
    <div key={label}><dt className="text-xs text-muted uppercase tracking-wider">{label}</dt><dd className="text-sm font-medium text-text mt-0.5">{String(val)}</dd></div>
  ) : null;
  const history: StateHistoryRow[] = (lead.state_history as StateHistoryRow[]|undefined) ?? [];

  return (
    <div className="space-y-5">
      {/* Header: name + state badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-text">{lead.business_name}</h4>
          <p className="text-xs text-muted mt-0.5 font-mono">{lead.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: `${statusColor}22`, color: statusColor }}>{currentState}</span>
          {lead.is_duplicate ? <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-red-100 text-red-700">Duplicate</span> : null}
          {lead.ai_core != null ? <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700">AI {lead.ai_core}/10</span> : null}
        </div>
      </div>

      {/* Workflow pipeline bar */}
      <WorkflowPipelineBar currentState={currentState} />

      {/* Workflow actions */}
      <WorkflowActions lead={lead as ATMLeadRow} onDone={() => { refetch(); }} />

      {/* Info grid */}
      <dl className="grid grid-cols-2 gap-4">
        {field("Owner",           lead.owner_name)}
        {field("Business Type",   lead.business_type)}
        {field("Email",           lead.email)}
        {field("Business Phone",  lead.business_phone_number)}
        {field("Personal Cell",   lead.personal_cell_phone)}
        {field("Lead Owner",      lead.lead_owner)}
        {field("Company",         lead.company)}
        {field("Branch",          lead.branch)}
        {field("Executive",       lead.executive_name)}
        {field("State",           lead.state)}
        {field("State Code",      lead.state_code)}
        {field("City",            lead.city)}
        {field("Zip",             lead.zip_code)}
        {field("Address",         lead.address)}
        {field("Contract Length", lead.contract_length)}
        {field("Base Rent",       lead.base_rent != null ? `$${lead.base_rent}` : null)}
        {field("Percentage",      lead.percentage != null ? `${lead.percentage}%` : null)}
        {field("Hours",           lead.hours)}
      </dl>

      {/* Key dates timeline */}
      {[lead.post_date, lead.approve_date, lead.sign_date, lead.install_date].some(Boolean) && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Key Dates</p>
          <div className="gc-timeline">
            {[
              { label:"Posted",         date:lead.post_date,           color:"#6366f1" },
              { label:"Approved",       date:lead.approve_date,        color:"#16a34a" },
              { label:"Agreement Sent", date:lead.agreement_sent_date, color:"#0ea5e9" },
              { label:"Signed",         date:lead.sign_date,           color:"#16a34a" },
              { label:"Converted",      date:lead.convert_date,        color:"#2563eb" },
              { label:"Installed",      date:lead.install_date,        color:"#2563eb" },
              { label:"Removed",        date:lead.remove_date,         color:"#ef4444" },
            ].filter(t=>t.date).map(t=>(
              <div key={t.label} className="gc-timeline-item">
                <div className="gc-timeline-dot" style={{background:t.color}} />
                <div><span className="text-xs font-semibold text-text">{t.label}</span><span className="text-xs text-muted ml-2">{t.date}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow state history */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Workflow History</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-hover">
                <tr>
                  <th className="text-left px-3 py-2 text-muted font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">From</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">To</th>
                  <th className="text-left px-3 py-2 text-muted font-medium">Agent</th>
                  <th className="text-right px-3 py-2 text-muted font-medium">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h,i)=>(
                  <tr key={i} className="hover:bg-surface-hover">
                    <td className="px-3 py-2 text-muted">{h.change_date}</td>
                    <td className="px-3 py-2"><StatusBadge status={h.from_state} /></td>
                    <td className="px-3 py-2"><StatusBadge status={h.to_state} /></td>
                    <td className="px-3 py-2 text-text">{h.agent_name||h.changed_by||"—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{h.days_in_state!=null?`${h.days_in_state}d`:"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <button className="gc-btn gc-btn-primary" onClick={onEdit}>Edit</button>
        <button onClick={onDuplicate} className="gc-btn" style={{background:"#eff6ff",color:"#2563eb",border:"1px solid #93c5fd"}}>Duplicate for Companies</button>
        <button className="gc-btn gc-btn-ghost" onClick={onClose}>Close</button>
        <button onClick={onDelete} className="gc-btn ml-auto" style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5"}}>Delete</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────
const DEFAULT_FILTERS: Filters = {
  search: "", status: "", company: "", branch: "", stateCode: "", executive: "",
  dateField: "post_date", fromDate: "", toDate: "", isDuplicate: "", aiMin: "", aiMax: "",
};

export default function LeadsPage() {
  const { from, to } = thisMonthRange();
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, fromDate: from, toDate: to });
  const [page, setPage]       = useState(1);
  const [activeTab, setTab]   = useState("all");
  const PAGE_SIZE = 50;

  const [showCreate, setShowCreate]     = useState(false);
  const [editLead, setEditLead]         = useState<ATMLeadRow | null>(null);
  const [viewLeadName, setViewLeadName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dupLead, setDupLead]           = useState<ATMLeadRow | null>(null);

  const qc = useQueryClient();
  const { data: companiesList = [] } = useQuery({ queryKey: ["operator_companies"], queryFn: fetchOperatorCompanies });

  const mergeFilters = (f: Partial<Filters>) => { setFilters(p => ({ ...p, ...f })); setPage(1); };

  const qParams = {
    status:          filters.status   || undefined,
    company:         filters.company  || undefined,
    branch:          filters.branch   || undefined,
    executive_name:  filters.executive || undefined,
    state_code:      filters.stateCode || undefined,
    is_duplicate:    filters.isDuplicate !== "" ? Number(filters.isDuplicate) as 0|1 : undefined,
    ai_score_min:    filters.aiMin ? Number(filters.aiMin) : undefined,
    ai_score_max:    filters.aiMax ? Number(filters.aiMax) : undefined,
    date_field:      filters.dateField,
    from_date:       filters.fromDate || undefined,
    to_date:         filters.toDate   || undefined,
    search:          filters.search   || undefined,
    page, page_size: PAGE_SIZE,
  };

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["atm_leads", qParams],
    queryFn:  () => fetchATMLeads(qParams),
  });

  const stateCounts = leads.reduce<Record<string,number>>((acc,l) => {
    const s = getState(l); acc[s] = (acc[s]??0) + 1; return acc;
  }, {});

  // Tab filter
  const TAB_STATE_MAP: Record<string, string[]> = {
    all:           [],
    pending:       ["Pending"],
    approved:      ["Approved"],
    "agmt":        ["Requested for Agreement Sent","Agreement Sent","Pending Sign"],
    signed:        ["Signed"],
    installed:     ["Installed","Converted"],
    rejected:      ["Rejected","Not Qualified","Signed Rejected","Cancelled"],
    callback:      ["Call Back","Called","Interested","Not Interested"],
  };
  const tabLeads = activeTab === "all" ? leads
    : leads.filter(l => (TAB_STATE_MAP[activeTab] ?? []).includes(getState(l)));

  const createMut = useMutation({
    mutationFn: createATMLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atm_leads"] }); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<ATMLeadRow> }) => updateATMLead(name, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atm_leads"] }); qc.invalidateQueries({ queryKey: ["atm_lead_full"] }); setEditLead(null); setViewLeadName(null); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteATMLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atm_leads"] }); setDeleteTarget(null); setViewLeadName(null); },
  });

  const TABS = [
    { key: "all",       label: "All",          count: leads.length },
    { key: "pending",   label: "Pending",       count: stateCounts["Pending"] },
    { key: "approved",  label: "Approved",      count: stateCounts["Approved"] },
    { key: "agmt",      label: "Agmt Pipeline", count: (stateCounts["Requested for Agreement Sent"]??0)+(stateCounts["Agreement Sent"]??0)+(stateCounts["Pending Sign"]??0) },
    { key: "signed",    label: "Signed",        count: stateCounts["Signed"] },
    { key: "installed", label: "Installed",     count: (stateCounts["Installed"]??0)+(stateCounts["Converted"]??0) },
    { key: "rejected",  label: "Rejected",      count: (stateCounts["Rejected"]??0)+(stateCounts["Not Qualified"]??0)+(stateCounts["Signed Rejected"]??0)+(stateCounts["Cancelled"]??0) },
    { key: "callstack", label: "Call Stack",    count: (stateCounts["Call Back"]??0)+(stateCounts["Called"]??0)+(stateCounts["Interested"]??0)+(stateCounts["Not Interested"]??0) },
  ];

  // Workflow funnel stats (main pipeline only)
  const FUNNEL_STATS = [
    { label: "Total",      value: leads.length,                                   color: "#6366f1" },
    { label: "Pending",    value: stateCounts["Pending"]    ?? 0,                 color: "#f59e0b" },
    { label: "Approved",   value: stateCounts["Approved"]   ?? 0,                 color: "#16a34a" },
    { label: "Signed",     value: stateCounts["Signed"]     ?? 0,                 color: "#16a34a" },
    { label: "Installed",  value: (stateCounts["Installed"]??0)+(stateCounts["Converted"]??0), color: "#2563eb" },
    { label: "Rejected",   value: (stateCounts["Rejected"]??0)+(stateCounts["Not Qualified"]??0)+(stateCounts["Signed Rejected"]??0), color: "#ef4444" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Advanced Filters */}
      <AdvancedFilters
        filters={filters}
        onChange={mergeFilters}
        onRefresh={() => refetch()}
        onNewLead={() => setShowCreate(true)}
        companiesList={companiesList}
      />

      {/* KPI Funnel */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {FUNNEL_STATS.map(s => <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />)}
      </div>

      {/* State distribution pills (click to filter) */}
      <div className="flex flex-wrap gap-1.5">
        {WF_STATES.map(s => {
          const count = stateCounts[s] ?? 0;
          if (!count) return null;
          const c = STATE_COLOR[s] ?? "#6b7280";
          const active = filters.status === s;
          return (
            <button key={s} onClick={() => mergeFilters({ status: active ? "" : s })}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all"
              style={{ background: active ? c : `${c}22`, color: active ? "#fff" : c, border: `1px solid ${c}44` }}>
              {s} <span className="font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs + Table */}
      <Card>
        <div className="px-5 pt-4 pb-0 flex items-center justify-between flex-wrap gap-3">
          <div className="gc-tabs">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`gc-tab${activeTab === t.key ? " active" : ""}`}>
                {t.label}
                {(t.count ?? 0) > 0 && <span className={`gc-tab-count${activeTab === t.key ? " active" : ""}`}>{t.count}</span>}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">{tabLeads.length} records</span>
        </div>
        <div className="p-5">
          {isLoading ? <LoadingBlock /> : tabLeads.length === 0 ? <EmptyBlock msg="No leads found" /> : (
            <>
              <DataTable keyField="name" rows={tabLeads} cols={[
                { key: "business_name", label: "Business",
                  render: r => <button className="text-left font-semibold text-primary hover:underline" onClick={() => setViewLeadName(r.name)}>{r.business_name ?? "—"}</button> },
                { key: "workflow_state", label: "State",
                  render: r => <StatusBadge status={getState(r)} /> },
                { key: "owner_name",    label: "Owner" },
                { key: "executive_name",label: "Executive" },
                { key: "company",       label: "Company" },
                { key: "branch",        label: "Branch" },
                { key: "city",          label: "City" },
                { key: "state_code",    label: "State" },
                { key: "post_date",     label: "Posted" },
                { key: "ai_core",       label: "AI", align: "right" as const,
                  render: r => r.ai_core != null ? <span className="font-semibold text-xs text-indigo-600">{r.ai_core}</span> : <span className="text-muted">—</span> },
                { key: "actions", label: "", align: "right" as const,
                  render: r => (
                    <div className="flex items-center gap-1 justify-end">
                      <button className="gc-icon-btn" onClick={() => setEditLead(r)} title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button className="gc-icon-btn danger" onClick={() => setDeleteTarget(r.name)} title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  )},
              ]} />
              <Pagination page={page} pageSize={PAGE_SIZE} total={leads.length >= PAGE_SIZE ? page * PAGE_SIZE + 1 : (page - 1) * PAGE_SIZE + tabLeads.length} onChange={setPage} />
            </>
          )}
        </div>
      </Card>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New ATM Lead" size="xl">
        {createMut.isError && <div className="mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{String((createMut.error as Error).message)}</div>}
        <div className="p-4"><LeadForm initial={{ post_date: new Date().toISOString().slice(0,10), workflow_state: "Draft", status: "Draft" }} onSave={d => createMut.mutate(d)} onCancel={() => setShowCreate(false)} saving={createMut.isPending} /></div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editLead} onClose={() => setEditLead(null)} title={`Edit: ${editLead?.business_name ?? ""}`} size="xl">
        {updateMut.isError && <div className="mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{String((updateMut.error as Error).message)}</div>}
        {editLead && <div className="p-4"><LeadForm initial={editLead} onSave={d => updateMut.mutate({ name: editLead.name, data: d })} onCancel={() => setEditLead(null)} saving={updateMut.isPending} /></div>}
      </Modal>

      {/* Detail modal */}
      <Modal open={!!viewLeadName} onClose={() => setViewLeadName(null)} title="Lead Detail" size="lg">
        {viewLeadName && (
          <div className="p-4">
            <LeadDetail
              leadName={viewLeadName}
              onEdit={() => { const l = leads.find(x => x.name === viewLeadName); if (l) { setEditLead(l); setViewLeadName(null); } }}
              onDelete={() => { setDeleteTarget(viewLeadName); setViewLeadName(null); }}
              onDuplicate={() => { const l = leads.find(x => x.name === viewLeadName); if (l) { setDupLead(l); setViewLeadName(null); } }}
              onClose={() => setViewLeadName(null)}
            />
          </div>
        )}
      </Modal>

      {/* Duplicate for Companies */}
      {dupLead && <DuplicateCompaniesModal lead={dupLead} open={!!dupLead} onClose={() => setDupLead(null)} />}

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleteTarget} title="Delete Lead" message="Permanently delete this lead? This cannot be undone." confirmLabel="Delete" danger onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
