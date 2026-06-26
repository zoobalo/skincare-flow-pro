const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api`;

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("zoobalo_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sharedQs(sharedTeamId?: string | null, extra?: URLSearchParams): string {
  const q = extra ? new URLSearchParams(extra) : new URLSearchParams();
  if (sharedTeamId) q.set("sharedTeamId", sharedTeamId);
  const s = q.toString();
  return s ? "?" + s : "";
}

function sharedUserQs(sharedUserId?: string | null): string {
  if (!sharedUserId) return "";
  return "?sharedUserId=" + encodeURIComponent(sharedUserId);
}

async function get<T>(path: string): Promise<T> {
  if (typeof window === "undefined") return [] as unknown as T;
  const r = await fetch(BASE + path, { headers: authHeaders() });
  if (r.status === 401) {
    const dest = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?redirect=${dest}`;
    throw new Error("Unauthorized");
  }
  // If a shared request is forbidden, retry without sharedTeamId so own data loads
  if (r.status === 403 && path.includes("sharedTeamId=")) {
    const [basePath, qs] = path.split("?");
    const params = new URLSearchParams(qs ?? "");
    params.delete("sharedTeamId");
    const newQs = params.toString();
    return get<T>(newQs ? `${basePath}?${newQs}` : basePath);
  }
  if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

const EMPTY_DASHBOARD: DashboardResponse = {
  kpis: { totalPOs: 0, pendingApprovals: 0, activeProduction: 0, inTransit: 0, delayedBatches: 0, lowStockSkus: 0, totalSpend: 0, totalDuePayments: 0, totalVendors: 0, totalSkus: 0 },
  charts: { procurementSpend: [], monthlyProduction: [], poStatusBreakdown: {}, vendorReliability: [], shipmentStatusBreakdown: {} },
};

