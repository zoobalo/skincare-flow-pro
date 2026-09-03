/**
 * Sales platform columns, in the order they appear in the sheet. Person A's
 * muscle memory forms around this order, so append new ones at the end rather
 * than reordering.
 */
export const SALES_PLATFORMS = [
  "Shiprocket", "LLC", "Amazon", "Flipkart", "Nykaa", "Broadway",
  "Export", "Blinkit", "Zepto", "Myntra", "PharmEasy", "Other",
] as const;

/** Weeks averaged for velocity — smooths a single promo week. */
export const VELOCITY_WEEKS = 4;

/** Default days-of-cover below which a SKU is flagged. Overridable per SKU. */
export const DEFAULT_COVER_THRESHOLD_DAYS = 90;

/** Extra days on top of lead time before a SKU is called critical. */
export const CRITICAL_BUFFER_DAYS = 30;
