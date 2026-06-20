import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { sharesApi, type ApiShare, type ApiUserShare, type ApiShareableUser } from "@/lib/api";
import { TEAM_SHAREABLE_MODULES, PERSONAL_SHAREABLE_MODULES } from "@/lib/grants";
import { isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Share2, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sharing/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const admin = isAdmin();
    const [teamShares, personalShares, allUsers, otherTeamUsers] = await Promise.all([
      admin ? sharesApi.listMine() : Promise.resolve([]),
      sharesApi.listMyUserShares(),
      sharesApi.allUsers(),
      admin ? sharesApi.availableUsers() : Promise.resolve([]),
    ]);
    return { teamShares, personalShares, allUsers, otherTeamUsers, admin };
  },
  pendingComponent: PageSkeleton,
  component: SharingPage,
  head: () => ({ meta: [{ title: "Sharing — Zoobalo" }] }),
});

const TEAM_MODULE_LABEL = Object.fromEntries(TEAM_SHAREABLE_MODULES.map((m) => [m.key, m.label]));
const PERSONAL_MODULE_LABEL = Object.fromEntries(PERSONAL_SHAREABLE_MODULES.map((m) => [m.key, m.label]));

function SharingPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return (
    <SharingContent
      initialTeamShares={data.teamShares}
      initialPersonalShares={data.personalShares}
      allUsers={data.allUsers}
      otherTeamUsers={data.otherTeamUsers}
      admin={data.admin}
    />
  );
}

