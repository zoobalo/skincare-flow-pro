export type POStatus = "Pending" | "Approved" | "In Production" | "Dispatched" | "Delivered" | "Delayed";
export type ProductionStage =
  | "PO Generated"
  | "Raw Material Ordered"
  | "Packaging Ordered"
  | "Material Received"
  | "Material Sent to Manufacturer"
  | "Production Started"
  | "Filling Process"
  | "Packing Process"
  | "QC Approved"
  | "Final Dispatch"
  | "Warehouse Received";

export const PRODUCTION_STAGES: ProductionStage[] = [
  "PO Generated",
  "Raw Material Ordered",
  "Packaging Ordered",
  "Material Received",
  "Material Sent to Manufacturer",
  "Production Started",
  "Filling Process",
  "Packing Process",
  "QC Approved",
  "Final Dispatch",
  "Warehouse Received",
];

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  mobile: string;
  email: string;
  gst: string;
  address: string;
  city: string;
  materials: string[];
  leadTimeDays: number;
  paymentTerms: string;
  rating: number; // 0-5
  reliability: number; // 0-100
  delayPercent: number;
  totalOrders: number;
  runningOrders: number;
  totalSpend: number;
}

export interface PackagingItem {
  id: string;
  name: string;
  vendorId: string;
  moq: number;
  leadTimeDays: number;
  currentStock: number;
  transitStock: number;
  costPerUnit: number;
  lastPurchaseDate: string;
}

export interface SKU {
  id: string;
  code: string;
  name: string;
  category: string;
  type: string;
  description: string;
  image: string;
  manufacturerId: string;
  currentInventory: number;
  minThreshold: number;
  productionTimelineDays: number;
  packaging: PackagingItem[];
  rawMaterials: { id: string; name: string; vendorId: string; qtyPerUnit: number; unit: string; currentStock: number; costPerUnit: number }[];
}

export interface Manufacturer {
  id: string;
  name: string;
  location: string;
  contactPerson: string;
  mobile: string;
  capacityPerMonth: number;
  activeBatches: number;
  qcPassRate: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  skuId: string;
  materialType: string;
  quantity: number;
  rate: number;
  total: number;
  dispatchDate: string;
  expectedDelivery: string;
  status: POStatus;
  paymentDue?: number;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  skuId: string;
  manufacturerId: string;
  quantity: number;
  currentStage: ProductionStage;
  startedAt: string;
  expectedCompletion: string;
  delayed: boolean;
  stageHistory: { stage: ProductionStage; date: string; note?: string }[];
}

export interface Shipment {
  id: string;
  lrNumber: string;
  transporter: string;
  driverName: string;
  vehicleNumber: string;
  origin: string;
  destination: string;
  pickupDate: string;
  expectedDelivery: string;
  currentLocation: string;
  freightCost: number;
  status: "In Transit" | "Delivered" | "Delayed" | "Loading";
  linkedPO?: string;
}
