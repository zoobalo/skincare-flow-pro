import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { skus } from "@/lib/mock/data";
import { Plus, LayoutGrid, List, Search } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/skus/")({
  component: SkuListPage,
  head: () => ({ meta: [{ title: "SKU Management — SkinOps" }] }),
});

function SkuListPage() {
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const categories = Array.from(new Set(skus.map(s => s.category)));
  const filtered = skus.filter(s =>
    (cat === "all" || s.category === cat) &&
    (q.trim() === "" || s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="SKU Management"
        description={`${skus.length} active SKUs across ${categories.length} categories`}
        actions={<Button><Plus className="mr-1.5 h-4 w-4" />Add SKU</Button>}
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search SKUs by name or code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <button onClick={() => setView("grid")} className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs ${view==="grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" />Cards</button>
          <button onClick={() => setView("table")} className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs ${view==="table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List className="h-3.5 w-3.5" />Table</button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(sku => {
            const low = sku.currentInventory < sku.minThreshold;
            return (
              <Link key={sku.id} to="/skus/$skuId" params={{ skuId: sku.id }} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img src={sku.image} alt={sku.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  <div className="absolute left-2 top-2"><StatusBadge status={low ? "Low Stock" : "Healthy"} /></div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{sku.code} · {sku.category}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{sku.name}</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Stock</div><div className="font-semibold tabular-nums">{sku.currentInventory.toLocaleString()}</div></div>
                    <div><div className="text-muted-foreground">Lead time</div><div className="font-semibold tabular-nums">{sku.productionTimelineDays}d</div></div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">SKU Code</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                <th className="px-4 py-2.5 font-medium text-right">Min</th>
                <th className="px-4 py-2.5 font-medium text-right">Lead time</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sku => {
                const low = sku.currentInventory < sku.minThreshold;
                return (
                  <tr key={sku.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5"><Link to="/skus/$skuId" params={{ skuId: sku.id }} className="font-medium text-primary hover:underline">{sku.code}</Link></td>
                    <td className="px-4 py-2.5">{sku.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{sku.category}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sku.currentInventory.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{sku.minThreshold.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sku.productionTimelineDays}d</td>
                    <td className="px-4 py-2.5"><StatusBadge status={low ? "Low Stock" : "Healthy"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
