import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Upload, X } from "lucide-react";

const API_BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}`;
const MAX_MB   = 1;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED  = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ALLOWED.includes(file.type)) {
      setError("Only JPEG, PNG, WebP or GIF images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File too large. Max ${MAX_MB} MB (this file is ${(file.size / 1024 / 1024).toFixed(2)} MB).`);
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? "Upload failed."); return; }
      onChange(`${API_BASE}${body.url}`);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  const clear = () => { onChange(""); setError(null); };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
      />

      {value ? (
        <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
          <img src={value} alt="SKU" className="h-40 w-full object-cover" />
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          {uploading ? (
            <span className="text-xs">Uploading…</span>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 opacity-40" />
              <span>Click to upload image</span>
              <span className="text-xs opacity-60">JPEG, PNG, WebP or GIF · max {MAX_MB} MB</span>
            </>
          )}
        </button>
      )}

      {!value && !uploading && (
        <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload Image"}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
