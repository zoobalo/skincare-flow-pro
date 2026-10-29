import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`;

const SECTIONS = [
  "SKU management", "SKU activity (comments & dispatches)", "Vendors", "Manufacturers",
  "Directory", "IMP links", "New product development", "Follow ups",
  "Inventory forecast (weekly sales & stock)",
];

/**
 * One-click archive of the operational data, to keep a copy outside the
 * platform. Downloads a zip of CSVs, optionally with every image they
 * reference, so the export still means something if storage is ever lost.
 */
export function DataExport() {
  const [busy, setBusy] = useState<"full" | "csv" | null>(null);

  async function download(withImages: boolean) {
    setBusy(withImages ? "full" : "csv");
    const note = toast.loading(
      withImages
        ? "Building your archive — images take a minute or two…"
        : "Building your archive…",
    );
    try {
      const token = localStorage.getItem("zoobalo_token");
      const res = await fetch(`${API_BASE}/api/export${withImages ? "" : "?images=0"}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const name = res.headers.get("content-disposition")?.match(/filename="(.+?)"/)?.[1]
        ?? `zoobalo-export-${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${name} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`, { id: note });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.", { id: note });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-xl space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h3 className="text-sm font-semibold">Download a copy of your data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A zip of Excel workbooks, one per section, with product pictures embedded beside the
          rows they belong to — so a copy of your records lives somewhere other than this platform.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included</p>
        <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
          {SECTIONS.map((s) => <li key={s}>· {s}</li>)}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => download(true)} disabled={busy !== null}>
          {busy === "full" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1.5 h-4 w-4" />}
          {busy === "full" ? "Preparing…" : "Download with images"}
        </Button>
        <Button variant="outline" onClick={() => download(false)} disabled={busy !== null}>
          {busy === "csv" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
          {busy === "csv" ? "Preparing…" : "Without images"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        With images embeds the pictures in each workbook and includes the image files too.
        Without images is quicker, and the image columns still hold their links.
        Follow ups are personal to each account, so yours are the ones exported.
      </p>
    </div>
  );
}
