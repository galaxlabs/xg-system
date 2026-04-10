import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  fetchATMLeads, fetchATMLead, createATMLead, updateATMLead, deleteATMLead,
  thisMonthRange,
} from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, Badge, Modal, FormField, FormGrid,
  StatusPill, Pagination, ConfirmDialog, Button, Tabs,
} from "../components/ui/index";
import type { ATMLeadRow } from "../lib/types";

const LEAD_STATUSES = [
  "Fresh","Qualifying","Prospecting","Agreed","Submitted","Approved",
  "Agreement Sent","Signed","Converted","Installed","Rejected","Cancelled",
];

const STATUS_COLORS: Record<string, string> = {
  Signed: "#10b981", Installed: "#22c55e", Converted: "#0ea5e9",
  Approved: "#0ea5e9", "Agreement Sent": "#f97316",
  Submitted: "#f59e0b", Rejected: "#ef4444", Cancelled: "#9ca3af",
  Fresh: "#94a3b8", Qualifying: "#6366f1", Prospecting: "#8b5cf6",
  Agreed: "#a78bfa",
};

// ── Lead Form ─────────────────────────────────────────────────────────────
function LeadForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<ATMLeadRow>;
  onSave: (data: Partial<ATMLeadRow>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<ATMLeadRow>>(initial);
  const set = (k: keyof ATMLeadRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="space-y-5"
    >
      {/* Business Info */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Business Info</p>
        <FormGrid cols={2}>
          <FormField label="Business Name" required>
            <input className="gc-input" value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} required />
          </FormField>
          <FormField label="Owner Name">
            <input className="gc-input" value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} />
          </FormField>
          <FormField label="Business Type">
            <input className="gc-input" value={form.business_type ?? ""} onChange={(e) => set("business_type", e.target.value)} />
          </FormField>
          <FormField label="Status">
            <select className="gc-select" value={form.status ?? ""} onChange={(e) => set("status", e.target.value)}>
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
            <input className="gc-input" value={form.business_phone_number ?? ""} onChange={(e) => set("business_phone_number", e.target.value)} />
          </FormField>
          <FormField label="Personal Cell">
            <input className="gc-input" value={form.personal_cell_phone ?? ""} onChange={(e) => set("personal_cell_phone", e.target.value)} />
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
          <FormField label="Address">
            <input className="gc-input" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </FormField>
          <FormField label="City">
            <input className="gc-input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </FormField>
          <FormField label="State / Province">
            <input className="gc-input" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
          </FormField>
          <FormField label="State Code">
            <input className="gc-input" value={form.state_code ?? ""} onChange={(e) => set("state_code", e.target.value)} />
          </FormField>
          <FormField label="Zip Code">
            <input className="gc-input" value={form.zip_code ?? ""} onChange={(e) => set("zip_code", e.target.value)} />
          </FormField>
          <FormField label="Country">
            <input className="gc-input" value={form.country as string ?? ""} onChange={(e) => set("country", e.target.value)} />
          </FormField>
        </FormGrid>
      </div>

      {/* Deal */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Deal Info</p>
        <FormGrid cols={2}>
          <FormField label="Company">
            <input className="gc-input" value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />
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
          <FormField label="Base Rent">
            <input className="gc-input" value={form.base_rent ?? ""} onChange={(e) => set("base_rent", e.target.value)} />
          </FormField>
          <FormField label="Percentage">
            <input className="gc-input" value={form.percentage ?? ""} onChange={(e) => set("percentage", e.target.value)} />
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
        </FormGrid>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" className="gc-btn-outline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="gc-btn-primary" disabled={saving}>
          {saving ? "Saving…" : form.name ? "Update Lead" : "Create Lead"}
        </button>
      </div>
    </form>
  );
}

