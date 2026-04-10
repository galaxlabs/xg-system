import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import {
  fetchATMLeads, fetchATMLeadFull, createATMLead, updateATMLead, deleteATMLead,
  checkLocationConflict, getCompanyAvailability, fetchOperatorCompanies,
  thisMonthRange,
  type DedupConflict, type CompanyAvailability, type StateHistoryRow,
} from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, Modal, FormField, FormGrid,
  Pagination, ConfirmDialog,
} from "../components/ui/index";
import type { ATMLeadRow } from "../lib/types";

// ── Constants ─────────────────────────────────────────────────────────────
const LEAD_STATUSES = [
  "Fresh","Qualifying","Prospecting","Agreed","Submitted","Approved",
  "Agreement Sent","Signed","Converted","Installed","Rejected","Cancelled",
];

const STATUS_COLORS: Record<string, string> = {
  Signed:           "#10b981",
  Installed:        "#22c55e",
  Converted:        "#0ea5e9",
  Approved:         "#0ea5e9",
  "Agreement Sent": "#f97316",
  Submitted:        "#f59e0b",
  Rejected:         "#ef4444",
  Cancelled:        "#9ca3af",
  Fresh:            "#94a3b8",
  Qualifying:       "#6366f1",
  Prospecting:      "#8b5cf6",
  Agreed:           "#a78bfa",
  Pending:          "#f59e0b",
  "Call Back":      "#8b5cf6",
  "Not Interested": "#ef4444",
  Interested:       "#10b981",
  "Pending Sign":   "#f59e0b",
};

