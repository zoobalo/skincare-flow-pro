import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, assignedTasksApi, type ApiTask, type ApiSku, type ApiAssignedTask, type ApiAssignableUser, type ApiAssignedTaskComment } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Search, UserPlus, CheckCircle2, Clock, User, MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { PersonalModuleTabs } from "@/components/personal-module-tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/tasks/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [tasks, skus, assignedToMe, assignedByMe, allUsers] = await Promise.all([
      api.tasks.list(),
      api.skus.list(),
      assignedTasksApi.listForMe(),
      assignedTasksApi.listByMe(),
      assignedTasksApi.listUsers(),
    ]);
    return { tasks, skus, assignedToMe, assignedByMe, allUsers };
  },
  pendingComponent: PageSkeleton,
  component: TasksPage,
  head: () => ({ meta: [{ title: "Task Management — Zoobalo" }] }),
});

const STATUSES: ApiTask["status"][]     = ["None", "Initiated", "Done"];
const URGENCIES: ApiTask["urgency"][]   = ["Low", "Medium", "High", "Very High"];
const PRODUCT_TYPES: ApiTask["productType"][] = ["None", "Packaging Material", "Raw Material"];

const STATUS_STYLE: Record<ApiTask["status"], string> = {
  None:      "bg-muted text-muted-foreground",
  Initiated: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Done:      "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
};

const URGENCY_STYLE: Record<ApiTask["urgency"], string> = {
  Low:        "bg-muted text-muted-foreground",
  Medium:     "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  High:       "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  "Very High":"bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const EMPTY: Omit<ApiTask, "id" | "createdAt" | "updatedAt"> = {
  title: "", comments: "", status: "None", urgency: "Medium",
  skuId: null, productType: "None", deadlineDate: null,
};

const DEPT_LABELS: Record<string, string> = {
  skincare: "Procurement & Ops", sales: "Sales", marketing: "Marketing",
  creative: "Creative", hr: "HR", finance: "Finance", logistics: "Logistics", d2c: "D2C",
};

function TasksPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return (
    <TasksContent
      tasks={loaderData.tasks}
      skus={loaderData.skus}
      initialAssignedToMe={loaderData.assignedToMe}
      initialAssignedByMe={loaderData.assignedByMe}
      allUsers={loaderData.allUsers}
    />
  );
}

