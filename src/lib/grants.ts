const GRANTS_KEY = "zoobalo_grants";

export type Grant = {
  id: string;
  module: string;
  ownerTeamId: string;
  ownerTeamName: string;
  ownerDept: string;
  createdAt: string;
};

export const SHAREABLE_MODULES = [
  { key: "skus",          label: "SKU Management",    to: "/skus"          },
  { key: "artwork",       label: "Artwork",            to: "/artwork"       },
  { key: "tasks",         label: "Task Management",   to: "/tasks"         },
  { key: "follow-ups",    label: "Follow Up",          to: "/follow-ups"    },
  { key: "imp-links",     label: "IMP Links",          to: "/imp-links"     },
  { key: "mft",           label: "MFT",                to: "/mft"           },
  { key: "courier",       label: "Courier",            to: "/courier"       },
  { key: "sku-activity",  label: "SKU Activity",       to: "/sku-activity"  },
  { key: "sample",        label: "Sample",             to: "/sample"        },
  { key: "directory",     label: "Directory",          to: "/directory"     },
  { key: "vendors",       label: "Vendors",            to: "/vendors"       },
  { key: "manufacturers", label: "Manufacturers",      to: "/manufacturers" },
] as const;

export function getGrants(): Grant[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GRANTS_KEY) ?? "[]");
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

/** Returns the owner's teamId if the user has a grant for this module. */
export function getGrantTeamId(module: string): string | null {
  const grant = getGrants().find((g) => g.module === module);
  return grant?.ownerTeamId ?? null;
}
