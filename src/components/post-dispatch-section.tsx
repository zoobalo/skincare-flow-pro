import { useState } from "react";
import { api, type ApiSkuDispatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function PostDispatchSection({ dispatch }: { dispatch: ApiSkuDispatch }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState({
    batchNumber:   dispatch.batchNumber   ?? "",
    coaLink:       dispatch.coaLink       ?? "",
    invoiceNumber: dispatch.invoiceNumber ?? "",
    invoiceLink:   dispatch.invoiceLink   ?? "",
    qcStatus:      dispatch.qcStatus      ?? "",
  });

  const hasData = local.batchNumber || local.coaLink || local.invoiceNumber || local.invoiceLink || local.qcStatus;

  const save = async () => {
    setSaving(true);
    try {
      await api.skus.updateDispatch(dispatch.id, {
        batchNumber:   local.batchNumber   || null,
        coaLink:       local.coaLink       || null,
        invoiceNumber: local.invoiceNumber || null,
        invoiceLink:   local.invoiceLink   || null,
        qcStatus:      (local.qcStatus     || null) as "Done" | "Pending" | null,
      });
      toast.success("Post dispatch data saved.");
      setOpen(false);
    } catch {
      toast.error("Failed to save post dispatch data.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Post Dispatch</span>
        {hasData && !open && (
          <span className="text-foreground/60 truncate">
            {local.batchNumber ? `· Batch ${local.batchNumber}` : ""}
            {local.invoiceNumber ? ` · Inv ${local.invoiceNumber}` : ""}
            {local.qcStatus ? ` · QC: ${local.qcStatus}` : ""}
          </span>
        )}
        {!hasData && !open && (
          <span className="text-muted-foreground/60">· not filled</span>
        )}
        {open ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Summary row when data exists */}
          {hasData && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs">
              {local.batchNumber   && <span><span className="text-muted-foreground">Batch: </span><span className="font-medium">{local.batchNumber}</span></span>}
              {local.invoiceNumber && <span><span className="text-muted-foreground">Invoice: </span><span className="font-medium">{local.invoiceNumber}</span></span>}
              {local.qcStatus && (
                <span>
                  <span className="text-muted-foreground">QC: </span>
                  <span className={`font-medium ${local.qcStatus === "Done" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {local.qcStatus}
                  </span>
                </span>
              )}
              {local.coaLink && (
                <a href={local.coaLink} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="h-3 w-3" /> COA
                </a>
              )}
              {local.invoiceLink && (
                <a href={local.invoiceLink} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="h-3 w-3" /> Invoice Doc
                </a>
              )}
            </div>
          )}

          {/* Edit form */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Batch Number</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. BT2406001"
                value={local.batchNumber}
                onChange={(e) => setLocal((p) => ({ ...p, batchNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Invoice Number</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. INV-2024-001"
                value={local.invoiceNumber}
                onChange={(e) => setLocal((p) => ({ ...p, invoiceNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">COA Link</Label>
              <Input
                className="h-8 text-xs"
                placeholder="https://…"
                value={local.coaLink}
                onChange={(e) => setLocal((p) => ({ ...p, coaLink: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Invoice Link</Label>
              <Input
                className="h-8 text-xs"
                placeholder="https://…"
                value={local.invoiceLink}
                onChange={(e) => setLocal((p) => ({ ...p, invoiceLink: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">QC Status</Label>
              <Select
                value={local.qcStatus}
                onValueChange={(v) => setLocal((p) => ({ ...p, qcStatus: v === "__clear__" ? "" : v }))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Done">Done</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="__clear__">— Clear —</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
