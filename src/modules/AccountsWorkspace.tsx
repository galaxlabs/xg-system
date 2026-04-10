import { useEffect, useMemo, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

import { callFrappe } from "../lib/frappe";

type DoctypeInfo = {
  doctype: string;
  permissions: { read: number; create: number; write: number; delete: number; print: number };
  default_fields: string[];
  editable_fields: { fieldname: string; label: string; fieldtype: string }[];
};

type ListResponse = {
  rows: Record<string, unknown>[];
  total: number;
};

type DashboardResponse = {
  months: string[];
  series: { name: string; data: number[]; color: string }[];
  totals: { income: number; expense: number; profit: number };
};

type PrintFormatRow = {
  name: string;
  print_format_type: string;
  modified: string;
};

export default function AccountsWorkspace() {
  const [doctypes, setDoctypes] = useState<DoctypeInfo[]>([]);
  const [activeDoctype, setActiveDoctype] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [printFormats, setPrintFormats] = useState<PrintFormatRow[]>([]);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [printName, setPrintName] = useState("");
  const [printHtml, setPrintHtml] = useState("<h1>{{ doc.name }}</h1>");
  const [printCss, setPrintCss] = useState("h1 { font-size: 20px; }");

  const activeInfo = useMemo(
    () => doctypes.find((d) => d.doctype === activeDoctype) ?? null,
    [doctypes, activeDoctype]
  );

  async function loadDoctypes() {
    try {
      setError("");
      const r = await callFrappe<{ doctypes: DoctypeInfo[] }>("galaxy_ui.api.accounts_module.get_accounts_doctypes");
      setDoctypes(r.doctypes || []);
      if (!activeDoctype && r.doctypes?.length) {
        setActiveDoctype(r.doctypes[0].doctype);
      }
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function loadRows() {
    if (!activeDoctype) return;
    setLoading(true);
    try {
      setError("");
      const r = await callFrappe<ListResponse>("galaxy_ui.api.accounts_module.accounts_list", {
        doctype: activeDoctype,
        fields: activeInfo?.default_fields || ["name", "modified"],
        page_length: 20,
      });
      setRows(r.rows || []);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      const r = await callFrappe<DashboardResponse>("galaxy_ui.api.accounts_module.accounts_dashboard_report");
      setDashboard(r);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function loadPrintFormats() {
    if (!activeDoctype || !activeInfo?.permissions.print) return;
    try {
      const r = await callFrappe<{ print_formats: PrintFormatRow[] }>(
        "galaxy_ui.api.accounts_module.accounts_print_formats",
        { doctype: activeDoctype }
      );
      setPrintFormats(r.print_formats || []);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  useEffect(() => {
    loadDoctypes().catch(console.error);
  }, []);

  useEffect(() => {
    loadRows().catch(console.error);
    loadDashboard().catch(console.error);
    loadPrintFormats().catch(console.error);
    setFormData({});
  }, [activeDoctype]);

  async function saveRecord() {
    if (!activeDoctype || !activeInfo) return;
    await callFrappe("galaxy_ui.api.accounts_module.accounts_save", {
      doctype: activeDoctype,
      doc: formData,
    });
    setFormData({});
    await loadRows();
  }

  async function removeRecord(name: string) {
    if (!activeDoctype || !activeInfo?.permissions.delete) return;
    await callFrappe("galaxy_ui.api.accounts_module.accounts_delete", { doctype: activeDoctype, name });
    await loadRows();
  }

  async function savePrintFormat() {
    if (!activeDoctype) return;
    await callFrappe("galaxy_ui.api.accounts_module.save_accounts_print_format", {
      doctype: activeDoctype,
      name: printName || undefined,
      html: printHtml,
      css: printCss,
    });
    setPrintName("");
    await loadPrintFormats();
  }

  const chartOptions: Highcharts.Options = {
    chart: { type: "column", backgroundColor: "transparent" },
    title: { text: "Accounts Monthly Report" },
    xAxis: { categories: dashboard?.months || [] },
    yAxis: { title: { text: "Amount" } },
    series: (dashboard?.series || []).map((s) => ({
      name: s.name,
      data: s.data,
      type: "column",
      color: s.color,
    })),
    credits: { enabled: false },
  };

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-border bg-card p-4 shadow-soft">
        <h3 className="text-lg font-semibold">Accounts Module</h3>
        <p className="text-sm text-muted">DocTypes, CRUD, permissions, reporting, and print format design.</p>
        {error ? (
          <div className="mt-3 rounded-panel border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            API error: {error}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {doctypes.map((d) => (
            <button
              key={d.doctype}
              onClick={() => setActiveDoctype(d.doctype)}
              className={`rounded-panel border px-3 py-2 text-sm ${
                activeDoctype === d.doctype ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              {d.doctype}
            </button>
          ))}
        </div>
      </section>

      {dashboard && (
        <section className="rounded-panel border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-panel border border-border bg-bg p-3 text-sm">
              Income
              <div className="text-xl font-bold text-emerald-600">{dashboard.totals.income.toLocaleString()}</div>
            </div>
            <div className="rounded-panel border border-border bg-bg p-3 text-sm">
              Expense
              <div className="text-xl font-bold text-red-600">{dashboard.totals.expense.toLocaleString()}</div>
            </div>
            <div className="rounded-panel border border-border bg-bg p-3 text-sm">
              Profit
              <div className="text-xl font-bold text-primary">{dashboard.totals.profit.toLocaleString()}</div>
            </div>
          </div>
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </section>
      )}

      <section className="rounded-panel border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-semibold">Records: {activeDoctype || "-"}</h4>
          <button onClick={() => loadRows()} className="rounded-panel border border-border px-3 py-1 text-sm">
            Refresh
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                {(activeInfo?.default_fields || ["name"]).map((field) => (
                  <th key={field} className="py-2">
                    {field}
                  </th>
                ))}
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={99} className="py-4 text-muted">
                    Loading...
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={String(row.name || Math.random())} className="border-b border-border/60">
                    {(activeInfo?.default_fields || ["name"]).map((field) => (
                      <td key={field} className="py-2">
                        {String(row[field] ?? "")}
                      </td>
                    ))}
                    <td className="py-2">
                      <button
                        onClick={() => setFormData(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? "")])))}
                        className="mr-2 rounded border border-border px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      {activeInfo?.permissions.delete ? (
                        <button
                          onClick={() => removeRecord(String(row.name || ""))}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600"
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeInfo?.permissions.create || activeInfo?.permissions.write ? (
        <section className="rounded-panel border border-border bg-card p-4 shadow-soft">
          <h4 className="mb-3 font-semibold">CRUD Form</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(activeInfo?.editable_fields || []).slice(0, 10).map((f) => (
              <label key={f.fieldname} className="text-sm">
                <span className="mb-1 block text-muted">{f.label || f.fieldname}</span>
                <input
                  value={formData[f.fieldname] || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [f.fieldname]: e.target.value }))}
                  className="w-full rounded-panel border border-border px-3 py-2"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={saveRecord} className="rounded-panel bg-primary px-4 py-2 text-sm font-semibold text-white">
              Save
            </button>
            <button onClick={() => setFormData({})} className="rounded-panel border border-border px-4 py-2 text-sm">
              Reset
            </button>
          </div>
        </section>
      ) : null}

      {activeInfo?.permissions.print ? (
        <section className="rounded-panel border border-border bg-card p-4 shadow-soft">
          <h4 className="mb-3 font-semibold">Print Format Designer</h4>
          <div className="mb-3 text-sm text-muted">Create/update custom print formats for {activeDoctype}.</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Print Format Name (optional for update)</span>
              <input
                value={printName}
                onChange={(e) => setPrintName(e.target.value)}
                className="w-full rounded-panel border border-border px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">HTML Template</span>
              <textarea
                value={printHtml}
                onChange={(e) => setPrintHtml(e.target.value)}
                className="h-40 w-full rounded-panel border border-border px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">CSS</span>
              <textarea
                value={printCss}
                onChange={(e) => setPrintCss(e.target.value)}
                className="h-40 w-full rounded-panel border border-border px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>
          <div className="mt-3">
            <button onClick={savePrintFormat} className="rounded-panel bg-primary px-4 py-2 text-sm font-semibold text-white">
              Save Print Format
            </button>
          </div>
          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2">Name</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Modified</th>
                </tr>
              </thead>
              <tbody>
                {printFormats.map((pf) => (
                  <tr key={pf.name} className="border-b border-border/60">
                    <td className="py-2">{pf.name}</td>
                    <td className="py-2">{pf.print_format_type}</td>
                    <td className="py-2">{pf.modified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
