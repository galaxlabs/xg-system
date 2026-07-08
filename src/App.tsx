// XG System Dashboard — Full App
// @ts-nocheck — route/layout scaffold; individual pages are fully typed
import { useState, Component } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

import OverviewPage from "./pages/OverviewPage";
import SignsPage from "./pages/SignsPage";
import AgentsPage from "./pages/AgentsPage";
import PipelinePage from "./pages/PipelinePage";
import AttendancePage from "./pages/AttendancePage";
import DirectionPage from "./pages/DirectionPage";
import LeadsPage from "./pages/LeadsPage";
import ProjectsPage from "./pages/ProjectsPage";
import FinancialsPage from "./pages/FinancialsPage";
import PayrollPage from "./pages/PayrollPage";

import { resolveFrappeBaseUrl } from "./lib/frappe";
import {
  DashboardSessionProvider,
  fetchDashboardSession,
  formatRoles,
  hasAnyRole,
  isGuestSession,
  useDashboardSession,
} from "./lib/session";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

type NavItem = {
  path: string;
  label: string;
  d: string;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Overview",
    d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    path: "/leads",
    label: "ATM Leads",
    d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    roles: ["Sales Agent", "Sales User", "Data Executive", "Onboarding Executive", "OC", "Administrator", "System Manager"],
  },
  {
    path: "/signs",
    label: "Signs",
    d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    roles: ["Sales Agent", "Sales User", "Data Executive", "Administrator", "System Manager"],
  },
  {
    path: "/pipeline",
    label: "Pipeline",
    d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    roles: ["Sales Agent", "Sales User", "Data Executive", "Administrator", "System Manager"],
  },
  {
    path: "/agents",
    label: "Agents",
    d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    roles: ["Sales Manager", "Sales Agent", "Data Executive", "Administrator", "System Manager"],
  },
  {
    path: "/attendance",
    label: "Attendance",
    d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    roles: ["HR Manager", "HR User", "Administrator", "System Manager"],
  },
  {
    path: "/direction",
    label: "Direction",
    d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    roles: ["Sales Manager", "Sales Agent", "Data Executive", "Administrator", "System Manager"],
  },
  {
    path: "/projects",
    label: "Projects",
    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    roles: ["Project Manager", "Project User", "Administrator", "System Manager"],
  },
  {
    path: "/financials",
    label: "Financials",
    d: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    roles: ["Accounts Manager", "Accounts User", "Finance Manager", "Administrator", "System Manager"],
  },
  {
    path: "/payroll",
    label: "Payroll",
    d: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
    roles: ["HR Manager", "HR User", "Payroll Manager", "Administrator", "System Manager"],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/leads": "ATM Leads",
  "/signs": "Signs & Attribution",
  "/pipeline": "Pipeline",
  "/agents": "Agents",
  "/attendance": "Attendance",
  "/direction": "Direction",
  "/projects": "Projects",
  "/financials": "Financials · GL",
  "/payroll": "Payroll",
};


function ErrorBoundaryFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,_#050816,_#0f172a)] text-white">
      <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.35em] text-indigo-200">XG System</p>
        <h1 className="mt-3 text-3xl font-bold">The dashboard hit a runtime error</h1>
        <p className="mt-3 text-sm text-slate-300">Retry after the page reloads. If the problem repeats, the browser console should show the exact component that failed.</p>
        <button className="mt-6 gc-btn gc-btn-primary" onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: any }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <ErrorBoundaryFallback onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_30%),linear-gradient(180deg,_#050816,_#0f172a)] text-white">
      <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          Syncing Frappe session
        </div>
        <h1 className="mt-4 text-3xl font-bold">Loading XG System</h1>
        <p className="mt-3 text-sm text-slate-300">We are checking the live Frappe session and preparing the role-aware navigation.</p>
        <div className="mt-6 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ loginUrl, backendUrl }: { loginUrl: string; backendUrl: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_#04111f,_#071323)] text-white">
      <div className="max-w-3xl w-full grid gap-6 lg:grid-cols-[1.2fr_0.8fr] rounded-[2rem] border border-white/10 bg-white/6 backdrop-blur-2xl p-6 md:p-8 shadow-2xl shadow-black/30">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-sky-200">XG System</p>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">Sign in with your Frappe account to see the dashboard.</h1>
          <p className="text-slate-300 max-w-2xl">
            This build uses the logged-in Frappe session when it is served from the same site.
            API token support stays available for local development or cross-site testing, but it is not required for normal site use.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a className="gc-btn gc-btn-primary" href={loginUrl}>Open Frappe Login</a>
            <a className="gc-btn gc-btn-outline border-white/20 text-white hover:bg-white/10" href={backendUrl} target="_blank" rel="noreferrer">
              Open Site
            </a>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Connection</p>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-wider">Frappe site</div>
              <div className="mt-1 font-semibold text-white break-all">{backendUrl}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-wider">Authentication</div>
              <div className="mt-1">Frappe session cookie or API token fallback</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-wider">Role scope</div>
              <div className="mt-1">Modules appear only when your Frappe roles are allowed to see them.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ path, title, roles }: { path: string; title: string; roles: string[] }) {
  const session = useDashboardSession();
  const backendUrl = resolveFrappeBaseUrl();
  const loginUrl = `/login?redirect-to=${encodeURIComponent(path)}`;
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Access restricted</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-700">
          Your current Frappe roles do not include this module. If this looks wrong, check the role assignments on your user record or log in with the right account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <span key={role} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
              {role}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="gc-btn gc-btn-primary" href={loginUrl}>Open Login</a>
          <a className="gc-btn gc-btn-outline" href={backendUrl} target="_blank" rel="noreferrer">Open Site</a>
        </div>
        {session && session.user !== "Guest" && (
          <p className="mt-4 text-xs text-slate-500">Signed in as {session.full_name ?? session.user} · {formatRoles(session.roles)}</p>
        )}
      </div>
    </div>
  );
}

function RouteGate({ path, title, roles, children }: { path: string; title: string; roles: string[]; children: any }) {
  const session = useDashboardSession();
  if (!hasAnyRole(session?.roles, roles)) {
    return <AccessDenied path={path} title={title} roles={roles} />;
  }
  return children;
}

