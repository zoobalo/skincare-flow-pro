import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { api, type ApiVendor } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vendors/")({
  loader: () => api.vendors.list(),
  component: VendorsPage,
  head: () => ({ meta: [{ title: "Vendors — SkinOps" }] }),
});

const cols: Column<ApiVendor>[] = [
  { key: "name",        header: "Vendor",      accessor: (r) => r.name,         cell: (r) => <Link to="/vendors/$vendorId" params={{ vendorId: r.id }} className="font-medium text-primary hover:underline">{r.name}</Link> },
  { key: "city",        header: "City",         accessor: (r) => r.city,         cell: (r) => r.city },
  { key: "materials",   header: "Materials",    accessor: (r) => r.materials.join(", "), cell: (r) => <span className="text-muted-foreground">{r.materials.join(", ")}</span> },
  { key: "lead",        header: "Lead time",    accessor: (r) => r.leadTimeDays, cell: (r) => <span className="tabular-nums">{r.leadTimeDays}d</span>, className: "text-right" },
  { key: "rating",      header: "Rating",       accessor: (r) => r.rating,       cell: (r) => <span className="inline-flex items-center gap-1 tabular-nums"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{r.rating}</span> },
  { key: "reliability", header: "Reliability",  accessor: (r) => r.reliability,  cell: (r) => <span className="tabular-nums">{r.reliability}%</span>, className: "text-right" },
  { key: "delay",       header: "Delay %",      accessor: (r) => r.delayPercent, cell: (r) => <span className={`tabular-nums ${r.delayPercent > 10 ? "text-destructive" : "text-success"}`}>{r.delayPercent}%</span>, className: "text-right" },
  { key: "running",     header: "Running",      accessor: (r) => r.runningOrders,cell: (r) => <span className="tabular-nums">{r.runningOrders}</span>, className: "text-right" },
  { key: "spend",       header: "Total spend",  accessor: (r) => r.totalSpend,   cell: (r) => <span className="tabular-nums">₹{(r.totalSpend / 100000).toFixed(1)}L</span>, className: "text-right" },
];

const EMPTY = {
  name: "", contactPerson: "", mobile: "", email: "", gst: "",
  address: "", city: "", materials: "",
  leadTimeDays: 21, paymentTerms: "Net 30", rating: 4.0,
  reliability: 85, delayPercent: 10, totalOrders: 0, runningOrders: 0, totalSpend: 0,
};

function VendorsPage() {
  const vendors = Route.useLoaderData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.city) {
      toast.error("Name, email and city are required.");
      return;
    }
    setSaving(true);
    try {
      await api.vendors.create({
        ...form,
        materials: (form.materials as any).split(",").map((s: string) => s.trim()).filter(Boolean),
        leadTimeDays: Number(form.leadTimeDays),
        rating: Number(form.rating) as any,
        reliability: Number(form.reliability),
        delayPercent: Number(form.delayPercent),
        totalOrders: Number(form.totalOrders),
        runningOrders: Number(form.runningOrders),
        totalSpend: Number(form.totalSpend) as any,
      });
      toast.success(`Vendor "${form.name}" added.`);
      setOpen(false);
      setForm({ ...EMPTY });
      await router.invalidate();
    } catch {
      toast.error("Failed to create vendor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description={`${vendors.length} active vendors across India`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Add Vendor
          </Button>
        }
      />
      <DataTable rows={vendors} columns={cols} searchKeys={["name", "city", "contactPerson", "email"]} searchPlaceholder="Search vendors…" pageSize={15} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Vendor</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name *</Label>
              <Input placeholder="e.g. Alpha Aluminium Co." value={form.name} onChange={set("name")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input placeholder="Full name" value={form.contactPerson} onChange={set("contactPerson")} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input placeholder="+91 98..." value={form.mobile} onChange={set("mobile")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="vendor@company.com" value={form.email} onChange={set("email")} />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input placeholder="27AAAPL1234C1Z5" value={form.gst} onChange={set("gst")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input placeholder="Mumbai" value={form.city} onChange={set("city")} />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input placeholder="Plot 14, MIDC…" value={form.address} onChange={set("address")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Materials Supplied (comma separated)</Label>
              <Input placeholder="Aluminium Can, Valve, Cap" value={form.materials} onChange={set("materials")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Lead time (days)</Label>
                <Input type="number" value={form.leadTimeDays} onChange={set("leadTimeDays")} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input placeholder="Net 30" value={form.paymentTerms} onChange={set("paymentTerms")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Rating (0–5)</Label>
                <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={set("rating")} />
              </div>
              <div className="space-y-1.5">
                <Label>Reliability %</Label>
                <Input type="number" min="0" max="100" value={form.reliability} onChange={set("reliability")} />
              </div>
              <div className="space-y-1.5">
                <Label>Delay %</Label>
                <Input type="number" min="0" max="100" value={form.delayPercent} onChange={set("delayPercent")} />
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Add Vendor"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
