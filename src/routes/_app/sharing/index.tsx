import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { sharesApi, type ApiShare, type ApiShareableUser } from "@/lib/api";
import { SHAREABLE_MODULES } from "@/lib/grants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Share2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sharing/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [shares, availableUsers] = await Promise.all([
      sharesApi.listMine(),
      sharesApi.availableUsers(),
    ]);
    return { shares, availableUsers };
  },
  pendingComponent: PageSkeleton,
  component: SharingPage,
  head: () => ({ meta: [{ title: "Sharing — Zoobalo" }] }),
});

const MODULE_LABEL = Object.fromEntries(SHAREABLE_MODULES.map((m) => [m.key, m.label]));

function SharingPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <SharingContent initialShares={data.shares} availableUsers={data.availableUsers} />;
}

function SharingContent({
  initialShares,
  availableUsers,
}: {
  initialShares: ApiShare[];
  availableUsers: ApiShareableUser[];
}) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [shares, setShares] = useState(initialShares);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleModule = (key: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()),
  );

  const openAdd = () => {
    setSelectedModules(new Set());
    setSelectedUserId("");
    setUserSearch("");
    setSheetOpen(true);
  };

  const save = async () => {
    if (selectedModules.size === 0) { toast.error("Select at least one module"); return; }
    if (!selectedUserId) { toast.error("Select a user"); return; }
    setSaving(true);
    try {
      const results = await Promise.all(
        [...selectedModules].map((mod) => sharesApi.create(mod, selectedUserId))
      );
      const failed = results.filter((r) => r?.error);
      if (failed.length === results.length) {
        toast.error(failed[0]?.error ?? "Failed to create shares");
        return;
      }
      if (failed.length > 0) {
        toast.warning(`${results.length - failed.length} share(s) created; ${failed.length} already existed`);
      } else {
        toast.success(`${results.length} module${results.length > 1 ? "s" : ""} shared`);
      }
      setSheetOpen(false);
      await reload();
    } catch {
      toast.error("Failed to create shares");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this share? The user will lose access immediately.")) return;
    try {
      await sharesApi.delete(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      toast.success("Share revoked");
    } catch {
      toast.error("Failed to revoke");
    }
  };

  // Group shares by module
  const byModule = shares.reduce<Record<string, ApiShare[]>>((acc, s) => {
    (acc[s.module] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sharing"
        description="Grant specific users from other teams read/write access to your modules"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Share a module
          </Button>
        }
      />

      {shares.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <Share2 className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No shares yet</p>
          <p className="mt-1 text-xs">Share modules with users from other teams to collaborate.</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byModule).map(([module, moduleShares]) => (
          <div key={module} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{MODULE_LABEL[module] ?? module}</span>
              <Badge variant="secondary" className="ml-auto">{moduleShares.length} {moduleShares.length === 1 ? "person" : "people"}</Badge>
            </div>
            <div className="divide-y">
              {moduleShares.map((share) => (
                <div key={share.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{share.granteeName || "Unknown User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{share.granteeEmail}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => revoke(share.id)}
                    title="Revoke access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Share Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Share Modules</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            {/* Module checkboxes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Modules</Label>
                {selectedModules.size > 0 && (
                  <span className="text-xs text-muted-foreground">{selectedModules.size} selected</span>
                )}
              </div>
              <div className="rounded-md border bg-background max-h-52 overflow-y-auto divide-y">
                {SHAREABLE_MODULES.map((m) => (
                  <label
                    key={m.key}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={selectedModules.has(m.key)}
                      onCheckedChange={() => toggleModule(m.key)}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Person picker */}
            <div className="space-y-1.5">
              <Label>Person</Label>
              <Input
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <div className="mt-1 max-h-44 overflow-y-auto rounded-md border bg-background">
                {filteredUsers.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No users found from other teams.</p>
                )}
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUserId(u.id); setUserSearch(u.name); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${selectedUserId === u.id ? "bg-accent" : ""}`}
                  >
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email} · {u.teamName}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Confirmation preview */}
            {selectedUserId && selectedModules.size > 0 && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <strong>{availableUsers.find((u) => u.id === selectedUserId)?.name}</strong> will get read &amp; write access to:
                <ul className="mt-1 list-disc list-inside space-y-0.5">
                  {[...selectedModules].map((key) => (
                    <li key={key}>{MODULE_LABEL[key] ?? key}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || selectedModules.size === 0 || !selectedUserId}>
              {saving ? "Sharing…" : `Share${selectedModules.size > 1 ? ` (${selectedModules.size})` : ""}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
