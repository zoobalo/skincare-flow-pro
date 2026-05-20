import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { ProgressRail } from "@/components/progress-rail";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/production/")({
  loader: () => api.production.list(),
  component: ProductionPage,
  head: () => ({ meta: [{ title: "Production Tracking — SkinOps" }] }),
});

function ProductionPage() {
  const productionBatches = Route.useLoaderData();

  const buckets: { label: string; stages: readonly string[] }[] = [
    { label: "Procurement",   stages: PRODUCTION_STAGES.slice(0, 4) },
    { label: "Manufacturing", stages: PRODUCTION_STAGES.slice(4, 8) },
    { label: "Dispatch & QC", stages: PRODUCTION_STAGES.slice(8) },
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
            {buckets.map((b) => {
              const items = productionBatches.filter((x) => b.stages.includes(x.currentStage));
              return (
                <div key={b.label} className="rounded-xl border bg-muted/30 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide">{b.label}</h3>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums">{items.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {items.map((batch) => (
                      <li key={batch.id} className="rounded-lg border bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{batch.sku?.name}</div>
                            <div className="text-xs text-muted-foreground">{batch.batchNumber} · {batch.quantity.toLocaleString()} units</div>
                          </div>
                          {batch.delayed && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />}
                        </div>
                        <div className="mt-2 text-xs"><StatusBadge status={batch.delayed ? "Delayed" : "In Production"} /></div>
                        <div className="mt-2 text-[10px] text-muted-foreground">Stage: <span className="font-medium text-foreground">{batch.currentStage}</span></div>
                        <div className="text-[10px] text-muted-foreground">ETA: {batch.expectedCompletion}</div>
                      </li>
                    ))}
                    {items.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">No batches</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-4">
            {productionBatches.map((batch) => (
              <div key={batch.id} className="rounded-xl border bg-card p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{batch.sku?.name}</h3>
                    <p className="text-xs text-muted-foreground">{batch.batchNumber} · {batch.manufacturer?.name} · {batch.quantity.toLocaleString()} units · ETA {batch.expectedCompletion}</p>
                  </div>
                  <StatusBadge status={batch.delayed ? "Delayed" : "In Production"} />
                </div>
                <ProgressRail stages={PRODUCTION_STAGES} current={batch.currentStage as any} delayed={batch.delayed} />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
