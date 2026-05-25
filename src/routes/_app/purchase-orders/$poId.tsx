import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { PODocument } from "@/components/po-document";

export const Route = createFileRoute("/_app/purchase-orders/$poId")({
  loader: async ({ params }) => {
    const po = await api.purchaseOrders.get(params.poId);
    if (!po) throw notFound();
    return { po };
  },
  component: POPrintPage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.po.poNumber ?? "PO"} — Zoobalo` }] }),
});

function POPrintPage() {
  const { po } = Route.useLoaderData();
  const mfr = (po as any).manufacturer;
  const partyForDoc = po.vendor ?? (mfr ? { ...mfr, address: mfr.location } : undefined);

  return (
    <>
      <style>{`
        @page { margin: 0; size: A4; }
        @media print {
          body * { visibility: hidden; }
          #po-document, #po-document * { visibility: visible; }
          #po-document { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/purchase-orders"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />Print PO
        </Button>
      </div>

      <PODocument
        poNumber={po.poNumber}
        poDate={po.dispatchDate}
        materialType={po.materialType}
        quantity={po.quantity}
        rate={Number(po.rate)}
        gstRate={po.gstRate ?? 0}
        gstAmount={Number(po.gstAmount ?? 0)}
        total={Number(po.total)}
        items={po.items}
        category={po.category}
        deliveryAt={po.deliveryAddress}
        notes={po.notes}
        terms={po.terms}
        vendor={partyForDoc as any}
        sku={po.sku as any}
      />
    </>
  );
}
