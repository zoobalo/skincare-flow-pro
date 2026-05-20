import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ShoppingCart, CheckCircle2, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { KpiCard } from "@/components/kpi-card";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/procurement/")({
  loader: async () => {
    const [mrpAlerts, pendingApprovals, duePayments] = await Promise.all([
      api.procurement.mrpAlerts(),
      api.procurement.pendingApprovals(),
      api.procurement.duePayments(),
    ]);
    const totalDue = duePayments.reduce((acc, p) => acc + (p.paymentDue ?? 0), 0);
    return { mrpAlerts, pendingApprovals, duePayments, totalDue };
  },
  component: ProcurementPage,
  head: () => ({ meta: [{ title: "Procurement — SkinOps" }] }),
});

function ApproveButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const handleApprove = async () => {
    setBusy(true);
    try {
      await api.purchaseOrders.updateStatus(id, "Approved");
      toast.success("PO approved.");
      onDone();
    } catch {
      toast.error("Failed to approve PO.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" onClick={handleApprove} disabled={busy}>
      {busy ? "Approving…" : "Approve"}
    </Button>
  );
}

function ProcurementPage() {
  const { mrpAlerts, pendingApprovals, duePayments, totalDue } = Route.useLoaderData();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description="Material requirement planning, approvals, and payment tracking"
        actions={<Button asChild><Link to="/purchase-orders/new"><FileText className="mr-1.5 h-4 w-4" />New PO</Link></Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pending Approvals"   value={pendingApprovals.length}              icon={ShoppingCart} tone="warning" />
        <KpiCard label="MRP Alerts"          value={mrpAlerts.length}                     icon={AlertTriangle} tone="danger" hint="SKUs below threshold" />
        <KpiCard label="Due Payments"        value={`₹${(totalDue / 100000).toFixed(1)}L`} icon={FileText} tone="info" />
        <KpiCard label="Due POs"             value={duePayments.length}                   icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4"><h3 className="text-sm font-semibold">Material Requirement Planning</h3><p className="text-xs text-muted-foreground">SKUs that need replenishment</p></div>
          <ul className="divide-y">
            {mrpAlerts.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">All SKUs are above minimum threshold.</li>}
            {mrpAlerts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <Link to="/skus/$skuId" params={{ skuId: s.id }} className="font-medium hover:text-primary">{s.name}</Link>
                  <p className="text-xs text-muted-foreground">{s.code} · Stock {s.currentInventory.toLocaleString()} / Min {s.minThreshold.toLocaleString()}</p>
                </div>
                <Button asChild size="sm" variant="outline"><Link to="/purchase-orders/new">Plan PO<ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b p-4"><h3 className="text-sm font-semibold">PO Approval Queue</h3><p className="text-xs text-muted-foreground">Awaiting your approval</p></div>
          <ul className="divide-y">
            {pendingApprovals.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No POs awaiting approval.</li>}
            {pendingApprovals.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{p.poNumber}</div>
                  <p className="text-xs text-muted-foreground">{p.vendor?.name} · {p.materialType} · ₹{p.total.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <ApproveButton id={p.id} onDone={() => router.invalidate()} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-4"><h3 className="text-sm font-semibold">Due Payments Tracker</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">PO #</th><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium text-right">PO Total</th><th className="px-4 py-2.5 font-medium text-right">Due</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
            </thead>
            <tbody>
              {duePayments.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No outstanding payments.</td></tr>}
              {duePayments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{p.poNumber}</td>
                  <td className="px-4 py-2.5">{p.vendor?.name}</td>
                  <td className="px-4 py-2.5">{p.sku?.code}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">₹{p.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-destructive">₹{(p.paymentDue ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
