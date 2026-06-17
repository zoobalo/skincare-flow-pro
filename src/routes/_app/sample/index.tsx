import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageHeader } from "@/components/page-header";
import { api, type ApiSample, type ApiSampleProduct } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, RotateCcw, CheckCircle2, FlaskConical, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/sample/")({
  loader: async () => {
    if (typeof window === "undefined") return null;
    const sharedTeamId = new URLSearchParams(window.location.search).get("sharedTeamId") ?? undefined;
    return { samples: await api.samples.list(sharedTeamId), sharedTeamId };
  },
  pendingComponent: PageSkeleton,
  component: SamplePage,
  head: () => ({ meta: [{ title: "Sample Tracking — Zoobalo" }] }),
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function SamplePage() {
  const data = Route.useLoaderData();
  if (!data) return <PageSkeleton />;
  return <SampleContent initialSamples={data.samples} sharedTeamId={data.sharedTeamId} />;
}

type ProductRow = { productName: string; quantity: number };

const EMPTY_PRODUCT: ProductRow = { productName: "", quantity: 1 };

function SampleContent({ initialSamples, sharedTeamId }: { initialSamples: ApiSample[]; sharedTeamId?: string }) {
  const router = useRouter();
  const reload = () => router.invalidate();

  const [samples, setSamples] = useState(initialSamples);
  useEffect(() => { setSamples(initialSamples); }, [initialSamples]);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [comment, setComment] = useState("");
  const [productRows, setProductRows] = useState<ProductRow[]>([{ ...EMPTY_PRODUCT }]);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setPersonName("");
    setPurpose("");
    setComment("");
    setProductRows([{ ...EMPTY_PRODUCT }]);
    setSheetOpen(true);
  };

  const addProductRow = () => setProductRows((p) => [...p, { ...EMPTY_PRODUCT }]);

  const removeProductRow = (i: number) =>
    setProductRows((p) => p.length === 1 ? p : p.filter((_, idx) => idx !== i));

  const updateProductRow = (i: number, field: keyof ProductRow, value: string | number) =>
    setProductRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const save = async () => {
    if (!personName.trim()) { toast.error("Person name is required"); return; }
    const validProducts = productRows.filter((r) => r.productName.trim());
    if (!validProducts.length) { toast.error("At least one product is required"); return; }
    setSaving(true);
    try {
      const created = await api.samples.create({
        personName: personName.trim(),
        purpose: purpose.trim() || undefined,
        comment: comment.trim() || undefined,
        products: validProducts.map((r) => ({ productName: r.productName.trim(), quantity: Number(r.quantity) || 1 })),
      }, sharedTeamId);
      if (created.error) { toast.error(created.error); return; }
      setSheetOpen(false);
      toast.success("Sample record added");
      await reload();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Optimistic toggle return
  const toggleReturn = async (sampleId: string, product: ApiSampleProduct) => {
    setSamples((prev) => prev.map((s) =>
      s.id !== sampleId ? s : {
        ...s,
        products: s.products.map((p) =>
          p.id !== product.id ? p : { ...p, returned: !p.returned, returnedAt: !p.returned ? new Date().toISOString() : null }
        ),
      }
    ));
    try {
      await api.samples.toggleReturn(sampleId, product.id);
    } catch {
      // Roll back
      setSamples((prev) => prev.map((s) =>
        s.id !== sampleId ? s : {
          ...s,
          products: s.products.map((p) => p.id !== product.id ? p : { ...p, returned: product.returned, returnedAt: product.returnedAt }),
        }
      ));
      toast.error("Failed to update");
    }
  };

  const deleteSample = async (id: string) => {
    if (!confirm("Delete this sample record and all its products?")) return;
    try {
      await api.samples.delete(id);
      setSamples((prev) => prev.filter((s) => s.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const allReturned = (s: ApiSample) => s.products.length > 0 && s.products.every((p) => p.returned);
  const someReturned = (s: ApiSample) => s.products.some((p) => p.returned);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sample Tracking"
        description="Track products given out for photoshoots, testing, and other purposes"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Sample
          </Button>
        }
      />

      {samples.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <FlaskConical className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No samples recorded yet.</p>
        </div>
      )}

      <div className="space-y-4">
        {samples.map((sample) => {
          const done = allReturned(sample);
          const partial = !done && someReturned(sample);
          return (
            <div key={sample.id} className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", done && "opacity-70")}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/20">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{sample.personName}</span>
                    {sample.purpose && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {sample.purpose}
                      </span>
                    )}
                    {done ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> All Returned
                      </span>
                    ) : partial ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Partially Returned
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                        Pending Return
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(sample.createdAt)}</p>
                  {sample.comment && <p className="text-xs text-muted-foreground italic mt-1">{sample.comment}</p>}
                </div>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteSample(sample.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Products table */}
              <div className="divide-y">
                {sample.products.map((product) => (
                  <div
                    key={product.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-2.5 text-sm transition-colors",
                      product.returned ? "bg-green-50/50 dark:bg-green-950/10" : "hover:bg-muted/20"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className={cn("font-medium", product.returned && "line-through text-muted-foreground")}>
                        {product.productName}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">× {product.quantity}</span>
                    </div>
                    {product.returned && product.returnedAt && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Returned {fmtDate(product.returnedAt)}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant={product.returned ? "outline" : "default"}
                      className={cn(
                        "h-7 shrink-0 gap-1.5 text-xs",
                        product.returned && "text-muted-foreground"
                      )}
                      onClick={() => toggleReturn(sample.id, product)}
                    >
                      {product.returned ? (
                        <><RotateCcw className="h-3 w-3" /> Undo</>
                      ) : (
                        <><CheckCircle2 className="h-3 w-3" /> Mark Returned</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Sample Record</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Person Name *</Label>
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Who is taking the sample?"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Photoshoot, Testing, Review…"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Products *</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addProductRow}>
                  <Plus className="h-3 w-3" /> Add product
                </Button>
              </div>
              <div className="space-y-2">
                {productRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      className="flex-1"
                      placeholder="Product name"
                      value={row.productName}
                      onChange={(e) => updateProductRow(i, "productName", e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-20 shrink-0"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => updateProductRow(i, "quantity", e.target.value)}
                    />
                    <Button
                      type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeProductRow(i)}
                      disabled={productRows.length === 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any notes about this sample…"
                rows={3}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Add Sample"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
