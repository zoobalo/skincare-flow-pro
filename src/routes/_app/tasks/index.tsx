import { PageSkeleton } from "@/components/page-skeleton";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type ApiTask, type ApiSku } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PersonalModuleTabs } from "@/components/personal-module-tabs";

export const Route = createFileRoute("/_app/tasks/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const [tasks, skus] = await Promise.all([api.tasks.list(), api.skus.list()]);
    return { tasks, skus };
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

function TasksPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <PageSkeleton />;
  return <TasksContent tasks={loaderData.tasks} skus={loaderData.skus} />;
}

function TasksContent({ tasks, skus }: { tasks: Awaited<ReturnType<typeof api.tasks.list>>; skus: Awaited<ReturnType<typeof api.skus.list>> }) {
  const router = useRouter();
  const [sharedUserId, setSharedUserId] = useState<string | undefined>(undefined);

  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  // Re-fetch when switching tabs
  useEffect(() => {
    if (sharedUserId === undefined) { setLocalTasks(tasks); return; }
    api.tasks.list(sharedUserId).then(setLocalTasks).catch(() => {});
  }, [sharedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => {
    if (sharedUserId) {
      api.tasks.list(sharedUserId).then(setLocalTasks).catch(() => {});
    } else {
      router.invalidate();
    }
  };

  const updateStatusOptimistic = async (taskId: string, newStatus: ApiTask["status"]) => {
    const prev = localTasks.find((t) => t.id === taskId);
    setLocalTasks((ts) => ts.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.tasks.update(taskId, { status: newStatus });
    } catch {
      // Roll back
      if (prev) setLocalTasks((ts) => ts.map((t) => t.id === taskId ? prev : t));
      toast.error("Failed to update status.");
    }
  };

  const [sheetOpen, setSheetOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<ApiTask | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ ...EMPTY, skuId: "" as string | null, deadlineDate: "" as string | null });

  // Filters, search & sort
  const [search, setSearch]         = useState("");
  const [filterSku, setFilterSku]   = useState("__all__");
  const [filterType, setFilterType] = useState("__all__");
  const [sortBy, setSortBy]         = useState("urgency");

  const setF = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const openCreate = () => {
    setForm({ ...EMPTY, skuId: null, deadlineDate: "" });
    setEditTarget(null);
    setSheetOpen(true);
  };

  const openEdit = (t: ApiTask) => {
    setForm({ title: t.title, comments: t.comments, status: t.status, urgency: t.urgency, skuId: t.skuId ?? null, productType: t.productType, deadlineDate: t.deadlineDate ?? "" });
    setEditTarget(t);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Task title is required."); return; }
    setSaving(true);
    try {
      const payload = { ...form, skuId: form.skuId || null, deadlineDate: form.deadlineDate || null };
      if (editTarget) {
        await api.tasks.update(editTarget.id, payload);
        toast.success("Task updated.");
      } else {
        await api.tasks.create(payload, sharedUserId);
        toast.success("Task added.");
      }
      setSheetOpen(false);
      await reload();
    } catch { toast.error("Failed to save task."); } finally { setSaving(false); }
  };

  const handleDelete = async (t: ApiTask) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await api.tasks.delete(t.id); toast.success("Task deleted."); reload(); }
    catch { toast.error("Failed to delete task."); }
  };

  const skuMap = Object.fromEntries(skus.map((s: ApiSku) => [s.id, s]));

  const URGENCY_ORDER: Record<ApiTask["urgency"], number> = { "Very High": 0, High: 1, Medium: 2, Low: 3 };

  const sortFn = (a: ApiTask, b: ApiTask) => {
    if (sortBy === "deadline_asc") {
      if (!a.deadlineDate && !b.deadlineDate) return 0;
      if (!a.deadlineDate) return 1;
      if (!b.deadlineDate) return -1;
      return a.deadlineDate.localeCompare(b.deadlineDate);
    }
    if (sortBy === "deadline_desc") {
      if (!a.deadlineDate && !b.deadlineDate) return 0;
      if (!a.deadlineDate) return 1;
      if (!b.deadlineDate) return -1;
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

  return (
    <div className="space-y-6">
      <PersonalModuleTabs module="tasks" activeSharedUserId={sharedUserId} onChange={setSharedUserId} />
      <PageHeader
        title="Task Management"
        description={`${localTasks.length} task${localTasks.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />New Task
          </Button>
        }
      />

      {/* Filter + sort bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 w-52"
          />
        </div>
        <Select value={filterSku} onValueChange={setFilterSku}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by SKU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All SKUs</SelectItem>
            {skus.map((s: ApiSku) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">Sort: Urgency (default)</SelectItem>
            <SelectItem value="deadline_asc">Sort: Deadline ↑ earliest first</SelectItem>
            <SelectItem value="deadline_desc">Sort: Deadline ↓ latest first</SelectItem>
          </SelectContent>
        </Select>
        {(filterSku !== "__all__" || filterType !== "__all__" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterSku("__all__"); setFilterType("__all__"); setSearch(""); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>

        {([
          { value: "pending",   items: pending,   done: false, emptyMsg: "No pending tasks." },
          { value: "completed", items: completed, done: true,  emptyMsg: "No completed tasks yet." },
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
                          <Select
                            value={t.status}
                            onValueChange={(v) => updateStatusOptimistic(t.id, v as ApiTask["status"])}
                          >
                            <SelectTrigger className={`h-6 w-auto gap-1 rounded-full border-0 px-2.5 py-0 text-xs font-medium shadow-none focus:ring-0 ${STATUS_STYLE[t.status]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
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

      {/* Create / Edit Sheet */}
      <Sheet key={editTarget?.id ?? "new"} open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Task" : "New Task"}</SheetTitle>
          </SheetHeader>
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
    </div>
  );
}
