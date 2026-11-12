import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { VendorCardComments } from "@/components/vendor-card-comments";
import { ChevronDown, ChevronRight, Edit, Trash2 } from "lucide-react";
import type { ApiVendor } from "@/lib/api";

/**
 * The packaging on one SKU, read as a bill of materials: a line per
 * component, its vendor, and where its stock is sitting.
 *
 * Cards made each component easy to read on its own and the SKU impossible to
 * read as a whole — you cannot compare twelve cards, or total them. The
 * stock a run depends on is a column now, with a total under it.
 */

type PackagingItem = {
  id: string;
  name: string;
  vendorId: string;
  vendorStatus: string;
  moq: number;
  leadTimeDays: number;
  currentStock: number;
  mfrStock: number;
  otherStock: number;
  llcUdaipurStock: number;
  edgistifyGurgaonStock: number;
  unprintedStock: number;
  unprintedStockNote: string;
  transitStock: number;
  transitDeliveryDate: string | null;
  costPerUnit: number;
  lastPurchaseDate: string | null;
};

const num = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-IN");

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

/** Stock on hand anywhere we control it. Transit is counted apart: not here yet. */
const onHand = (p: PackagingItem) =>
  (p.currentStock ?? 0) + (p.mfrStock ?? 0) + (p.otherStock ?? 0) +
  (p.llcUdaipurStock ?? 0) + (p.edgistifyGurgaonStock ?? 0);

export function PackagingBom({
  items, vendors, statusStyle, onCycleStatus, onEdit, onDelete,
}: {
  items: PackagingItem[];
  vendors: ApiVendor[];
  statusStyle: Record<string, string>;
  onCycleStatus: (p: never) => void;
  onEdit: (p: never) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const total = (pick: (p: PackagingItem) => number) =>
    items.reduce((sum, p) => sum + (pick(p) ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[1500px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-2 py-2" />
            <th className="px-3 py-2 text-left font-medium">Component</th>
            <th className="px-3 py-2 text-left font-medium">Vendor</th>
            <th className="px-3 py-2 text-left font-medium">Vendor Status</th>
            <th className="px-2 py-2 text-right font-medium">Own</th>
            <th className="px-2 py-2 text-right font-medium">Mfr.</th>
            <th className="px-2 py-2 text-right font-medium">Other</th>
            <th className="px-2 py-2 text-right font-medium">LLC Udaipur</th>
            <th className="px-2 py-2 text-right font-medium">Edgistify Gurgaon</th>
            <th className="px-2 py-2 text-right font-medium">Unprinted</th>
            <th className="px-3 py-2 text-right font-medium">Total Stock</th>
            <th className="px-2 py-2 text-right font-medium">Transit</th>
            <th className="px-3 py-2 text-left font-medium">Transit ETA</th>
            <th className="px-2 py-2 text-right font-medium">Cost / Unit</th>
            <th className="px-2 py-2 text-right font-medium">MOQ</th>
            <th className="px-2 py-2 text-right font-medium">Lead Time</th>
            <th className="px-3 py-2 text-left font-medium">Last PO</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((p) => {
            const open = expanded === p.id;
            const notes = Boolean((p.unprintedStock ?? 0) > 0 && p.unprintedStockNote);
            return (
              <Fragment key={p.id}>
                <tr className="align-top">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : p.id)}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title={open ? "Hide notes and comments" : "Show notes and comments"}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {p.name}
                    {notes && <span className="ml-1.5 text-[10px] text-muted-foreground">note</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {vendors.find((v) => v.id === p.vendorId)?.name ?? p.vendorId}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onCycleStatus(p as never)}
                      title="Click to change vendor status"
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-75 ${statusStyle[p.vendorStatus]}`}
                    >
                      {p.vendorStatus}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(p.currentStock)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{num(p.mfrStock)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{num(p.otherStock)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{num(p.llcUdaipurStock)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{num(p.edgistifyGurgaonStock)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{num(p.unprintedStock)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{num(onHand(p))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span className={p.transitStock > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                      {num(p.transitStock)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {p.transitStock > 0 ? fmtDate(p.transitDeliveryDate) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">₹{p.costPerUnit}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{num(p.moq)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{p.leadTimeDays}d</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(p.lastPurchaseDate)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(p as never)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDelete(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>

                {/* What does not belong in a column: the unprinted note and the
                    vendor's comment thread. */}
                {open && (
                  <tr className="bg-muted/20">
                    <td />
                    <td colSpan={17} className="px-3 pb-4 pt-1">
                      {notes && (
                        <div className="mb-3 rounded-md bg-background px-3 py-2 text-xs">
                          <span className="font-medium text-muted-foreground">Unprinted note: </span>
                          <span className="whitespace-pre-wrap">{p.unprintedStockNote}</span>
                        </div>
                      )}
                      <VendorCardComments vendorId={p.vendorId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30 text-xs font-semibold">
            <td />
            <td className="px-3 py-2">{items.length} component{items.length === 1 ? "" : "s"}</td>
            <td /><td />
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.currentStock))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.mfrStock))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.otherStock))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.llcUdaipurStock))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.edgistifyGurgaonStock))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.unprintedStock))}</td>
            <td className="px-3 py-2 text-right tabular-nums">{num(total(onHand))}</td>
            <td className="px-2 py-2 text-right tabular-nums">{num(total((p) => p.transitStock))}</td>
            <td colSpan={5} />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
