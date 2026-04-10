import { type ReactNode, useEffect, useRef } from "react";
import clsx from "clsx";

// ── Card ──────────────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
}
export function Card({ children, className }: CardProps) {
  return (
    <div className={clsx("gc-card animate-fade-in", className)}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="gc-card-header">
      <div>
        <h3 className="gc-card-title">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: ReactNode;
  trend?: { value: number; up: boolean };
}
export function StatCard({ label, value, sub, color = "#6366f1", trend }: StatCardProps) {
  return (
    <div
      className="gc-stat group hover:shadow-soft transition-all duration-200"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between">
        <div className="gc-stat-label">{label}</div>
        {trend && (
          <span
            className={clsx(
              "text-xs font-semibold rounded-full px-2 py-0.5",
              trend.up
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {trend.up ? "+" : "−"}{Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="gc-stat-value">{value}</div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "hsl(var(--muted))" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────
const badgeVariants: Record<string, string> = {
  green:  "gc-badge-green",
  red:    "gc-badge-red",
  yellow: "gc-badge-yellow",
  blue:   "gc-badge-blue",
  sky:    "gc-badge-sky",
  gray:   "gc-badge-gray",
};

export function Badge({
  children,
  variant = "gray",
}: {
  children: ReactNode;
  variant?: keyof typeof badgeVariants;
}) {
  return <span className={badgeVariants[variant] ?? "gc-badge-gray"}>{children}</span>;
}

// ── Button ────────────────────────────────────────────────────────────────
export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const base = {
    primary: "gc-btn-primary",
    ghost:   "gc-btn-ghost",
    outline: "gc-btn-outline",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(base, size === "sm" && "py-1.5 px-3 text-xs", disabled && "opacity-50 cursor-not-allowed", className)}
    >
      {children}
    </button>
  );
}

// ── Select ────────────────────────────────────────────────────────────────
export function Select({
  value,
  onChange,
  options,
  placeholder = "All",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx("gc-select", className)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Date input ────────────────────────────────────────────────────────────
export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="gc-input"
      />
    </label>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" }[size];
  return (
    <div
      className={clsx(sz, "animate-spin rounded-full border-2 border-border border-t-primary")}
    />
  );
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <Spinner size="md" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export function EmptyBlock({ msg = "No data available" }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted">
      <span className="text-3xl opacity-30">◎</span>
      <span className="text-sm">{msg}</span>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  max,
  color = "#6366f1",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="gc-progress flex-1">
      <div
        className="gc-progress-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ── Data Table ────────────────────────────────────────────────────────────
interface ColDef<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  cols,
  rows,
  keyField,
}: {
  cols: ColDef<T>[];
  rows: T[];
  keyField?: keyof T;
}) {
  return (
    <div className="overflow-auto -mx-0">
      <table className="gc-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={String(c.key)}
                style={{ textAlign: c.align ?? "left", width: c.width }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyField ? String(row[keyField as string]) : i}>
              {cols.map((c) => (
                <td
                  key={String(c.key)}
                  style={{ textAlign: c.align ?? "left" }}
                >
                  {c.render
                    ? c.render(row)
                    : String(row[c.key as string] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={cols.length}
                className="py-8 text-center text-muted text-sm"
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
export function SectionTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-text">{children}</h2>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Filter Row ────────────────────────────────────────────────────────────
export function FilterRow({ children, onRefresh }: { children: ReactNode; onRefresh?: () => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl border border-border/60 bg-surface">
      {children}
      {onRefresh && (
        <button onClick={onRefresh} className="gc-btn-primary self-end">
          ↻ Refresh
        </button>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div
      ref={overlayRef}
      className="gc-modal-overlay"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`gc-modal-panel ${widths[size]}`}>
        {/* Header */}
        <div className="gc-modal-header">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[hsl(var(--border))] transition-colors"
          >
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="gc-modal-body">{children}</div>
        {/* Footer */}
        {footer && <div className="gc-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Form Field ────────────────────────────────────────────────────────────
export function FormField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

// ── FormGrid ──────────────────────────────────────────────────────────────
export function FormGrid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: ReactNode }) {
  const gridCls = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }[cols];
  return <div className={`grid ${gridCls} gap-4`}>{children}</div>;
}

// ── Tabs ──────────────────────────────────────────────────────────────────
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="gc-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`gc-tab ${active === t.key ? "active" : ""}`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`gc-tab-count ${active === t.key ? "active" : ""}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── KPI Card (colored gradient variant) ──────────────────────────────────
export function KpiCard({
  label,
  value,
  sub,
  icon,
  gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  gradient?: string;
}) {
  return (
    <div
      className="gc-kpi-card"
      style={gradient ? { background: gradient } : undefined}
    >
      {icon && <div className="gc-kpi-icon">{icon}</div>}
      <div className="gc-kpi-value">{value}</div>
      <div className="gc-kpi-label">{label}</div>
      {sub && <div className="gc-kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  // Lead statuses
  Fresh:              "gc-badge-gray",
  Qualifying:         "gc-badge-sky",
  Prospecting:        "gc-badge-blue",
  Agreed:             "gc-badge-purple",
  Approved:           "gc-badge-sky",
  "Agreement Sent":   "gc-badge-blue",
  Signed:             "gc-badge-green",
  Converted:          "gc-badge-green",
  Installed:          "gc-badge-green",
  Rejected:           "gc-badge-red",
  // Project / Task statuses
  Open:               "gc-badge-blue",
  Working:            "gc-badge-yellow",
  "Pending Review":   "gc-badge-sky",
  Template:           "gc-badge-gray",
  Completed:          "gc-badge-green",
  Overdue:            "gc-badge-red",
  Cancelled:          "gc-badge-gray",
  // Payroll
  Draft:              "gc-badge-gray",
  Submitted:          "gc-badge-green",
};

export function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="gc-badge-gray">—</span>;
  const cls = STATUS_COLORS[status] ?? "gc-badge-gray";
  return <span className={cls}>{status}</span>;
}

// ── Pagination ────────────────────────────────────────────────────────────
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
      <span className="text-muted">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="gc-btn-ghost py-1 px-2 text-xs disabled:opacity-30"
        >
          ← Prev
        </button>
        <span className="px-2 font-medium">{page}/{totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="gc-btn-ghost py-1 px-2 text-xs disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button className="gc-btn-outline" onClick={onCancel}>Cancel</button>
          <button
            className={danger ? "gc-btn-danger" : "gc-btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

// ── Toast Notification (lightweight) ─────────────────────────────────────
export function useToast() {
  // Simple implementation using alert for now — replace with a toast lib if desired
  return {
    success: (msg: string) => { console.log("[success]", msg); },
    error: (msg: string)   => { console.error("[error]", msg); },
  };
}
