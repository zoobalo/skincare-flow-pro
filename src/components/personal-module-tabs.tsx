import { useState, useEffect, useMemo } from "react";
import { getModuleUserGrants, type UserGrant } from "@/lib/grants";
import { cn } from "@/lib/utils";

interface PersonalModuleTabsProps {
  module: string;
  activeSharedUserId: string | undefined;
  onChange: (sharedUserId: string | undefined) => void;
}

export function PersonalModuleTabs({ module, activeSharedUserId, onChange }: PersonalModuleTabsProps) {
  const [grants, setGrants] = useState<UserGrant[]>([]);

  useEffect(() => {
    setGrants(getModuleUserGrants(module));
  }, [module]);

  if (grants.length === 0) return null;

  return (
    <div className="flex gap-1 border-b px-6 mb-0 overflow-x-auto shrink-0">
      <button
        onClick={() => onChange(undefined)}
        className={cn(
          "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
          !activeSharedUserId
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        My Data
      </button>
      {grants.map((g) => (
        <button
          key={g.id}
          onClick={() => onChange(g.ownerUserId)}
          className={cn(
            "shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            activeSharedUserId === g.ownerUserId
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Shared by {g.ownerUserName || "Someone"}
        </button>
      ))}
    </div>
  );
}
