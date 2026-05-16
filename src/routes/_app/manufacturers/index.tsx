import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { manufacturers, productionBatches, helpers } from "@/lib/mock/data";
import { Button } from "@/components/ui/button";
import { Plus, Factory, CheckCircle2, Clock, Truck } from "lucide-react";
import { ProgressRail } from "@/components/progress-rail";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_app/manufacturers/")({
  component: ManufacturersPage,
  head: () => ({ meta: [{ title: "Manufacturers — SkinOps" }] }),
});

function ManufacturersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Manufacturers" description={`${manufacturers.length} active manufacturing partners`} actions={<Button><Plus className="mr-1.5 h-4 w-4" />Add Manufacturer</Button>} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {manufacturers.map(m => {
          const batches = productionBatches.filter(b => b.manufacturerId === m.id);
          return (
            <div key={m.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold">{m.name}</h3>
                  <p className="text-xs text-muted-foreground">{m.location} · {m.contactPerson} · {m.mobile}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Factory className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div><div className="text-muted-foreground">Capacity / mo</div><div className="text-base font-semibold tabular-nums">{m.capacityPerMonth.toLocaleString()}</div></div>
                <div><div className="text-muted-foreground">Active batches</div><div className="text-base font-semibold tabular-nums">{m.activeBatches}</div></div>
                <div><div className="text-muted-foreground">QC pass rate</div><div className="text-base font-semibold tabular-nums text-success">{m.qcPassRate}%</div></div>
              </div>
              {batches.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live batches</p>
                  <ul className="mt-3 space-y-3">
                    {batches.map(b => (
                      <li key={b.id} className="rounded-lg border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-medium">{b.batchNumber} · {helpers.sku(b.skuId)?.code}</span>
                          <StatusBadge status={b.delayed ? "Delayed" : "In Production"} />
                        </div>
                        <ProgressRail stages={PRODUCTION_STAGES} current={b.currentStage} delayed={b.delayed} />
                        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />ETA {b.expectedCompletion}</span>
                          <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Qty {b.quantity.toLocaleString()}</span>
                          <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />Started {b.startedAt}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