// ── Lead Detail Drawer (read-only + edit trigger) ─────────────────────────
function LeadDetail({
  lead,
  onEdit,
  onDelete,
  onClose,
}: {
  lead: ATMLeadRow;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const statusColor = STATUS_COLORS[lead.status ?? ""] ?? "#6b7280";

  const field = (label: string, val: unknown) =>
    val ? (
      <div key={label}>
        <dt className="text-xs text-muted uppercase tracking-wider">{label}</dt>
        <dd className="text-sm font-medium text-text mt-0.5">{String(val)}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-text">{lead.business_name}</h4>
          <p className="text-xs text-muted mt-0.5">{lead.name}</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `${statusColor}22`, color: statusColor }}
        >
          {lead.status ?? "—"}
        </span>
      </div>

      {/* Details grid */}
      <dl className="grid grid-cols-2 gap-4">
        {field("Owner", lead.owner_name)}
        {field("Business Type", lead.business_type)}
        {field("Email", lead.email)}
        {field("Business Phone", lead.business_phone_number)}
        {field("Personal Cell", lead.personal_cell_phone)}
        {field("Lead Owner", lead.lead_owner)}
        {field("Company", lead.company)}
        {field("Branch", lead.branch)}
        {field("Executive", lead.executive_name)}
        {field("State", lead.state)}
        {field("City", lead.city)}
        {field("Zip", lead.zip_code)}
        {field("Address", lead.address)}
        {field("Contract Length", lead.contract_length)}
        {field("Base Rent", lead.base_rent)}
        {field("Percentage", lead.percentage)}
        {lead.ai_core != null ? field("AI Score", `${lead.ai_core}/10`) : null}
      </dl>

      {/* Timeline */}
      {(lead.post_date || lead.approve_date || lead.sign_date || lead.install_date) && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Timeline</p>
          <div className="gc-timeline">
            {[
              { label: "Posted",         date: lead.post_date },
              { label: "Approved",       date: lead.approve_date },
              { label: "Agreement Sent", date: lead.agreement_sent_date },
              { label: "Signed",         date: lead.sign_date },
              { label: "Converted",      date: lead.convert_date },
              { label: "Installed",      date: lead.install_date },
              { label: "Removed",        date: lead.remove_date },
            ].filter((t) => t.date).map((t) => (
              <div key={t.label} className="gc-timeline-item">
                <div className="gc-timeline-dot" />
                <div>
                  <span className="text-xs font-semibold text-text">{t.label}</span>
                  <span className="text-xs text-muted ml-2">{t.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <button className="gc-btn-primary flex-1" onClick={onEdit}>Edit Lead</button>
        <button className="gc-btn-danger" onClick={onDelete}>Delete</button>
        <button className="gc-btn-outline" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(from);
  const [toDate, setTo]     = useState(to);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompany]     = useState("");
  const [page, setPage]     = useState(1);
  const PAGE_SIZE = 50;

  const [activeTab, setTab] = useState("all");

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead]     = useState<ATMLeadRow | null>(null);
  const [viewLead, setViewLead]     = useState<ATMLeadRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const qc = useQueryClient();

  // ── Queries ──
  const params = {
    status:         statusFilter || undefined,
    company:        companyFilter || undefined,
    from_date:      fromDate,
    to_date:        toDate,
    search:         search || undefined,
    page,
    page_size:      PAGE_SIZE,
  };

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["atm_leads", params],
    queryFn: () => fetchATMLeads(params),
  });

  // KPI counts by status
  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    const s = l.status ?? "Unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const totalSigned    = statusCounts["Signed"]    ?? 0;
  const totalInstalled = statusCounts["Installed"] ?? 0;
  const totalRejected  = statusCounts["Rejected"]  ?? 0;
  const totalApproved  = statusCounts["Approved"]  ?? 0;

  // Filtered by tab
  const tabLeads = activeTab === "all"
    ? leads
    : leads.filter((l) => l.status?.toLowerCase() === activeTab);

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: createATMLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atm_leads"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ name, data }: { name: string; data: Partial<ATMLeadRow> }) =>
      updateATMLead(name, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atm_leads"] }); setEditLead(null); setViewLead(null); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteATMLead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["atm_leads"] }); setDeleteTarget(null); setViewLead(null); },
  });

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, companyFilter, fromDate, toDate]);

  const TABS = [
    { key: "all",      label: "All",       count: leads.length },
    { key: "fresh",    label: "Fresh",     count: statusCounts["Fresh"] },
    { key: "approved", label: "Approved",  count: totalApproved },
    { key: "signed",   label: "Signed",    count: totalSigned },
    { key: "rejected", label: "Rejected",  count: totalRejected },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Filter bar */}
      <FilterRow onRefresh={refetch}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <input
            className="gc-input w-52"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Business name…"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Status</span>
          <select className="gc-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
        <button
          className="gc-btn-primary self-end"
          onClick={() => setShowCreate(true)}
        >
          + New Lead
        </button>
      </FilterRow>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Leads"   value={leads.length}   color="#6366f1" />
        <StatCard label="Signed"        value={totalSigned}    color="#10b981" />
        <StatCard label="Installed"     value={totalInstalled} color="#22c55e" />
        <StatCard label="Rejected"      value={totalRejected}  color="#ef4444" />
      </div>

      {/* Status summary pills */}
      <div className="flex flex-wrap gap-2">
        {LEAD_STATUSES.map((s) => {
          const count = statusCounts[s] ?? 0;
          if (!count) return null;
          const color = STATUS_COLORS[s] ?? "#6b7280";
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
              style={{
                background: statusFilter === s ? color : `${color}22`,
                color: statusFilter === s ? "#fff" : color,
              }}
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
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`gc-tab ${activeTab === t.key ? "active" : ""}`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`gc-tab-count ${activeTab === t.key ? "active" : ""}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">{tabLeads.length} records</span>
        </div>

        <div className="p-5">
          {isLoading ? <LoadingBlock /> : tabLeads.length === 0 ? <EmptyBlock msg="No leads found for these filters" /> : (
            <>
              <DataTable
                keyField="name"
                rows={tabLeads}
                cols={[
                  {
                    key: "business_name",
                    label: "Business",
                    render: (r) => (
                      <button
                        className="text-left font-semibold text-primary hover:underline"
                        onClick={() => setViewLead(r)}
                      >
                        {r.business_name ?? "—"}
                      </button>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => {
                      const c = STATUS_COLORS[r.status ?? ""] ?? "#6b7280";
                      return (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: `${c}22`, color: c }}
                        >
                          {r.status ?? "—"}
                        </span>
                      );
                    },
                  },
                  { key: "owner_name",             label: "Owner" },
                  { key: "executive_name",          label: "Executive" },
                  { key: "company",                 label: "Company" },
                  { key: "branch",                  label: "Branch" },
                  { key: "city",                    label: "City" },
                  { key: "state_code",              label: "State" },
                  { key: "post_date",               label: "Posted" },
                  {
                    key: "ai_core",
                    label: "AI",
                    align: "right",
                    render: (r) => r.ai_core != null
                      ? <span className="font-semibold text-xs text-indigo-600">{r.ai_core}</span>
                      : <span className="text-muted">—</span>,
                  },
                  {
                    key: "actions",
                    label: "",
                    align: "right",
                    render: (r) => (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          className="gc-icon-btn"
                          onClick={() => setEditLead(r)}
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="gc-icon-btn danger"
                          onClick={() => setDeleteTarget(r.name)}
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={leads.length >= PAGE_SIZE ? page * PAGE_SIZE + 1 : (page - 1) * PAGE_SIZE + tabLeads.length}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </Card>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New ATM Lead"
        size="xl"
      >
        <LeadForm
          initial={{ post_date: new Date().toISOString().slice(0, 10) }}
          onSave={(data) => createMut.mutate(data)}
          onCancel={() => setShowCreate(false)}
          saving={createMut.isPending}
        />
        {createMut.isError && (
          <p className="text-red-600 text-xs mt-2">{String((createMut.error as Error).message)}</p>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editLead}
        onClose={() => setEditLead(null)}
        title={`Edit: ${editLead?.business_name ?? ""}`}
        size="xl"
      >
        {editLead && (
          <LeadForm
            initial={editLead}
            onSave={(data) => updateMut.mutate({ name: editLead.name, data })}
            onCancel={() => setEditLead(null)}
            saving={updateMut.isPending}
          />
        )}
        {updateMut.isError && (
          <p className="text-red-600 text-xs mt-2">{String((updateMut.error as Error).message)}</p>
        )}
      </Modal>

      {/* View detail modal */}
      <Modal
        open={!!viewLead}
        onClose={() => setViewLead(null)}
        title="Lead Detail"
        size="lg"
      >
        {viewLead && (
          <LeadDetail
            lead={viewLead}
            onEdit={() => { setEditLead(viewLead); setViewLead(null); }}
            onDelete={() => setDeleteTarget(viewLead.name)}
            onClose={() => setViewLead(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Lead"
        message={`Are you sure you want to permanently delete this lead? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
