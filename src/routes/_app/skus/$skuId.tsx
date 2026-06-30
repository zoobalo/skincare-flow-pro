import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { api, type VendorStatus, type ApiInventoryLocation } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Edit, ExternalLink, Eye, Pencil, Plus, Trash2, Warehouse } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { ProgressRail } from "@/components/progress-rail";
import { PRODUCTION_STAGES } from "@/lib/mock/types";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { VendorCardComments } from "@/components/vendor-card-comments";
import { PostDispatchSection } from "@/components/post-dispatch-section";

export const Route = createFileRoute("/_app/skus/$skuId")({
  loader: async ({ params }) => {
    const [sku, manufacturers, vendors, allPackaging, allRawMaterials] = await Promise.all([
      api.skus.get(params.skuId),
      api.manufacturers.list(),
      api.vendors.list(),
      api.inventory.packaging(),
      api.inventory.rawMaterials(),
    ]);
    // On SSR, auth token isn't available (localStorage) so sku will be null.
    // Return null here so server and client render the same loading shell.
    // staleTime: 0 ensures the client re-runs this loader immediately after hydration.
    if (!sku) {
      if (typeof window === "undefined") return null;
      throw notFound();
    }
    const [mftNotes, comments, links] = await Promise.all([
      api.skus.listMft(params.skuId),
      api.skus.listComments(params.skuId),
      api.skus.listLinks(params.skuId),
    ]);
    return { sku, manufacturers, vendors, allPackaging, allRawMaterials, mftNotes, comments, links };
  },
  component: SkuDetailPage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.sku?.name ?? "SKU"} — Zoobalo` }] }),
});

const SKU_CATEGORIES = ["Sun Care", "Serums", "Moisturizers", "Cleansers", "Toners", "Exfoliators", "Eye Care", "Lip Care", "Body Care", "Skin Cure"];
const SKU_TYPES = ["Aerosol Spray", "Glass Dropper", "Pump Bottle", "Tube", "Jar", "Cream Tube", "Lotion Bottle", "Toner Bottle", "Stick", "Airless Glass Pump", "Airless Bottle", "PET Spray"];
const RAW_UNITS = ["ml", "g", "kg", "L", "pcs", "mg"];
const PO_STATUSES = ["To be sent", "Sent", "Pending", "Approved", "In Production", "Dispatched", "Delivered", "Delayed"] as const;
const GST_RATES = [0, 5, 12, 18, 28] as const;

const EMPTY_PACK = { name: "", vendorId: "", moq: 1000, leadTimeDays: 14, currentStock: 0, mfrStock: 0, otherStock: 0, transitStock: 0, transitDeliveryDate: "", costPerUnit: 0, lastPurchaseDate: "" };
const EMPTY_RM   = { name: "", vendorId: "", qtyPerUnit: 1, unit: "ml", currentStock: 0, costPerUnit: 0 };
const DISPATCH_STATUSES = ["Planned", "Dispatched", "In Transit", "Delivered", "Delayed"] as const;
const GOODS_TYPES = ["Final Goods", "Packaging Material"] as const;
const EMPTY_DISPATCH = { goodsType: "Final Goods", goodsName: "", quantity: 0, dispatchDate: "", from: "", to: "", transporterName: "", vehicleNumber: "", lrNumber: "", freight: 0, status: "Dispatched", notes: "" };

const EMPTY_BATCH = { batchNumber: "", manufacturerId: "", vendorId: "", quantity: 1000, currentStage: "PO Generated", startedAt: "", expectedCompletion: "", delayed: false, materialCategory: "", materialItemId: "", applicableStages: [...PRODUCTION_STAGES] as string[], comment: "" };

const FINAL_DISPATCH_IDX = PRODUCTION_STAGES.indexOf("Final Dispatch");
function getDelayDays(batch: { expectedCompletion: string; currentStage: string }): number {
  const stageIdx = PRODUCTION_STAGES.indexOf(batch.currentStage as typeof PRODUCTION_STAGES[number]);
  if (stageIdx >= FINAL_DISPATCH_IDX) return 0;
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const etaStr = (batch.expectedCompletion ?? "").slice(0, 10);
  if (!etaStr || todayStr <= etaStr) return 0;
  return Math.floor((Date.parse(todayStr) - Date.parse(etaStr)) / 86_400_000);
}

function SkuDetailPage() {
  const loaderData = Route.useLoaderData();
  if (!loaderData) return <div className="flex items-center justify-center p-20 text-muted-foreground text-sm">Loading…</div>;
  return <SkuDetailContent sku={loaderData.sku} manufacturers={loaderData.manufacturers} vendors={loaderData.vendors} allPackaging={loaderData.allPackaging} allRawMaterials={loaderData.allRawMaterials} mftNotes={loaderData.mftNotes} comments={loaderData.comments} links={loaderData.links} />;
}

function SkuDetailContent({ sku, manufacturers, vendors, allPackaging, allRawMaterials, mftNotes, comments, links: initialLinks }: { sku: import("@/lib/api").ApiSkuDetail; manufacturers: import("@/lib/api").ApiManufacturer[]; vendors: import("@/lib/api").ApiVendor[]; allPackaging: import("@/lib/api").ApiPackagingItem[]; allRawMaterials: import("@/lib/api").ApiRawMaterial[]; mftNotes: import("@/lib/api").ApiMftNote[]; comments: import("@/lib/api").ApiSkuComment[]; links: import("@/lib/api").ApiSkuLink[] }) {
  const router = useRouter();
  const navigate = useNavigate();
  const mfg = sku.manufacturer;
  const totalPackagingValue = sku.packaging.reduce((acc, p) => acc + p.currentStock * p.costPerUnit, 0);
  const low = sku.currentInventory < sku.minThreshold;

  // Edit SKU sheet
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    code: sku.code, name: sku.name, category: sku.category, type: sku.type,
    description: sku.description, image: sku.image, manufacturerId: sku.manufacturerId,
    currentInventory: sku.currentInventory, minThreshold: sku.minThreshold,
    productionTimelineDays: sku.productionTimelineDays,
    mrp: sku.mrp ?? "",
    usp: sku.usp ?? "",
    importantLinks: sku.importantLinks ?? "[]",
  });
  const [linkInput, setLinkInput] = useState({ label: "", url: "" });

  // Add Packaging sheet
  const [packOpen, setPackOpen] = useState(false);
  const [packSaving, setPackSaving] = useState(false);
  const [packForm, setPackForm] = useState({ ...EMPTY_PACK, vendorId: vendors[0]?.id ?? "" });

  // Add Raw Material sheet
  const [rmOpen, setRmOpen] = useState(false);
  const [rmSaving, setRmSaving] = useState(false);
  const [rmForm, setRmForm] = useState({ ...EMPTY_RM, vendorId: manufacturers[0]?.id ?? "" });

  // Add Production Batch sheet
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchForm, setBatchForm] = useState({ ...EMPTY_BATCH, manufacturerId: manufacturers[0]?.id ?? "" });

  // Edit Production Batch sheet
  const [editBatchOpen, setEditBatchOpen] = useState(false);
  const [editBatchSaving, setEditBatchSaving] = useState(false);
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({ ...EMPTY_BATCH, manufacturerId: manufacturers[0]?.id ?? "", materialCategory: "", materialItemId: "" });

  // Dispatch sheet
  const [dispatchOpen, setDispatchOpen]       = useState(false);
  const [dispatchSaving, setDispatchSaving]   = useState(false);
  const [editDispatchId, setEditDispatchId]   = useState<string | null>(null);
  const [dispatchForm, setDispatchForm]       = useState({ ...EMPTY_DISPATCH });
  const [showDispatchHistory, setShowDispatchHistory] = useState(false);

  // Tests sheet
  const [testOpen, setTestOpen]       = useState(false);
  const [testSaving, setTestSaving]   = useState(false);
  const [editTestId, setEditTestId]   = useState<string | null>(null);
  const [testForm, setTestForm]       = useState({ testName: "", result: "" });

  // MFT sheet
  const [mftOpen, setMftOpen]         = useState(false);
  const [mftSaving, setMftSaving]     = useState(false);
  const [editMftId, setEditMftId]     = useState<string | null>(null);
  const [mftForm, setMftForm]         = useState({ date: "", notes: "" });

  // Comments
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  // Links
  const [links, setLinks] = useState(initialLinks);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [editLink, setEditLink] = useState<import("@/lib/api").ApiSkuLink | null>(null);
  const [linkForm, setLinkForm] = useState({ title: "", link: "", comment: "" });
  const [linkSaving, setLinkSaving] = useState(false);

  const openAddLink = () => {
    setEditLink(null);
    setLinkForm({ title: "", link: "", comment: "" });
    setLinkSheetOpen(true);
  };

  const openEditLink = (l: import("@/lib/api").ApiSkuLink) => {
    setEditLink(l);
    setLinkForm({ title: l.title, link: l.link, comment: l.comment });
    setLinkSheetOpen(true);
  };

  const saveLink = async () => {
    if (!linkForm.title.trim() || !linkForm.link.trim()) { toast.error("Title and link are required."); return; }
    let url = linkForm.link.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setLinkSaving(true);
    try {
      if (editLink) {
        const updated = await api.skus.updateLink(editLink.id, { title: linkForm.title.trim(), link: url, comment: linkForm.comment.trim() });
        setLinks((prev) => prev.map((l) => l.id === editLink.id ? updated : l));
        toast.success("Link updated.");
      } else {
        const created = await api.skus.addLink(sku.id, { title: linkForm.title.trim(), link: url, comment: linkForm.comment.trim() });
        setLinks((prev) => [...prev, created]);
        toast.success("Link added.");
      }
      setLinkSheetOpen(false);
    } catch { toast.error("Failed to save link."); }
    finally { setLinkSaving(false); }
  };

  const deleteLink = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    try {
      await api.skus.deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success("Link deleted.");
    } catch { toast.error("Failed to delete."); }
  };

  // Local packaging + raw material state (for optimistic vendor status updates)
  const [localPackaging, setLocalPackaging] = useState(sku.packaging);
  const [localRm, setLocalRm] = useState(sku.rawMaterials);
  useEffect(() => { setLocalPackaging(sku.packaging); }, [sku.packaging]);
  useEffect(() => { setLocalRm(sku.rawMaterials); }, [sku.rawMaterials]);

  // Inventory locations state
  const [invLocs, setInvLocs] = useState<ApiInventoryLocation[]>(sku.inventoryLocations ?? []);
  const [invOpen, setInvOpen] = useState(false);
  const [invAddName, setInvAddName] = useState("");
  const [invAddQty, setInvAddQty] = useState("");
  const [invAdding, setInvAdding] = useState(false);
  const [invEditId, setInvEditId] = useState<string | null>(null);
  const [invEditName, setInvEditName] = useState("");
  const [invEditQty, setInvEditQty] = useState("");
  const [invEditSaving, setInvEditSaving] = useState(false);
  const invTotal = invLocs.length > 0 ? invLocs.reduce((s, l) => s + (l.quantity ?? 0), 0) : (sku.currentInventory ?? 0);

  const handleAddLoc = async () => {
    if (!invAddName.trim()) { toast.error("Name is required."); return; }
    setInvAdding(true);
    try {
      const created = await api.skus.addInventoryLocation(sku.id, { name: invAddName.trim(), quantity: Number(invAddQty) || 0 });
      if (created?.error) { toast.error(created.error); return; }
      setInvLocs((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      setInvAddName(""); setInvAddQty("");
    } catch { toast.error("Failed to add location."); }
    finally { setInvAdding(false); }
  };

  const handleSaveLocEdit = async () => {
    if (!invEditId) return;
    setInvEditSaving(true);
    try {
      const updated = await api.skus.updateInventoryLocation(invEditId, { name: invEditName.trim(), quantity: Number(invEditQty) || 0 });
      if (updated?.error) { toast.error(updated.error); return; }
      setInvLocs((p) => p.map((l) => l.id === invEditId ? updated : l).sort((a, b) => a.name.localeCompare(b.name)));
      setInvEditId(null);
    } catch { toast.error("Failed to save."); }
    finally { setInvEditSaving(false); }
  };

  const handleDeleteLoc = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    try {
      await api.skus.deleteInventoryLocation(id);
      setInvLocs((p) => p.filter((l) => l.id !== id));
    } catch { toast.error("Failed to delete."); }
  };

  const VENDOR_STATUS_CYCLE: VendorStatus[] = ["Currently Working", "Worked Before", "Never Worked"];
  const VENDOR_STATUS_STYLE: Record<VendorStatus, string> = {
    "Currently Working": "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800",
    "Worked Before":     "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    "Never Worked":      "bg-muted text-muted-foreground border-border",
  };

  const cyclePackagingVendorStatus = async (p: typeof localPackaging[0]) => {
    const next = VENDOR_STATUS_CYCLE[(VENDOR_STATUS_CYCLE.indexOf(p.vendorStatus) + 1) % 3];
    setLocalPackaging((prev) => prev.map((x) => x.id === p.id ? { ...x, vendorStatus: next } : x));
    try { await api.skus.updatePackaging(p.id, { vendorStatus: next }); }
    catch {
      setLocalPackaging((prev) => prev.map((x) => x.id === p.id ? { ...x, vendorStatus: p.vendorStatus } : x));
      toast.error("Failed to update vendor status.");
    }
  };

  const cycleRmVendorStatus = async (rm: typeof localRm[0]) => {
    const next = VENDOR_STATUS_CYCLE[(VENDOR_STATUS_CYCLE.indexOf(rm.vendorStatus) + 1) % 3];
    setLocalRm((prev) => prev.map((x) => x.id === rm.id ? { ...x, vendorStatus: next } : x));
    try { await api.skus.updateRawMaterial(rm.id, { vendorStatus: next }); }
    catch {
      setLocalRm((prev) => prev.map((x) => x.id === rm.id ? { ...x, vendorStatus: rm.vendorStatus } : x));
      toast.error("Failed to update vendor status.");
    }
  };

  // Edit Packaging sheet
  const [editPackOpen, setEditPackOpen] = useState(false);
  const [editPackSaving, setEditPackSaving] = useState(false);
  const [editPackId, setEditPackId] = useState<string | null>(null);
  const [editPackForm, setEditPackForm] = useState({ ...EMPTY_PACK, vendorId: vendors[0]?.id ?? "" });

  // Edit Raw Material sheet
  const [editRmOpen, setEditRmOpen] = useState(false);
  const [editRmSaving, setEditRmSaving] = useState(false);
  const [editRmId, setEditRmId] = useState<string | null>(null);
  const [editRmForm, setEditRmForm] = useState({ ...EMPTY_RM, vendorId: manufacturers[0]?.id ?? "" });

  // Edit PO (from PO History) sheet
  const [editPoOpen, setEditPoOpen] = useState(false);
  const [editPoSaving, setEditPoSaving] = useState(false);
  const [editPoId, setEditPoId] = useState<string | null>(null);
  const [editPoForm, setEditPoForm] = useState({
    vendorId: "", materialType: "", quantity: 0, rate: 0, gstRate: 18, gstAmount: 0, total: 0,
    dispatchDate: "", expectedDelivery: "", status: "Pending" as typeof PO_STATUSES[number],
    amountPaid: "", paymentDueDate: "", notes: "", terms: "",
  });

  const setEdit      = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditForm(p => ({ ...p, [f]: e.target.value }));
  const setPack      = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setPackForm(p => ({ ...p, [f]: e.target.value }));
  const setRm        = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setRmForm(p => ({ ...p, [f]: e.target.value }));
  const setBatch     = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setBatchForm(p => ({ ...p, [f]: e.target.value }));
  const setEditBatch = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setEditBatchForm(p => ({ ...p, [f]: e.target.value }));
  const setEditPack  = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setEditPackForm(p => ({ ...p, [f]: e.target.value }));
  const setEditRm    = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setEditRmForm(p => ({ ...p, [f]: e.target.value }));
  const setEditPo    = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditPoForm(p => ({ ...p, [f]: e.target.value }));

  const reload = () => router.invalidate();

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await api.skus.update(sku.id, { ...editForm, currentInventory: +editForm.currentInventory, minThreshold: +editForm.minThreshold, productionTimelineDays: +editForm.productionTimelineDays, mrp: editForm.mrp !== "" ? +editForm.mrp : null });
      toast.success("SKU updated."); setEditOpen(false); reload();
    } catch { toast.error("Failed to update SKU."); } finally { setEditSaving(false); }
  };

  const savePackaging = async () => {
    if (!packForm.name || !packForm.vendorId) { toast.error("Name and vendor are required."); return; }
    setPackSaving(true);
    try {
      await api.skus.addPackaging(sku.id, { ...packForm, moq: +packForm.moq, leadTimeDays: +packForm.leadTimeDays, currentStock: +packForm.currentStock, mfrStock: +packForm.mfrStock, otherStock: +packForm.otherStock, transitStock: +packForm.transitStock, transitDeliveryDate: packForm.transitDeliveryDate || null, costPerUnit: +packForm.costPerUnit, lastPurchaseDate: packForm.lastPurchaseDate || null });
      toast.success("Packaging material added."); setPackOpen(false); setPackForm({ ...EMPTY_PACK, vendorId: vendors[0]?.id ?? "" }); reload();
    } catch { toast.error("Failed to add packaging."); } finally { setPackSaving(false); }
  };

  const saveRawMaterial = async () => {
    if (!rmForm.name || !rmForm.vendorId) { toast.error("Name and manufacturer are required."); return; }
    setRmSaving(true);
    try {
      await api.skus.addRawMaterial(sku.id, { ...rmForm, qtyPerUnit: +rmForm.qtyPerUnit, currentStock: +rmForm.currentStock, costPerUnit: +rmForm.costPerUnit });
      toast.success("Raw material added."); setRmOpen(false); setRmForm({ ...EMPTY_RM, vendorId: manufacturers[0]?.id ?? "" }); reload();
    } catch { toast.error("Failed to add raw material."); } finally { setRmSaving(false); }
  };

  const saveBatch = async () => {
    if (!batchForm.batchNumber || !batchForm.manufacturerId || !batchForm.startedAt || !batchForm.expectedCompletion) {
      toast.error("Batch number, manufacturer and dates are required."); return;
    }
    setBatchSaving(true);
    try {
      const matName = batchForm.materialCategory === "Packaging"
        ? allPackaging.find(p => p.id === batchForm.materialItemId)?.name ?? null
        : batchForm.materialCategory === "Raw Material"
        ? allRawMaterials.find(r => r.id === batchForm.materialItemId)?.name ?? null
        : null;
      await api.production.create({ ...batchForm, skuId: sku.id, quantity: +batchForm.quantity, vendorId: batchForm.vendorId || null, materialCategory: batchForm.materialCategory || null, materialItemId: batchForm.materialItemId || null, materialItemName: matName });
      setBatchOpen(false); setBatchForm({ ...EMPTY_BATCH, manufacturerId: manufacturers[0]?.id ?? "" }); await reload(); toast.success("Production batch created.");
    } catch { toast.error("Failed to create batch."); } finally { setBatchSaving(false); }
  };

  const deletePackaging = async (id: string) => {
    if (!confirm("Delete this packaging item?")) return;
    try { await api.skus.deletePackaging(id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); }
  };

  const deleteRawMaterial = async (id: string) => {
    if (!confirm("Delete this raw material?")) return;
    try { await api.skus.deleteRawMaterial(id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); }
  };

  const openEditBatch = (batch: typeof sku.productionBatches[0]) => {
    setEditBatchId(batch.id);
    setEditBatchForm({
      batchNumber: batch.batchNumber,
      manufacturerId: batch.manufacturerId,
      vendorId: batch.vendorId ?? "",
      quantity: batch.quantity,
      currentStage: batch.currentStage,
      startedAt: batch.startedAt.slice(0, 10),
      expectedCompletion: batch.expectedCompletion.slice(0, 10),
      delayed: batch.delayed,
      materialCategory: batch.materialCategory ?? "",
      materialItemId: batch.materialItemId ?? "",
      applicableStages: batch.applicableStages ?? [...PRODUCTION_STAGES],
      comment: batch.comment ?? "",
    });
    setEditBatchOpen(true);
  };

  const saveEditBatch = async () => {
    if (!editBatchId) return;
    setEditBatchSaving(true);
    try {
      const matName = editBatchForm.materialCategory === "Packaging"
        ? allPackaging.find(p => p.id === editBatchForm.materialItemId)?.name ?? null
        : editBatchForm.materialCategory === "Raw Material"
        ? allRawMaterials.find(r => r.id === editBatchForm.materialItemId)?.name ?? null
        : null;
      await api.production.update(editBatchId, { ...editBatchForm, quantity: +editBatchForm.quantity, vendorId: editBatchForm.vendorId || null, materialCategory: editBatchForm.materialCategory || null, materialItemId: editBatchForm.materialItemId || null, materialItemName: matName });
      setEditBatchOpen(false); await reload(); toast.success("Batch updated.");
    } catch { toast.error("Failed to update batch."); } finally { setEditBatchSaving(false); }
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Delete this production batch?")) return;
    try { await api.production.delete(id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); }
  };

  const openEditPack = (p: typeof sku.packaging[0]) => {
    setEditPackId(p.id);
    setEditPackForm({ name: p.name, vendorId: p.vendorId, moq: p.moq, leadTimeDays: p.leadTimeDays, currentStock: p.currentStock, mfrStock: p.mfrStock, otherStock: p.otherStock, transitStock: p.transitStock, transitDeliveryDate: p.transitDeliveryDate ?? "", costPerUnit: p.costPerUnit, lastPurchaseDate: p.lastPurchaseDate ?? "" });
    setEditPackOpen(true);
  };
  const saveEditPack = async () => {
    if (!editPackId) return;
    setEditPackSaving(true);
    try {
      await api.skus.updatePackaging(editPackId, { ...editPackForm, moq: +editPackForm.moq, leadTimeDays: +editPackForm.leadTimeDays, currentStock: +editPackForm.currentStock, mfrStock: +editPackForm.mfrStock, otherStock: +editPackForm.otherStock, transitStock: +editPackForm.transitStock, transitDeliveryDate: editPackForm.transitDeliveryDate || null, costPerUnit: +editPackForm.costPerUnit, lastPurchaseDate: editPackForm.lastPurchaseDate || null });
      toast.success("Packaging updated."); setEditPackOpen(false); reload();
    } catch { toast.error("Failed to update packaging."); } finally { setEditPackSaving(false); }
  };

  const openEditRm = (rm: typeof sku.rawMaterials[0]) => {
    setEditRmId(rm.id);
    setEditRmForm({ name: rm.name, vendorId: rm.vendorId, qtyPerUnit: rm.qtyPerUnit, unit: rm.unit, currentStock: rm.currentStock, costPerUnit: rm.costPerUnit });
    setEditRmOpen(true);
  };
  const saveEditRm = async () => {
    if (!editRmId) return;
    setEditRmSaving(true);
    try {
      await api.skus.updateRawMaterial(editRmId, { ...editRmForm, qtyPerUnit: +editRmForm.qtyPerUnit, currentStock: +editRmForm.currentStock, costPerUnit: +editRmForm.costPerUnit });
      toast.success("Raw material updated."); setEditRmOpen(false); reload();
    } catch { toast.error("Failed to update raw material."); } finally { setEditRmSaving(false); }
  };

  const openEditPo = (p: typeof sku.purchaseOrders[0]) => {
    setEditPoId(p.id);
    setEditPoForm({
      vendorId: p.vendorId ?? "", materialType: p.materialType, quantity: p.quantity, rate: p.rate,
      gstRate: p.gstRate ?? 18, gstAmount: p.gstAmount ?? 0, total: p.total,
      dispatchDate: p.dispatchDate, expectedDelivery: p.expectedDelivery, status: p.status,
      amountPaid: (p as any).amountPaid != null ? String((p as any).amountPaid) : "",
      paymentDueDate: (p as any).paymentDueDate ?? "",
      notes: p.notes ?? "", terms: (p as any).terms ?? "",
    });
    setEditPoOpen(true);
  };
  const saveEditPo = async () => {
    if (!editPoId) return;
    setEditPoSaving(true);
    try {
      const subtotal = Number(editPoForm.quantity) * Number(editPoForm.rate);
      const gstAmt   = Math.round(subtotal * Number(editPoForm.gstRate) / 100 * 100) / 100;
      await api.purchaseOrders.update(editPoId, {
        ...editPoForm,
        quantity: +editPoForm.quantity, rate: +editPoForm.rate as any, gstRate: +editPoForm.gstRate,
        gstAmount: gstAmt as any, total: (subtotal + gstAmt) as any,
        amountPaid: editPoForm.amountPaid ? +editPoForm.amountPaid as any : null,
        paymentDueDate: editPoForm.paymentDueDate || null,
        notes: editPoForm.notes || null, terms: editPoForm.terms || null,
      });
      toast.success("Purchase order updated."); setEditPoOpen(false); reload();
    } catch { toast.error("Failed to update purchase order."); } finally { setEditPoSaving(false); }
  };
  const deletePoFromHistory = async (id: string, poNumber: string) => {
    if (!confirm(`Delete PO ${poNumber}? This cannot be undone.`)) return;
    try {
      await api.purchaseOrders.delete(id);
      toast.success(`${poNumber} deleted.`);
      reload();
    } catch { toast.error("Failed to delete."); }
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/skus" className="hover:text-foreground">SKUs</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{sku.code}</span>
      </nav>

      <PageHeader
        title={sku.name}
        description={`${sku.code} · ${sku.category} · ${sku.type}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/skus"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
            <Button size="sm" onClick={() => setEditOpen(true)}><Edit className="mr-1.5 h-4 w-4" />Edit SKU</Button>
          </>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Product Details</TabsTrigger>
          <TabsTrigger value="packaging">Packaging ({sku.packaging.length})</TabsTrigger>
          <TabsTrigger value="raw">Raw Materials ({sku.rawMaterials.length})</TabsTrigger>
          <TabsTrigger value="production">Production ({sku.productionBatches.length})</TabsTrigger>
          <TabsTrigger value="tests">Tests ({(sku as any).tests?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="pohistory">PO History</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch ({(sku as any).dispatches?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="mft">MFT ({mftNotes.length})</TabsTrigger>
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="links">Links ({links.length})</TabsTrigger>
        </TabsList>

        {/* ── Product Details ── */}
        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl border bg-card">
              {sku.image ? <img src={sku.image} alt={sku.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">No image</div>}
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-3">
              {/* ── Current Inventory ── */}
              <div className="rounded-xl border bg-card p-4 flex flex-col gap-0">
                <button
                  type="button"
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setInvOpen((p) => !p)}
                >
                  <span className="text-xs text-muted-foreground">Current inventory</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Warehouse className="h-3.5 w-3.5" />
                    {invLocs.length > 0 ? `${invLocs.length} location${invLocs.length !== 1 ? "s" : ""}` : "Manage"}
                    {invOpen ? <ChevronDown className="h-3 w-3 rotate-180 transition-transform" /> : <ChevronDown className="h-3 w-3 transition-transform" />}
                  </span>
                </button>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{(invTotal ?? 0).toLocaleString()}</span>
                  <StatusBadge status={(invTotal ?? 0) < (sku.minThreshold ?? 0) ? "Low Stock" : "Healthy"} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Min threshold: {(sku.minThreshold ?? 0).toLocaleString()}</div>

                {invOpen && (
                  <div className="mt-3 border-t pt-3 space-y-3">
                    {/* Location list */}
                    {invLocs.length > 0 && (
                      <div className="space-y-1">
                        {invLocs.map((loc) => (
                          <div key={loc.id}>
                            {invEditId === loc.id ? (
                              <div className="flex items-center gap-2">
                                <Input className="h-7 text-xs flex-1" value={invEditName} onChange={(e) => setInvEditName(e.target.value)} />
                                <Input className="h-7 text-xs w-20" type="number" min="0" value={invEditQty} onChange={(e) => setInvEditQty(e.target.value)} />
                                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveLocEdit} disabled={invEditSaving}>{invEditSaving ? "…" : "Save"}</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setInvEditId(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs group">
                                <span className="text-muted-foreground">{loc.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold tabular-nums">{(loc.quantity ?? 0).toLocaleString()}</span>
                                  <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setInvEditId(loc.id); setInvEditName(loc.name); setInvEditQty(String(loc.quantity)); }}>
                                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </button>
                                  <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteLoc(loc.id)}>
                                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex justify-between px-3 pt-1 text-xs">
                          <span className="text-muted-foreground font-medium">Total</span>
                          <span className="font-semibold tabular-nums">{(invTotal ?? 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Add new location */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Add location</p>
                      <div className="flex gap-2">
                        <Input
                          className="h-7 text-xs flex-1"
                          placeholder="e.g. Blinkit, Amazon…"
                          value={invAddName}
                          onChange={(e) => setInvAddName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddLoc()}
                        />
                        <Input
                          className="h-7 text-xs w-20"
                          type="number" min="0"
                          placeholder="Qty"
                          value={invAddQty}
                          onChange={(e) => setInvAddQty(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddLoc()}
                        />
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddLoc} disabled={invAdding}>
                          {invAdding ? "…" : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Production lead time</div><div className="mt-1 text-2xl font-semibold tabular-nums">{sku.productionTimelineDays}d</div><div className="mt-1 text-xs text-muted-foreground">From PO to dispatch</div></div>
              <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Manufacturer</div><div className="mt-1 text-base font-semibold">{mfg?.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground">{mfg?.location} {mfg?.qcPassRate ? `· QC ${mfg.qcPassRate}%` : ""}</div></div>
              <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Packaging stock value</div><div className="mt-1 text-2xl font-semibold tabular-nums">₹{Math.round(totalPackagingValue).toLocaleString()}</div><div className="mt-1 text-xs text-muted-foreground">Across {sku.packaging.length} items</div></div>
              <div className="col-span-2 rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Product description</div><p className="mt-1.5 text-sm">{sku.description || "—"}</p></div>
              {sku.mrp != null && (
                <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">MRP</div><div className="mt-1 text-2xl font-semibold tabular-nums">₹{Number(sku.mrp).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
              )}
              {sku.usp && (
                <div className={`${sku.mrp != null ? "" : "col-span-2"} rounded-xl border bg-card p-4`}><div className="text-xs text-muted-foreground">USP</div><p className="mt-1.5 text-sm whitespace-pre-line">{sku.usp}</p></div>
              )}
              {(() => {
                let links: { label: string; url: string }[] = [];
                try { links = JSON.parse(sku.importantLinks || "[]"); } catch { links = []; }
                if (!Array.isArray(links) || !links.length) return null;
                return (
                  <div className="col-span-2 rounded-xl border bg-card p-4">
                    <div className="text-xs text-muted-foreground mb-2">Important Links</div>
                    <div className="flex flex-wrap gap-2">
                      {links.map((lnk, i) => (
                        <a key={i} href={lnk.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent transition-colors">
                          {lnk.label || lnk.url}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>

        {/* ── Packaging ── */}
        <TabsContent value="packaging" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setPackOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add Packaging Material</Button>
          </div>
          {sku.packaging.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No packaging materials yet. Click "Add Packaging Material" to get started.</div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {localPackaging.map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{p.name}</h4>
                    <span className="text-xs text-muted-foreground">{vendors.find(v => v.id === p.vendorId)?.name ?? p.vendorId}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right text-xs text-muted-foreground">MOQ<br /><span className="font-semibold tabular-nums text-foreground">{p.moq.toLocaleString()}</span></div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditPack(p)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deletePackaging(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {/* Vendor status badge — click to cycle */}
                <button
                  type="button"
                  onClick={() => cyclePackagingVendorStatus(p)}
                  title="Click to change vendor status"
                  className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-75 ${VENDOR_STATUS_STYLE[p.vendorStatus]}`}
                >
                  {p.vendorStatus}
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Own stock</div><div className="font-semibold tabular-nums">{(p.currentStock ?? 0).toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Mfr. warehouse</div><div className="font-semibold tabular-nums">{(p.mfrStock ?? 0).toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Other stock</div><div className="font-semibold tabular-nums">{(p.otherStock ?? 0).toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Total stock</div><div className="font-semibold tabular-nums">{((p.currentStock ?? 0) + (p.mfrStock ?? 0) + (p.otherStock ?? 0)).toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Transit</div><div className="font-semibold tabular-nums">{(p.transitStock ?? 0).toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Cost / unit</div><div className="font-semibold tabular-nums">₹{p.costPerUnit}</div></div>
                  <div><div className="text-muted-foreground">Lead time</div><div className="font-semibold tabular-nums">{p.leadTimeDays}d</div></div>
                </div>
                {p.transitStock > 0 && (
                  <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                    <span className="font-medium">In transit: {p.transitStock.toLocaleString()} units</span>
                    <span>Expected delivery: <span className="font-semibold">{fmtDate(p.transitDeliveryDate)}</span></span>
                  </div>
                )}
                <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">Last PO: {fmtDate(p.lastPurchaseDate)}</div>
                <VendorCardComments vendorId={p.vendorId} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Raw Materials ── */}
        <TabsContent value="raw" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setRmOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Add Raw Material</Button>
          </div>
          {localRm.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No raw materials yet. Click "Add Raw Material" to get started.</div>
          )}
          <div className="overflow-x-auto rounded-xl border bg-card">
            {localRm.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Material</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Qty / unit</th>
                    <th className="px-4 py-2.5 font-medium text-right">Stock</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                    <th className="px-4 py-2.5 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {localRm.map((rm) => (
                    <tr key={rm.id} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{rm.name}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => cycleRmVendorStatus(rm)}
                          title="Click to change vendor status"
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-75 ${VENDOR_STATUS_STYLE[rm.vendorStatus]}`}
                        >
                          {rm.vendorStatus}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rm.qtyPerUnit} {rm.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rm.currentStock} {rm.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">₹{rm.costPerUnit}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditRm(rm)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteRawMaterial(rm.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── Production ── */}
        <TabsContent value="production" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => setBatchOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Create Production Batch</Button>
          </div>
          {sku.productionBatches.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No production batches yet. Click "Create Production Batch" to track manufacturing.</div>
          )}
          <div className="space-y-4">
            {[...sku.productionBatches].sort((a, b) => (a.currentStage === "Completed" ? 1 : 0) - (b.currentStage === "Completed" ? 1 : 0)).map((batch) => {
              const completed = batch.currentStage === "Completed";
              const daysLate  = completed ? 0 : getDelayDays(batch);
              return (
                <div key={batch.id} className={`rounded-xl border bg-card p-5 ${completed ? "opacity-70" : ""}`}>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{batch.batchNumber}</div>
                      <p className="text-xs text-muted-foreground">{batch.quantity.toLocaleString()} units · ETA {fmtDate(batch.expectedCompletion)}</p>
                      {daysLate > 0 && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Delayed by {daysLate} {daysLate === 1 ? "day" : "days"}
                        </div>
                      )}
                      {(batch as any).vendor?.name && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Vendor: <span className="font-medium text-foreground">{(batch as any).vendor.name}</span></p>
                      )}
                      {batch.materialCategory && batch.materialItemName && (
                        <p className="mt-0.5 text-xs text-primary font-medium">{batch.materialCategory}: {batch.materialItemName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={completed ? "Completed" : daysLate > 0 ? "Delayed" : "In Production"} />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditBatch(batch)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteBatch(batch.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {completed ? (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-400">
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      All stages complete — batch delivered to warehouse
                    </div>
                  ) : (
                    <ProgressRail stages={(batch.applicableStages ?? PRODUCTION_STAGES) as any} current={batch.currentStage as any} delayed={daysLate > 0} />
                  )}
                  {batch.comment && (
                    <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      <span className="font-semibold text-foreground">Note: </span>{batch.comment}
                    </div>
                  )}

                  {/* Packaging inventory status */}
                  {localPackaging.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Packaging Inventory</p>
                      <div className="space-y-1.5">
                        {localPackaging.map((p) => {
                          const total = p.currentStock + p.mfrStock + p.otherStock;
                          const mfrReady = p.mfrStock >= batch.quantity;
                          const totalSufficient = total >= batch.quantity;
                          const needToSend = batch.quantity - p.mfrStock;
                          return (
                            <div key={p.id} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium">{p.name}</span>
                                {mfrReady ? (
                                  <div className="flex items-center gap-1 shrink-0 text-green-600 dark:text-green-400 font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Mfr ready
                                  </div>
                                ) : totalSufficient ? (
                                  <div className="flex items-center gap-1 shrink-0 text-amber-600 dark:text-amber-400 font-medium">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Send to Mfr
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 shrink-0 text-destructive font-medium">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Insufficient
                                  </div>
                                )}
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                <span className={`font-semibold ${mfrReady ? "text-green-600 dark:text-green-400" : totalSufficient ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
                                  {total.toLocaleString()}
                                </span>
                                {" "}
                                <span className="text-muted-foreground/60">
                                  ({p.currentStock.toLocaleString()} vendor + {p.mfrStock.toLocaleString()} Mfr{p.otherStock > 0 ? ` + ${p.otherStock.toLocaleString()} other` : ""})
                                </span>
                                {" / "}
                                <span className="font-medium text-foreground">{batch.quantity.toLocaleString()}</span>
                                {!mfrReady && needToSend > 0 && (
                                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                                    (Need to send {needToSend.toLocaleString()} more to Mfr)
                                  </span>
                                )}
                                {p.transitStock > 0 && (
                                  <span className="ml-2 text-amber-600 dark:text-amber-400">· +{p.transitStock.toLocaleString()} in transit</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── PO History ── */}
        <TabsContent value="pohistory" className="mt-4">
          {sku.purchaseOrders.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No PO history yet.</div>
          )}
          <div className="space-y-3">
            {sku.purchaseOrders.map((p) => {
              const paid    = Number((p as any).amountPaid ?? 0);
              const pending = Math.max(0, p.total - paid);
              const fmt     = (n: number) => `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              const showPayment = p.status !== "To be sent" && (paid > 0 || (p as any).paymentDueDate != null);
              return (
                <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{p.poNumber}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.dispatchDate)} · {p.vendor?.name}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={p.status} />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View PO" onClick={() => navigate({ to: "/purchase-orders/$poId", params: { poId: p.id } })}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditPo(p)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deletePoFromHistory(p.id, p.poNumber)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {/* Order details */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                    <div><div className="text-muted-foreground">SKU</div><div className="font-medium">{sku.code}</div></div>
                    <div><div className="text-muted-foreground">Material</div><div className="font-medium">{p.materialType}</div></div>
                    <div><div className="text-muted-foreground">Quantity</div><div className="font-medium tabular-nums">{p.quantity.toLocaleString()}</div></div>
                    <div><div className="text-muted-foreground">Rate / unit</div><div className="font-medium tabular-nums">₹{p.rate}</div></div>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-xs border-t pt-3 sm:grid-cols-4">
                    <div><div className="text-muted-foreground">GST ({p.gstRate ?? 0}%)</div><div className="font-medium tabular-nums">{fmt(p.gstAmount ?? 0)}</div></div>
                    <div><div className="text-muted-foreground">Grand Total</div><div className="font-semibold tabular-nums">{fmt(p.total)}</div></div>
                    <div><div className="text-muted-foreground">Expected delivery</div><div className="font-medium">{fmtDate(p.expectedDelivery)}</div></div>
                    <div className="hidden sm:block"><div className="text-muted-foreground">Notes</div><div className="font-medium truncate max-w-[160px]">{p.notes || "—"}</div></div>
                  </div>

                  {/* Payment tracking */}
                  {showPayment && (
                    <div className="grid grid-cols-3 gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs">
                      <div>
                        <div className="text-muted-foreground mb-0.5">Amount Paid</div>
                        <div className="font-semibold tabular-nums text-success">{fmt(paid)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5">Amount Pending</div>
                        <div className={`font-semibold tabular-nums ${pending > 0 ? "text-destructive" : "text-success"}`}>{fmt(pending)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-0.5">Pay by Date</div>
                        <div className="font-semibold">{fmtDate((p as any).paymentDueDate)}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Tests ── */}
        <TabsContent value="tests" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => { setTestForm({ testName: "", result: "" }); setEditTestId(null); setTestOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" />Add Test
            </Button>
          </div>
          {(sku as any).tests?.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No tests yet. Click "Add Test" to record test results.</div>
          )}
          <div className="overflow-x-auto rounded-xl border bg-card">
            {(sku as any).tests?.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left font-medium">Test Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Result</th>
                    <th className="px-4 py-2.5 text-right font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(sku as any).tests.map((t: any) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-medium align-top">{t.testName}</td>
                      <td className="px-4 py-3 text-muted-foreground align-top whitespace-pre-wrap">{t.result || "—"}</td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setTestForm({ testName: t.testName, result: t.result }); setEditTestId(t.id); setTestOpen(true); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={async () => { if (!confirm("Delete this test?")) return; try { await api.skus.deleteTest(t.id); toast.success("Deleted."); reload(); } catch { toast.error("Failed to delete."); } }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── Dispatch ── */}
        <TabsContent value="dispatch" className="mt-4">
          {(() => {
            const allDispatches: any[] = (sku as any).dispatches ?? [];
            const isHistory = (d: any) => d.status === "Delivered" && d.qcStatus === "Done";
            const active  = allDispatches.filter((d) => !isHistory(d));
            const history = allDispatches.filter(isHistory);

            const statusColors: Record<string, string> = {
              Dispatched:   "bg-blue-100 text-blue-800 border-blue-200",
              "In Transit": "bg-amber-100 text-amber-800 border-amber-200",
              Delivered:    "bg-green-100 text-green-800 border-green-200",
              Delayed:      "bg-red-100 text-red-800 border-red-200",
              Planned:      "bg-muted text-muted-foreground border-border",
            };
            const goodsColors: Record<string, string> = {
              "Final Goods":        "bg-purple-100 text-purple-800 border-purple-200",
              "Packaging Material": "bg-amber-100 text-amber-800 border-amber-200",
            };

            const renderCard = (d: any, muted = false) => (
              <div key={d.id} className={`rounded-xl border p-4 space-y-2 ${muted ? "bg-muted/30 opacity-80" : "bg-card"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{d.goodsName || "—"}</span>
                      <span className={`text-[11px] rounded-full border px-2 py-0.5 font-medium ${goodsColors[d.goodsType] ?? ""}`}>{d.goodsType}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.quantity.toLocaleString()} units · {fmtDate(d.dispatchDate)}</p>
                    {(d.from || d.to) && (
                      <p className="text-xs text-muted-foreground">
                        {d.from && <span>From: <span className="text-foreground font-medium">{d.from}</span></span>}
                        {d.from && d.to && <span className="mx-1">→</span>}
                        {d.to && <span>To: <span className="text-foreground font-medium">{d.to}</span></span>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] rounded-full border px-2 py-0.5 font-medium ${statusColors[d.status] ?? ""}`}>{d.status}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setDispatchForm({ goodsType: d.goodsType, goodsName: d.goodsName, quantity: d.quantity, dispatchDate: d.dispatchDate, from: d.from, to: d.to, transporterName: d.transporterName ?? "", vehicleNumber: d.vehicleNumber ?? "", lrNumber: d.lrNumber ?? "", freight: d.freight ?? 0, status: d.status, notes: d.notes }); setEditDispatchId(d.id); setDispatchOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={async () => { if (!confirm("Delete dispatch record?")) return; try { await api.skus.deleteDispatch(d.id); toast.success("Deleted."); reload(); } catch { toast.error("Failed."); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {(d.transporterName || d.vehicleNumber || d.lrNumber || d.freight > 0) && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t pt-2 sm:grid-cols-4">
                    {d.transporterName && <div><span className="text-muted-foreground">Transporter: </span><span className="font-medium">{d.transporterName}</span></div>}
                    {d.vehicleNumber   && <div><span className="text-muted-foreground">Vehicle: </span><span className="font-medium">{d.vehicleNumber}</span></div>}
                    {d.lrNumber        && <div><span className="text-muted-foreground">LR No: </span><span className="font-medium">{d.lrNumber}</span></div>}
                    {d.freight > 0     && <div><span className="text-muted-foreground">Freight: </span><span className="font-medium">₹{Number(d.freight).toLocaleString()}</span></div>}
                  </div>
                )}
                {d.notes && <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2">{d.notes}</p>}
                <PostDispatchSection dispatch={d} />
              </div>
            );

            return (
              <>
                <div className="mb-3 flex justify-end">
                  <Button size="sm" onClick={() => { setDispatchForm({ ...EMPTY_DISPATCH }); setEditDispatchId(null); setDispatchOpen(true); }}>
                    <Plus className="mr-1.5 h-4 w-4" />Add Dispatch
                  </Button>
                </div>

                {/* Active dispatches */}
                {active.length === 0 && history.length === 0 && (
                  <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No dispatch records yet. Click "Add Dispatch" to start tracking.</div>
                )}
                {active.length === 0 && history.length > 0 && (
                  <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No active dispatches. All entries are in history.</div>
                )}
                <div className="space-y-3">
                  {active.map((d) => renderCard(d))}
                </div>

                {/* Dispatch History */}
                {history.length > 0 && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setShowDispatchHistory((p) => !p)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
                    >
                      {showDispatchHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Dispatch History
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{history.length}</span>
                    </button>
                    {showDispatchHistory && (
                      <div className="space-y-3">
                        {history.map((d) => renderCard(d, true))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* ── MFT ── */}
        <TabsContent value="mft" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => { setMftForm({ date: new Date().toISOString().slice(0, 10), notes: "" }); setEditMftId(null); setMftOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" />Add Meeting Note
            </Button>
          </div>
          {mftNotes.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">No MFT notes yet. Click "Add Meeting Note" to record weekly updates.</div>
          )}
          <div className="space-y-3">
            {mftNotes.map((m) => (
              <div key={m.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">{fmtDate(m.date)}</span>
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setMftForm({ date: m.date, notes: m.notes }); setEditMftId(m.id); setMftOpen(true); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={async () => { if (!confirm("Delete this MFT note?")) return; try { await api.skus.deleteMft(m.id); toast.success("Deleted."); reload(); } catch { toast.error("Failed."); } }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{m.notes}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Comments ── */}
        <TabsContent value="comments" className="mt-4">
          {/* Inline add / edit box */}
          <div className="mb-4 rounded-xl border bg-card p-4">
            <Textarea
              rows={3}
              placeholder={editCommentId ? "Edit your comment…" : "Write a comment about this SKU…"}
              value={editCommentId ? editCommentText : commentText}
              onChange={(e) => editCommentId ? setEditCommentText(e.target.value) : setCommentText(e.target.value)}
              className="resize-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              {editCommentId && (
                <Button variant="outline" size="sm" onClick={() => { setEditCommentId(null); setEditCommentText(""); }}>
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                disabled={commentSaving || !(editCommentId ? editCommentText.trim() : commentText.trim())}
                onClick={async () => {
                  setCommentSaving(true);
                  try {
                    if (editCommentId) {
                      await api.skus.updateComment(editCommentId, editCommentText);
                      setEditCommentId(null);
                      setEditCommentText("");
                      toast.success("Comment updated.");
                    } else {
                      await api.skus.addComment(sku.id, commentText);
                      setCommentText("");
                      toast.success("Comment added.");
                    }
                    reload();
                  } catch { toast.error("Failed."); }
                  finally { setCommentSaving(false); }
                }}
              >
                {commentSaving ? "Saving…" : editCommentId ? "Save Edit" : "Add Comment"}
              </Button>
            </div>
          </div>

          {comments.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No comments yet. Write one above.
            </div>
          )}

          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="group rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                  <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => { setEditCommentId(c.id); setEditCommentText(c.comment); }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Delete this comment?")) return;
                        try { await api.skus.deleteComment(c.id); toast.success("Deleted."); reload(); }
                        catch { toast.error("Failed."); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {c.authorName && <span className="font-medium text-foreground/70">{c.authorName} · </span>}
                  {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {c.updatedAt !== c.createdAt && " · edited"}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Links ── */}
        <TabsContent value="links" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button size="sm" onClick={openAddLink}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Link
            </Button>
          </div>

          {links.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              No links saved yet. Add one above.
            </div>
          )}

          <div className="space-y-3">
            {links.map((l) => (
              <div key={l.id} className="group rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{l.title}</p>
                    <a
                      href={l.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex items-center gap-1 text-xs text-primary hover:underline break-all"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{l.link}</span>
                    </a>
                    {l.comment && (
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{l.comment}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditLink(l)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteLink(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Links Sheet ── */}
      <Sheet open={linkSheetOpen} onOpenChange={setLinkSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editLink ? "Edit Link" : "Add Link"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Regulatory Filing, Supplier Spec Sheet"
                value={linkForm.title}
                onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://example.com"
                value={linkForm.link}
                onChange={(e) => setLinkForm((f) => ({ ...f, link: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea
                placeholder="Any notes about this link…"
                rows={3}
                value={linkForm.comment}
                onChange={(e) => setLinkForm((f) => ({ ...f, comment: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setLinkSheetOpen(false)}>Cancel</Button>
            <Button onClick={saveLink} disabled={linkSaving}>
              {linkSaving ? "Saving…" : editLink ? "Save Changes" : "Add Link"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── MFT Sheet ── */}
      <Sheet open={mftOpen} onOpenChange={setMftOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editMftId ? "Edit Meeting Note" : "Add Meeting Note"}</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Meeting Date *</Label>
              <input type="date" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" value={mftForm.date} onChange={(e) => setMftForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting Notes *</Label>
              <Textarea rows={8} placeholder="Write the meeting updates here…" value={mftForm.notes} onChange={(e) => setMftForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setMftOpen(false)}>Cancel</Button>
            <Button
              disabled={mftSaving || !mftForm.date || !mftForm.notes.trim()}
              onClick={async () => {
                setMftSaving(true);
                try {
                  if (editMftId) {
                    await api.skus.updateMft(editMftId, mftForm);
                    toast.success("Note updated.");
                  } else {
                    await api.skus.addMft(sku.id, mftForm);
                    toast.success("Note added.");
                  }
                  setMftOpen(false);
                  reload();
                } catch {
                  toast.error("Save failed.");
                } finally {
                  setMftSaving(false);
                }
              }}
            >
              {mftSaving ? "Saving…" : editMftId ? "Save Changes" : "Add Note"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Dispatch Sheet ── */}
      <Sheet open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editDispatchId ? "Edit Dispatch" : "Add Dispatch"}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Type of Goods *</Label>
              <Select value={dispatchForm.goodsType} onValueChange={(v) => setDispatchForm(f => ({ ...f, goodsType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GOODS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Goods Name *</Label>
              <Input placeholder="e.g. SPF 50 Sunscreen 50ml" value={dispatchForm.goodsName} onChange={(e) => setDispatchForm(f => ({ ...f, goodsName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Number of Units *</Label>
                <Input type="number" value={dispatchForm.quantity || ""} onChange={(e) => setDispatchForm(f => ({ ...f, quantity: +e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Dispatch Date *</Label>
                <Input type="date" value={dispatchForm.dispatchDate} onChange={(e) => setDispatchForm(f => ({ ...f, dispatchDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input placeholder="Origin location" value={dispatchForm.from} onChange={(e) => setDispatchForm(f => ({ ...f, from: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input placeholder="Destination location" value={dispatchForm.to} onChange={(e) => setDispatchForm(f => ({ ...f, to: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Transporter Name</Label>
                <Input placeholder="e.g. BlueDart, DTDC" value={(dispatchForm as any).transporterName} onChange={(e) => setDispatchForm(f => ({ ...f, transporterName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Number</Label>
                <Input placeholder="e.g. MH12AB1234" value={(dispatchForm as any).vehicleNumber} onChange={(e) => setDispatchForm(f => ({ ...f, vehicleNumber: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>LR / Docket Number</Label>
                <Input placeholder="Lorry receipt number" value={(dispatchForm as any).lrNumber} onChange={(e) => setDispatchForm(f => ({ ...f, lrNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Freight (₹)</Label>
                <Input type="number" placeholder="0" value={(dispatchForm as any).freight || ""} onChange={(e) => setDispatchForm(f => ({ ...f, freight: +e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={dispatchForm.status} onValueChange={(v) => setDispatchForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DISPATCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} placeholder="Any additional notes…" value={dispatchForm.notes} onChange={(e) => setDispatchForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setDispatchOpen(false)}>Cancel</Button>
            <Button
              disabled={dispatchSaving}
              onClick={async () => {
                if (!dispatchForm.dispatchDate) { toast.error("Dispatch date is required."); return; }
                if (!dispatchForm.quantity)     { toast.error("Quantity is required."); return; }
                setDispatchSaving(true);
                try {
                  if (editDispatchId) { await api.skus.updateDispatch(editDispatchId, dispatchForm as any); toast.success("Dispatch updated."); }
                  else                { await api.skus.addDispatch(sku.id, dispatchForm as any); toast.success("Dispatch added."); }
                  setDispatchOpen(false); await reload();
                } catch { toast.error("Failed to save."); } finally { setDispatchSaving(false); }
              }}
            >{dispatchSaving ? "Saving…" : (editDispatchId ? "Save changes" : "Add Dispatch")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Test Sheet ── */}
      <Sheet open={testOpen} onOpenChange={setTestOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editTestId ? "Edit Test" : "Add Test"}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Test Name *</Label>
              <Input placeholder="e.g. Viscosity, pH, Microbial Count" value={testForm.testName} onChange={(e) => setTestForm(f => ({ ...f, testName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Result</Label>
              <Textarea rows={4} placeholder="e.g. Pass — 5000–7000 cPs at 25°C" value={testForm.result} onChange={(e) => setTestForm(f => ({ ...f, result: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button
              disabled={testSaving}
              onClick={async () => {
                if (!testForm.testName.trim()) { toast.error("Test name is required."); return; }
                setTestSaving(true);
                try {
                  if (editTestId) {
                    await api.skus.updateTest(editTestId, testForm);
                    toast.success("Test updated.");
                  } else {
                    await api.skus.addTest(sku.id, testForm);
                    toast.success("Test added.");
                  }
                  setTestOpen(false);
                  await reload();
                } catch { toast.error("Failed to save."); } finally { setTestSaving(false); }
              }}
            >{testSaving ? "Saving…" : (editTestId ? "Save changes" : "Add Test")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit SKU Sheet ── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit SKU — {sku.code}</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>SKU Code</Label><Input value={editForm.code} onChange={setEdit("code")} /></div>
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SKU_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Product Name</Label><Input value={editForm.name} onChange={setEdit("name")} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SKU_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Manufacturer</Label>
                <Select value={editForm.manufacturerId} onValueChange={(v) => setEditForm(f => ({ ...f, manufacturerId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={editForm.description} onChange={setEdit("description")} /></div>
            <div className="space-y-1.5">
              <Label>Product Image</Label>
              <ImageUpload value={editForm.image} onChange={(url) => setEditForm(f => ({ ...f, image: url }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" value={editForm.currentInventory} onChange={setEdit("currentInventory")} /></div>
              <div className="space-y-1.5"><Label>Min Threshold</Label><Input type="number" value={editForm.minThreshold} onChange={setEdit("minThreshold")} /></div>
              <div className="space-y-1.5"><Label>Lead time (days)</Label><Input type="number" value={editForm.productionTimelineDays} onChange={setEdit("productionTimelineDays")} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>MRP (₹)</Label>
              <Input type="number" step="0.01" placeholder="e.g. 499.00" value={editForm.mrp} onChange={setEdit("mrp")} />
            </div>
            <div className="space-y-1.5">
              <Label>USP</Label>
              <Textarea rows={3} placeholder="Unique selling points of this product…" value={editForm.usp} onChange={setEdit("usp")} />
            </div>
            <div className="space-y-1.5">
              <Label>Important Links</Label>
              <div className="space-y-2">
                {((() => { try { const p = JSON.parse(editForm.importantLinks || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } })() as { label: string; url: string }[]).map((lnk, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate">{lnk.label || lnk.url}</span>
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => {
                      const links = JSON.parse(editForm.importantLinks || "[]") as { label: string; url: string }[];
                      links.splice(i, 1);
                      setEditForm(f => ({ ...f, importantLinks: JSON.stringify(links) }));
                    }}>✕</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input placeholder="Label" value={linkInput.label} onChange={e => setLinkInput(l => ({ ...l, label: e.target.value }))} />
                  <Input placeholder="URL" value={linkInput.url} onChange={e => setLinkInput(l => ({ ...l, url: e.target.value }))} />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (!linkInput.url) return;
                    const links = JSON.parse(editForm.importantLinks || "[]") as { label: string; url: string }[];
                    links.push({ label: linkInput.label || linkInput.url, url: linkInput.url });
                    setEditForm(f => ({ ...f, importantLinks: JSON.stringify(links) }));
                    setLinkInput({ label: "", url: "" });
                  }}>Add</Button>
                </div>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Packaging Sheet ── */}
      <Sheet open={packOpen} onOpenChange={setPackOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Add Packaging Material</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Item Name *</Label><Input placeholder="e.g. Aluminium Can 150ml" value={packForm.name} onChange={setPack("name")} /></div>
            <div className="space-y-1.5"><Label>Vendor *</Label>
              <Select value={packForm.vendorId} onValueChange={(v) => setPackForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>MOQ (units)</Label><Input type="number" value={packForm.moq} onChange={setPack("moq")} /></div>
              <div className="space-y-1.5"><Label>Lead time (days)</Label><Input type="number" value={packForm.leadTimeDays} onChange={setPack("leadTimeDays")} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" value={packForm.currentStock} onChange={setPack("currentStock")} /></div>
              <div className="space-y-1.5"><Label>Mfr. Warehouse</Label><Input type="number" value={packForm.mfrStock} onChange={setPack("mfrStock")} /></div>
              <div className="space-y-1.5"><Label>Other Stock</Label><Input type="number" value={packForm.otherStock} onChange={setPack("otherStock")} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Transit Stock</Label><Input type="number" value={packForm.transitStock} onChange={setPack("transitStock")} /></div>
              <div className="space-y-1.5"><Label>Cost / unit (₹)</Label><Input type="number" step="0.01" value={packForm.costPerUnit} onChange={setPack("costPerUnit")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Transit Delivery Date</Label><Input type="date" value={packForm.transitDeliveryDate} onChange={setPack("transitDeliveryDate")} /></div>
            <div className="space-y-1.5"><Label>Last Purchase Date</Label><Input type="date" value={packForm.lastPurchaseDate} onChange={setPack("lastPurchaseDate")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setPackOpen(false)}>Cancel</Button>
            <Button onClick={savePackaging} disabled={packSaving}>{packSaving ? "Adding…" : "Add Packaging"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Raw Material Sheet ── */}
      <Sheet open={rmOpen} onOpenChange={setRmOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Add Raw Material</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Material Name *</Label><Input placeholder="e.g. Avobenzone (3%)" value={rmForm.name} onChange={setRm("name")} /></div>
            <div className="space-y-1.5"><Label>Manufacturer *</Label>
              <Select value={rmForm.vendorId} onValueChange={(v) => setRmForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5"><Label>Qty / unit</Label><Input type="number" step="0.01" value={rmForm.qtyPerUnit} onChange={setRm("qtyPerUnit")} /></div>
              <div className="space-y-1.5"><Label>Unit</Label>
                <Select value={rmForm.unit} onValueChange={(v) => setRmForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RAW_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" step="0.01" value={rmForm.currentStock} onChange={setRm("currentStock")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Cost / unit (₹)</Label><Input type="number" step="0.01" value={rmForm.costPerUnit} onChange={setRm("costPerUnit")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setRmOpen(false)}>Cancel</Button>
            <Button onClick={saveRawMaterial} disabled={rmSaving}>{rmSaving ? "Adding…" : "Add Raw Material"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Production Batch Sheet ── */}
      <Sheet open={editBatchOpen} onOpenChange={setEditBatchOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Production Batch</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Batch Number</Label><Input value={editBatchForm.batchNumber} onChange={setEditBatch("batchNumber")} /></div>
              <div className="space-y-1.5"><Label>Quantity (units)</Label><Input type="number" value={editBatchForm.quantity} onChange={setEditBatch("quantity")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Manufacturer</Label>
              <Select value={editBatchForm.manufacturerId} onValueChange={(v) => setEditBatchForm(f => ({ ...f, manufacturerId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Vendor (optional)</Label>
              <Select value={(editBatchForm as any).vendorId || "__none__"} onValueChange={(v) => setEditBatchForm(f => ({ ...f, vendorId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Material category + item */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link to Material (optional)</p>
              <div className="space-y-1.5">
                <Label>Material Category</Label>
                <Select value={editBatchForm.materialCategory} onValueChange={(v) => setEditBatchForm(f => ({ ...f, materialCategory: v, materialItemId: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Packaging">Packaging</SelectItem>
                    <SelectItem value="Raw Material">Raw Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editBatchForm.materialCategory && (
                <div className="space-y-1.5">
                  <Label>{editBatchForm.materialCategory === "Packaging" ? "Packaging Item" : "Raw Material"}</Label>
                  <Select value={editBatchForm.materialItemId} onValueChange={(v) => setEditBatchForm(f => ({ ...f, materialItemId: v }))}>
                    <SelectTrigger><SelectValue placeholder={`Select ${editBatchForm.materialCategory.toLowerCase()}…`} /></SelectTrigger>
                    <SelectContent>
                      {editBatchForm.materialCategory === "Packaging"
                        ? allPackaging.map(p => <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground">· Stock {(p.currentStock ?? 0).toLocaleString()}</span></SelectItem>)
                        : allRawMaterials.map(r => <SelectItem key={r.id} value={r.id}>{r.name} <span className="text-muted-foreground">· {r.currentStock} {r.unit}</span></SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Applicable Stages</Label>
              <p className="text-xs text-muted-foreground">Select only the stages this batch will go through.</p>
              <div className="rounded-lg border divide-y overflow-hidden">
                {PRODUCTION_STAGES.map((stage) => {
                  const checked = (editBatchForm.applicableStages as string[]).includes(stage);
                  return (
                    <label key={stage} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? (editBatchForm.applicableStages as string[]).filter(s => s !== stage)
                            : [...(editBatchForm.applicableStages as string[]), stage].sort((a, b) => PRODUCTION_STAGES.indexOf(a as any) - PRODUCTION_STAGES.indexOf(b as any));
                          const currentStillValid = next.includes(editBatchForm.currentStage) || editBatchForm.currentStage === "Completed";
                          setEditBatchForm(f => ({ ...f, applicableStages: next, currentStage: currentStillValid ? f.currentStage : (next[0] ?? "PO Generated") }));
                        }}
                        className="h-4 w-4 accent-primary shrink-0"
                      />
                      <span className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>{stage}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Current Stage</Label>
              <Select value={editBatchForm.currentStage} onValueChange={(v) => setEditBatchForm(f => ({ ...f, currentStage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(editBatchForm.applicableStages as string[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="Completed">✓ Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={editBatchForm.startedAt} onChange={setEditBatch("startedAt")} /></div>
              <div className="space-y-1.5"><Label>Expected Completion</Label><Input type="date" value={editBatchForm.expectedCompletion} onChange={setEditBatch("expectedCompletion")} /></div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="delayedFlag" checked={editBatchForm.delayed as boolean} onChange={(e) => setEditBatchForm(f => ({ ...f, delayed: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="delayedFlag">Mark as Delayed</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea rows={3} placeholder="Any notes about this batch…" value={(editBatchForm as any).comment ?? ""} onChange={(e) => setEditBatchForm(f => ({ ...f, comment: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditBatchOpen(false)}>Cancel</Button>
            <Button onClick={saveEditBatch} disabled={editBatchSaving}>{editBatchSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Packaging Sheet ── */}
      <Sheet key={editPackId ?? "ep"} open={editPackOpen} onOpenChange={setEditPackOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Packaging Material</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Item Name *</Label><Input value={editPackForm.name} onChange={setEditPack("name")} /></div>
            <div className="space-y-1.5"><Label>Vendor *</Label>
              <Select value={editPackForm.vendorId} onValueChange={(v) => setEditPackForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>MOQ (units)</Label><Input type="number" value={editPackForm.moq} onChange={setEditPack("moq")} /></div>
              <div className="space-y-1.5"><Label>Lead time (days)</Label><Input type="number" value={editPackForm.leadTimeDays} onChange={setEditPack("leadTimeDays")} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" value={editPackForm.currentStock} onChange={setEditPack("currentStock")} /></div>
              <div className="space-y-1.5"><Label>Mfr. Warehouse</Label><Input type="number" value={editPackForm.mfrStock} onChange={setEditPack("mfrStock")} /></div>
              <div className="space-y-1.5"><Label>Other Stock</Label><Input type="number" value={editPackForm.otherStock} onChange={setEditPack("otherStock")} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Transit Stock</Label><Input type="number" value={editPackForm.transitStock} onChange={setEditPack("transitStock")} /></div>
              <div className="space-y-1.5"><Label>Cost / unit (₹)</Label><Input type="number" step="0.01" value={editPackForm.costPerUnit} onChange={setEditPack("costPerUnit")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Transit Delivery Date</Label><Input type="date" value={editPackForm.transitDeliveryDate} onChange={setEditPack("transitDeliveryDate")} /></div>
            <div className="space-y-1.5"><Label>Last Purchase Date</Label><Input type="date" value={editPackForm.lastPurchaseDate} onChange={setEditPack("lastPurchaseDate")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditPackOpen(false)}>Cancel</Button>
            <Button onClick={saveEditPack} disabled={editPackSaving}>{editPackSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Raw Material Sheet ── */}
      <Sheet key={editRmId ?? "er"} open={editRmOpen} onOpenChange={setEditRmOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Raw Material</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Material Name *</Label><Input value={editRmForm.name} onChange={setEditRm("name")} /></div>
            <div className="space-y-1.5"><Label>Manufacturer *</Label>
              <Select value={editRmForm.vendorId} onValueChange={(v) => setEditRmForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5"><Label>Qty / unit</Label><Input type="number" step="0.01" value={editRmForm.qtyPerUnit} onChange={setEditRm("qtyPerUnit")} /></div>
              <div className="space-y-1.5"><Label>Unit</Label>
                <Select value={editRmForm.unit} onValueChange={(v) => setEditRmForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RAW_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Current Stock</Label><Input type="number" step="0.01" value={editRmForm.currentStock} onChange={setEditRm("currentStock")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Cost / unit (₹)</Label><Input type="number" step="0.01" value={editRmForm.costPerUnit} onChange={setEditRm("costPerUnit")} /></div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditRmOpen(false)}>Cancel</Button>
            <Button onClick={saveEditRm} disabled={editRmSaving}>{editRmSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit PO Sheet ── */}
      <Sheet key={editPoId ?? "epo"} open={editPoOpen} onOpenChange={setEditPoOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Purchase Order</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="space-y-1.5"><Label>Vendor</Label>
              <Select value={editPoForm.vendorId} onValueChange={(v) => setEditPoForm(f => ({ ...f, vendorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Material Type</Label><Input value={editPoForm.materialType} onChange={setEditPo("materialType")} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={editPoForm.quantity} onChange={setEditPo("quantity")} /></div>
              <div className="space-y-1.5"><Label>Rate (₹)</Label><Input type="number" step="0.01" value={editPoForm.rate} onChange={setEditPo("rate")} /></div>
              <div className="space-y-1.5"><Label>GST Rate</Label>
                <Select value={String(editPoForm.gstRate)} onValueChange={(v) => setEditPoForm(f => ({ ...f, gstRate: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GST_RATES.map(g => <SelectItem key={g} value={String(g)}>{g}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {(() => {
              const subtotal = Number(editPoForm.quantity) * Number(editPoForm.rate);
              const gstAmt   = Math.round(subtotal * Number(editPoForm.gstRate) / 100 * 100) / 100;
              return (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>GST @ {editPoForm.gstRate}%</span><span className="tabular-nums">₹{gstAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold text-sm"><span>Grand Total</span><span className="tabular-nums">₹{(subtotal + gstAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Dispatch Date</Label><Input type="date" value={editPoForm.dispatchDate} onChange={setEditPo("dispatchDate")} /></div>
              <div className="space-y-1.5"><Label>Expected Delivery</Label><Input type="date" value={editPoForm.expectedDelivery} onChange={setEditPo("expectedDelivery")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={editPoForm.status} onValueChange={(v) => setEditPoForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PO_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(() => {
              const total   = Number(editPoForm.quantity) * Number(editPoForm.rate) * (1 + Number(editPoForm.gstRate) / 100);
              const paid    = Number(editPoForm.amountPaid) || 0;
              const pending = Math.max(0, total - paid);
              const fmt     = (n: number) => `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              return (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Payment Tracking</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Amount Paid (₹)</Label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={editPoForm.amountPaid} onChange={setEditPo("amountPaid")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount Pending (₹)</Label>
                      <div className={`flex h-9 items-center rounded-md border px-3 text-sm tabular-nums font-medium ${pending > 0 ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/40 bg-success/5 text-success"}`}>
                        {fmt(pending)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date for Pending Payment</Label>
                    <Input type="date" value={editPoForm.paymentDueDate} onChange={setEditPo("paymentDueDate")} />
                  </div>
                  <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground grid grid-cols-3 gap-2">
                    <div><span className="block font-medium text-foreground">{fmt(total)}</span>Grand Total</div>
                    <div><span className="block font-medium text-foreground">{fmt(paid)}</span>Paid</div>
                    <div><span className={`block font-medium ${pending > 0 ? "text-destructive" : "text-success"}`}>{fmt(pending)}</span>Pending</div>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional notes" value={editPoForm.notes} onChange={setEditPo("notes")} /></div>
            <div className="space-y-1.5">
              <Label>Terms & Conditions</Label>
              <Textarea rows={6} className="font-mono text-xs" placeholder="Enter terms and conditions…" value={editPoForm.terms} onChange={setEditPo("terms")} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditPoOpen(false)}>Cancel</Button>
            <Button onClick={saveEditPo} disabled={editPoSaving}>{editPoSaving ? "Saving…" : "Save changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Create Production Batch Sheet ── */}
      <Sheet open={batchOpen} onOpenChange={setBatchOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Create Production Batch</SheetTitle></SheetHeader>
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Batch Number *</Label><Input placeholder="e.g. BATCH-2026-001" value={batchForm.batchNumber} onChange={setBatch("batchNumber")} /></div>
              <div className="space-y-1.5"><Label>Quantity (units)</Label><Input type="number" value={batchForm.quantity} onChange={setBatch("quantity")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Manufacturer *</Label>
              <Select value={batchForm.manufacturerId} onValueChange={(v) => setBatchForm(f => ({ ...f, manufacturerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Vendor (optional)</Label>
              <Select value={batchForm.vendorId || "__none__"} onValueChange={(v) => setBatchForm(f => ({ ...f, vendorId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Material category + item */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link to Material (optional)</p>
              <div className="space-y-1.5">
                <Label>Material Category</Label>
                <Select value={batchForm.materialCategory} onValueChange={(v) => setBatchForm(f => ({ ...f, materialCategory: v, materialItemId: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Packaging">Packaging</SelectItem>
                    <SelectItem value="Raw Material">Raw Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {batchForm.materialCategory && (
                <div className="space-y-1.5">
                  <Label>{batchForm.materialCategory === "Packaging" ? "Packaging Item" : "Raw Material"}</Label>
                  <Select value={batchForm.materialItemId} onValueChange={(v) => setBatchForm(f => ({ ...f, materialItemId: v }))}>
                    <SelectTrigger><SelectValue placeholder={`Select ${batchForm.materialCategory.toLowerCase()}…`} /></SelectTrigger>
                    <SelectContent>
                      {batchForm.materialCategory === "Packaging"
                        ? allPackaging.map(p => <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-muted-foreground">· Stock {(p.currentStock ?? 0).toLocaleString()}</span></SelectItem>)
                        : allRawMaterials.map(r => <SelectItem key={r.id} value={r.id}>{r.name} <span className="text-muted-foreground">· {r.currentStock} {r.unit}</span></SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Applicable Stages</Label>
              <p className="text-xs text-muted-foreground">Select only the stages this batch will go through.</p>
              <div className="rounded-lg border divide-y overflow-hidden">
                {PRODUCTION_STAGES.map((stage) => {
                  const checked = (batchForm.applicableStages as string[]).includes(stage);
                  return (
                    <label key={stage} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? (batchForm.applicableStages as string[]).filter(s => s !== stage)
                            : [...(batchForm.applicableStages as string[]), stage].sort((a, b) => PRODUCTION_STAGES.indexOf(a as any) - PRODUCTION_STAGES.indexOf(b as any));
                          const currentStillValid = next.includes(batchForm.currentStage) || batchForm.currentStage === "Completed";
                          setBatchForm(f => ({ ...f, applicableStages: next, currentStage: currentStillValid ? f.currentStage : (next[0] ?? "PO Generated") }));
                        }}
                        className="h-4 w-4 accent-primary shrink-0"
                      />
                      <span className={`text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>{stage}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Current Stage</Label>
              <Select value={batchForm.currentStage} onValueChange={(v) => setBatchForm(f => ({ ...f, currentStage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(batchForm.applicableStages as string[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="Completed">✓ Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Start Date *</Label><Input type="date" value={batchForm.startedAt} onChange={setBatch("startedAt")} /></div>
              <div className="space-y-1.5"><Label>Expected Completion *</Label><Input type="date" value={batchForm.expectedCompletion} onChange={setBatch("expectedCompletion")} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea rows={3} placeholder="Any notes about this batch…" value={batchForm.comment as string} onChange={(e) => setBatchForm(p => ({ ...p, comment: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancel</Button>
            <Button onClick={saveBatch} disabled={batchSaving}>{batchSaving ? "Creating…" : "Create Batch"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
