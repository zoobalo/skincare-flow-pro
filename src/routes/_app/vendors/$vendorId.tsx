import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, fmtMonth, type ApiVendorComment } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, MapPin, Phone, Send, Star, Trash2, UserRound } from "lucide-react";
import { ChartCard } from "@/components/chart-card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar } from "recharts";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { getUser } from "@/lib/auth";

export const Route = createFileRoute("/_app/vendors/$vendorId")({
  loader: async ({ params }) => {
    const [vendor, dashboard, comments] = await Promise.all([
      api.vendors.get(params.vendorId),
      api.dashboard.kpis(),
      api.vendors.listComments(params.vendorId),
    ]);
    if (!vendor) throw notFound();
    const spendTrend = dashboard.charts.procurementSpend.map((d) => ({ month: fmtMonth(d.month), spend: d.total }));
    return { vendor, spendTrend, comments };
  },
  component: VendorDetailPage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.vendor.name ?? "Vendor"} — Zoobalo` }] }),
});

function VendorDetailPage() {
  const { vendor, spendTrend, comments: initialComments } = Route.useLoaderData();
  const currentUser = getUser();
  const radial = [{ name: "Reliability", value: vendor.reliability, fill: "var(--chart-2)" }];

  const [comments, setComments] = useState<ApiVendorComment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const created = await api.vendors.addComment(vendor.id, newComment.trim());
      if (created?.id) {
        setComments((prev) => [...prev, created as ApiVendorComment]);
        setNewComment("");
        textareaRef.current?.focus();
      } else {
        toast.error(created?.error ?? "Failed to add comment.");
      }
    } catch { toast.error("Failed to add comment."); } finally { setSending(false); }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.vendors.deleteComment(vendor.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { toast.error("Failed to delete comment."); }
  };

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.name}
        description={`${vendor.materials.join(", ")} · ${vendor.city}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/vendors"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
            <Button size="sm">Create PO</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Contact information</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Contact person</dt><dd className="mt-0.5">{vendor.contactPerson}</dd></div>
            <div><dt className="text-xs text-muted-foreground">GST</dt><dd className="mt-0.5 font-mono text-xs">{vendor.gst}</dd></div>
            <div><dt className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Mobile</dt><dd className="mt-0.5">{vendor.mobile}</dd></div>
            <div><dt className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />Email</dt><dd className="mt-0.5">{vendor.email}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Address</dt><dd className="mt-0.5">{vendor.address}, {vendor.city}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Payment terms</dt><dd className="mt-0.5">{vendor.paymentTerms}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Lead time</dt><dd className="mt-0.5">{vendor.leadTimeDays} days</dd></div>
          </dl>
          {vendor.contacts && vendor.contacts.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><UserRound className="h-3.5 w-3.5" />Department Contacts</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {vendor.contacts.map((c, i) => (
                  <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <div className="font-semibold text-primary">{c.department}</div>
                    <div className="mt-0.5 font-medium">{c.name}</div>
                    {c.mobile && <div className="text-muted-foreground">{c.mobile}</div>}
                    {c.email && <div className="text-muted-foreground">{c.email}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Rating</div><div className="mt-1 flex items-baseline gap-1"><Star className="h-5 w-5 fill-warning text-warning" /><span className="text-2xl font-semibold tabular-nums">{vendor.rating}</span><span className="text-xs text-muted-foreground">/ 5</span></div><div className="mt-1 text-xs text-muted-foreground">{vendor.totalOrders} orders fulfilled</div></div>
        <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Total spend (YTD)</div><div className="mt-1 text-2xl font-semibold tabular-nums">₹{(vendor.totalSpend / 100000).toFixed(1)}L</div><div className="mt-1 text-xs text-muted-foreground">{vendor.runningOrders} running orders</div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Reliability score" description="On-time delivery performance">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="65%" outerRadius="100%" data={radial} startAngle={180} endAngle={0}>
              <RadialBar background dataKey="value" cornerRadius={8} />
              <text x="50%" y="60%" textAnchor="middle" className="fill-foreground" style={{ fontSize: 28, fontWeight: 600 }}>{vendor.reliability}%</text>
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Spend trend" description="All-vendor procurement spend (last 6 months)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={spendTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b p-4"><h3 className="text-sm font-semibold">Order history</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">PO #</th><th className="px-4 py-2.5 font-medium">SKU</th><th className="px-4 py-2.5 font-medium">Material</th><th className="px-4 py-2.5 font-medium text-right">Qty</th><th className="px-4 py-2.5 font-medium text-right">Total</th><th className="px-4 py-2.5 font-medium">ETA</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
            </thead>
            <tbody>
              {vendor.purchaseOrders.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No orders</td></tr>}
              {vendor.purchaseOrders.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{p.poNumber}</td>
                  <td className="px-4 py-2.5">{p.sku?.code}</td>
                  <td className="px-4 py-2.5">{p.materialType}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">₹{p.total.toLocaleString()}</td>
                  <td className="px-4 py-2.5">{fmtDate(p.expectedDelivery)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comments ── */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Comments</h3>
          {comments.length > 0 && <span className="text-xs text-muted-foreground">{comments.length} comment{comments.length !== 1 ? "s" : ""}</span>}
        </div>

        <div className="p-4 space-y-4">
          {/* Input */}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              rows={2}
              placeholder="Add a comment about this vendor…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              className="resize-none text-sm"
            />
            <Button
              size="sm"
              onClick={sendComment}
              disabled={sending || !newComment.trim()}
              className="shrink-0 h-9 w-9 p-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* List */}
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to add one.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="group flex items-start gap-3">
                  <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2.5">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-foreground">{c.authorName}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                  </div>
                  {c.authorId === currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-muted-foreground hover:text-destructive"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
