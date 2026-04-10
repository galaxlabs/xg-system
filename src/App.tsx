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
  { path: "/",           label: "Overview",   exact: true },
  { path: "/signs",      label: "Signs"       },
  { path: "/pipeline",   label: "Pipeline"    },
  { path: "/agents",     label: "Agents"      },
  { path: "/attendance", label: "Attendance"  },
  { path: "/direction",  label: "Direction"   },
] as const;

const BACKEND = import.meta.env.VITE_FRAPPE_BASE_URL ?? "https://crm.galaxylabs.online";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const PAGE_TITLES: Record<string, string> = {
    "/":           "Overview",
    "/signs":      "Signs & Attribution",
    "/pipeline":   "Pipeline",
    "/agents":     "Agents",
    "/attendance": "Attendance",
    "/direction":  "Direction",
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
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                    className="p-2 rounded-lg hover:bg-[var(--gc-surface)] transition-colors text-sm"
                    title="Toggle dark mode"
                  >
                    {darkMode ? "Light" : "Dark"}
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
                  <Route path="/"           element={<OverviewPage />} />
                  <Route path="/signs"      element={<SignsPage />} />
                  <Route path="/pipeline"   element={<PipelinePage />} />
                  <Route path="/agents"     element={<AgentsPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/direction"  element={<DirectionPage />} />
                  <Route path="*"           element={<Navigate to="/" replace />} />
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

