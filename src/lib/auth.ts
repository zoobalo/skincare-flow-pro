const TOKEN_KEY = "zoobalo_token";
const USER_KEY  = "zoobalo_user";

const isBrowser = typeof window !== "undefined";

export type AuthUser = { id: string; name: string; email: string; role: "Admin" | "Manager"; department?: string };

export function getToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSession(token: string, user: AuthUser) {
  if (!isBrowser) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (!isBrowser) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("zoobalo_grants");
}

export function isAdmin(): boolean {
  return getUser()?.role === "Admin";
}

export function getHomeRoute(user?: AuthUser | null): string {
  const u = user ?? getUser();
  if (!u || u.role === "Admin" || u.department === "skincare") return "/dashboard";
  return "/tasks";
}
