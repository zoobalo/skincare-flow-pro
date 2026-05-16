import type { Vendor, SKU, Manufacturer, PurchaseOrder, ProductionBatch, Shipment, POStatus, ProductionStage } from "./types";
import { PRODUCTION_STAGES } from "./types";

export const vendors: Vendor[] = [
  { id: "v1", name: "Alpha Aluminium Co.", contactPerson: "Rajeev Mehta", mobile: "+91 98201 23456", email: "rajeev@alphaalu.in", gst: "27AAAPL1234C1Z5", address: "Plot 14, MIDC Andheri", city: "Mumbai", materials: ["Aluminium Can"], leadTimeDays: 21, paymentTerms: "Net 45", rating: 4.4, reliability: 88, delayPercent: 8, totalOrders: 64, runningOrders: 3, totalSpend: 4820000 },
  { id: "v2", name: "Precision Valve Industries", contactPerson: "Sneha Patel", mobile: "+91 99300 11221", email: "sneha@pvi.co.in", gst: "24AABCP3344L1Z2", address: "GIDC Vatva", city: "Ahmedabad", materials: ["Valve", "Actuator"], leadTimeDays: 18, paymentTerms: "Net 30", rating: 4.7, reliability: 94, delayPercent: 4, totalOrders: 88, runningOrders: 5, totalSpend: 6210000 },
  { id: "v3", name: "ColorPack Cartons", contactPerson: "Vikram Singh", mobile: "+91 98109 55667", email: "vikram@colorpack.in", gst: "07AABCC7788H1Z9", address: "Okhla Phase II", city: "New Delhi", materials: ["Outer Carton", "Insert"], leadTimeDays: 14, paymentTerms: "Net 30", rating: 4.1, reliability: 81, delayPercent: 12, totalOrders: 51, runningOrders: 2, totalSpend: 1950000 },
  { id: "v4", name: "StickIt Labels", contactPerson: "Anita Roy", mobile: "+91 98800 22334", email: "anita@stickit.co", gst: "29AAACS1122M1Z4", address: "Peenya Industrial Area", city: "Bengaluru", materials: ["Sticker", "Barcode"], leadTimeDays: 10, paymentTerms: "Net 15", rating: 4.6, reliability: 92, delayPercent: 5, totalOrders: 110, runningOrders: 4, totalSpend: 980000 },
  { id: "v5", name: "PolyWrap Films", contactPerson: "Manoj Kumar", mobile: "+91 99100 88990", email: "manoj@polywrap.in", gst: "06AAACP9988K1Z1", address: "Sector 37, Industrial Estate", city: "Gurugram", materials: ["Shrink Wrap"], leadTimeDays: 12, paymentTerms: "Net 30", rating: 3.9, reliability: 76, delayPercent: 18, totalOrders: 42, runningOrders: 1, totalSpend: 720000 },
  { id: "v6", name: "CapMakers Pvt Ltd", contactPerson: "Deepa Nair", mobile: "+91 99400 11556", email: "deepa@capmakers.in", gst: "33AAACC4455B1Z7", address: "Ambattur Industrial Estate", city: "Chennai", materials: ["Cap"], leadTimeDays: 16, paymentTerms: "Net 30", rating: 4.3, reliability: 86, delayPercent: 9, totalOrders: 73, runningOrders: 2, totalSpend: 1340000 },
  { id: "v7", name: "BioActive Chemicals", contactPerson: "Sumit Joshi", mobile: "+91 98230 44556", email: "sumit@bioactive.in", gst: "27BIOAC1122E1Z3", address: "Tarapur MIDC", city: "Boisar", materials: ["Active Ingredients", "Surfactants"], leadTimeDays: 28, paymentTerms: "Advance 50%", rating: 4.5, reliability: 90, delayPercent: 6, totalOrders: 96, runningOrders: 6, totalSpend: 8900000 },
  { id: "v8", name: "AromaSource Naturals", contactPerson: "Priya Krishnan", mobile: "+91 98450 77881", email: "priya@aromasource.co", gst: "29AROMS3344N1Z8", address: "Whitefield", city: "Bengaluru", materials: ["Fragrances", "Essential Oils"], leadTimeDays: 22, paymentTerms: "Net 45", rating: 4.2, reliability: 83, delayPercent: 11, totalOrders: 58, runningOrders: 3, totalSpend: 2410000 },
  { id: "v9", name: "PrintMatrix Inserts", contactPerson: "Arun Verma", mobile: "+91 98180 33445", email: "arun@printmatrix.in", gst: "07PRMTX9988P1Z6", address: "Naraina", city: "New Delhi", materials: ["Insert", "Barcode"], leadTimeDays: 9, paymentTerms: "Net 15", rating: 4.0, reliability: 79, delayPercent: 14, totalOrders: 39, runningOrders: 1, totalSpend: 410000 },
  { id: "v10", name: "EcoGlass Containers", contactPerson: "Rashmi Iyer", mobile: "+91 98401 22337", email: "rashmi@ecoglass.in", gst: "29ECOGL5566T1Z2", address: "Hosur Road", city: "Bengaluru", materials: ["Glass Bottle", "Glass Jar"], leadTimeDays: 25, paymentTerms: "Net 30", rating: 4.6, reliability: 91, delayPercent: 7, totalOrders: 82, runningOrders: 4, totalSpend: 5640000 },
];

