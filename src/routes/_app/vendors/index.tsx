import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { vendors } from "@/lib/mock/data";
import type { Vendor } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";

export const Route = createFileRoute("/_app/vendors/")({
  component: VendorsPage,
  head: () => ({ meta: [{ title: "Vendors — SkinOps" }] }),
});

const cols: Column<Vendor>[] = [
  { key: "name", header: "Vendor", accessor: (r) => r.name, cell: (r) => <Link to="/vendors/$vendorId" params={{ vendorId: r.id }} className="font-medium text-primary hover:underline">{r.name}</Link> },
  { key: "city", header: "City", accessor: (r) => r.city, cell: (r) => r.city },
  { key: "materials", header: "Materials", accessor: (r) => r.materials.join(", "), cell: (r) => <span className="text-muted-foreground">{r.materials.join(", ")}</span> },
  { key: "lead", header: "Lead time", accessor: (r) => r.leadTimeDays, cell: (r) => <span className="tabular-nums">{r.leadTimeDays}d</span>, className: "text-right" },
  { key: "rating", header: "Rating", accessor: (r) => r.rating, cell: (r) => <span className="inline-flex items-center gap-1 tabular-nums"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{r.rating}</span> },
  { key: "reliability", header: "Reliability", accessor: (r) => r.reliability, cell: (r) => <span className="tabular-nums">{r.reliability}%</span>, className: "text-right" },
  { key: "delay", header: "Delay %", accessor: (r) => r.delayPercent, cell: (r) => <span className={`tabular-nums ${r.delayPercent > 10 ? "text-destructive" : "text-success"}`}>{r.delayPercent}%</span>, className: "text-right" },
  { key: "running", header: "Running", accessor: (r) => r.runningOrders, cell: (r) => <span className="tabular-nums">{r.runningOrders}</span>, className: "text-right" },
  { key: "spend", header: "Total spend", accessor: (r) => r.totalSpend, cell: (r) => <span className="tabular-nums">₹{(r.totalSpend/100000).toFixed(1)}L</span>, className: "text-right" },
];

function VendorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Vendors" description={`${vendors.length} active vendors across India`} actions={<Button><Plus className="mr-1.5 h-4 w-4" />Add Vendor</Button>} />
      <DataTable rows={vendors} columns={cols} searchKeys={["name","city","contactPerson","email"]} searchPlaceholder="Search vendors…" pageSize={15} />
    </div>
  );
}