function SharingContent({
  initialTeamShares,
  initialPersonalShares,
  allUsers,
  otherTeamUsers,
  admin,
}: {
  initialTeamShares: ApiShare[];
  initialPersonalShares: ApiUserShare[];
  allUsers: ApiShareableUser[];
  otherTeamUsers: ApiShareableUser[];
  admin: boolean;
}) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [teamShares, setTeamShares] = useState(initialTeamShares);
  const [personalShares, setPersonalShares] = useState(initialPersonalShares);

  // ── Personal share sheet ──────────────────────────────────────────────────
  const [personalSheetOpen, setPersonalSheetOpen] = useState(false);
  const [personalSelectedModules, setPersonalSelectedModules] = useState<Set<string>>(new Set());
  const [personalSelectedUserId, setPersonalSelectedUserId] = useState("");
  const [personalUserSearch, setPersonalUserSearch] = useState("");
  const [personalSaving, setPersonalSaving] = useState(false);

  // ── Team share sheet ──────────────────────────────────────────────────────
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [teamSelectedModules, setTeamSelectedModules] = useState<Set<string>>(new Set());
  const [teamSelectedUserId, setTeamSelectedUserId] = useState("");
  const [teamUserSearch, setTeamUserSearch] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);

  const filteredPersonalUsers = useMemo(
    () => allUsers.filter((u) =>
      u.name.toLowerCase().includes(personalUserSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(personalUserSearch.toLowerCase())
    ),
    [allUsers, personalUserSearch],
  );

  const filteredTeamUsers = useMemo(
    () => otherTeamUsers.filter((u) =>
      u.name.toLowerCase().includes(teamUserSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(teamUserSearch.toLowerCase())
    ),
    [otherTeamUsers, teamUserSearch],
  );

  const openPersonalAdd = () => {
    setPersonalSelectedModules(new Set());
    setPersonalSelectedUserId("");
    setPersonalUserSearch("");
    setPersonalSheetOpen(true);
  };

  const openTeamAdd = () => {
    setTeamSelectedModules(new Set());
    setTeamSelectedUserId("");
    setTeamUserSearch("");
    setTeamSheetOpen(true);
  };

  const savePersonal = async () => {
    if (personalSelectedModules.size === 0) { toast.error("Select at least one module"); return; }
    if (!personalSelectedUserId) { toast.error("Select a person"); return; }
    setPersonalSaving(true);
    try {
      const results = await Promise.all(
        [...personalSelectedModules].map((mod) => sharesApi.createUserGrant(mod, personalSelectedUserId))
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
      setPersonalSheetOpen(false);
      await reload();
    } catch {
      toast.error("Failed to create shares");
    } finally {
      setPersonalSaving(false);
    }
  };

  const saveTeam = async () => {
    if (teamSelectedModules.size === 0) { toast.error("Select at least one module"); return; }
    if (!teamSelectedUserId) { toast.error("Select a person"); return; }
    setTeamSaving(true);
    try {
      const results = await Promise.all(
        [...teamSelectedModules].map((mod) => sharesApi.create(mod, teamSelectedUserId))
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
      setTeamSheetOpen(false);
      await reload();
    } catch {
      toast.error("Failed to create shares");
    } finally {
      setTeamSaving(false);
    }
  };

  const revokePersonal = async (id: string) => {
    if (!confirm("Revoke this share? The person will lose access immediately.")) return;
    try {
      await sharesApi.deleteUserGrant(id);
      setPersonalShares((prev) => prev.filter((s) => s.id !== id));
      toast.success("Share revoked");
    } catch {
      toast.error("Failed to revoke");
    }
  };

  const revokeTeam = async (id: string) => {
    if (!confirm("Revoke this share? The user will lose access immediately.")) return;
    try {
      await sharesApi.delete(id);
      setTeamShares((prev) => prev.filter((s) => s.id !== id));
      toast.success("Share revoked");
    } catch {
      toast.error("Failed to revoke");
    }
  };

  const personalByModule = personalShares.reduce<Record<string, ApiUserShare[]>>((acc, s) => {
    (acc[s.module] ??= []).push(s);
    return acc;
  }, {});

  const teamByModule = teamShares.reduce<Record<string, ApiShare[]>>((acc, s) => {
    (acc[s.module] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sharing"
        description="Share your modules with teammates"
      />

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">My Personal Modules</TabsTrigger>
          {admin && <TabsTrigger value="team">Team Modules</TabsTrigger>}
        </TabsList>

        {/* ── Personal tab ────────────────────────────────────────────────── */}
        <TabsContent value="personal" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Share your Tasks, Follow Up, IMP Links, Courier, MFT, and Sample data with specific people.
              They'll see a "Shared by you" tab in those sections.
            </p>
            <Button onClick={openPersonalAdd} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Share
            </Button>
          </div>

          {personalShares.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
              <Share2 className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No personal shares yet</p>
              <p className="mt-1 text-xs">Share your personal modules with teammates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(personalByModule).map(([module, shares]) => (
                <div key={module} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{PERSONAL_MODULE_LABEL[module] ?? module}</span>
                    <Badge variant="secondary" className="ml-auto">{shares.length} {shares.length === 1 ? "person" : "people"}</Badge>
                  </div>
                  <div className="divide-y">
                    {shares.map((share) => (
                      <div key={share.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{share.granteeName || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground truncate">{share.granteeEmail}</p>
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => revokePersonal(share.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Team tab (admin only) ────────────────────────────────────────── */}
        {admin && (
          <TabsContent value="team" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Grant users from other teams access to your team's modules.
                They'll see a link in their sidebar under "Shared with me".
              </p>
              <Button onClick={openTeamAdd} size="sm">
                <Plus className="mr-1 h-4 w-4" /> Share
              </Button>
            </div>

            {teamShares.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
                <Share2 className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No team shares yet</p>
                <p className="mt-1 text-xs">Share team modules with users from other departments.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(teamByModule).map(([module, shares]) => (
                  <div key={module} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{TEAM_MODULE_LABEL[module] ?? module}</span>
                      <Badge variant="secondary" className="ml-auto">{shares.length} {shares.length === 1 ? "person" : "people"}</Badge>
                    </div>
                    <div className="divide-y">
                      {shares.map((share) => (
                        <div key={share.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{share.granteeName || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate">{share.granteeEmail}</p>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => revokeTeam(share.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ── Personal Share Sheet ──────────────────────────────────────────── */}
      <Sheet open={personalSheetOpen} onOpenChange={setPersonalSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Share Personal Modules</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Modules</Label>
                {personalSelectedModules.size > 0 && (
                  <span className="text-xs text-muted-foreground">{personalSelectedModules.size} selected</span>
                )}
              </div>
              <div className="rounded-md border bg-background max-h-48 overflow-y-auto divide-y">
                {PERSONAL_SHAREABLE_MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                    <Checkbox
                      checked={personalSelectedModules.has(m.key)}
                      onCheckedChange={() => setPersonalSelectedModules((prev) => {
                        const next = new Set(prev);
                        next.has(m.key) ? next.delete(m.key) : next.add(m.key);
                        return next;
                      })}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Person</Label>
              <Input
                placeholder="Search by name or email…"
                value={personalUserSearch}
                onChange={(e) => setPersonalUserSearch(e.target.value)}
              />
              <div className="mt-1 max-h-44 overflow-y-auto rounded-md border bg-background">
                {filteredPersonalUsers.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No users found.</p>
                )}
                {filteredPersonalUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setPersonalSelectedUserId(u.id); setPersonalUserSearch(u.name); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${personalSelectedUserId === u.id ? "bg-accent" : ""}`}
                  >
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email} · {u.teamName}</div>
                  </button>
                ))}
              </div>
            </div>
            {personalSelectedUserId && personalSelectedModules.size > 0 && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <strong>{allUsers.find((u) => u.id === personalSelectedUserId)?.name}</strong> will see your data as a tab in:
                <ul className="mt-1 list-disc list-inside space-y-0.5">
                  {[...personalSelectedModules].map((key) => (
                    <li key={key}>{PERSONAL_MODULE_LABEL[key] ?? key}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setPersonalSheetOpen(false)}>Cancel</Button>
            <Button onClick={savePersonal} disabled={personalSaving || personalSelectedModules.size === 0 || !personalSelectedUserId}>
              {personalSaving ? "Sharing…" : `Share${personalSelectedModules.size > 1 ? ` (${personalSelectedModules.size})` : ""}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Team Share Sheet ──────────────────────────────────────────────── */}
      <Sheet open={teamSheetOpen} onOpenChange={setTeamSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Share Team Modules</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Modules</Label>
                {teamSelectedModules.size > 0 && (
                  <span className="text-xs text-muted-foreground">{teamSelectedModules.size} selected</span>
                )}
              </div>
              <div className="rounded-md border bg-background max-h-48 overflow-y-auto divide-y">
                {TEAM_SHAREABLE_MODULES.map((m) => (
                  <label key={m.key} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                    <Checkbox
                      checked={teamSelectedModules.has(m.key)}
                      onCheckedChange={() => setTeamSelectedModules((prev) => {
                        const next = new Set(prev);
                        next.has(m.key) ? next.delete(m.key) : next.add(m.key);
                        return next;
                      })}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Person (other teams only)</Label>
              <Input
                placeholder="Search by name or email…"
                value={teamUserSearch}
                onChange={(e) => setTeamUserSearch(e.target.value)}
              />
              <div className="mt-1 max-h-44 overflow-y-auto rounded-md border bg-background">
                {filteredTeamUsers.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">No users from other teams found.</p>
                )}
                {filteredTeamUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setTeamSelectedUserId(u.id); setTeamUserSearch(u.name); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${teamSelectedUserId === u.id ? "bg-accent" : ""}`}
                  >
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email} · {u.teamName}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setTeamSheetOpen(false)}>Cancel</Button>
            <Button onClick={saveTeam} disabled={teamSaving || teamSelectedModules.size === 0 || !teamSelectedUserId}>
              {teamSaving ? "Sharing…" : `Share${teamSelectedModules.size > 1 ? ` (${teamSelectedModules.size})` : ""}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