export const manufacturers: Manufacturer[] = [
  { id: "m1", name: "Bluewave Personal Care", location: "Daman", contactPerson: "Harish Shah", mobile: "+91 98250 11122", capacityPerMonth: 120000, activeBatches: 6, qcPassRate: 98.4 },
  { id: "m2", name: "Lotus Cosmetics Mfg.", location: "Baddi, HP", contactPerson: "Pooja Sharma", mobile: "+91 94170 33445", capacityPerMonth: 200000, activeBatches: 9, qcPassRate: 97.1 },
  { id: "m3", name: "Aeroform Aerosols", location: "Silvassa", contactPerson: "Naveen Reddy", mobile: "+91 98255 66778", capacityPerMonth: 80000, activeBatches: 4, qcPassRate: 99.0 },
  { id: "m4", name: "PureBlend Labs", location: "Hyderabad", contactPerson: "Sanjay Rao", mobile: "+91 98480 12345", capacityPerMonth: 95000, activeBatches: 5, qcPassRate: 96.5 },
];

const mkPackaging = (vendorId: string, name: string, moq: number, cost: number, stock: number, transit: number): import("./types").PackagingItem => ({
  id: `${name}-${vendorId}`.toLowerCase().replace(/\s+/g, "-"),
  name, vendorId, moq, leadTimeDays: vendors.find(v => v.id === vendorId)?.leadTimeDays ?? 14,
  currentStock: stock, transitStock: transit, costPerUnit: cost,
  lastPurchaseDate: "2026-04-12",
});

