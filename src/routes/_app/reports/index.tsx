import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Download, FileBarChart } from "lucide-react";

const reports = [
  { name: "SKU-wise Consumption", description: "Material consumption broken down by SKU" },
  { name: "Vendor Performance", description: "Reliability, delays, and rating per vendor" },
  { name: "Procurement Spend", description: "Monthly spend and category breakdown" },
  { name: "Production Delays", description: "Batches delayed and root cause" },
  { name: "Inventory Aging", description: "Stock aged by days in warehouse" },
  { name: "Dead Stock", description: "SKUs and materials with no movement > 90d" },
  { name: "Monthly Production", description: "Units produced per month per SKU" },
  { name: "Material Wastage", description: "Wastage % per batch and per manufacturer" },
];

export const Route = createFileRoute("/_app/reports/")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — Zoobalo" }] }),
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate, view, and export operational reports" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(r => (
          <div key={r.name} className="flex items-start gap-3 rounded-xl border bg-card p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileBarChart className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{r.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">View</Button>
                <Button size="sm" variant="ghost"><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
