import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Column } from "@/components/data-table";
import { api, type ApiPo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/purchase-orders/")({
  loader: () => api.purchaseOrders.list(),
  component: POPage,
  head: () => ({ meta: [{ title: "Purchase Orders — SkinOps" }] }),
});

const PO_STATUSES = ["Pending", "Approved", "In Production", "Dispatched", "Delivered", "Delayed"] as const;

const cols: Column<ApiPo>[] = [
  { key: "po",       header: "PO #",     accessor: (r) => r.poNumber,           cell: (r) => <span className="font-medium">{r.poNumber}</span> },
  { key: "vendor",   header: "Vendor",   accessor: (r) => r.vendor?.name ?? "", cell: (r) => r.vendor?.name },
  { key: "sku",      header: "SKU",      accessor: (r) => r.sku?.code ?? "",    cell: (r) => r.sku?.code },
  { key: "material", header: "Material", accessor: (r) => r.materialType,       cell: (r) => r.materialType },
  { key: "qty",      header: "Qty",      accessor: (r) => r.quantity,           cell: (r) => <span className="tabular-nums">{r.quantity.toLocaleString()}</span>, className: "text-right" },
  { key: "rate",     header: "Rate",     accessor: (r) => r.rate,               cell: (r) => <span className="tabular-nums">₹{r.rate}</span>, className: "text-right" },
  { key: "total",    header: "Total",    accessor: (r) => r.total,              cell: (r) => <span className="tabular-nums font-medium">₹{r.total.toLocaleString()}</span>, className: "text-right" },
  { key: "dispatch", header: "Dispatch", accessor: (r) => r.dispatchDate,       cell: (r) => r.dispatchDate },
  { key: "eta",      header: "Expected", accessor: (r) => r.expectedDelivery,   cell: (r) => r.expectedDelivery },
  { key: "status",   header: "Status",   accessor: (r) => r.status,             cell: (r) => <StatusBadge status={r.status} /> },
];

function POPage() {
  const purchaseOrders = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`${purchaseOrders.length} POs across all vendors and SKUs`}
        actions={<Button asChild><Link to="/purchase-orders/new"><Plus className="mr-1.5 h-4 w-4" />Create PO</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {PO_STATUSES.map((s) => {
          const count = purchaseOrders.filter((p) => p.status === s).length;
          return (
            <div key={s} className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">{s}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{count}</div>
            </div>
          );
        })}
      </div>
      <DataTable rows={purchaseOrders} columns={cols} searchKeys={["poNumber", "materialType"]} searchPlaceholder="Search POs…" pageSize={12} />
    </div>
  );
}