export const skus: SKU[] = [
  {
    id: "sku1", code: "INV-SS-150", name: "Invi Shield Sunscreen Spray", category: "Sun Care", type: "Aerosol Spray",
    description: "SPF 50+ broad spectrum invisible sunscreen mist, 150ml aluminium aerosol can.",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600",
    manufacturerId: "m3", currentInventory: 8420, minThreshold: 2500, productionTimelineDays: 38,
    packaging: [
      mkPackaging("v1", "Aluminium Can", 10000, 28.5, 14200, 8000),
      mkPackaging("v2", "Actuator", 20000, 4.2, 32000, 0),
      mkPackaging("v2", "Valve", 20000, 6.8, 28500, 5000),
      mkPackaging("v3", "Outer Carton", 10000, 7.5, 11800, 0),
      mkPackaging("v4", "Sticker", 25000, 0.9, 38000, 0),
      mkPackaging("v4", "Barcode", 25000, 0.4, 41000, 0),
      mkPackaging("v9", "Insert", 25000, 1.2, 22000, 5000),
      mkPackaging("v5", "Shrink Wrap", 50000, 0.3, 6200, 12000),
      mkPackaging("v6", "Cap", 20000, 3.6, 18400, 0),
    ],
    rawMaterials: [
      { id: "rm1", name: "Avobenzone (3%)", vendorId: "v7", qtyPerUnit: 4.5, unit: "ml", currentStock: 280, costPerUnit: 12 },
      { id: "rm2", name: "Octocrylene (10%)", vendorId: "v7", qtyPerUnit: 15, unit: "ml", currentStock: 920, costPerUnit: 6 },
      { id: "rm3", name: "Ethanol Base", vendorId: "v7", qtyPerUnit: 90, unit: "ml", currentStock: 4500, costPerUnit: 0.8 },
      { id: "rm4", name: "Fragrance — Cool Citrus", vendorId: "v8", qtyPerUnit: 0.6, unit: "ml", currentStock: 38, costPerUnit: 38 },
    ],
  },
  {
    id: "sku2", code: "HYD-SR-50", name: "Hydra-Glow Vitamin C Serum", category: "Serums", type: "Glass Dropper",
    description: "15% L-Ascorbic Acid + ferulic brightening serum, 50ml amber glass.",
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600",
    manufacturerId: "m4", currentInventory: 3100, minThreshold: 1500, productionTimelineDays: 32,
    packaging: [
      mkPackaging("v10", "Glass Bottle (50ml Amber)", 5000, 18.0, 4200, 2000),
      mkPackaging("v6", "Dropper Cap", 5000, 7.2, 5100, 0),
      mkPackaging("v3", "Outer Carton", 5000, 8.5, 3800, 0),
      mkPackaging("v4", "Sticker", 10000, 1.1, 12000, 0),
      mkPackaging("v9", "Insert", 10000, 1.4, 4200, 3000),
    ],
    rawMaterials: [
      { id: "rm5", name: "L-Ascorbic Acid", vendorId: "v7", qtyPerUnit: 7.5, unit: "g", currentStock: 120, costPerUnit: 85 },
      { id: "rm6", name: "Ferulic Acid", vendorId: "v7", qtyPerUnit: 0.25, unit: "g", currentStock: 18, costPerUnit: 180 },
    ],
  },
  {
    id: "sku3", code: "NIA-MS-100", name: "Niacinamide Pore Refining Toner", category: "Toners", type: "PET Bottle",
    description: "10% Niacinamide + zinc PCA pore refining toner, 100ml.", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600",
    manufacturerId: "m2", currentInventory: 1800, minThreshold: 2000, productionTimelineDays: 26,
    packaging: [
      mkPackaging("v6", "PET Bottle 100ml", 10000, 6.4, 9200, 0),
      mkPackaging("v6", "Spray Cap", 10000, 3.2, 8800, 0),
      mkPackaging("v3", "Outer Carton", 10000, 6.8, 6400, 0),
      mkPackaging("v4", "Sticker", 15000, 0.9, 14000, 0),
    ],
    rawMaterials: [
      { id: "rm7", name: "Niacinamide", vendorId: "v7", qtyPerUnit: 10, unit: "g", currentStock: 210, costPerUnit: 22 },
      { id: "rm8", name: "Zinc PCA", vendorId: "v7", qtyPerUnit: 1, unit: "g", currentStock: 42, costPerUnit: 95 },
    ],
  },
  {
    id: "sku4", code: "CER-MO-75", name: "Ceramide Barrier Repair Moisturizer", category: "Moisturizers", type: "Jar",
    description: "Ceramide complex + squalane barrier repair cream, 75g.", image: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=600",
    manufacturerId: "m1", currentInventory: 5200, minThreshold: 1800, productionTimelineDays: 30,
    packaging: [
      mkPackaging("v10", "Glass Jar 75g", 5000, 22.0, 7100, 0),
      mkPackaging("v6", "Lid Cap", 5000, 5.5, 6400, 0),
      mkPackaging("v3", "Outer Carton", 5000, 9.2, 5800, 0),
      mkPackaging("v4", "Sticker", 10000, 1.2, 11000, 0),
    ],
    rawMaterials: [
      { id: "rm9", name: "Ceramide NP Complex", vendorId: "v7", qtyPerUnit: 1.5, unit: "g", currentStock: 64, costPerUnit: 240 },
      { id: "rm10", name: "Squalane", vendorId: "v8", qtyPerUnit: 8, unit: "ml", currentStock: 320, costPerUnit: 32 },
    ],
  },
  {
    id: "sku5", code: "GTL-FW-150", name: "Gentle Foaming Face Wash", category: "Cleansers", type: "Pump Bottle",
    description: "Sulfate-free amino-acid foaming cleanser, 150ml.", image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600",
    manufacturerId: "m2", currentInventory: 9400, minThreshold: 3000, productionTimelineDays: 24,
    packaging: [
      mkPackaging("v6", "PET Bottle 150ml", 10000, 8.4, 12000, 0),
      mkPackaging("v6", "Foam Pump", 10000, 11.0, 9800, 4000),
      mkPackaging("v3", "Outer Carton", 10000, 7.0, 8400, 0),
      mkPackaging("v4", "Sticker", 15000, 1.0, 16000, 0),
    ],
    rawMaterials: [
      { id: "rm11", name: "Cocamidopropyl Betaine", vendorId: "v7", qtyPerUnit: 18, unit: "ml", currentStock: 1240, costPerUnit: 4.5 },
    ],
  },
];