// Auth API
export const auth = {
  login:  (email: string, password: string) =>
    fetch(`${BASE}/auth/login`,  { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ email, password }) }).then(r => r.json()),
  signup: (name: string, email: string, password: string, department: string) =>
    fetch(`${BASE}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ name, email, password, department }) }).then(r => r.json()),
  me: () =>
    fetch(`${BASE}/auth/me`, { headers: authHeaders() }).then(r => r.json()),
};

// ── Shared types ─────────────────────────────────────────────────────────────

export type ApiContact = { department: string; name: string; mobile: string; email: string };

export type ApiVendor = {
  id: string; name: string; contactPerson: string; mobile: string;
  email: string; gst: string; pan: string | null; address: string; city: string;
  materials: string[]; leadTimeDays: number; paymentTerms: string;
  rating: number; reliability: number; delayPercent: number;
  totalOrders: number; runningOrders: number; totalSpend: number;
  contacts: ApiContact[];
  docsLink?: string | null;
};

export type ApiVendorComment = {
  id: string; vendorId: string; authorId: string; authorName: string; text: string; createdAt: string;
};

export type ApiManufacturer = {
  id: string; name: string; location: string; city: string;
  email: string; gst: string; pan: string | null; contactPerson: string; mobile: string;
  capacityPerMonth: number; activeBatches: number; qcPassRate: number;
  leadTimeDays: number; paymentTerms: string;
  rating: number; reliability: number; delayPercent: number;
  contacts: ApiContact[];
  docsLink?: string | null;
  productionBatches: ApiBatch[];
};

export type ApiSku = {
  id: string; code: string; name: string; category: string; type: string;
  description: string; image: string; manufacturerId: string;
  currentInventory: number; minThreshold: number; productionTimelineDays: number;
  mrp: number | null; usp: string; importantLinks: string;
  manufacturer?: { id: string; name: string };
};

export type ApiSkuTest = {
  id: string; skuId: string; testName: string; result: string;
  createdAt: string; updatedAt: string;
};

export type ApiSkuDispatch = {
  id: string; skuId: string;
  goodsType: "Packaging Material" | "Final Goods";
  goodsName: string; quantity: number; dispatchDate: string;
  from: string; to: string;
  transporterName: string; vehicleNumber: string; lrNumber: string; freight: number;
  status: "Planned" | "Dispatched" | "In Transit" | "Delivered" | "Delayed";
  notes: string;
  batchNumber: string | null;
  coaLink: string | null;
  invoiceNumber: string | null;
  invoiceLink: string | null;
  qcStatus: "Done" | "Pending" | null;
  createdAt: string; updatedAt: string;
};

export type ApiSkuDetail = ApiSku & {
  manufacturer: ApiManufacturer;
  packaging: ApiPackagingItem[];
  rawMaterials: ApiRawMaterial[];
  purchaseOrders: ApiPo[];
  productionBatches: ApiBatch[];
  tests: ApiSkuTest[];
  dispatches: ApiSkuDispatch[];
};

export type VendorStatus = "Currently Working" | "Worked Before" | "Never Worked";

export type ApiPackagingItem = {
  id: string; skuId: string; name: string; vendorId: string;
  vendorStatus: VendorStatus;
  moq: number; leadTimeDays: number; currentStock: number; transitStock: number;
  transitDeliveryDate: string | null;
  costPerUnit: number; lastPurchaseDate: string | null;
  sku?: { id: string; code: string; name: string };
};

export type ApiRawMaterial = {
  id: string; skuId: string; name: string; vendorId: string;
  vendorStatus: VendorStatus;
  qtyPerUnit: number; unit: string; currentStock: number; costPerUnit: number;
  sku?: { id: string; code: string; name: string };
};

export type POLineItem = {
  description: string;
  quantity: number;
  rate: number;
  gstRate: number;
  subtotal: number;
  gstAmount: number;
  total: number;
};

export type ApiPo = {
  id: string; poNumber: string; vendorId: string | null; manufacturerId: string | null; skuId: string;
  materialType: string; quantity: number; rate: number;
  gstRate: number; gstAmount: number; total: number;
  category: string | null;
  items: POLineItem[] | null;
  deliveryAddress: string | null;
  dispatchDate: string; expectedDelivery: string;
  status: "To be sent" | "Sent" | "Pending" | "Approved" | "In Production" | "Dispatched" | "Delivered" | "Delayed";
  paymentDue: number | null; amountPaid: number | null; paymentDueDate: string | null; notes: string | null; terms: string | null;
  images?: string[] | null;
  vendor?: { id: string; name: string; city: string } | null;
  manufacturer?: { id: string; name: string; city: string; location: string } | null;
  sku?: { id: string; code: string; name: string };
};

export type ApiBatch = {
  id: string; batchNumber: string; skuId: string; manufacturerId: string; vendorId: string | null;
  quantity: number; currentStage: string; startedAt: string;
  expectedCompletion: string; delayed: boolean;
  materialCategory: string | null; materialItemId: string | null; materialItemName: string | null;
  applicableStages: string[] | null; comment: string | null;
  sku?: { id: string; code: string; name: string; image: string };
  manufacturer?: { id: string; name: string; location: string };
  vendor?: { id: string; name: string; city: string } | null;
  stageHistory?: Array<{ id: number; batchId: string; stage: string; date: string; note: string | null }>;
};

export type ApiShipment = {
  id: string; lrNumber: string; transporter: string; driverName: string;
  vehicleNumber: string; origin: string; destination: string;
  pickupDate: string; expectedDelivery: string; currentLocation: string;
  freightCost: number; status: "In Transit" | "Delivered" | "Delayed" | "Loading";
  linkedPoNumber: string | null;
  purchaseOrder?: { id: string; poNumber: string; status: string; vendor?: { id: string; name: string } } | null;
};

export type ApiUser = {
  id: string; name: string; email: string; role: string; status: string;
};

export type ApiDirectoryEntry = {
  id: string; name: string; category: string;
  address: string; state: string; country: string;
  contact1Name: string; contact1Phone: string;
  contact2Name: string; contact2Phone: string;
  email1: string; email2: string; comment: string;
  createdAt: string; updatedAt: string;
};

export type ApiNpdImageGroup = { name: string; images: string[]; comment: string };

export type ApiProductionRemark = {
  id: string;
  skuId: string | null;
  materialType: "None" | "Packaging Material" | "Raw Material";
  remark: string;
  status: "Active" | "Conveyed" | "Resolved";
  createdAt: string; updatedAt: string;
  skuCode?: string | null; skuName?: string | null;
};

export type ApiNpd = {
  id: string; name: string; launchMonth: string | null;
  rmStatus: string; pmStatus: string;
  images: ApiNpdImageGroup[]; comments: string;
  createdAt: string; updatedAt: string;
};

export type ApiSkuComment = {
  id: string; skuId: string; comment: string; authorName: string; createdAt: string; updatedAt: string;
};

export type ApiSkuCommentWithSku = ApiSkuComment & { skuCode: string; skuName: string };
export type ApiSkuDispatchWithSku = ApiSkuDispatch & { skuCode: string; skuName: string };

export type ApiSkuLink = {
  id: string; skuId: string; title: string; link: string; comment: string; createdAt: string;
};

export type ApiAssignedTask = {
  id: string; teamId: string; title: string; comments: string;
  urgency: "Low" | "Medium" | "High" | "Very High";
  deadlineDate: string | null;
  assignedTo: string; assignedToName: string;
  assignedBy: string; assignedByName: string;
  status: "Pending" | "Done";
  createdAt: string; updatedAt: string;
};

export type ApiAssignableUser = { id: string; name: string; email: string; department: string };

export type ApiAssignedTaskComment = {
  id: string; taskId: string; authorId: string; authorName: string; text: string; createdAt: string;
};

export type ApiWarehouseQc = {
  id: string; teamId: string; qcDate: string; qcDoneBy: string;
  qcTypes: string[]; skuIds: string[];
  reportText: string; reportImageUrl: string | null; reportLink: string | null;
  comment: string; createdAt: string; updatedAt: string;
};

export type ApiMftNote = {
  id: string; skuId: string | null; date: string; notes: string; createdAt: string;
};

export type ApiArtworkItem = {
  id: string; skuName: string; artworkType: string;
  imageUrl: string | null; statusRemark: string | null;
  statusUpdatedAt: string | null; comment: string | null;
  fileLink: string | null;
  createdAt: string; updatedAt: string;
};

export type ApiArtworkComment = {
  id: string; artworkId: string; text: string;
  authorName: string; teamId: string; createdAt: string;
};

export type ApiFollowUpContact = {
  id: string; name: string; phone: string | null; email: string | null; notes: string | null; createdAt: string;
};

export type ApiFollowUpTask = {
  id: string; contactId: string; description: string; done: boolean; doneAt: string | null; createdAt: string;
};

export type ApiTask = {
  id: string; title: string; comments: string;
  status: "None" | "Initiated" | "Done";
  urgency: "Low" | "Medium" | "High" | "Very High";
  skuId: string | null; productType: "None" | "Packaging Material" | "Raw Material";
  deadlineDate: string | null;
  createdAt: string; updatedAt: string;
};

export type ApiImpLink = {
  id: string; name: string; link: string; comment: string | null;
  createdAt: string; updatedAt: string;
};

export type ApiCourier = {
  id: string; name: string; courierPartner: string; dispatchDate: string;
  docketNumber: string; comment: string | null; createdAt: string; updatedAt: string;
};

export type ApiSampleProduct = {
  id: string; sampleId: string; productName: string; quantity: number;
  returned: boolean; returnedAt: string | null; teamId: string; createdAt: string;
};

export type ApiSample = {
  id: string; personName: string; purpose: string | null; comment: string | null;
  teamId: string; createdAt: string;
  products: ApiSampleProduct[];
};

export type ApiPm = {
  id: string; code: string; name: string; category: string;
  description: string; specifications: string; image: string;
  currentStock: number; minThreshold: number; moq: number; leadTimeDays: number;
  costPerUnit: number | null;
  docsLink?: string | null;
  teamId: string; createdAt: string; updatedAt: string;
};

export type ApiPmVendor = {
  id: string; pmId: string; vendorId: string;
  vendorStatus: VendorStatus;
  moq: number | null; leadTimeDays: number | null; costPerUnit: number | null;
  notes: string; teamId: string;
};

export type ApiPmDispatch = {
  id: string; pmId: string; quantity: number; dispatchDate: string;
  from: string; to: string;
  transporterName: string; vehicleNumber: string; lrNumber: string;
  freight: number; status: string; notes: string; createdAt: string;
};

export type ApiPmComment = {
  id: string; pmId: string; authorId: string; authorName: string; text: string; createdAt: string;
};

export type ApiPmLink = {
  id: string; pmId: string; title: string; link: string; comment: string; createdAt: string;
};

export type ApiPmDetail = ApiPm & {
  vendors: ApiPmVendor[];
  dispatches: ApiPmDispatch[];
  comments: ApiPmComment[];
  links: ApiPmLink[];
};

export type ApiShare = {
  id: string; module: string; ownerTeamId: string;
  granteeUserId: string; createdBy: string; createdAt: string;
  granteeName?: string; granteeEmail?: string;
};

export type ApiGrant = {
  id: string; module: string; ownerTeamId: string;
  granteeUserId: string; createdBy: string; createdAt: string;
  ownerTeamName: string; ownerDept: string;
};

export type ApiUserShare = {
  id: string; module: string; ownerUserId: string;
  granteeUserId: string; createdBy: string; createdAt: string;
  granteeName?: string; granteeEmail?: string;
};

export type ApiUserGrant = {
  id: string; module: string; ownerUserId: string;
  granteeUserId: string; createdBy: string; createdAt: string;
  ownerUserName: string; ownerUserEmail: string;
};

export type ApiShareableUser = {
  id: string; name: string; email: string; department: string; teamId: string; teamName: string;
};

export type DashboardResponse = {
  kpis: {
    totalPOs: number; pendingApprovals: number; activeProduction: number;
    inTransit: number; delayedBatches: number; lowStockSkus: number;
    totalSpend: number; totalDuePayments: number; totalVendors: number; totalSkus: number;
  };
  charts: {
    procurementSpend: Array<{ month: string; total: number }>;
    monthlyProduction: Array<{ month: string; quantity: number }>;
    poStatusBreakdown: Record<string, number>;
    vendorReliability: Array<{ name: string; reliability: number; delayPercent: number }>;
    shipmentStatusBreakdown: Record<string, number>;
  };
};

// Helper to parse Drizzle numeric strings → numbers
function parseNum(v: unknown): number {
  return typeof v === "string" ? parseFloat(v) : (v as number) ?? 0;
}

function coerceVendor(v: any): ApiVendor {
  return { ...v, rating: parseNum(v.rating), totalSpend: parseNum(v.totalSpend) };
}

function coercePo(p: any): ApiPo {
  return { ...p, rate: parseNum(p.rate), gstAmount: parseNum(p.gstAmount), total: parseNum(p.total), paymentDue: p.paymentDue != null ? parseNum(p.paymentDue) : null, amountPaid: p.amountPaid != null ? parseNum(p.amountPaid) : null };
}

function coerceShipment(s: any): ApiShipment {
  return { ...s, freightCost: parseNum(s.freightCost) };
}

function coercePackaging(p: any): ApiPackagingItem {
  return { ...p, costPerUnit: parseNum(p.costPerUnit), vendorStatus: p.vendorStatus ?? "Currently Working" };
}

function coerceRawMaterial(r: any): ApiRawMaterial {
  return { ...r, qtyPerUnit: parseNum(r.qtyPerUnit), currentStock: parseNum(r.currentStock), costPerUnit: parseNum(r.costPerUnit), vendorStatus: r.vendorStatus ?? "Currently Working" };
}

function coerceManufacturer(m: any): ApiManufacturer {
  return { ...m, qcPassRate: parseNum(m.qcPassRate), rating: parseNum(m.rating) };
}

// ── Months helper ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function fmtMonth(iso: string) {
  const m = parseInt(iso.slice(5, 7), 10);
  return MONTH_NAMES[m - 1] ?? iso;
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  dashboard: {
    kpis: () => typeof window === "undefined" ? Promise.resolve(EMPTY_DASHBOARD) : get<DashboardResponse>("/dashboard/kpis"),
  },

  vendors: {
    list: async (sharedTeamId?: string) => (await get<any[]>(`/vendors${sharedQs(sharedTeamId)}`)).map(coerceVendor),
    get: async (id: string) => {
      const v = await get<any>(`/vendors/${id}`);
      return { ...coerceVendor(v), purchaseOrders: (v.purchaseOrders ?? []).map(coercePo) } as ApiVendor & { purchaseOrders: ApiPo[] };
    },
    create: (data: Partial<ApiVendor>, sharedTeamId?: string) =>
      fetch(`${BASE}/vendors${sharedQs(sharedTeamId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiVendor>) =>
      fetch(`${BASE}/vendors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/vendors/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    listComments: (vendorId: string) => get<ApiVendorComment[]>(`/vendors/${vendorId}/comments`),
    addComment: (vendorId: string, text: string) =>
      fetch(`${BASE}/vendors/${vendorId}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ text }) }).then((r) => r.json()),
    deleteComment: (vendorId: string, commentId: string) =>
      fetch(`${BASE}/vendors/${vendorId}/comments/${commentId}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  manufacturers: {
    list: async (sharedTeamId?: string) => (await get<any[]>(`/manufacturers${sharedQs(sharedTeamId)}`)).map(coerceManufacturer),
    create: (data: Partial<ApiManufacturer>, sharedTeamId?: string) =>
      fetch(`${BASE}/manufacturers${sharedQs(sharedTeamId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiManufacturer>) =>
      fetch(`${BASE}/manufacturers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/manufacturers/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  skus: {
    list: async (search?: string, category?: string, sharedTeamId?: string) => {
      const q = new URLSearchParams();
      if (search)   q.set("search",   search);
      if (category) q.set("category", category);
      return get<ApiSku[]>(`/skus${sharedQs(sharedTeamId, q)}`);
    },
    get: async (id: string) => {
      const s = await get<any>(`/skus/${id}`);
      if (!s?.id) return null;
      return {
        ...s,
        packaging:         (s.packaging         ?? []).map(coercePackaging),
        rawMaterials:      (s.rawMaterials      ?? []).map(coerceRawMaterial),
        purchaseOrders:    (s.purchaseOrders    ?? []).map(coercePo),
        productionBatches: (s.productionBatches ?? []),
        tests:             (s.tests             ?? []),
        dispatches:        (s.dispatches        ?? []),
        importantLinks:    s.importantLinks ?? "[]",
      } as ApiSkuDetail;
    },
    create: (data: Partial<ApiSku>, sharedTeamId?: string) =>
      fetch(`${BASE}/skus${sharedQs(sharedTeamId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiSku>) =>
      fetch(`${BASE}/skus/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/skus/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addPackaging: (skuId: string, data: Partial<ApiPackagingItem>) =>
      fetch(`${BASE}/skus/${skuId}/packaging`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updatePackaging: (id: string, data: Partial<ApiPackagingItem>) =>
      fetch(`${BASE}/skus/packaging/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deletePackaging: (id: string) =>
      fetch(`${BASE}/skus/packaging/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addRawMaterial: (skuId: string, data: Partial<ApiRawMaterial>) =>
      fetch(`${BASE}/skus/${skuId}/raw-materials`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateRawMaterial: (id: string, data: Partial<ApiRawMaterial>) =>
      fetch(`${BASE}/skus/raw-materials/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteRawMaterial: (id: string) =>
      fetch(`${BASE}/skus/raw-materials/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addTest: (skuId: string, data: Partial<ApiSkuTest>) =>
      fetch(`${BASE}/skus/${skuId}/tests`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateTest: (id: string, data: Partial<ApiSkuTest>) =>
      fetch(`${BASE}/skus/tests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteTest: (id: string) =>
      fetch(`${BASE}/skus/tests/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addDispatch: (skuId: string, data: Partial<ApiSkuDispatch>) =>
      fetch(`${BASE}/skus/${skuId}/dispatches`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateDispatch: (id: string, data: Partial<ApiSkuDispatch>) =>
      fetch(`${BASE}/skus/dispatches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteDispatch: (id: string) =>
      fetch(`${BASE}/skus/dispatches/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    listMft: (skuId: string) => get<ApiMftNote[]>(`/skus/${skuId}/mft`),
    addMft: (skuId: string, data: { date: string; notes: string }) =>
      fetch(`${BASE}/skus/${skuId}/mft`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateMft: (id: string, data: { date?: string; notes?: string }) =>
      fetch(`${BASE}/skus/mft/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteMft: (id: string) =>
      fetch(`${BASE}/skus/mft/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    listAllComments: (sharedTeamId?: string) => get<ApiSkuCommentWithSku[]>(`/skus/all-comments${sharedQs(sharedTeamId)}`),
    listAllDispatches: (sharedTeamId?: string) => get<ApiSkuDispatchWithSku[]>(`/skus/all-dispatches${sharedQs(sharedTeamId)}`),
    listComments: (skuId: string) => get<ApiSkuComment[]>(`/skus/${skuId}/comments`),
    addComment: (skuId: string, comment: string) =>
      fetch(`${BASE}/skus/${skuId}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ comment }) }).then((r) => r.json()),
    updateComment: (id: string, comment: string) =>
      fetch(`${BASE}/skus/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ comment }) }).then((r) => r.json()),
    deleteComment: (id: string) =>
      fetch(`${BASE}/skus/comments/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    listLinks: (skuId: string) => get<ApiSkuLink[]>(`/skus/${skuId}/links`),
    addLink: (skuId: string, data: { title: string; link: string; comment?: string }) =>
      fetch(`${BASE}/skus/${skuId}/links`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateLink: (id: string, data: { title?: string; link?: string; comment?: string }) =>
      fetch(`${BASE}/skus/links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteLink: (id: string) =>
      fetch(`${BASE}/skus/links/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  purchaseOrders: {
    list: async (params?: { status?: string; vendorId?: string; skuId?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return (await get<any[]>(`/purchase-orders${q ? "?" + q : ""}`)).map(coercePo);
    },
    get: async (id: string) => coercePo(await get<any>(`/purchase-orders/${id}`)) as ApiPo & { vendor: ApiVendor; sku: ApiSku },
    updateStatus: (id: string, status: string) =>
      fetch(`${BASE}/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    create: (data: Partial<ApiPo>) =>
      fetch(`${BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiPo>) =>
      fetch(`${BASE}/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/purchase-orders/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  production: {
    list: () => get<ApiBatch[]>("/production"),
    create: (data: Partial<ApiBatch>) =>
      fetch(`${BASE}/production`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiBatch>) =>
      fetch(`${BASE}/production/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/production/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  shipments: {
    list: async () => (await get<any[]>("/shipments")).map(coerceShipment),
  },

  inventory: {
    summary:      () => get<any>("/inventory/summary"),
    packaging:    async () => (await get<any[]>("/inventory/packaging")).map(coercePackaging),
    rawMaterials: async () => (await get<any[]>("/inventory/raw-materials")).map(coerceRawMaterial),
  },

  users: {
    list: () => get<ApiUser[]>("/users"),
  },

  npd: {
    list: (sharedTeamId?: string) => get<ApiNpd[]>(`/npd${sharedQs(sharedTeamId)}`),
    create: (data: Partial<ApiNpd>, sharedTeamId?: string) =>
      fetch(`${BASE}/npd${sharedQs(sharedTeamId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiNpd>) =>
      fetch(`${BASE}/npd/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/npd/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  directory: {
    list: (sharedTeamId?: string) => get<ApiDirectoryEntry[]>(`/directory${sharedQs(sharedTeamId)}`),
    create: (data: Partial<ApiDirectoryEntry>, sharedTeamId?: string) =>
      fetch(`${BASE}/directory${sharedQs(sharedTeamId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiDirectoryEntry>) =>
      fetch(`${BASE}/directory/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/directory/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  productionRemarks: {
    list: () => get<ApiProductionRemark[]>("/production-remarks"),
    create: (data: Partial<ApiProductionRemark>) =>
      fetch(`${BASE}/production-remarks`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiProductionRemark>) =>
      fetch(`${BASE}/production-remarks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/production-remarks/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  tasks: {
    list: (sharedUserId?: string) => get<ApiTask[]>(`/tasks${sharedUserQs(sharedUserId)}`),
    create: (data: Partial<ApiTask>, sharedUserId?: string) =>
      fetch(`${BASE}/tasks${sharedUserQs(sharedUserId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiTask>) =>
      fetch(`${BASE}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/tasks/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  procurement: {
    mrpAlerts:        () => get<ApiSku[]>("/procurement/mrp-alerts"),
    pendingApprovals: async () => (await get<any[]>("/procurement/pending-approvals")).map(coercePo),
    duePayments:      async () => (await get<any[]>("/procurement/due-payments")).map(coercePo),
  },

  mft: {
    list: (sharedUserId?: string) => get<ApiMftNote[]>(`/mft${sharedUserQs(sharedUserId)}`),
    create: (data: { skuId?: string | null; date: string; notes: string }, sharedUserId?: string) =>
      fetch(`${BASE}/mft${sharedUserQs(sharedUserId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: { skuId?: string | null; date?: string; notes?: string }) =>
      fetch(`${BASE}/mft/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/mft/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  artwork: {
    list: (sharedTeamId?: string) => get<ApiArtworkItem[]>(`/artwork${sharedQs(sharedTeamId)}`),
    create: (data: Partial<ApiArtworkItem>, sharedTeamId?: string) =>
      fetch(`${BASE}/artwork${sharedQs(sharedTeamId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiArtworkItem>) =>
      fetch(`${BASE}/artwork/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/artwork/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    listComments: (id: string) => get<ApiArtworkComment[]>(`/artwork/${id}/comments`),
    addComment: (id: string, text: string) =>
      fetch(`${BASE}/artwork/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ text }) }).then((r) => r.json()),
    deleteComment: (artworkId: string, commentId: string) =>
      fetch(`${BASE}/artwork/${artworkId}/comments/${commentId}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  followUps: {
    list: (sharedUserId?: string) => get<(ApiFollowUpContact & { tasks: ApiFollowUpTask[] })[]>(`/follow-ups${sharedUserQs(sharedUserId)}`),
    createContact: (data: Partial<ApiFollowUpContact>, sharedUserId?: string) =>
      fetch(`${BASE}/follow-ups${sharedUserQs(sharedUserId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateContact: (id: string, data: Partial<ApiFollowUpContact>) =>
      fetch(`${BASE}/follow-ups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteContact: (id: string) =>
      fetch(`${BASE}/follow-ups/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    createTask: (contactId: string, data: { description: string }) =>
      fetch(`${BASE}/follow-ups/${contactId}/tasks`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateTask: (contactId: string, taskId: string, data: Partial<ApiFollowUpTask>) =>
      fetch(`${BASE}/follow-ups/${contactId}/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteTask: (contactId: string, taskId: string) =>
      fetch(`${BASE}/follow-ups/${contactId}/tasks/${taskId}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  impLinks: {
    list: (sharedUserId?: string) => get<ApiImpLink[]>(`/imp-links${sharedUserQs(sharedUserId)}`),
    create: (data: Omit<ApiImpLink, "id" | "createdAt" | "updatedAt">, sharedUserId?: string) =>
      fetch(`${BASE}/imp-links${sharedUserQs(sharedUserId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiImpLink>) =>
      fetch(`${BASE}/imp-links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/imp-links/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  couriers: {
    list: (sharedUserId?: string) => get<ApiCourier[]>(`/couriers${sharedUserQs(sharedUserId)}`),
    create: (data: Omit<ApiCourier, "id" | "createdAt" | "updatedAt">, sharedUserId?: string) =>
      fetch(`${BASE}/couriers${sharedUserQs(sharedUserId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiCourier>) =>
      fetch(`${BASE}/couriers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/couriers/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  pm: {
    list: async (search?: string, category?: string) => {
      const q = new URLSearchParams();
      if (search)   q.set("search",   search);
      if (category) q.set("category", category);
      const qs = q.toString();
      const items = await get<any[]>(`/pm${qs ? "?" + qs : ""}`);
      return items.map((p) => ({ ...p, costPerUnit: p.costPerUnit != null ? parseNum(p.costPerUnit) : null })) as ApiPm[];
    },
    get: async (id: string) => {
      const p = await get<any>(`/pm/${id}`);
      if (!p?.id) return null;
      return {
        ...p,
        costPerUnit: p.costPerUnit != null ? parseNum(p.costPerUnit) : null,
        vendors:   (p.vendors   ?? []).map((v: any) => ({ ...v, costPerUnit: v.costPerUnit != null ? parseNum(v.costPerUnit) : null })),
        dispatches: (p.dispatches ?? []).map((d: any) => ({ ...d, freight: parseNum(d.freight) })),
        comments:  p.comments  ?? [],
        links:     p.links     ?? [],
      } as ApiPmDetail;
    },
    create: (data: Partial<ApiPm>) =>
      fetch(`${BASE}/pm`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    update: (id: string, data: Partial<ApiPm>) =>
      fetch(`${BASE}/pm/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/pm/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addVendor: (pmId: string, data: Partial<ApiPmVendor>) =>
      fetch(`${BASE}/pm/${pmId}/vendors`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateVendor: (vid: string, data: Partial<ApiPmVendor>) =>
      fetch(`${BASE}/pm/vendors/${vid}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteVendor: (vid: string) =>
      fetch(`${BASE}/pm/vendors/${vid}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addDispatch: (pmId: string, data: Partial<ApiPmDispatch>) =>
      fetch(`${BASE}/pm/${pmId}/dispatches`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateDispatch: (did: string, data: Partial<ApiPmDispatch>) =>
      fetch(`${BASE}/pm/dispatches/${did}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteDispatch: (did: string) =>
      fetch(`${BASE}/pm/dispatches/${did}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addComment: (pmId: string, text: string) =>
      fetch(`${BASE}/pm/${pmId}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ text }) }).then((r) => r.json()),
    deleteComment: (pmId: string, cid: string) =>
      fetch(`${BASE}/pm/${pmId}/comments/${cid}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    addLink: (pmId: string, data: { title: string; link: string; comment?: string }) =>
      fetch(`${BASE}/pm/${pmId}/links`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    updateLink: (lid: string, data: { title?: string; link?: string; comment?: string }) =>
      fetch(`${BASE}/pm/links/${lid}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    deleteLink: (lid: string) =>
      fetch(`${BASE}/pm/links/${lid}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },

  samples: {
    list: (sharedUserId?: string) => get<ApiSample[]>(`/samples${sharedUserQs(sharedUserId)}`),
    create: (data: { personName: string; purpose?: string; comment?: string; products: { productName: string; quantity: number }[] }, sharedUserId?: string) =>
      fetch(`${BASE}/samples${sharedUserQs(sharedUserId)}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
    delete: (id: string) =>
      fetch(`${BASE}/samples/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
    toggleReturn: (sampleId: string, productId: string) =>
      fetch(`${BASE}/samples/${sampleId}/products/${productId}/return`, { method: "PATCH", headers: authHeaders() }).then((r) => r.json()),
    deleteProduct: (sampleId: string, productId: string) =>
      fetch(`${BASE}/samples/${sampleId}/products/${productId}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  },
};

export const sharesApi = {
  // Team module grants
  listMine:             () => get<ApiShare[]>("/shares"),
  listMyGrants:         () => get<ApiGrant[]>("/shares/my-grants"),
  availableUsers:       () => get<ApiShareableUser[]>("/shares/available-users"),
  create:               (module: string, granteeUserId: string) =>
    fetch(`${BASE}/shares`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ module, granteeUserId }) }).then((r) => r.json()),
  delete:               (id: string) =>
    fetch(`${BASE}/shares/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  // User grants (personal module sharing)
  listMyUserShares:     () => get<ApiUserShare[]>("/shares/user-shares"),
  listMyUserGrants:     () => get<ApiUserGrant[]>("/shares/my-user-grants"),
  allUsers:             () => get<ApiShareableUser[]>("/shares/all-users"),
  createUserGrant:      (module: string, granteeUserId: string) =>
    fetch(`${BASE}/shares/user`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ module, granteeUserId }) }).then((r) => r.json()),
  deleteUserGrant:      (id: string) =>
    fetch(`${BASE}/shares/user/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
};

export type ApiPendingUser = {
  id: string; name: string; email: string; role: string; status: string;
  department: string; teamId: string; createdAt: string;
};

export const assignedTasksApi = {
  listForMe:  () => get<ApiAssignedTask[]>("/assigned-tasks"),
  listByMe:   () => get<ApiAssignedTask[]>("/assigned-tasks/by-me"),
  listUsers:  () => get<ApiAssignableUser[]>("/assigned-tasks/users"),
  create: (data: { title: string; comments?: string; urgency?: string; deadlineDate?: string | null; assignedTo: string }) =>
    fetch(`${BASE}/assigned-tasks`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
  updateStatus: (id: string, status: "Pending" | "Done") =>
    fetch(`${BASE}/assigned-tasks/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ status }) }).then((r) => r.json()),
  update: (id: string, data: { title?: string; urgency?: string; deadlineDate?: string | null; comments?: string }) =>
    fetch(`${BASE}/assigned-tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
  delete: (id: string) =>
    fetch(`${BASE}/assigned-tasks/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
  listComments: (taskId: string) => get<ApiAssignedTaskComment[]>(`/assigned-tasks/${taskId}/comments`),
  addComment: (taskId: string, text: string) =>
    fetch(`${BASE}/assigned-tasks/${taskId}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ text }) }).then((r) => r.json()),
  deleteComment: (taskId: string, commentId: string) =>
    fetch(`${BASE}/assigned-tasks/${taskId}/comments/${commentId}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
};

export const warehouseQcApi = {
  list: () => get<ApiWarehouseQc[]>("/warehouse-qc"),
  create: (data: Omit<ApiWarehouseQc, "id" | "teamId" | "createdAt" | "updatedAt">) =>
    fetch(`${BASE}/warehouse-qc`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
  update: (id: string, data: Partial<Omit<ApiWarehouseQc, "id" | "teamId" | "createdAt" | "updatedAt">>) =>
    fetch(`${BASE}/warehouse-qc/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
  delete: (id: string) =>
    fetch(`${BASE}/warehouse-qc/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
};

export const adminApi = {
  listPending:  () => get<ApiPendingUser[]>("/users/pending"),
  listAll:      () => get<ApiPendingUser[]>("/users"),
  approveUser:  (id: string) =>
    fetch(`${BASE}/users/${id}/approve`, { method: "POST", headers: authHeaders() }).then((r) => r.json()),
  rejectUser:   (id: string) =>
    fetch(`${BASE}/users/${id}/reject`,  { method: "POST", headers: authHeaders() }).then((r) => r.json()),
  updateUser:   (id: string, data: { role?: string; status?: string }) =>
    fetch(`${BASE}/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then((r) => r.json()),
  deleteUser:   (id: string) =>
    fetch(`${BASE}/users/${id}`, { method: "DELETE", headers: authHeaders() }).then((r) => r.json()),
};
