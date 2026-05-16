import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { productionBatches, helpers } from "@/lib/mock/data";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { ProgressRail } from "@/components/progress-rail";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/production/")({
  component: ProductionPage,
  head: () => ({ meta: [{ title: "Production Tracking — SkinOps" }] }),
});

function ProductionPage() {
  // Kanban-style buckets
  const earlyStages = PRODUCTION_STAGES.slice(0, 4);
  const midStages = PRODUCTION_STAGES.slice(4, 8);
  const lateStages = PRODUCTION_STAGES.slice(8);
  const buckets: { label: string; stages: string[] }[] = [
    { label: "Procurement", stages: earlyStages },
    { label: "Manufacturing", stages: midStages },
    { label: "Dispatch & QC", stages: lateStages },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Production Tracking" description={`${productionBatches.length} live batches across manufacturers`} actions={<Button><Plus className="mr-1.5 h-4 w-4" />New Batch</Button>} />

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {buckets.map(b => {
              const items = productionBatches.filter(x => b.stages.includes(x.currentStage));
              return (
                <div key={b.label} className="rounded-xl border bg-muted/30 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide">{b.label}</h3>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">{items.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {items.map(batch => {
                      const sku = helpers.sku(batch.skuId);
                      return (
                        <li key={batch.id} className="rounded-lg border bg-card p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{sku?.name}</div>
                              <div className="text-xs text-muted-foreground">{batch.batchNumber} · {batch.quantity.toLocaleString()} units</div>
                            </div>
                            {batch.delayed && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />}
                          </div>
                          <div className="mt-2 text-xs"><StatusBadge status={batch.delayed ? "Delayed" : "In Production"} /></div>
                          <div className="mt-2 text-[10px] text-muted-foreground">Stage: <span className="font-medium text-foreground">{batch.currentStage}</span></div>
                          <div className="text-[10px] text-muted-foreground">ETA: {batch.expectedCompletion}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-4">
            {productionBatches.map(batch => {
              const sku = helpers.sku(batch.skuId);
              const mfg = helpers.manufacturer(batch.manufacturerId);
              return (
                <div key={batch.id} className="rounded-xl border bg-card p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{sku?.name}</h3>
                      <p className="text-xs text-muted-foreground">{batch.batchNumber} · {mfg?.name} · {batch.quantity.toLocaleString()} units · ETA {batch.expectedCompletion}</p>
                    </div>
                    <StatusBadge status={batch.delayed ? "Delayed" : "In Production"} />
                  </div>
                  <ProgressRail stages={PRODUCTION_STAGES} current={batch.currentStage} delayed={batch.delayed} />
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