// Add 15 more lightweight SKUs for "20+" feeling
const extraNames = [
  ["RTN-EY-15","Retinol 0.3% Eye Cream","Eye Care","Tube"],
  ["AHA-EX-30","AHA 30% Exfoliant","Exfoliators","Glass Dropper"],
  ["PEP-NK-50","Peptide Neck & Decollete","Specialty","Tube"],
  ["SPF-DL-50","Daily Defense SPF 50","Sun Care","Tube"],
  ["MIC-CW-200","Micellar Cleansing Water","Cleansers","PET Bottle"],
  ["CLY-MK-100","Kaolin Clay Mask","Masks","Jar"],
  ["HYL-SR-30","Hyaluronic Booster","Serums","Glass Dropper"],
  ["TEA-CL-100","Tea Tree Spot Gel","Specialty","Tube"],
  ["VIT-EN-15","Vitamin E Lip Treatment","Lip Care","Stick"],
  ["RSE-MS-50","Rose Hydrating Mist","Toners","PET Bottle"],
  ["BTN-HC-100","Biotin Hair & Scalp","Hair","PET Bottle"],
  ["MAN-BD-200","Mandelic Body Wash","Body Care","PET Bottle"],
  ["UBQ-NT-30","Ubiquinone Night Oil","Oils","Glass Dropper"],
  ["RDN-PR-50","Radiance Primer","Makeup Prep","Tube"],
  ["CCM-DC-60","Coco-Mango Body Butter","Body Care","Jar"],
];
extraNames.forEach((row, i) => {
  const [code, name, category, type] = row;
  skus.push({
    id: `sku${6 + i}`, code, name, category, type,
    description: `${name} — premium skincare formulation.`,
    image: `https://images.unsplash.com/photo-156066${i}-${1000 + i * 31}?w=600`,
    manufacturerId: ["m1","m2","m3","m4"][i % 4],
    currentInventory: 1000 + i * 320,
    minThreshold: 1500,
    productionTimelineDays: 22 + (i % 10),
    packaging: [
      mkPackaging("v3", "Outer Carton", 5000, 6 + i * 0.1, 4000 + i * 100, 0),
      mkPackaging("v4", "Sticker", 10000, 1, 12000, 0),
      mkPackaging("v6", "Cap", 5000, 4, 6000, 0),
    ],
    rawMaterials: [
      { id: `rm-extra-${i}-1`, name: "Base Formulation", vendorId: "v7", qtyPerUnit: 30, unit: "ml", currentStock: 800 + i * 40, costPerUnit: 3 },
    ],
  });
});

const statuses: POStatus[] = ["Pending","Approved","In Production","Dispatched","Delivered","Delayed"];
export const purchaseOrders: PurchaseOrder[] = Array.from({ length: 42 }).map((_, i) => {
  const sku = skus[i % skus.length];
  const vendor = vendors[i % vendors.length];
  const qty = 5000 + (i % 7) * 2500;
  const rate = 5 + (i % 9) * 2.5;
  const total = qty * rate;
  const status = statuses[i % statuses.length];
  return {
    id: `po${i+1}`,
    poNumber: `PO-2026-${String(1000 + i)}`,
    vendorId: vendor.id, skuId: sku.id,
    materialType: sku.packaging[i % sku.packaging.length]?.name ?? "Outer Carton",
    quantity: qty, rate, total,
    dispatchDate: `2026-0${1 + (i % 5)}-${10 + (i % 18)}`,
    expectedDelivery: `2026-0${2 + (i % 5)}-${5 + (i % 22)}`,
    status,
    paymentDue: status === "Delivered" ? total * 0.5 : status === "Pending" ? 0 : total,
  };
});

