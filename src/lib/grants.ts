const GRANTS_KEY = "zoobalo_grants";
const USER_GRANTS_KEY = "zoobalo_user_grants";

export type Grant = {
  id: string;
  module: string;
  ownerTeamId: string;
  ownerTeamName: string;
  ownerDept: string;
  createdAt: string;
};

export type UserGrant = {
  id: string;
  module: string;
  ownerUserId: string;
  ownerUserName: string;
  ownerUserEmail: string;
  createdAt: string;
};

// Personal modules use user grants (user-to-user sharing with tabs)
export const PERSONAL_MODULE_KEYS = new Set([
  "tasks", "follow-ups", "imp-links", "courier", "mft", "sample",
] as const);

export const SHAREABLE_MODULES = [
  { key: "skus",          label: "SKU Management",    to: "/skus"          },
  { key: "artwork",       label: "Artwork",            to: "/artwork"       },
  { key: "tasks",         label: "Task Management",   to: "/tasks"         },
  { key: "follow-ups",    label: "Follow Up",          to: "/follow-ups"    },
  { key: "imp-links",     label: "IMP Links",          to: "/imp-links"     },
  { key: "mft",           label: "MFT",                to: "/mft"           },
  { key: "courier",       label: "Courier",            to: "/courier"       },
  { key: "sku-activity",  label: "SKU Activity",       to: "/sku-activity"  },
  { key: "npd",           label: "New Product Development", to: "/npd"      },
  { key: "sample",        label: "Sample",             to: "/sample"        },
  { key: "directory",     label: "Directory",          to: "/directory"     },
  { key: "vendors",       label: "Vendors",            to: "/vendors"       },
  { key: "manufacturers", label: "Manufacturers",      to: "/manufacturers" },
] as const;

// Team modules = shareable via team grants (sidebar links)
export const TEAM_SHAREABLE_MODULES = SHAREABLE_MODULES.filter(
  (m) => !PERSONAL_MODULE_KEYS.has(m.key as any),
);

// Personal modules = shareable via user grants (tabs in the module page)
export const PERSONAL_SHAREABLE_MODULES = SHAREABLE_MODULES.filter(
  (m) => PERSONAL_MODULE_KEYS.has(m.key as any),
);

// ── Team grants ───────────────────────────────────────────────────────────────

export function getGrants(): Grant[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(GRANTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGrants(grants: Grant[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GRANTS_KEY, JSON.stringify(grants));
}

export function clearGrants() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GRANTS_KEY);
}

/** Returns the owner's teamId if the user has a team grant for this module. */
export function getGrantTeamId(module: string): string | null {
  const grant = getGrants().find((g) => g.module === module);
  return grant?.ownerTeamId ?? null;
}

// ── User grants ───────────────────────────────────────────────────────────────

export function getUserGrants(): UserGrant[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_GRANTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserGrants(grants: UserGrant[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_GRANTS_KEY, JSON.stringify(grants));
}

export function clearUserGrants() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_GRANTS_KEY);
}

/** Returns user grants for a specific personal module. */
export function getModuleUserGrants(module: string): UserGrant[] {
  return getUserGrants().filter((g) => g.module === module);
}
