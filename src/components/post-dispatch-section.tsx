import { useState } from "react";
import { api, type ApiSkuDispatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, ChevronDown, ChevronUp, Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const CHECKLIST = [
  { key: "coa",          label: "COA" },
  { key: "invoice",      label: "Invoice" },
  { key: "grn",          label: "GRN" },
  { key: "warehouseQc",  label: "Warehouse QC" },
  { key: "officeExtQc",  label: "Office External QC" },
  { key: "officeIntQc",  label: "Office Internal QC" },
  { key: "otherQc",      label: "Other QC" },
] as const;

type ChecklistKey = typeof CHECKLIST[number]["key"];

type LocalState = {
  batchNumbers: string[];
  coaReceived: boolean; coaUploaded: boolean;
  invoiceReceived: boolean; invoiceUploaded: boolean;
  grnReceived: boolean; grnUploaded: boolean;
  warehouseQcReceived: boolean; warehouseQcUploaded: boolean;
  officeExtQcReceived: boolean; officeExtQcUploaded: boolean;
  officeIntQcReceived: boolean; officeIntQcUploaded: boolean;
  otherQcReceived: boolean; otherQcUploaded: boolean;
};

function parseBatchNumbers(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function PostDispatchSection({ dispatch, onDone }: { dispatch: ApiSkuDispatch; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<LocalState>({
    batchNumbers:      parseBatchNumbers(dispatch.batchNumbers ?? "[]"),
    coaReceived:       dispatch.coaReceived ?? false,
    coaUploaded:       dispatch.coaUploaded ?? false,
    invoiceReceived:   dispatch.invoiceReceived ?? false,
    invoiceUploaded:   dispatch.invoiceUploaded ?? false,
    grnReceived:       dispatch.grnReceived ?? false,
    grnUploaded:       dispatch.grnUploaded ?? false,
    warehouseQcReceived:  dispatch.warehouseQcReceived ?? false,
    warehouseQcUploaded:  dispatch.warehouseQcUploaded ?? false,
    officeExtQcReceived:  dispatch.officeExtQcReceived ?? false,
    officeExtQcUploaded:  dispatch.officeExtQcUploaded ?? false,
    officeIntQcReceived:  dispatch.officeIntQcReceived ?? false,
    officeIntQcUploaded:  dispatch.officeIntQcUploaded ?? false,
    otherQcReceived:   dispatch.otherQcReceived ?? false,
    otherQcUploaded:   dispatch.otherQcUploaded ?? false,
  });

  const checkedCount = CHECKLIST.reduce((n, { key }) =>
    n + (local[`${key}Received` as keyof LocalState] ? 1 : 0)
      + (local[`${key}Uploaded` as keyof LocalState] ? 1 : 0), 0);
  const totalChecks = CHECKLIST.length * 2;
  const isDone = dispatch.qcStatus === "Done";

  const setBool = (field: keyof LocalState) => (checked: boolean) =>
    setLocal((p) => ({ ...p, [field]: checked }));

  const addBatch = () => setLocal((p) => ({ ...p, batchNumbers: [...p.batchNumbers, ""] }));
  const removeBatch = (i: number) =>
    setLocal((p) => ({ ...p, batchNumbers: p.batchNumbers.filter((_, idx) => idx !== i) }));
  const editBatch = (i: number, val: string) =>
    setLocal((p) => ({ ...p, batchNumbers: p.batchNumbers.map((b, idx) => idx === i ? val : b) }));

  const saveChecklist = async () => {
    setSaving(true);
    try {
      await api.skus.updateDispatch(dispatch.id, {
        batchNumbers: JSON.stringify(local.batchNumbers.filter(Boolean)),
        coaReceived:       local.coaReceived,
        coaUploaded:       local.coaUploaded,
        invoiceReceived:   local.invoiceReceived,
        invoiceUploaded:   local.invoiceUploaded,
        grnReceived:       local.grnReceived,
        grnUploaded:       local.grnUploaded,
        warehouseQcReceived:  local.warehouseQcReceived,
        warehouseQcUploaded:  local.warehouseQcUploaded,
        officeExtQcReceived:  local.officeExtQcReceived,
        officeExtQcUploaded:  local.officeExtQcUploaded,
        officeIntQcReceived:  local.officeIntQcReceived,
        officeIntQcUploaded:  local.officeIntQcUploaded,
        otherQcReceived:   local.otherQcReceived,
        otherQcUploaded:   local.otherQcUploaded,
      });
      toast.success("Saved.");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const markDone = async () => {
    setSaving(true);
    try {
      await api.skus.updateDispatch(dispatch.id, {
        batchNumbers: JSON.stringify(local.batchNumbers.filter(Boolean)),
        coaReceived:       local.coaReceived,
        coaUploaded:       local.coaUploaded,
        invoiceReceived:   local.invoiceReceived,
        invoiceUploaded:   local.invoiceUploaded,
        grnReceived:       local.grnReceived,
        grnUploaded:       local.grnUploaded,
        warehouseQcReceived:  local.warehouseQcReceived,
        warehouseQcUploaded:  local.warehouseQcUploaded,
        officeExtQcReceived:  local.officeExtQcReceived,
        officeExtQcUploaded:  local.officeExtQcUploaded,
        officeIntQcReceived:  local.officeIntQcReceived,
        officeIntQcUploaded:  local.officeIntQcUploaded,
        otherQcReceived:   local.otherQcReceived,
        otherQcUploaded:   local.otherQcUploaded,
        qcStatus: "Done",
        status: "Delivered",
      });
      toast.success("Dispatch marked as complete.");
      onDone?.();
    } catch {
      toast.error("Failed to mark as done.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">Post Dispatch</span>
        {isDone ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />Complete
          </span>
        ) : checkedCount > 0 ? (
          <span className="text-foreground/60">{checkedCount}/{totalChecks} checked</span>
        ) : (
          <span className="text-muted-foreground/60">· not started</span>
        )}
        {local.batchNumbers.filter(Boolean).length > 0 && !open && (
          <span className="text-foreground/60 truncate">
            · {local.batchNumbers.filter(Boolean).map((b, i) => `Batch ${i + 1}: ${b}`).join(", ")}
          </span>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Batch Numbers */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Batch Numbers</p>
            <div className="space-y-1.5">
              {local.batchNumbers.map((bn, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">Batch {i + 1}</span>
                  <Input
                    className="h-7 text-xs flex-1"
                    placeholder="e.g. BT2406001"
                    value={bn}
                    onChange={(e) => editBatch(i, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeBatch(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBatch}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />Add batch number
              </button>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Checklist</p>
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-0 text-[11px]">
                <div className="bg-muted/60 px-3 py-1.5 font-medium text-muted-foreground">Document</div>
                <div className="bg-muted/60 px-3 py-1.5 font-medium text-muted-foreground text-center">Received?</div>
                <div className="bg-muted/60 px-3 py-1.5 font-medium text-muted-foreground text-center">Uploaded?</div>
                {CHECKLIST.map(({ key, label }, idx) => (
                  <>
                    <div key={`${key}-label`} className={`px-3 py-2 text-xs flex items-center ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      {label}
                    </div>
                    <div key={`${key}-recv`} className={`px-3 py-2 flex items-center justify-center ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <Checkbox
                        checked={local[`${key}Received` as keyof LocalState] as boolean}
                        onCheckedChange={(v) => setBool(`${key}Received` as keyof LocalState)(Boolean(v))}
                        disabled={isDone}
                      />
                    </div>
                    <div key={`${key}-uplod`} className={`px-3 py-2 flex items-center justify-center ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <Checkbox
                        checked={local[`${key}Uploaded` as keyof LocalState] as boolean}
                        onCheckedChange={(v) => setBool(`${key}Uploaded` as keyof LocalState)(Boolean(v))}
                        disabled={isDone}
                      />
                    </div>
                  </>
                ))}
              </div>
            </div>
          </div>

          {/* Progress summary */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(checkedCount / totalChecks) * 100}%` }}
              />
            </div>
            <span>{checkedCount}/{totalChecks} checked</span>
          </div>

          {/* Actions */}
          {!isDone ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={saveChecklist} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                onClick={markDone}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Dispatch completed
            </div>
          )}
        </div>
      )}
    </div>
  );
}
