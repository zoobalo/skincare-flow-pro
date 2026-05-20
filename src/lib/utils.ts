import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_PO_TERMS = `1. Payment shall be made within 30 days of invoice receipt.
2. Goods must conform to agreed specifications and quality standards.
3. Any defects must be reported within 7 days of delivery.
4. The supplier shall provide batch certificates and test reports with every shipment.
5. Partial deliveries are not accepted unless prior written approval is obtained.
6. The supplier must maintain confidentiality of all product formulations and specifications.
7. Any changes to pricing or lead time must be communicated 15 days in advance.`;

/** Convert "YYYY-MM-DD" → "DD/MM/YYYY". Returns "—" for falsy values. */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}
