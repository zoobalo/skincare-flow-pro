import { createFileRoute } from "@tanstack/react-router";
import { fmtDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { MapPin, Truck } from "lucide-react";

export const Route = createFileRoute("/_app/logistics/")({
  loader: () => api.shipments.list(),
  component: LogisticsPage,
  head: () => ({ meta: [{ title: "Logistics — Zoobalo" }] }),
});

function LogisticsPage() {
  const shipments = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <PageHeader title="Logistics & Transport" description={`${shipments.length} active shipments`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shipments.map((s) => (
          <div key={s.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-primary" />{s.transporter}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">LR {s.lrNumber} · {s.vehicleNumber} · Driver: {s.driverName}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted-foreground">Origin</div><div className="font-medium">{s.origin}</div></div>
              <div><div className="text-muted-foreground">Current</div><div className="font-medium inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-info" />{s.currentLocation}</div></div>
              <div><div className="text-muted-foreground">Destination</div><div className="font-medium">{s.destination}</div></div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>Pickup {fmtDate(s.pickupDate)} · ETA {fmtDate(s.expectedDelivery)}</span>
              <span className="tabular-nums">Freight ₹{s.freightCost.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
