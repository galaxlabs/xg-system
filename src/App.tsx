// XG System Dashboard - ERP workspace shell
// @ts-nocheck - route/layout scaffold; individual pages are typed where needed
import { useState, Component } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Compass,
  Gauge,
  LogIn,
  Menu,
  Moon,
  PanelLeftClose,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";

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
import AnalyticsPage from "./pages/AnalyticsPage";

import { loginFrappe } from "./lib/frappe";

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
  module: string;
  description: string;
  icon: any;
  roles?: string[];
};

const ROLE = {
  sales: ["Sales Agent", "Sales User", "Sales Manager", "Data Executive", "Onboarding Executive", "OC", "Administrator", "System Manager"],
  cclms: ["Sales Agent", "Sales User", "Sales Manager", "Data Executive", "Onboarding Executive", "OC", "Administrator", "System Manager"],
  projects: ["Project Manager", "Project User", "Administrator", "System Manager"],
  accounts: ["Accounts Manager", "Accounts User", "Finance Manager", "Administrator", "System Manager"],
  hr: ["HR Manager", "HR User", "Payroll Manager", "Administrator", "System Manager"],
  analytics: ["Sales Manager", "Data Executive", "Accounts Manager", "HR Manager", "Administrator", "System Manager"],
};

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Command Center", module: "ERP", description: "Live executive overview", icon: Gauge },
  { path: "/analytics", label: "Analytics", module: "ERP", description: "DocType health and recent activity", icon: BarChart3, roles: ROLE.analytics },
  { path: "/leads", label: "ATM Leads", module: "CCLMS", description: "Lead capture, workflow, dedupe", icon: Users, roles: ROLE.cclms },
  { path: "/pipeline", label: "Pipeline", module: "CCLMS", description: "Milestones and state velocity", icon: TrendingUp, roles: ROLE.cclms },
  { path: "/signs", label: "Signs", module: "CCLMS", description: "Attribution and signed deals", icon: CheckCircle2, roles: ROLE.cclms },
  { path: "/direction", label: "Direction", module: "CRM", description: "State and executive coverage", icon: Compass, roles: ROLE.sales },
  { path: "/agents", label: "Agents", module: "CRM", description: "Sales agent performance", icon: BadgeDollarSign, roles: ROLE.sales },
  { path: "/projects", label: "Projects", module: "Projects", description: "Project and task delivery", icon: BriefcaseBusiness, roles: ROLE.projects },
  { path: "/financials", label: "Financials", module: "Accounting", description: "GL, accounts, balances", icon: WalletCards, roles: ROLE.accounts },
  { path: "/attendance", label: "Attendance", module: "HR", description: "Activity and attendance logs", icon: CalendarDays, roles: ROLE.hr },
  { path: "/payroll", label: "Payroll", module: "HR", description: "Salary slips and payroll entries", icon: BadgeDollarSign, roles: ROLE.hr },
];

const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map((item) => [item.path, item.label]));

function currentPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function AppShellMessage({ kind, title, copy, action }: { kind: string; title: string; copy: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--gc-bg)] px-6 text-[var(--gc-text)]">
      <div className="w-full max-w-xl rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-card)] p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--gc-border)] bg-[var(--gc-surface)] px-3 py-1 text-xs font-semibold text-[var(--gc-muted)]">
          <Sparkles className="h-3.5 w-3.5" />
          {kind}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gc-muted)]">{copy}</p>
        {action ? <div className="mt-6 flex flex-wrap gap-3">{action}</div> : null}
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
      return (
        <AppShellMessage
          kind="Runtime error"
          title="The workspace needs a reload"
          copy="A frontend component stopped rendering. Retry the workspace; if it repeats, the browser console will show the failing component."
          action={<button className="gc-btn-primary" onClick={() => this.setState({ error: null })}>Retry</button>}
        />
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return <AppShellMessage kind="XG System" title="Preparing your workspace" copy="Checking the Frappe session, loading role access, and warming up the ERP modules." />;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => Promise<unknown> }) {
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginFrappe(usr, pwd);
      await onLoggedIn();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--gc-bg)] px-6 text-[var(--gc-text)]">
      <form onSubmit={submit} className="w-full max-w-md rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-card)] p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--gc-border)] bg-[var(--gc-surface)] px-3 py-1 text-xs font-semibold text-[var(--gc-muted)]">
          <LogIn className="h-3.5 w-3.5" /> Secure workspace
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-normal">Sign in to XG System</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gc-muted)]">Use your Frappe account. After login, the workspace only shows modules allowed by your roles.</p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--gc-muted)]">Email or username</span>
            <input className="gc-input h-11" value={usr} onChange={(event) => setUsr(event.target.value)} autoComplete="username" required />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[var(--gc-muted)]">Password</span>
            <input className="gc-input h-11" value={pwd} onChange={(event) => setPwd(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

        <button className="mt-6 w-full justify-center gc-btn-primary" disabled={busy || !usr || !pwd} type="submit">
          <LogIn className="h-4 w-4" /> {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function AccessDenied({ path, title, roles }: { path: string; title: string; roles: string[] }) {
  const session = useDashboardSession();
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl rounded-[8px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-amber-700">
          <ShieldAlert className="h-4 w-4" /> Access restricted
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">Your current Frappe roles do not include this module. Ask an admin to adjust the role assignment, or sign in with the right account.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role) => <span key={role} className="rounded-[6px] border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700">{role}</span>)}
        </div>
        {session && session.user !== "Guest" ? <p className="mt-4 text-xs text-slate-500">Signed in as {session.full_name ?? session.user} · {formatRoles(session.roles)}</p> : null}
      </div>
    </div>
  );
}

function RouteGate({ path, title, roles, children }: { path: string; title: string; roles: string[]; children: any }) {
  const session = useDashboardSession();
  if (!hasAnyRole(session?.roles, roles)) return <AccessDenied path={path} title={title} roles={roles} />;
  return children;
}

function DashboardShell() {
  const session = useDashboardSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const location = useLocation();

  const roles = session?.roles ?? [];
  const visibleNav = NAV_ITEMS.filter((item) => hasAnyRole(roles, item.roles));
  const filteredNav = visibleNav.filter((item) => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return true;
    return `${item.label} ${item.module} ${item.description}`.toLowerCase().includes(q);
  });
  const groupedNav = filteredNav.reduce<Record<string, NavItem[]>>((groups, item) => {
    groups[item.module] = [...(groups[item.module] ?? []), item];
    return groups;
  }, {});
  const activeItem = visibleNav.find((item) => item.path === location.pathname) ?? visibleNav[0];
  const pageTitle = PAGE_TITLES[location.pathname] ?? activeItem?.label ?? "XG System";

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-[var(--gc-bg)] text-[var(--gc-text)]">
        {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

        <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--gc-sidebar-border)] bg-[var(--gc-sidebar)] text-white transition-all duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-24" : "lg:w-80"} w-80 lg:translate-x-0`}>
          <div className="flex items-center gap-3 border-b border-[var(--gc-sidebar-border)] px-5 py-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[var(--gc-sidebar-primary)] text-base font-black text-[var(--gc-sidebar-primary-text)] shadow-sm">XG</div>
            {!collapsed ? (
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">XG System</div>
                <div className="truncate text-xs text-white/65">ERP · CRM · CCLMS</div>
              </div>
            ) : null}
            <button className="ml-auto hidden rounded-[6px] p-2 text-white/70 hover:bg-white/10 lg:inline-flex" onClick={() => setCollapsed((v) => !v)} title="Toggle sidebar">
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <button className="ml-auto rounded-[6px] p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} title="Close navigation">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!collapsed ? (
            <div className="px-4 py-4">
              <label className="flex h-10 items-center gap-2 rounded-[8px] border border-white/10 bg-white/7 px-3 text-white/70">
                <Search className="h-4 w-4" />
                <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45" value={navSearch} onChange={(e) => setNavSearch(e.target.value)} placeholder="Search modules" />
              </label>
            </div>
          ) : null}

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {Object.entries(groupedNav).map(([module, items]) => (
              <div key={module} className="mb-4">
                {!collapsed ? <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-normal text-white/45">{module}</div> : null}
                <div className="grid gap-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink key={item.path} to={item.path} end={item.path === "/"} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `xg-nav-link ${isActive ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`} title={collapsed ? item.label : undefined}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? (
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{item.label}</span>
                            <span className="block truncate text-[11px] text-white/45">{item.description}</span>
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--gc-sidebar-border)] p-4">
            <div className="rounded-[8px] bg-white/7 p-3">
              <div className="truncate text-sm font-semibold">{session?.full_name ?? session?.user}</div>
              {!collapsed ? <div className="mt-1 truncate text-xs text-white/60">{formatRoles(roles)}</div> : null}
            </div>
          </div>
        </aside>

        <div className={`${collapsed ? "lg:pl-24" : "lg:pl-80"} transition-all duration-200`}>
          <header className="sticky top-0 z-20 border-b border-[var(--gc-border)] bg-[var(--gc-card)]/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 md:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button className="rounded-[6px] p-2 hover:bg-[var(--gc-surface)] lg:hidden" onClick={() => setSidebarOpen(true)} title="Open navigation"><Menu className="h-5 w-5" /></button>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-normal text-[var(--gc-muted)]">Galaxy Labs / {activeItem?.module ?? "ERP"}</div>
                  <div className="truncate text-lg font-semibold tracking-normal">{pageTitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden rounded-[8px] border border-[var(--gc-border)] bg-[var(--gc-surface)] px-3 py-2 text-xs text-[var(--gc-muted)] md:block">{visibleNav.length} modules enabled</div>
                <button className="rounded-[6px] border border-[var(--gc-border)] bg-[var(--gc-surface)] p-2" onClick={() => setDarkMode((d) => !d)} title={darkMode ? "Light mode" : "Dark mode"}>{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
              </div>
            </div>
          </header>

          <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/analytics" element={<RouteGate path="/analytics" title="Analytics" roles={ROLE.analytics}><AnalyticsPage /></RouteGate>} />
              <Route path="/leads" element={<RouteGate path="/leads" title="ATM Leads" roles={ROLE.cclms}><LeadsPage /></RouteGate>} />
              <Route path="/signs" element={<RouteGate path="/signs" title="Signs" roles={ROLE.cclms}><SignsPage /></RouteGate>} />
              <Route path="/pipeline" element={<RouteGate path="/pipeline" title="Pipeline" roles={ROLE.cclms}><PipelinePage /></RouteGate>} />
              <Route path="/agents" element={<RouteGate path="/agents" title="Agents" roles={ROLE.sales}><AgentsPage /></RouteGate>} />
              <Route path="/attendance" element={<RouteGate path="/attendance" title="Attendance" roles={ROLE.hr}><AttendancePage /></RouteGate>} />
              <Route path="/direction" element={<RouteGate path="/direction" title="Direction" roles={ROLE.sales}><DirectionPage /></RouteGate>} />
              <Route path="/projects" element={<RouteGate path="/projects" title="Projects" roles={ROLE.projects}><ProjectsPage /></RouteGate>} />
              <Route path="/financials" element={<RouteGate path="/financials" title="Financials" roles={ROLE.accounts}><FinancialsPage /></RouteGate>} />
              <Route path="/payroll" element={<RouteGate path="/payroll" title="Payroll" roles={ROLE.hr}><PayrollPage /></RouteGate>} />
              <Route path="*" element={<Navigate to={visibleNav[0]?.path ?? "/"} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { data: session, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-session"],
    queryFn: fetchDashboardSession,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const refetchSession = async () => {
    await refetch();
  };

  if (isLoading) return <LoadingScreen />;
  if (error) {
    return (
      <AppShellMessage
        kind="Connection error"
        title="Could not verify the Frappe session"
        copy="Confirm the site is reachable and this app is served from the Frappe domain or has a valid API token configured for development."
        action={null}
      />
    );
  }
  if (isGuestSession(session)) return <LoginScreen onLoggedIn={refetchSession} />;

  return (
    <DashboardSessionProvider session={session}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