function TasksContent({
  tasks, skus, initialAssignedToMe, initialAssignedByMe, allUsers,
}: {
  tasks: Awaited<ReturnType<typeof api.tasks.list>>;
  skus: Awaited<ReturnType<typeof api.skus.list>>;
  initialAssignedToMe: ApiAssignedTask[];
  initialAssignedByMe: ApiAssignedTask[];
  allUsers: ApiAssignableUser[];
}) {
  const router = useRouter();
  const currentUser = getUser();

  // ── My tasks state ──────────────────────────────────────────────────────────
  const [sharedUserId, setSharedUserId] = useState<string | undefined>(undefined);
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);
  useEffect(() => {
    if (sharedUserId === undefined) { setLocalTasks(tasks); return; }
    api.tasks.list(sharedUserId).then(setLocalTasks).catch(() => {});
  }, [sharedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => {
    if (sharedUserId) api.tasks.list(sharedUserId).then(setLocalTasks).catch(() => {});
    else router.invalidate();
  };

  // ── Assigned tasks state ────────────────────────────────────────────────────
  const [assignedToMe, setAssignedToMe]   = useState(initialAssignedToMe);
  const [assignedByMe, setAssignedByMe]   = useState(initialAssignedByMe);

  const reloadAssigned = async () => {
    const [toMe, byMe] = await Promise.all([assignedTasksApi.listForMe(), assignedTasksApi.listByMe()]);
    setAssignedToMe(toMe);
    setAssignedByMe(byMe);
  };

  // ── My tasks sheet / form ──────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<ApiTask | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY, skuId: "" as string | null, deadlineDate: "" as string | null });

  const [search, setSearch]         = useState("");
  const [filterSku, setFilterSku]   = useState("__all__");
  const [filterType, setFilterType] = useState("__all__");
  const [sortBy, setSortBy]         = useState("urgency");

  const setF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const openCreate = () => { setForm({ ...EMPTY, skuId: null, deadlineDate: "" }); setEditTarget(null); setSheetOpen(true); };
  const openEdit   = (t: ApiTask) => {
    setForm({ title: t.title, comments: t.comments, status: t.status, urgency: t.urgency, skuId: t.skuId ?? null, productType: t.productType, deadlineDate: t.deadlineDate ?? "" });
    setEditTarget(t); setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Task title is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, skuId: form.skuId || null, deadlineDate: form.deadlineDate || null };
      if (editTarget) { await api.tasks.update(editTarget.id, payload); toast.success("Task updated."); }
      else { await api.tasks.create(payload, sharedUserId); toast.success("Task added."); }
      setSheetOpen(false);
      await reload();
    } catch { toast.error("Failed to save task."); } finally { setSaving(false); }
  };

  const handleDelete = async (t: ApiTask) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await api.tasks.delete(t.id); toast.success("Task deleted."); reload(); }
    catch { toast.error("Failed to delete task."); }
  };

  const updateStatusOptimistic = async (taskId: string, newStatus: ApiTask["status"]) => {
    const prev = localTasks.find((t) => t.id === taskId);
    setLocalTasks((ts) => ts.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try { await api.tasks.update(taskId, { status: newStatus }); }
    catch {
      if (prev) setLocalTasks((ts) => ts.map((t) => t.id === taskId ? prev : t));
      toast.error("Failed to update status.");
    }
  };

  // ── Assign task sheet ───────────────────────────────────────────────────────
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignSaving, setAssignSaving]       = useState(false);
  const [assignForm, setAssignForm] = useState({
    assignedTo: "", title: "", comments: "",
    urgency: "Medium" as ApiAssignedTask["urgency"],
    deadlineDate: "",
  });

  const openAssign = () => {
    setAssignForm({ assignedTo: "", title: "", comments: "", urgency: "Medium", deadlineDate: "" });
    setAssignSheetOpen(true);
  };

  const handleAssign = async () => {
    if (!assignForm.assignedTo) { toast.error("Please select who to assign to."); return; }
    if (!assignForm.title.trim()) { toast.error("Task title is required."); return; }
    setAssignSaving(true);
    try {
      const created = await assignedTasksApi.create({
        title:        assignForm.title.trim(),
        comments:     assignForm.comments,
        urgency:      assignForm.urgency,
        deadlineDate: assignForm.deadlineDate || null,
        assignedTo:   assignForm.assignedTo,
      });
      if (created.error) { toast.error(created.error); return; }
      setAssignSheetOpen(false);
      toast.success("Task assigned.");
      await reloadAssigned();
    } catch { toast.error("Failed to assign task."); } finally { setAssignSaving(false); }
  };

  // ── Assigned tasks status toggle ────────────────────────────────────────────
  const toggleAssignedStatus = async (task: ApiAssignedTask) => {
    const next = task.status === "Pending" ? "Done" : "Pending";
    // Optimistic update
    setAssignedToMe((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    try { await assignedTasksApi.updateStatus(task.id, next); }
    catch {
      setAssignedToMe((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
      toast.error("Failed to update.");
    }
  };

  const deleteAssigned = async (task: ApiAssignedTask) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      const res = await assignedTasksApi.delete(task.id);
      if (res.error) { toast.error(res.error); return; }
      setAssignedByMe((prev) => prev.filter((t) => t.id !== task.id));
      setAssignedToMe((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Deleted.");
    } catch { toast.error("Failed to delete."); }
  };

  // ── Filter / sort for my tasks ─────────────────────────────────────────────
  const skuMap = Object.fromEntries(skus.map((s: ApiSku) => [s.id, s]));
  const URGENCY_ORDER: Record<ApiTask["urgency"], number> = { "Very High": 0, High: 1, Medium: 2, Low: 3 };

  const sortFn = (a: ApiTask, b: ApiTask) => {
    if (sortBy === "deadline_asc") {
      if (!a.deadlineDate && !b.deadlineDate) return 0;
      if (!a.deadlineDate) return 1; if (!b.deadlineDate) return -1;
      return a.deadlineDate.localeCompare(b.deadlineDate);
    }
    if (sortBy === "deadline_desc") {
      if (!a.deadlineDate && !b.deadlineDate) return 0;
      if (!a.deadlineDate) return 1; if (!b.deadlineDate) return -1;
      return b.deadlineDate.localeCompare(a.deadlineDate);
    }
    return URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
  };

  const filtered = localTasks.filter((t) => {
    if (filterSku  !== "__all__" && t.skuId !== filterSku)        return false;
    if (filterType !== "__all__" && t.productType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const sku = t.skuId ? skuMap[t.skuId] : null;
      if (!t.title.toLowerCase().includes(q) && !(t.comments ?? "").toLowerCase().includes(q) && !(sku?.name ?? "").toLowerCase().includes(q) && !(sku?.code ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pending   = filtered.filter((t) => t.status !== "Done").sort(sortFn);
  const completed = filtered.filter((t) => t.status === "Done").sort(sortFn);

  // ── Assigned tab data ────────────────────────────────────────────────────────
  const assignedPending   = assignedToMe.filter((t) => t.status === "Pending");
  const assignedCompleted = assignedToMe.filter((t) => t.status === "Done");
  const pendingAssignedCount = assignedPending.length;

  // ── Assigned by me tab data ──────────────────────────────────────────────────
  const assignedByMePending   = assignedByMe.filter((t) => t.status === "Pending");
  const assignedByMeCompleted = assignedByMe.filter((t) => t.status === "Done");
  const pendingAssignedByMeCount = assignedByMePending.length;

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      <PersonalModuleTabs module="tasks" activeSharedUserId={sharedUserId} onChange={setSharedUserId} />
      <PageHeader
        title="Task Management"
        description={`${localTasks.length} task${localTasks.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={openAssign}>
              <UserPlus className="mr-1.5 h-4 w-4" />Assign Task
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />New Task
            </Button>
          </div>
        }
      />

      {/* Top-level tabs: My Tasks | Assigned to me | Assigned by me */}
      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my">My Tasks</TabsTrigger>
          <TabsTrigger value="assigned" className="relative">
            Assigned to me
            {pendingAssignedCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {pendingAssignedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="assigned-by-me" className="relative">
            Assigned by me
            {pendingAssignedByMeCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {pendingAssignedByMeCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── My Tasks ── */}
        <TabsContent value="my" className="mt-4 space-y-4">
          {/* Filter + sort bar */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 w-52" />
            </div>
            <Select value={filterSku} onValueChange={setFilterSku}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Filter by SKU" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All SKUs</SelectItem>
                {skus.map((s: ApiSku) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Filter by type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urgency">Sort: Urgency (default)</SelectItem>
                <SelectItem value="deadline_asc">Sort: Deadline ↑ earliest</SelectItem>
                <SelectItem value="deadline_desc">Sort: Deadline ↓ latest</SelectItem>
              </SelectContent>
            </Select>
            {(filterSku !== "__all__" || filterType !== "__all__" || search) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterSku("__all__"); setFilterType("__all__"); setSearch(""); }}>
                Clear filters
              </Button>
            )}
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            </TabsList>
            {([
              { value: "pending", items: pending, done: false, emptyMsg: "No pending tasks." },
              { value: "completed", items: completed, done: true, emptyMsg: "No completed tasks yet." },
            ] as const).map(({ value, items, done, emptyMsg }) => (
              <TabsContent key={value} value={value} className="mt-4">
                {items.length === 0 ? (
                  <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">{emptyMsg}</div>
                ) : (
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr_auto] gap-x-4 bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <div>Task</div><div>SKU / Type</div><div>Status</div>
                      <div>Urgency</div><div>Deadline</div><div>Comments</div><div></div>
                    </div>
                    <div className="divide-y">
                      {items.map((t) => {
                        const sku = t.skuId ? skuMap[t.skuId] : null;
                        return (
                          <div key={t.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr_auto] gap-x-4 items-start px-4 py-3 text-sm hover:bg-muted/20 transition-colors ${done ? "opacity-60" : ""}`}>
                            <div className={`font-medium leading-snug ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                            <div className="text-xs space-y-0.5">
                              {sku ? <div className="font-medium text-primary">{sku.code}</div> : <div className="text-muted-foreground">—</div>}
                              {t.productType !== "None" && <div className="text-muted-foreground">{t.productType}</div>}
                            </div>
                            <div>
                              <Select value={t.status} onValueChange={(v) => updateStatusOptimistic(t.id, v as ApiTask["status"])}>
                                <SelectTrigger className={`h-6 w-auto gap-1 rounded-full border-0 px-2.5 py-0 text-xs font-medium shadow-none focus:ring-0 ${STATUS_STYLE[t.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[t.urgency]}`}>{t.urgency}</span></div>
                            <div className={`text-xs ${t.deadlineDate && new Date(t.deadlineDate) < new Date() && !done ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                              {fmtDate(t.deadlineDate)}
                            </div>
                            <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t.comments || "—"}</div>
                            <div className="flex items-center gap-0.5">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ── Assigned to me ── */}
        <TabsContent value="assigned" className="mt-4">
          <Tabs defaultValue="a-pending">
            <TabsList>
              <TabsTrigger value="a-pending">
                Pending
                {assignedPending.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {assignedPending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="a-completed">Completed ({assignedCompleted.length})</TabsTrigger>
            </TabsList>

            {([
              { value: "a-pending",   items: assignedPending,   done: false },
              { value: "a-completed", items: assignedCompleted, done: true  },
            ] as const).map(({ value, items, done }) => (
              <TabsContent key={value} value={value} className="mt-4">
                {items.length === 0 ? (
                  <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
                    {done ? "No completed assigned tasks yet." : "No tasks assigned to you."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((t) => (
                      <AssignedTaskCard
                        key={t.id}
                        task={t}
                        done={done}
                        currentUserId={currentUser?.id}
                        onToggleStatus={toggleAssignedStatus}
                        onDelete={deleteAssigned}
                        fmtDateTime={fmtDateTime}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ── Assigned by me ── */}
        <TabsContent value="assigned-by-me" className="mt-4">
          <Tabs defaultValue="byme-pending">
            <TabsList>
              <TabsTrigger value="byme-pending">
                Pending
                {assignedByMePending.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {assignedByMePending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="byme-completed">Completed ({assignedByMeCompleted.length})</TabsTrigger>
            </TabsList>

            {([
              { value: "byme-pending",   items: assignedByMePending,   done: false, emptyMsg: "No pending tasks assigned by you." },
              { value: "byme-completed", items: assignedByMeCompleted, done: true,  emptyMsg: "No completed tasks yet." },
            ] as const).map(({ value, items, done, emptyMsg }) => (
              <TabsContent key={value} value={value} className="mt-4">
                {items.length === 0 ? (
                  <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">{emptyMsg}</div>
                ) : (
                  <div className="space-y-3">
                    {items.map((t) => (
                      <AssignedTaskCard
                        key={t.id}
                        task={t}
                        done={done}
                        currentUserId={currentUser?.id}
                        onToggleStatus={toggleAssignedStatus}
                        onDelete={deleteAssigned}
                        fmtDateTime={fmtDateTime}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* ── My Task Create / Edit Sheet ── */}
      <Sheet key={editTarget?.id ?? "new"} open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{editTarget ? "Edit Task" : "New Task"}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Task *</Label>
              <Input placeholder="e.g. Follow up with vendor on PO delay" value={form.title} onChange={setF("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ApiTask["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm((f) => ({ ...f, urgency: v as ApiTask["urgency"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{URGENCIES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Deadline Date</Label>
              <Input type="date" value={form.deadlineDate ?? ""} onChange={setF("deadlineDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Select value={form.skuId ?? "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, skuId: v === "__none__" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {skus.map((s: ApiSku) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Product Type</Label>
              <Select value={form.productType} onValueChange={(v) => setForm((f) => ({ ...f, productType: v as ApiTask["productType"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCT_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Comments</Label>
              <Textarea rows={4} placeholder="Any notes or context…" value={form.comments} onChange={setF("comments")} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : (editTarget ? "Save changes" : "Add Task")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Assign Task Sheet ── */}
      <Sheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Assign Task</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Assign To <span className="text-destructive">*</span></Label>
              <Select value={assignForm.assignedTo} onValueChange={(v) => setAssignForm((f) => ({ ...f, assignedTo: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person…" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u) => u.id !== currentUser?.id)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.department && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            · {DEPT_LABELS[u.department] ?? u.department}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Task Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="What needs to be done?"
                value={assignForm.title}
                onChange={(e) => setAssignForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Urgency</Label>
                <Select value={assignForm.urgency} onValueChange={(v) => setAssignForm((f) => ({ ...f, urgency: v as ApiAssignedTask["urgency"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{URGENCIES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={assignForm.deadlineDate} onChange={(e) => setAssignForm((f) => ({ ...f, deadlineDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes / Context</Label>
              <Textarea
                rows={4}
                placeholder="Any context or instructions for this task…"
                value={assignForm.comments}
                onChange={(e) => setAssignForm((f) => ({ ...f, comments: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setAssignSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={assignSaving}>
              {assignSaving ? "Assigning…" : "Assign Task"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Assigned Task Card (with per-card comment state) ─────────────────────────

function AssignedTaskCard({
  task, done, currentUserId, onToggleStatus, onDelete, fmtDateTime,
}: {
  task: ApiAssignedTask;
  done: boolean;
  currentUserId: string | undefined;
  onToggleStatus: (t: ApiAssignedTask) => void;
  onDelete: (t: ApiAssignedTask) => void;
  fmtDateTime: (iso: string) => string;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments]         = useState<ApiAssignedTaskComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment]     = useState("");
  const [sending, setSending]           = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = async () => {
    if (commentsLoaded) return;
    setLoadingComments(true);
    try {
      const data = await assignedTasksApi.listComments(task.id);
      setComments(Array.isArray(data) ? data : []);
      setCommentsLoaded(true);
    } catch { /* silently fail */ } finally { setLoadingComments(false); }
  };

  const toggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) loadComments();
  };

  const sendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const created = await assignedTasksApi.addComment(task.id, newComment.trim());
      if (created?.id) {
        setComments((prev) => [...prev, created as ApiAssignedTaskComment]);
        setNewComment("");
      } else {
        toast.error(created?.error ?? "Failed to send comment.");
      }
    } catch { toast.error("Failed to send comment."); } finally { setSending(false); }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await assignedTasksApi.deleteComment(task.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { toast.error("Failed to delete comment."); }
  };

  return (
    <div className={cn("rounded-xl border bg-card transition-colors", done && "opacity-70")}>
      <div className="group p-4">
        <div className="flex items-start gap-3">
          {/* Mark done / undo button (only assignee can toggle) */}
          {task.assignedTo === currentUserId && (
            <button
              type="button"
              onClick={() => onToggleStatus(task)}
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                done
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-muted-foreground/30 hover:border-primary"
              )}
              title={done ? "Mark as pending" : "Mark as done"}
            >
              {done && <CheckCircle2 className="h-3.5 w-3.5" />}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className={cn("font-medium text-sm leading-snug", done && "line-through text-muted-foreground")}>
              {task.title}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className={cn("inline-flex rounded-full px-2 py-0.5 font-medium", URGENCY_STYLE[task.urgency])}>{task.urgency}</span>
              <span className={cn(
                "inline-flex rounded-full px-2 py-0.5 font-medium",
                done
                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {done ? "Done" : "Pending"}
              </span>
              {task.deadlineDate && (
                <span className={cn(
                  "flex items-center gap-1",
                  !done && new Date(task.deadlineDate) < new Date() && "font-semibold text-destructive"
                )}>
                  <Clock className="h-3 w-3" />
                  {fmtDate(task.deadlineDate)}
                </span>
              )}
              {task.comments && <span className="italic line-clamp-1 max-w-xs">{task.comments}</span>}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Assigned by <span className="font-medium text-foreground">{task.assignedByName}</span></span>
              </span>
              {task.assignedTo !== currentUserId && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  → <span className="font-medium text-foreground">{task.assignedToName}</span>
                </span>
              )}
              <span className="text-muted-foreground/70">{fmtDateTime(task.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Comments toggle */}
            <button
              type="button"
              onClick={toggleComments}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {comments.length > 0 && <span>{comments.length}</span>}
              {commentsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* Delete (assigner only) */}
            {task.assignedBy === currentUserId && (
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Comments panel */}
      {commentsOpen && (
        <div className="border-t bg-muted/20 px-4 pb-4 pt-3">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground py-2">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No comments yet. Be the first to add one.</p>
          ) : (
            <div className="space-y-3 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="group/comment flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                  {c.authorId === currentUserId && (
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover/comment:opacity-100 transition-opacity shrink-0 mt-0.5 text-muted-foreground hover:text-destructive"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New comment input */}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={inputRef}
              rows={1}
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }
              }}
              className="min-h-0 resize-none text-xs py-2"
            />
            <Button
              size="sm"
              onClick={sendComment}
              disabled={sending || !newComment.trim()}
              className="shrink-0 h-8 w-8 p-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
