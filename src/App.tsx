// XG System Dashboard — Full App
// @ts-nocheck — route/layout scaffold; individual pages are fully typed
import { useState, Component } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import OverviewPage    from "./pages/OverviewPage";
import SignsPage       from "./pages/SignsPage";
import AgentsPage      from "./pages/AgentsPage";
import PipelinePage    from "./pages/PipelinePage";
import AttendancePage  from "./pages/AttendancePage";
import DirectionPage   from "./pages/DirectionPage";
import LeadsPage       from "./pages/LeadsPage";
import ProjectsPage    from "./pages/ProjectsPage";
import FinancialsPage  from "./pages/FinancialsPage";
import PayrollPage     from "./pages/PayrollPage";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

// ── Error Boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: any }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", background: "#1e1b4b", color: "#e0e7ff", minHeight: "100vh" }}>
          <h2 style={{ color: "#f87171", marginBottom: 12 }}>Runtime Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#a5b4fc", marginTop: 12 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV = [
  {
    path: "/", label: "Overview",
    d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    path: "/leads", label: "ATM Leads",
    d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    path: "/signs", label: "Signs",
    d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    path: "/pipeline", label: "Pipeline",
    d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    path: "/agents", label: "Agents",
    d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    path: "/attendance", label: "Attendance",
    d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    path: "/direction", label: "Direction",
    d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    path: "/projects", label: "Projects",
    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
  {
    path: "/financials", label: "Financials",
    d: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    path: "/payroll", label: "Payroll",
    d: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  },
];

const BACKEND = import.meta.env.VITE_FRAPPE_BASE_URL ?? "https://crm.galaxylabs.online";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const PAGE_TITLES: Record<string, string> = {
    "/":            "Overview",
    "/leads":       "ATM Leads",
    "/signs":       "Signs & Attribution",
    "/pipeline":    "Pipeline",
    "/agents":      "Agents",
    "/attendance":  "Attendance",
    "/direction":   "Direction",
    "/projects":    "Projects",
    "/financials":  "Financials · GL",
    "/payroll":     "Payroll",
  };

  return (
    <ErrorBoundary>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <div className={darkMode ? "dark" : ""}>
          <div className="flex min-h-screen bg-[var(--gc-bg)] font-sans transition-colors duration-200">

            {/* Sidebar overlay (mobile) */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <aside
              className={`fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300
                ${sidebarOpen ? "w-60" : "w-0 overflow-hidden"}
                lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:w-60`}
              style={{ background: "var(--gc-sidebar)" }}
            >
              {/* Logo */}
              <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-emerald-400 flex items-center justify-center text-white font-black text-sm shrink-0">
                  G
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] text-indigo-300 uppercase tracking-widest leading-none">Galaxy Labs</p>
                  <p className="text-sm font-bold text-white leading-tight mt-0.5">XG System</p>
                </div>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `gc-nav-item ${isActive ? "active" : ""}`
                    }
                    onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  >
                    <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                    </svg>
                    <span className="text-sm">{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* Backend indicator */}
              <div className="mx-3 mb-4 p-3 rounded-xl bg-white/5 shrink-0">
                <p className="text-[10px] text-indigo-300 uppercase tracking-wider">Connected to</p>
                <p className="text-xs font-semibold text-white mt-0.5 truncate">{BACKEND.replace("https://","")}</p>
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-emerald-300">
                  Live
                </span>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex flex-col flex-1 min-w-0">

              {/* Top bar */}
              <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b shrink-0"
                style={{ background: "var(--gc-card)", borderColor: "var(--gc-border)" }}>
                <div className="flex items-center gap-3">
                  <button
                    className="p-2 rounded-lg hover:bg-[var(--gc-surface)] transition-colors lg:hidden"
                    onClick={() => setSidebarOpen((v) => !v)}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <button
                    className="hidden lg:flex p-2 rounded-lg hover:bg-[var(--gc-surface)] transition-colors"
                    onClick={() => setSidebarOpen((v) => !v)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  {/* Breadcrumb title */}
                  <Routes>
                    {Object.entries(PAGE_TITLES).map(([path, title]) => (
                      <Route key={path} path={path} element={
                        <span className="text-sm font-semibold" style={{ color: "var(--gc-text)" }}>{title}</span>
                      } />
                    ))}
                  </Routes>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDarkMode((d) => !d)}
                    className="p-2 rounded-lg hover:bg-[var(--gc-surface)] transition-colors"
                    title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {darkMode ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                  </button>
                  <a
                    href={BACKEND}
                    target="_blank"
                    rel="noreferrer"
                    className="gc-btn-outline text-xs px-3 py-1.5"
                  >
                  Open Frappe
                  </a>
                </div>
              </header>

              {/* Page content */}
              <main className="flex-1 p-4 md:p-6 overflow-auto">
                <Routes>
                  <Route path="/"             element={<OverviewPage />} />
                  <Route path="/leads"        element={<LeadsPage />} />
                  <Route path="/signs"        element={<SignsPage />} />
                  <Route path="/pipeline"     element={<PipelinePage />} />
                  <Route path="/agents"       element={<AgentsPage />} />
                  <Route path="/attendance"   element={<AttendancePage />} />
                  <Route path="/direction"    element={<DirectionPage />} />
                  <Route path="/projects"     element={<ProjectsPage />} />
                  <Route path="/financials"   element={<FinancialsPage />} />
                  <Route path="/payroll"      element={<PayrollPage />} />
                  <Route path="*"             element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

