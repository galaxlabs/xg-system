import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchGLEntries, fetchAccounts, thisMonthRange } from "../lib/api";
import {
  Card, CardHeader, StatCard, DataTable, LoadingBlock, EmptyBlock,
  FilterRow, DateInput, Badge,
} from "../components/ui/index";
import { AreaChart, ColumnChart, DonutChart } from "../components/charts/index";
import type { GLEntryRow } from "../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtN(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VOUCHER_COLORS: Record<string, string> = {
  "Sales Invoice":     "#10b981",
  "Purchase Invoice":  "#ef4444",
  "Journal Entry":     "#6366f1",
  "Payment Entry":     "#0ea5e9",
  "Expense Claim":     "#f59e0b",
  "Payroll Entry":     "#8b5cf6",
  "Stock Entry":       "#f97316",
};

// ── Trend aggregation by month ────────────────────────────────────────────
function aggregateByMonth(entries: GLEntryRow[]) {
  const m = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    const month = (e.posting_date ?? "").slice(0, 7);
    if (!month) continue;
    if (!m.has(month)) m.set(month, { debit: 0, credit: 0 });
    const x = m.get(month)!;
    x.debit  += e.debit  ?? 0;
    x.credit += e.credit ?? 0;
  }
  const sorted = [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    categories: sorted.map(([k]) => k),
    debit:      sorted.map(([, v]) => v.debit),
    credit:     sorted.map(([, v]) => v.credit),
    net:        sorted.map(([, v]) => v.credit - v.debit),
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function FinancialsPage() {
  const { from, to } = thisMonthRange();
  const [fromDate, setFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setTo]       = useState(to);
  const [company, setCompany] = useState("");
  const [acctFilter, setAcct] = useState("");
  const [voucherType, setVoucherType] = useState("");
  const [search, setSearch] = useState("");

  const glQuery = useQuery({
    queryKey: ["gl_entries", fromDate, toDate, company, voucherType],
    queryFn: () => fetchGLEntries({
      from_date:    fromDate,
      to_date:      toDate,
      company:      company || undefined,
      voucher_type: voucherType || undefined,
    }),
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts", company],
    queryFn: () => fetchAccounts({ company: company || undefined }),
  });

  const entries = glQuery.data ?? [];

  // ── Aggregations ──
  const totalDebit  = entries.reduce((s, e) => s + (e.debit  ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit ?? 0), 0);
  const netBalance  = totalCredit - totalDebit;

  // Group by account
  const byAccount = useMemo(() => {
    const m = new Map<string, { account: string; debit: number; credit: number; net: number; txns: number }>();
    for (const e of entries) {
      const key = e.account ?? "Unknown";
      if (!m.has(key)) m.set(key, { account: key, debit: 0, credit: 0, net: 0, txns: 0 });
      const x = m.get(key)!;
      x.debit  += e.debit  ?? 0;
      x.credit += e.credit ?? 0;
      x.net    += (e.credit ?? 0) - (e.debit ?? 0);
      x.txns   += 1;
    }
    return [...m.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [entries]);

  // Group by voucher type for donut
  const byVoucher = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const k = e.voucher_type ?? "Other";
      m.set(k, (m.get(k) ?? 0) + Math.abs(e.debit ?? 0));
    }
    return [...m.entries()]
      .sort(([,a],[,b]) => b - a)
      .map(([name, y]) => ({ name, y, color: VOUCHER_COLORS[name] ?? "#94a3b8" }));
  }, [entries]);

  // Monthly trend
  const trend = useMemo(() => aggregateByMonth(entries), [entries]);

  // Top 10 accounts for bar
  const topAccounts    = byAccount.slice(0, 10);
  const acctBarCats    = topAccounts.map((a) => a.account.split(" - ")[0]);
  const acctDebitData  = topAccounts.map((a) => +(a.debit.toFixed(2)));
  const acctCreditData = topAccounts.map((a) => +(a.credit.toFixed(2)));

  // Filtered entries for ledger view
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (acctFilter  && e.account       !== acctFilter)  return false;
      if (search && !(
        (e.voucher_no ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.account    ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.party      ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.remarks    ?? "").toLowerCase().includes(search.toLowerCase())
      )) return false;
      return true;
    });
  }, [entries, acctFilter, search]);

  const VOUCHER_TYPES = [...new Set(entries.map((e) => e.voucher_type).filter(Boolean))].sort();
  const ACCOUNTS      = [...new Set(entries.map((e) => e.account).filter(Boolean))].sort();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Filter bar */}
      <FilterRow onRefresh={() => { glQuery.refetch(); accountsQuery.refetch(); }}>
        <DateInput label="From" value={fromDate} onChange={setFrom} />
        <DateInput label="To"   value={toDate}   onChange={setTo} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Company</span>
          <input className="gc-input w-36" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="All" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Voucher Type</span>
          <select className="gc-select" value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
            <option value="">All</option>
            {VOUCHER_TYPES.map((v) => <option key={v} value={v!}>{v}</option>)}
          </select>
        </label>
      </FilterRow>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Debit"   value={fmt(totalDebit)}  color="#ef4444" />
        <StatCard label="Total Credit"  value={fmt(totalCredit)} color="#10b981" />
        <StatCard label="Net Balance"   value={fmt(netBalance)}  color={netBalance >= 0 ? "#10b981" : "#ef4444"} />
        <StatCard label="Transactions"  value={entries.length}   color="#6366f1" />
      </div>

      {/* Trend Chart + Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly Debit vs Credit" subtitle="Cash flow trend" />
          <div className="px-4 pb-4">
            {glQuery.isLoading ? <LoadingBlock /> : trend.categories.length === 0 ? <EmptyBlock /> : (
              <ColumnChart
                categories={trend.categories}
                series={[
                  { name: "Credit (Income)", data: trend.credit, color: "#10b981" },
                  { name: "Debit (Expense)",  data: trend.debit,  color: "#ef4444" },
                ]}
                height={300}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="By Voucher Type" />
          <div className="px-4 pb-4">
            {glQuery.isLoading ? <LoadingBlock /> : byVoucher.length === 0 ? <EmptyBlock /> : (
              <DonutChart data={byVoucher} height={280} />
            )}
          </div>
        </Card>
      </div>

      {/* Account Balance Chart */}
      <Card>
        <CardHeader title="Top Accounts by Volume" subtitle="Debit vs Credit by account" />
        <div className="px-4 pb-4">
          {glQuery.isLoading ? <LoadingBlock /> : topAccounts.length === 0 ? <EmptyBlock /> : (
            <ColumnChart
              categories={acctBarCats}
              series={[
                { name: "Debit",  data: acctDebitData,  color: "#ef4444" },
                { name: "Credit", data: acctCreditData, color: "#10b981" },
              ]}
              height={320}
            />
          )}
        </div>
      </Card>

      {/* Account Summary Table */}
      <Card>
        <CardHeader title="Account Summary" subtitle={`${byAccount.length} accounts`} />
        <div className="px-4 pb-4">
          {glQuery.isLoading ? <LoadingBlock /> : (
            <DataTable
              keyField="account"
              rows={byAccount}
              cols={[
                { key: "account", label: "Account" },
                { key: "txns",    label: "Txns", align: "right" },
                {
                  key: "debit",
                  label: "Total Debit",
                  align: "right",
                  render: (r) => <span className="text-red-600 font-semibold">{fmtN(r.debit)}</span>,
                },
                {
                  key: "credit",
                  label: "Total Credit",
                  align: "right",
                  render: (r) => <span className="text-emerald-600 font-semibold">{fmtN(r.credit)}</span>,
                },
                {
                  key: "net",
                  label: "Net",
                  align: "right",
                  render: (r) => (
                    <span
                      className="font-bold"
                      style={{ color: r.net >= 0 ? "#10b981" : "#ef4444" }}
                    >
                      {r.net >= 0 ? "+" : ""}{fmtN(r.net)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </Card>

      {/* GL Ledger */}
      <Card>
        <CardHeader
          title="General Ledger"
          subtitle={`${filteredEntries.length} entries`}
          action={
            <div className="flex items-center gap-2">
              <select
                className="gc-select text-xs"
                value={acctFilter}
                onChange={(e) => setAcct(e.target.value)}
              >
                <option value="">All accounts</option>
                {ACCOUNTS.map((a) => <option key={a} value={a!}>{a}</option>)}
              </select>
              <input
                className="gc-input text-xs w-40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher, party…"
              />
            </div>
          }
        />
        <div className="px-4 pb-4">
          {glQuery.isLoading ? <LoadingBlock /> : filteredEntries.length === 0 ? <EmptyBlock msg="No GL entries found" /> : (
            <DataTable
              keyField="name"
              rows={filteredEntries.slice(0, 200)}
              cols={[
                { key: "posting_date", label: "Date" },
                {
                  key: "voucher_type",
                  label: "Type",
                  render: (r) => {
                    const c = VOUCHER_COLORS[r.voucher_type ?? ""] ?? "#94a3b8";
                    return (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: `${c}22`, color: c }}
                      >
                        {r.voucher_type ?? "—"}
                      </span>
                    );
                  },
                },
                { key: "voucher_no", label: "Voucher No" },
                { key: "account",   label: "Account" },
                { key: "party",     label: "Party" },
                {
                  key: "debit",
                  label: "Debit",
                  align: "right",
                  render: (r) => r.debit && r.debit > 0
                    ? <span className="text-red-600 font-mono text-xs">{fmtN(r.debit)}</span>
                    : <span className="text-muted">—</span>,
                },
                {
                  key: "credit",
                  label: "Credit",
                  align: "right",
                  render: (r) => r.credit && r.credit > 0
                    ? <span className="text-emerald-600 font-mono text-xs">{fmtN(r.credit)}</span>
                    : <span className="text-muted">—</span>,
                },
                {
                  key: "remarks",
                  label: "Remarks",
                  render: (r) => (
                    <span className="text-xs text-muted truncate max-w-[200px] block" title={r.remarks ?? ""}>
                      {r.remarks ?? "—"}
                    </span>
                  ),
                },
              ]}
            />
          )}
          {filteredEntries.length > 200 && (
            <p className="text-xs text-muted mt-2 text-center">Showing first 200 of {filteredEntries.length} entries. Refine filters to see more.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