// ─────────────────────────────────────────────────────────────────────────
// Phone normaliser (mirrors atm_leads.py _normalize_phone_value)
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
  const c = STATUS_COLORS[status ?? ""] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${c}22`, color: c }}
    >
      {status ?? "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Dedup Conflict Banner
// ─────────────────────────────────────────────────────────────────────────
function DedupBanner({ conflict, onDismiss }: { conflict: DedupConflict; onDismiss: () => void }) {
  const isPermanent = conflict.type === "permanent";
  const bg     = isPermanent ? "#fef2f2" : "#fffbeb";
  const border = isPermanent ? "#fca5a5" : "#fcd34d";
  const color  = isPermanent ? "#b91c1c" : "#92400e";
  const icon   = isPermanent ? "⛔" : "⚠️";
  const title  = isPermanent
    ? "Location Permanently Locked"
    : `Location Locked – ${conflict.window}-Day Window`;

  const pct = !isPermanent && conflict.remaining_days != null
    ? Math.min(100, Math.round(((conflict.window - conflict.remaining_days) / conflict.window) * 100))
    : 0;
  const barColor = !isPermanent
    ? (conflict.remaining_days ?? 0) <= 3 ? "#ef4444"
      : (conflict.remaining_days ?? 0) <= 7 ? "#f97316" : "#f59e0b"
    : "#ef4444";

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
        <div className="flex-1">
          <div style={{ fontWeight: 700, color, fontSize: 14 }}>{title}</div>
          <div className="mt-1 space-y-1 text-xs" style={{ color: "#4b5563" }}>
            <div>Existing lead: <strong>{conflict.lead}</strong></div>
            <div className="flex items-center gap-2">State: <StatusBadge status={conflict.state} /> &nbsp; Company: <strong>{conflict.company}</strong></div>
            {!isPermanent && conflict.age_days != null && (
              <div>Created <strong>{conflict.age_days}</strong> day(s) ago — <strong style={{ color: barColor }}>{conflict.remaining_days} day(s) remaining</strong></div>
            )}
          </div>
          {!isPermanent && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: `${barColor}22`, borderRadius: 999, height: 8, overflow: "hidden" }}>
                <div style={{ background: barColor, width: `${pct}%`, height: "100%", borderRadius: 999 }} />
              </div>
            </div>
          )}
          {isPermanent && (
            <p className="mt-2 text-xs" style={{ color: "#b91c1c" }}>
              Contact the lead owner to proceed with this location.
            </p>
          )}
        </div>
        <button onClick={onDismiss} className="text-xs text-muted hover:text-text flex-shrink-0">✕</button>
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
    queryFn: () => getCompanyAvailability({
      lead_name:      lead.name,
      full_address:   lead.full_address as string ?? "",
      address:        lead.address ?? "",
      zip_code:       lead.zip_code ?? "",
      latitude:       lead.latitude,
      longitude:      lead.longitude,
      source_company: lead.company ?? "",
    }),
    enabled: open,
  });

  const STATUS_CFG: Record<CompanyAvailability["status"], { icon: string; color: string; bg: string; border: string; label: string; selectable: boolean }> = {
    available: { icon: "✅", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", label: "Available",    selectable: true  },
    source:    { icon: "📌", color: "#2563eb", bg: "#eff6ff", border: "#93c5fd", label: "Current Lead", selectable: false },
    locked:    { icon: "⏱",  color: "#d97706", bg: "#fffbeb", border: "#fcd34d", label: "Locked",       selectable: false },
    committed: { icon: "🔒", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", label: "Committed",    selectable: false },
  };

  const filtered = companies.filter((c) => !search || c.operator_name.toLowerCase().includes(search.toLowerCase()));
  const available = filtered.filter((c) => c.status === "available");
  const toggle = (name: string) => setSelected((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const handleDuplicate = async () => {
    if (!selected.size) return;
    setDuping(true);
    const res: { name: string; ok: boolean; err?: string }[] = [];
    for (const coName of [...selected]) {
      try {
        const copy: Partial<ATMLeadRow> = { ...lead };
        delete copy.name;
        await createATMLead({ ...copy, company: coName, status: "Fresh" });
        res.push({ name: coName, ok: true });
      } catch (e) {
        res.push({ name: coName, ok: false, err: String(e) });
      }
    }
    setResults(res);
    setDuping(false);
    qc.invalidateQueries({ queryKey: ["atm_leads"] });
  };

  const handleClose = () => { setSelected(new Set()); setSearch(""); setResults(null); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Duplicate Lead for Companies" size="lg"
      footer={
        results ? (
          <button className="gc-btn gc-btn-primary" onClick={handleClose}>Close</button>
        ) : (
          <div className="flex gap-2 justify-end">
            <button className="gc-btn gc-btn-ghost" onClick={handleClose}>Cancel</button>
            <button className="gc-btn gc-btn-primary" onClick={handleDuplicate} disabled={!selected.size || duping}>
              {duping ? "Duplicating…" : `Duplicate${selected.size ? ` (${selected.size})` : ""} Selected`}
            </button>
          </div>
        )
      }
    >
      <div className="p-1">
        {results ? (
          <div className="space-y-2">
            <div className="rounded-lg p-3 text-sm font-semibold"
              style={{
                background: results.every((r) => r.ok) ? "#f0fdf4" : results.every((r) => !r.ok) ? "#fef2f2" : "#fffbeb",
                color:      results.every((r) => r.ok) ? "#16a34a" : results.every((r) => !r.ok) ? "#dc2626" : "#d97706",
              }}
            >
              {results.every((r) => r.ok) ? `✅ All ${results.length} lead(s) duplicated!`
                : results.every((r) => !r.ok) ? "❌ All duplications failed."
                : `⚠️ ${results.filter((r)=>r.ok).length} succeeded, ${results.filter((r)=>!r.ok).length} failed.`}
            </div>
            {results.map((r) => (
              <div key={r.name} className="flex items-center gap-2 py-2 border-b border-border text-sm">
                <span>{r.ok ? "✅" : "❌"}</span>
                <span className="font-medium flex-1 truncate">{r.name}</span>
                {!r.ok && <span className="text-red-600 text-xs">{r.err}</span>}
              </div>
            ))}
          </div>
        ) : isLoading ? <LoadingBlock /> : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex flex-wrap gap-2">
              {(["available","locked","committed","source"] as const).map((s) => {
                const cnt = companies.filter((c) => c.status === s).length;
                if (!cnt) return null;
                const cfg = STATUS_CFG[s];
                return <span key={s} className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cnt} {cfg.label}</span>;
              })}
            </div>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
              <input className="gc-input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies…" />
            </div>
            {/* Controls */}
            <div className="flex gap-3 text-xs">
              <button className="text-blue-600 font-semibold hover:underline" onClick={() => setSelected(new Set(available.map((c) => c.name)))}>Select All Available</button>
              <span className="text-border">|</span>
              <button className="text-muted hover:underline" onClick={() => setSelected(new Set())}>Clear All</button>
              <span className="ml-auto text-muted">{selected.size} selected</span>
            </div>
            {/* List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filtered.map((co) => {
                const cfg = STATUS_CFG[co.status];
                const isSel = selected.has(co.name);
                return (
                  <label key={co.name} className="flex items-start gap-3 rounded-xl p-3"
                    style={{ background: cfg.bg, border: `1px solid ${isSel ? cfg.color : cfg.border}`, opacity: cfg.selectable ? 1 : 0.65, cursor: cfg.selectable ? "pointer" : "default", boxShadow: isSel ? `0 0 0 2px ${cfg.color}44` : "none" }}
                  >
                    <input type="checkbox" disabled={!cfg.selectable} checked={isSel} onChange={() => toggle(co.name)} className="mt-0.5 w-4 h-4 flex-shrink-0" style={{ cursor: cfg.selectable ? "pointer" : "default" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{cfg.icon} {co.operator_name}</span>
                        <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: `${cfg.color}22`, color: cfg.color }}>{cfg.label}</span>
                      </div>
                      {co.status === "locked" && <div className="mt-1 text-xs" style={{ color: cfg.color }}>Locked — {co.remaining_days} day(s) remaining{co.lead ? ` · ${co.lead}` : ""}</div>}
                      {co.status === "committed" && co.lead && <div className="mt-1 text-xs" style={{ color: cfg.color }}>Committed: <span className="font-semibold">{co.lead}</span> <StatusBadge status={co.lead_state} /></div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lead Form (with dedup check + phone normalise + validation)
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

  const set = (k: keyof ATMLeadRow, v: unknown) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
    if (["address","zip_code","latitude","longitude"].includes(k as string)) {
      setDedupDismissed(false);
      setConflict(null);
    }
  };

  const onPhoneBlur = (k: "business_phone_number" | "personal_cell_phone") => {
    const val = form[k] as string | undefined;
    if (val) set(k, normalizePhone(val));
  };

  const runDedupCheck = useCallback(async (f: Partial<ATMLeadRow>) => {
    if (!f.address && !f.zip_code && !f.latitude && !f.longitude) return;
    setChecking(true);
    try {
      const result = await checkLocationConflict({
        address:   f.address,
        zip_code:  f.zip_code,
        latitude:  f.latitude as number,
        longitude: f.longitude as number,
        company:   f.company,
        lead_name: f.name ?? "__new__",
      });
      setConflict(result ?? null);
    } catch { /* silently ignore dedup errors */ }
    finally { setChecking(false); }
  }, []);

  const onLocationBlur = () => { if (!dedupDismissed) runDedupCheck(form); };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.company)      errs.company      = "Company is required";
    if (!form.address)      errs.address      = "Address is required";
    if (!form.business_name) errs.business_name = "Business name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      ...form,
      business_phone_number: normalizePhone(form.business_phone_number as string ?? ""),
      personal_cell_phone:   normalizePhone(form.personal_cell_phone   as string ?? ""),
    };
    onSave(data);
  };

  const { data: companies = [] } = useQuery({ queryKey: ["operator_companies"], queryFn: fetchOperatorCompanies });

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {conflict && !dedupDismissed && <DedupBanner conflict={conflict} onDismiss={() => setDedupDismissed(true)} />}
      {checking && <div className="text-xs text-muted px-1 animate-pulse">Checking location availability…</div>}

      {/* Business Info */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Business Info</p>
        <FormGrid cols={2}>
          <FormField label="Business Name" required>
            <input className={`gc-input${errors.business_name ? " border-red-500" : ""}`} value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} />
            {errors.business_name && <span className="text-red-500 text-xs">{errors.business_name}</span>}
          </FormField>
          <FormField label="Owner Name">
            <input className="gc-input" value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} />
          </FormField>
          <FormField label="Business Type">
            <input className="gc-input" value={form.business_type ?? ""} onChange={(e) => set("business_type", e.target.value)} />
          </FormField>
          <FormField label="Status">
            <select className="gc-input" value={form.status ?? ""} onChange={(e) => set("status", e.target.value)}>
              <option value="">Select status</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
        </FormGrid>
      </div>

      {/* Contact */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contact</p>
        <FormGrid cols={2}>
          <FormField label="Email">
            <input type="email" className="gc-input" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </FormField>
          <FormField label="Business Phone">
            <input className="gc-input" value={form.business_phone_number ?? ""} onChange={(e) => set("business_phone_number", e.target.value)} onBlur={() => onPhoneBlur("business_phone_number")} placeholder="5558675309 → 555-867-5309" />
          </FormField>
          <FormField label="Personal Cell">
            <input className="gc-input" value={form.personal_cell_phone ?? ""} onChange={(e) => set("personal_cell_phone", e.target.value)} onBlur={() => onPhoneBlur("personal_cell_phone")} placeholder="5558675309 → 555-867-5309" />
          </FormField>
          <FormField label="Lead Owner">
            <input className="gc-input" value={form.lead_owner ?? ""} onChange={(e) => set("lead_owner", e.target.value)} />
          </FormField>
        </FormGrid>
      </div>

      {/* Location */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Location</p>
        <FormGrid cols={2}>
          <FormField label="Address" required>
            <input className={`gc-input${errors.address ? " border-red-500" : ""}`} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} onBlur={onLocationBlur} />
            {errors.address && <span className="text-red-500 text-xs">{errors.address}</span>}
          </FormField>
          <FormField label="City">
            <input className="gc-input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </FormField>
          <FormField label="State">
            <input className="gc-input" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
          </FormField>
          <FormField label="State Code">
            <input className="gc-input" value={form.state_code ?? ""} onChange={(e) => set("state_code", e.target.value.toUpperCase())} maxLength={2} placeholder="TX" />
          </FormField>
          <FormField label="Zip Code">
            <input className="gc-input" value={form.zip_code ?? ""} onChange={(e) => set("zip_code", e.target.value)} onBlur={onLocationBlur} />
          </FormField>
          <FormField label="Full Address">
            <input className="gc-input" value={form.full_address as string ?? ""} onChange={(e) => set("full_address", e.target.value)} />
          </FormField>
          <FormField label="Latitude">
            <input type="number" step="0.000001" className="gc-input" value={form.latitude ?? ""} onChange={(e) => set("latitude", e.target.value)} onBlur={onLocationBlur} />
          </FormField>
          <FormField label="Longitude">
            <input type="number" step="0.000001" className="gc-input" value={form.longitude ?? ""} onChange={(e) => set("longitude", e.target.value)} onBlur={onLocationBlur} />
          </FormField>
        </FormGrid>
      </div>

      {/* Deal */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Deal Info</p>
        <FormGrid cols={2}>
          <FormField label="Company" required>
            <select className={`gc-input${errors.company ? " border-red-500" : ""}`} value={form.company ?? ""} onChange={(e) => set("company", e.target.value)}>
              <option value="">Select company</option>
              {companies.map((c) => <option key={c.name} value={c.name}>{c.operator_name}</option>)}
            </select>
            {errors.company && <span className="text-red-500 text-xs">{errors.company}</span>}
          </FormField>
          <FormField label="Branch">
            <input className="gc-input" value={form.branch ?? ""} onChange={(e) => set("branch", e.target.value)} />
          </FormField>
          <FormField label="Executive">
            <input className="gc-input" value={form.executive_name ?? ""} onChange={(e) => set("executive_name", e.target.value)} />
          </FormField>
          <FormField label="Contract Length">
            <input className="gc-input" value={form.contract_length ?? ""} onChange={(e) => set("contract_length", e.target.value)} />
          </FormField>
          <FormField label="Base Rent ($)">
            <input className="gc-input" type="number" step="0.01" value={form.base_rent ?? ""} onChange={(e) => set("base_rent", e.target.value)} />
          </FormField>
          <FormField label="Percentage (%)">
            <input className="gc-input" type="number" step="0.01" value={form.percentage ?? ""} onChange={(e) => set("percentage", e.target.value)} />
          </FormField>
          <FormField label="Hours">
            <input className="gc-input" value={form.hours ?? ""} onChange={(e) => set("hours", e.target.value)} placeholder="e.g. 24/7" />
          </FormField>
        </FormGrid>
      </div>

      {/* Dates */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Key Dates</p>
        <FormGrid cols={3}>
          <FormField label="Post Date">
            <input type="date" className="gc-input" value={form.post_date ?? ""} onChange={(e) => set("post_date", e.target.value)} />
          </FormField>
          <FormField label="Approve Date">
            <input type="date" className="gc-input" value={form.approve_date ?? ""} onChange={(e) => set("approve_date", e.target.value)} />
          </FormField>
          <FormField label="Agreement Sent">
            <input type="date" className="gc-input" value={form.agreement_sent_date ?? ""} onChange={(e) => set("agreement_sent_date", e.target.value)} />
          </FormField>
          <FormField label="Sign Date">
            <input type="date" className="gc-input" value={form.sign_date ?? ""} onChange={(e) => set("sign_date", e.target.value)} />
          </FormField>
          <FormField label="Convert Date">
            <input type="date" className="gc-input" value={form.convert_date ?? ""} onChange={(e) => set("convert_date", e.target.value)} />
          </FormField>
          <FormField label="Install Date">
            <input type="date" className="gc-input" value={form.install_date ?? ""} onChange={(e) => set("install_date", e.target.value)} />
          </FormField>
          <FormField label="Remove Date">
            <input type="date" className="gc-input" value={form.remove_date ?? ""} onChange={(e) => set("remove_date", e.target.value)} />
          </FormField>
        </FormGrid>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <button type="button" className="gc-btn gc-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="gc-btn gc-btn-primary" disabled={saving}>
          {saving ? "Saving…" : form.name ? "Update Lead" : "Create Lead"}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lead Detail (full view + workflow history)
// ─────────────────────────────────────────────────────────────────────────
function LeadDetail({ leadName, onEdit, onDelete, onDuplicate, onClose }: {
  leadName: string;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ["atm_lead_full", leadName],
    queryFn:  () => fetchATMLeadFull(leadName),
  });

  if (isLoading) return <LoadingBlock />;
  if (!lead) return <EmptyBlock msg="Lead not found" />;

  const statusColor = STATUS_COLORS[lead.status ?? ""] ?? "#6b7280";
  const field = (label: string, val: unknown) => val != null && val !== "" ? (
    <div key={label}>
      <dt className="text-xs text-muted uppercase tracking-wider">{label}</dt>
      <dd className="text-sm font-medium text-text mt-0.5">{String(val)}</dd>
    </div>
  ) : null;

  const history: StateHistoryRow[] = (lead.state_history as StateHistoryRow[] | undefined) ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-text">{lead.business_name}</h4>
          <p className="text-xs text-muted mt-0.5 font-mono">{lead.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${statusColor}22`, color: statusColor }}>
            {lead.status ?? "Draft"}
          </span>
          {lead.is_duplicate ? <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-red-100 text-red-700">Duplicate</span> : null}
        </div>
      </div>

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
        {lead.ai_core != null ? field("AI Score", `${lead.ai_core}/10`) : null}
      </dl>

      {/* Key dates timeline */}
      {[lead.post_date, lead.approve_date, lead.sign_date, lead.install_date].some(Boolean) && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Key Dates</p>
          <div className="gc-timeline">
            {[
              { label: "Posted",         date: lead.post_date,           color: "#6366f1" },
              { label: "Approved",       date: lead.approve_date,        color: "#0ea5e9" },
              { label: "Agreement Sent", date: lead.agreement_sent_date, color: "#f97316" },
              { label: "Signed",         date: lead.sign_date,           color: "#10b981" },
              { label: "Converted",      date: lead.convert_date,        color: "#22c55e" },
              { label: "Installed",      date: lead.install_date,        color: "#16a34a" },
              { label: "Removed",        date: lead.remove_date,         color: "#ef4444" },
            ].filter((t) => t.date).map((t) => (
              <div key={t.label} className="gc-timeline-item">
                <div className="gc-timeline-dot" style={{ background: t.color }} />
                <div>
                  <span className="text-xs font-semibold text-text">{t.label}</span>
                  <span className="text-xs text-muted ml-2">{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow state history (child table) */}
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
                  <th className="text-right px-3 py-2 text-muted font-medium">Days in State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-surface-hover">
                    <td className="px-3 py-2 text-muted">{h.change_date}</td>
                    <td className="px-3 py-2"><StatusBadge status={h.from_state} /></td>
                    <td className="px-3 py-2"><StatusBadge status={h.to_state} /></td>
                    <td className="px-3 py-2 text-text">{h.agent_name || h.changed_by || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{h.days_in_state != null ? `${h.days_in_state}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <button className="gc-btn gc-btn-primary" onClick={onEdit}>Edit</button>
        <button onClick={onDuplicate} className="gc-btn" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #93c5fd" }}>
          Duplicate for Companies
        </button>
        <button className="gc-btn gc-btn-ghost" onClick={onClose}>Close</button>
        <button onClick={onDelete} className="gc-btn ml-auto" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom]             = useState(from);
  const [toDate, setTo]                 = useState(to);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompany]     = useState("");
  const [page, setPage]                 = useState(1);
  const [activeTab, setTab]             = useState("all");
  const PAGE_SIZE = 50;

  const [showCreate, setShowCreate]     = useState(false);
  const [editLead, setEditLead]         = useState<ATMLeadRow | null>(null);
  const [viewLeadName, setViewLeadName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dupLead, setDupLead]           = useState<ATMLeadRow | null>(null);

  const qc = useQueryClient();

  const params = { status: statusFilter || undefined, company: companyFilter || undefined, from_date: fromDate, to_date: toDate, search: search || undefined, page, page_size: PAGE_SIZE };

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["atm_leads", params],
    queryFn: () => fetchATMLeads(params),
  });

  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => { const s = l.status ?? "Unknown"; acc[s] = (acc[s] ?? 0) + 1; return acc; }, {});

  const tabLeads = activeTab === "all" ? leads
    : leads.filter((l) => l.status?.toLowerCase() === activeTab.replace(" ", " "));

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

  useEffect(() => { setPage(1); }, [search, statusFilter, companyFilter, fromDate, toDate]);

  const TABS = [
    { key: "all",            label: "All",         count: leads.length },
    { key: "fresh",          label: "Fresh",       count: statusCounts["Fresh"] },
    { key: "approved",       label: "Approved",    count: statusCounts["Approved"] },
    { key: "agreement sent", label: "Agmt Sent",   count: statusCounts["Agreement Sent"] },
    { key: "signed",         label: "Signed",      count: statusCounts["Signed"] },
    { key: "installed",      label: "Installed",   count: statusCounts["Installed"] },
    { key: "rejected",       label: "Rejected",    count: statusCounts["Rejected"] },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <FilterRow onRefresh={refetch}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <input className="gc-input w-52" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Business name…" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Status</span>
          <select className="gc-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input className="gc-input w-36" value={companyFilter} onChange={(e) => setCompany(e.target.value)} placeholder="All" />
        </label>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <button className="gc-btn gc-btn-primary self-end" onClick={() => setShowCreate(true)}>+ New Lead</button>
      </FilterRow>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Leads"   value={leads.length}                    color="#6366f1" />
        <StatCard label="Signed"        value={statusCounts["Signed"]    ?? 0}  color="#10b981" />
        <StatCard label="Installed"     value={statusCounts["Installed"] ?? 0}  color="#22c55e" />
        <StatCard label="Rejected"      value={statusCounts["Rejected"]  ?? 0}  color="#ef4444" />
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {LEAD_STATUSES.map((s) => {
          const count = statusCounts[s] ?? 0;
          if (!count) return null;
          const c = STATUS_COLORS[s] ?? "#6b7280";
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(active ? "" : s)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={{ background: active ? c : `${c}22`, color: active ? "#fff" : c }}
            >
              {s} <span className="font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Tabs + Table */}
      <Card>
        <div className="px-5 pt-4 pb-0 flex items-center justify-between flex-wrap gap-3">
          <div className="gc-tabs">
            {TABS.map((t) => (
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
                  render: (r) => <button className="text-left font-semibold text-primary hover:underline" onClick={() => setViewLeadName(r.name)}>{r.business_name ?? "—"}</button> },
                { key: "status",        label: "Status",  render: (r) => <StatusBadge status={r.status} /> },
                { key: "owner_name",    label: "Owner" },
                { key: "executive_name",label: "Executive" },
                { key: "company",       label: "Company" },
                { key: "branch",        label: "Branch" },
                { key: "city",          label: "City" },
                { key: "state_code",    label: "State" },
                { key: "post_date",     label: "Posted" },
                { key: "ai_core",       label: "AI", align: "right" as const,
                  render: (r) => r.ai_core != null ? <span className="font-semibold text-xs text-indigo-600">{r.ai_core}</span> : <span className="text-muted">—</span> },
                { key: "actions",       label: "", align: "right" as const,
                  render: (r) => (
                    <div className="flex items-center gap-1 justify-end">
                      <button className="gc-icon-btn" onClick={() => setEditLead(r)} title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button className="gc-icon-btn danger" onClick={() => setDeleteTarget(r.name)} title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ) },
              ]} />
              <Pagination page={page} pageSize={PAGE_SIZE} total={leads.length >= PAGE_SIZE ? page * PAGE_SIZE + 1 : (page - 1) * PAGE_SIZE + tabLeads.length} onChange={setPage} />
            </>
          )}
        </div>
      </Card>

      {/* Create */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New ATM Lead" size="xl">
        {createMut.isError && <div className="mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{String((createMut.error as Error).message)}</div>}
        <div className="p-4"><LeadForm initial={{ post_date: new Date().toISOString().slice(0, 10) }} onSave={(d) => createMut.mutate(d)} onCancel={() => setShowCreate(false)} saving={createMut.isPending} /></div>
      </Modal>

      {/* Edit */}
      <Modal open={!!editLead} onClose={() => setEditLead(null)} title={`Edit: ${editLead?.business_name ?? ""}`} size="xl">
        {updateMut.isError && <div className="mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{String((updateMut.error as Error).message)}</div>}
        {editLead && <div className="p-4"><LeadForm initial={editLead} onSave={(d) => updateMut.mutate({ name: editLead.name, data: d })} onCancel={() => setEditLead(null)} saving={updateMut.isPending} /></div>}
      </Modal>

      {/* Detail */}
      <Modal open={!!viewLeadName} onClose={() => setViewLeadName(null)} title="Lead Detail" size="lg">
        {viewLeadName && (
          <div className="p-4">
            <LeadDetail
              leadName={viewLeadName}
              onEdit={() => { const l = leads.find((x) => x.name === viewLeadName); if (l) { setEditLead(l); setViewLeadName(null); } }}
              onDelete={() => { setDeleteTarget(viewLeadName); setViewLeadName(null); }}
              onDuplicate={() => { const l = leads.find((x) => x.name === viewLeadName); if (l) { setDupLead(l); setViewLeadName(null); } }}
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
