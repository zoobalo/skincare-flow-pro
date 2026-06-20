import { api, type ApiVendorComment } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function VendorCardComments({ vendorId }: { vendorId: string }) {
  const currentUser = getUser();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<ApiVendorComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const data = await api.vendors.listComments(vendorId);
        setComments(Array.isArray(data) ? data : []);
        setLoaded(true);
      } catch { /* silently fail */ } finally { setLoading(false); }
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const created = await api.vendors.addComment(vendorId, text.trim());
      if (created?.id) { setComments((p) => [...p, created as ApiVendorComment]); setText(""); }
      else toast.error(created?.error ?? "Failed to add comment.");
    } catch { toast.error("Failed to add comment."); } finally { setSending(false); }
  };

  const remove = async (commentId: string) => {
    try {
      await api.vendors.deleteComment(vendorId, commentId);
      setComments((p) => p.filter((c) => c.id !== commentId));
    } catch { toast.error("Failed to delete comment."); }
  };

  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span>{comments.length > 0 ? `Comments (${comments.length})` : "Comments"}</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {!loading && comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}

          {!loading && comments.length > 0 && (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="group flex items-start gap-2">
                  <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-semibold">{c.authorName}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                  {c.authorId === currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              rows={1}
              placeholder="Add a comment…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="min-h-0 resize-none text-xs py-2"
            />
            <Button size="sm" onClick={send} disabled={sending || !text.trim()} className="h-8 w-8 p-0 shrink-0">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
