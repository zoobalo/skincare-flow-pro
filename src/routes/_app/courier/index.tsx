import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { api, ApiCourier } from "@/lib/api";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/courier/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { items: await api.couriers.list(sharedTeamId), sharedTeamId };
  },
  component: CourierPage,
  head: () => ({ meta: [{ title: "Courier — Zoobalo" }] }),
});

function CourierPage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <CourierContent items={data.items} sharedTeamId={data.sharedTeamId} />;
}

const EMPTY_FORM = { name: "", courierPartner: "", dispatchDate: "", docketNumber: "", comment: "" };

function CourierContent({ items, sharedTeamId }: { items: ApiCourier[]; sharedTeamId?: string }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiCourier | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const filtered = items.filter((c) => {
    const q = search.toLowerCase();
    return !q
      || c.name.toLowerCase().includes(q)
      || c.courierPartner.toLowerCase().includes(q)
      || c.docketNumber.toLowerCase().includes(q)
      || (c.comment ?? "").toLowerCase().includes(q);
  });

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSheetOpen(true);
  }

  function openEdit(item: ApiCourier) {
    setEditTarget(item);
    setForm({
      name: item.name,
      courierPartner: item.courierPartner,
      dispatchDate: item.dispatchDate,
      docketNumber: item.docketNumber,
      comment: item.comment ?? "",
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.courierPartner.trim() || !form.dispatchDate || !form.docketNumber.trim()) {
      toast.error("Name, courier partner, dispatch date, and docket number are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        courierPartner: form.courierPartner.trim(),
        dispatchDate: form.dispatchDate,
        docketNumber: form.docketNumber.trim(),
        comment: form.comment.trim() || null,
      };
      if (editTarget) {
        await api.couriers.update(editTarget.id, payload);
        toast.success("Courier updated.");
      } else {
        await api.couriers.create(payload, sharedTeamId);
        toast.success("Courier added.");
      }
      setSheetOpen(false);
      reload();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ApiCourier) {
    if (!confirm(`Delete courier "${item.name}" (${item.docketNumber})?`)) return;
    try {
      await api.couriers.delete(item.id);
      toast.success("Courier deleted.");
      reload();
    } catch {
      toast.error("Failed to delete.");
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Courier"
        description="Track dispatched and received couriers."
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Add Courier
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search couriers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No couriers match your search." : "No couriers yet. Add one to start tracking."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name / Product</th>
                <th className="px-4 py-2.5 font-medium">Courier Partner</th>
                <th className="px-4 py-2.5 font-medium">Dispatch Date</th>
                <th className="px-4 py-2.5 font-medium">Docket No.</th>
                <th className="px-4 py-2.5 font-medium">Comment</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{item.courierPartner}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {item.dispatchDate
                      ? new Date(item.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.docketNumber}</td>
                  <td className="px-4 py-3 max-w-[240px] text-muted-foreground">
                    <span className="line-clamp-2 whitespace-pre-wrap">{item.comment || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editTarget ? "Edit Courier" : "Add Courier"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name / Product <span className="text-destructive">*</span></Label>
              <Input id="name" placeholder="e.g. Serum samples batch 3" value={form.name} onChange={set("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner">Courier Partner <span className="text-destructive">*</span></Label>
              <Input id="partner" placeholder="e.g. BlueDart, DTDC, FedEx" value={form.courierPartner} onChange={set("courierPartner")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date of Dispatch <span className="text-destructive">*</span></Label>
              <Input id="date" type="date" value={form.dispatchDate} onChange={set("dispatchDate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="docket">Docket Number <span className="text-destructive">*</span></Label>
              <Input id="docket" placeholder="e.g. 12345678901" value={form.docketNumber} onChange={set("docketNumber")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comment">Comment</Label>
              <Textarea id="comment" placeholder="Any notes about this shipment…" rows={3} value={form.comment} onChange={set("comment")} />
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editTarget ? "Save changes" : "Add Courier"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
