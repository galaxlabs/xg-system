import { type ReactNode } from "react";
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
export function StatCard({ label, value, sub, color = "#6366f1", icon, trend }: StatCardProps) {
  return (
    <div className="gc-stat group hover:shadow-soft transition-all duration-200">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-lg shadow-sm"
          style={{ background: color }}
        >
        {icon ?? null}
        </div>
        {trend && (
          <span
            className={clsx(
              "text-xs font-semibold rounded-full px-2 py-0.5",
              trend.up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}
          >
            {trend.up ? "+" : "-"} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="gc-stat-value" style={{ color }}>
          {value}
        </div>
        <div className="gc-stat-label mt-1">{label}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
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
