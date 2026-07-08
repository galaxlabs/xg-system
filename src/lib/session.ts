import { createContext, useContext, type ReactNode } from "react";

import { callFrappe } from "./frappe";

export interface DashboardSession {
  user: string;
  full_name: string | null;
  roles: string[];
}

export async function fetchDashboardSession(): Promise<DashboardSession> {
  return callFrappe<DashboardSession>("cclms.api.auth.whoami");
}

const DashboardSessionContext = createContext<DashboardSession | null>(null);

export function DashboardSessionProvider({
  session,
  children,
}: {
  session: DashboardSession | null;
  children: ReactNode;
}) {
  return <DashboardSessionContext.Provider value={session}>{children}</DashboardSessionContext.Provider>;
}

export function useDashboardSession(): DashboardSession | null {
  return useContext(DashboardSessionContext);
}

export function hasAnyRole(roles: string[] | undefined, requiredRoles: string[] = []): boolean {
  if (!requiredRoles.length) return true;
  const roleSet = new Set(roles ?? []);
  if (roleSet.has("System Manager") || roleSet.has("Administrator")) return true;
  return requiredRoles.some((role) => roleSet.has(role));
}

export function isGuestSession(session: DashboardSession | null | undefined): boolean {
  return !session || session.user === "Guest";
}

export function formatRoles(roles: string[] | undefined): string {
  const safe = (roles ?? []).filter(Boolean);
  return safe.length ? safe.slice(0, 4).join(" • ") : "No roles assigned";
}