function DashboardShell() {
  const session = useDashboardSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();

  const roles = session?.roles ?? [];
  const visibleNav = NAV_ITEMS.filter((item) => hasAnyRole(roles, item.roles));
  const pageTitle = PAGE_TITLES[location.pathname] ?? visibleNav.find((item) => item.path === location.pathname)?.label ?? "XG System";
  const backendUrl = resolveFrappeBaseUrl();
  const loginUrl = `/login?redirect-to=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`;

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex min-h-screen bg-[var(--gc-bg)] font-sans transition-colors duration-200">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300
            ${sidebarOpen ? "w-60" : "w-0 overflow-hidden"}
            lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:w-60`}
          style={{ background: "var(--gc-sidebar)" }}
        >
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-emerald-400 flex items-center justify-center text-white font-black text-sm shrink-0">
              G
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-indigo-300 uppercase tracking-widest leading-none">Galaxy Labs</p>
              <p className="text-sm font-bold text-white leading-tight mt-0.5">XG System</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {visibleNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) => `gc-nav-item ${isActive ? "active" : ""}`}
                onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
              >
                <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
                </svg>
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mx-3 mb-4 p-3 rounded-xl bg-white/5 shrink-0 space-y-2">
            <div>
              <p className="text-[10px] text-indigo-300 uppercase tracking-wider">Connected to</p>
              <p className="text-xs font-semibold text-white mt-0.5 truncate">{backendUrl.replace("https://", "")}</p>
            </div>
            <div>
              <p className="text-[10px] text-indigo-300 uppercase tracking-wider">Signed in as</p>
              <p className="text-xs font-semibold text-white mt-0.5 truncate">{session?.full_name ?? session?.user}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{formatRoles(roles)}</p>
            </div>
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0">
          <header
            className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ background: "var(--gc-card)", borderColor: "var(--gc-border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
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

              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--gc-muted)]">{pageTitle}</p>
                <p className="text-sm font-semibold" style={{ color: "var(--gc-text)" }}>
                  {session?.full_name ?? session?.user}
                  <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    {formatRoles(roles)}
                  </span>
                </p>
              </div>
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
                href={backendUrl}
                target="_blank"
                rel="noreferrer"
                className="gc-btn-outline text-xs px-3 py-1.5"
              >
                Open Frappe
              </a>
              <a
                href={loginUrl}
                className="hidden sm:inline-flex gc-btn text-xs px-3 py-1.5 bg-[var(--gc-surface)] text-[var(--gc-text)] border border-[var(--gc-border)]"
              >
                Recheck Login
              </a>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/leads" element={<RouteGate path="/leads" title="ATM Leads" roles={["Sales Agent", "Sales User", "Data Executive", "Onboarding Executive", "OC", "Administrator", "System Manager"]}><LeadsPage /></RouteGate>} />
              <Route path="/signs" element={<RouteGate path="/signs" title="Signs" roles={["Sales Agent", "Sales User", "Data Executive", "Administrator", "System Manager"]}><SignsPage /></RouteGate>} />
              <Route path="/pipeline" element={<RouteGate path="/pipeline" title="Pipeline" roles={["Sales Agent", "Sales User", "Data Executive", "Administrator", "System Manager"]}><PipelinePage /></RouteGate>} />
              <Route path="/agents" element={<RouteGate path="/agents" title="Agents" roles={["Sales Manager", "Sales Agent", "Data Executive", "Administrator", "System Manager"]}><AgentsPage /></RouteGate>} />
              <Route path="/attendance" element={<RouteGate path="/attendance" title="Attendance" roles={["HR Manager", "HR User", "Administrator", "System Manager"]}><AttendancePage /></RouteGate>} />
              <Route path="/direction" element={<RouteGate path="/direction" title="Direction" roles={["Sales Manager", "Sales Agent", "Data Executive", "Administrator", "System Manager"]}><DirectionPage /></RouteGate>} />
              <Route path="/projects" element={<RouteGate path="/projects" title="Projects" roles={["Project Manager", "Project User", "Administrator", "System Manager"]}><ProjectsPage /></RouteGate>} />
              <Route path="/financials" element={<RouteGate path="/financials" title="Financials" roles={["Accounts Manager", "Accounts User", "Finance Manager", "Administrator", "System Manager"]}><FinancialsPage /></RouteGate>} />
              <Route path="/payroll" element={<RouteGate path="/payroll" title="Payroll" roles={["HR Manager", "HR User", "Payroll Manager", "Administrator", "System Manager"]}><PayrollPage /></RouteGate>} />
              <Route path="*" element={<Navigate to={visibleNav[0]?.path ?? "/"} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { data: session, isLoading, error } = useQuery({
    queryKey: ["dashboard-session"],
    queryFn: fetchDashboardSession,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const backendUrl = resolveFrappeBaseUrl();
  const loginUrl = `/login?redirect-to=${encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)}`;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,_#050816,_#0f172a)] text-white">
        <div className="max-w-xl w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-200">Connection error</p>
          <h1 className="mt-3 text-3xl font-bold">Could not reach the Frappe session endpoint</h1>
          <p className="mt-3 text-sm text-slate-300">The dashboard could not verify the logged-in user. Confirm the site is reachable and that the app is served from the Frappe domain or has the correct API token configured.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="gc-btn gc-btn-primary" href={loginUrl}>Open Login</a>
            <a className="gc-btn gc-btn-outline border-white/20 text-white hover:bg-white/10" href={backendUrl} target="_blank" rel="noreferrer">Open Site</a>
          </div>
          <pre className="mt-6 overflow-auto rounded-2xl bg-black/30 p-4 text-xs text-red-200 whitespace-pre-wrap">{String((error as Error).message ?? error)}</pre>
        </div>
      </div>
    );
  }

  if (isGuestSession(session)) {
    return <LoginScreen loginUrl={loginUrl} backendUrl={backendUrl} />;
  }

  return (
    <DashboardSessionProvider session={session}>
      <BrowserRouter>
        <DashboardShell />
      </BrowserRouter>
    </DashboardSessionProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