export const productionBatches: ProductionBatch[] = skus.slice(0, 8).map((sku, i) => {
  const stage = PRODUCTION_STAGES[(i * 3 + 2) % PRODUCTION_STAGES.length];
  const stageIdx = PRODUCTION_STAGES.indexOf(stage);
  return {
    id: `b${i+1}`,
    batchNumber: `BATCH-${2026000 + i}`,
    skuId: sku.id,
    manufacturerId: sku.manufacturerId,
    quantity: 5000 + i * 1500,
    currentStage: stage,
    startedAt: `2026-04-${5 + i}`,
    expectedCompletion: `2026-0${5 + (i % 3)}-${20 + i}`,
    delayed: i % 4 === 0,
    stageHistory: PRODUCTION_STAGES.slice(0, stageIdx + 1).map((s, j) => ({
      stage: s, date: `2026-04-${5 + j}`, note: j === stageIdx ? "In progress" : "Completed",
    })),
  } as ProductionBatch;
});

export const shipments: Shipment[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `sh${i+1}`,
  lrNumber: `LR-${20260000 + i}`,
  transporter: ["VRL Logistics","TCI Express","Safexpress","Delhivery","Gati"][i % 5],
  driverName: ["Suresh","Mahesh","Ramesh","Dinesh","Naresh"][i % 5] + " " + ["Kumar","Yadav","Singh","Patel","Sharma"][i % 5],
  vehicleNumber: `MH-${10 + i}-AB-${1000 + i * 7}`,
  origin: ["Mumbai","Delhi","Bengaluru","Chennai","Ahmedabad"][i % 5],
  destination: ["Daman","Baddi","Silvassa","Hyderabad","Mumbai Warehouse"][i % 5],
  pickupDate: `2026-04-${5 + (i % 20)}`,
  expectedDelivery: `2026-04-${10 + (i % 20)}`,
  currentLocation: ["Nashik Hub","Bhopal Transit","Kolhapur Hub","Pune Sort","Reached Hub"][i % 5],
  freightCost: 8500 + i * 540,
  status: (["In Transit","Delivered","Delayed","Loading","In Transit"] as const)[i % 5],
  linkedPO: purchaseOrders[i % purchaseOrders.length].poNumber,
}));

// KPI snapshots
export const kpis = {
  totalSkus: skus.length,
  activeProductionOrders: productionBatches.length,
  pendingPOs: purchaseOrders.filter(p => p.status === "Pending").length,
  inventoryValue: 18400000,
  lowStockAlerts: skus.filter(s => s.currentInventory < s.minThreshold).length,
  delayedVendors: vendors.filter(v => v.delayPercent > 10).length,
  productionInProgress: productionBatches.filter(b => b.currentStage !== "Warehouse Received").length,
  finishedGoodsReady: 12480,
  transitMaterials: purchaseOrders.filter(p => p.status === "Dispatched").length,
};

export const monthlyProduction = [
  { month: "Nov", units: 42000 }, { month: "Dec", units: 51000 },
  { month: "Jan", units: 48500 }, { month: "Feb", units: 62000 },
  { month: "Mar", units: 71000 }, { month: "Apr", units: 68400 },
];
export const inventoryConsumption = [
  { week: "W1", raw: 12000, packaging: 18000 }, { week: "W2", raw: 14500, packaging: 21000 },
  { week: "W3", raw: 13200, packaging: 19400 }, { week: "W4", raw: 16100, packaging: 22800 },
];
export const procurementSpend = [
  { month: "Nov", spend: 2400000 }, { month: "Dec", spend: 2900000 },
  { month: "Jan", spend: 2650000 }, { month: "Feb", spend: 3150000 },
  { month: "Mar", spend: 3580000 }, { month: "Apr", spend: 3220000 },
];
export const vendorLeadTimePerf = vendors.slice(0, 8).map(v => ({ name: v.name.split(" ")[0], promised: v.leadTimeDays, actual: v.leadTimeDays + Math.round(v.delayPercent / 5) }));
export const skuProductionStatus = skus.slice(0, 8).map((s, i) => ({ name: s.code, completed: 60 + (i * 5) % 35, inProgress: 100 - (60 + (i * 5) % 35) }));

export const helpers = {
  vendor: (id: string) => vendors.find(v => v.id === id),
  sku: (id: string) => skus.find(s => s.id === id),
  manufacturer: (id: string) => manufacturers.find(m => m.id === id),
};
