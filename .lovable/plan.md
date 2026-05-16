# Skincare Procurement & Ops Dashboard — Build Plan

## Scope of this first build

A complete **frontend** for the platform with realistic mock data so every screen, table, chart, and workflow is clickable end-to-end. No backend wiring yet — once you approve the UI, we enable **Lovable Cloud** for real auth, database, and PO/inventory persistence in a follow-up.

Note on stack: project is **TanStack Start + React + Tailwind + shadcn/ui + Framer Motion** (not Next.js). Same component model, file-based routing under `src/routes/`. Flagging so expectations are aligned.

## Design direction

- Light professional theme, enterprise-dense, Notion/Linear-clean spacing
- Soft neutral surface + a single brand accent (skincare-appropriate: muted sage or warm clay — confirmable later)
- Inter for UI, tabular numerals in data grids
- Dark mode toggle in topbar
- Status badges, progress bars, timeline rails, kanban columns as shared primitives

## App shell

- `src/routes/__root.tsx` — providers + dark-mode class
- `_authenticated.tsx` layout route → guards all app pages
- Persistent **Sidebar** (collapsible to icon rail) + **Topbar** (global search, notifications, user menu, theme toggle)
- All modules below live under `/_authenticated/`

## Routes & modules

### Auth (public)
- `/login` — email + password, remember me
- `/signup` — email + password
- `/forgot-password`
- `/reset-password`

### Core modules (under authenticated layout)
1. `/dashboard` — 9 KPI cards, 5 charts (Recharts: line, bar, stacked bar, horizontal bar, donut), quick-action button row
2. `/skus` — list (table + card toggle, search, category/status filters) + `/skus/$skuId` detail (overview, BOM, packaging grid, raw materials, production timeline, inventory, PO history tabs)
3. `/procurement` — MRP view, draft PO list, approvals queue
4. `/purchase-orders` — master PO table with all columns + statuses; `/purchase-orders/$poId` detail with multi-step PO creation wizard (`/purchase-orders/new`), email-send mock interface, payment tracker
5. `/vendors` — vendor table + `/vendors/$vendorId` profile with performance analytics (reliability score, delay %, spend chart, running orders)
6. `/manufacturers` — manufacturer list + detail with material-received / production / QC / dispatch tracker
7. `/inventory` — tabs for Raw / Packaging / Finished / Transit; table, card, analytics views; aging + FIFO + movement history
8. `/inventory/packaging` and `/inventory/raw-materials` — focused sub-views
9. `/production` — kanban by stage + timeline view; `/production/$batchId` with the 11-step progress rail, delayed-step alerts, ETA
10. `/logistics` — shipments table + shipment timeline tracker with current location
11. `/warehouse` — inward, outward, dispatch, damage, returns, batch tracking (tabbed)
12. `/analytics` — pie / bar / heatmap / trend / forecast cards
13. `/reports` — report catalog with export buttons (CSV mock)
14. `/users` — user management table with roles
15. `/settings` — profile, company, notifications, appearance

### Shared primitives (`src/components/`)
`AppSidebar`, `Topbar`, `KpiCard`, `StatusBadge`, `DataTable` (search + column filters + pagination + export), `ProgressRail`, `TimelineTracker`, `KanbanBoard`, `MultiStepForm`, `EmptyState`, `PageHeader`, `FilterBar`, `ChartCard`.

### Mock data (`src/lib/mock/`)
Typed seed files for SKUs (incl. "Invi Shield Sunscreen Spray" with all 9 packaging items), vendors, manufacturers, POs, inventory, production batches, shipments. Drives every screen so the demo feels real.

## Out of scope for this iteration
- Real authentication (UI only; submits navigate to dashboard)
- Database persistence
- Real email sending
- File uploads for product images (uses placeholders)

These all come in the **Lovable Cloud** follow-up once you approve the UI.

## Delivery approach
Given the size (~15 modules, ~25 routes), I'll build in this order so the app is usable at every step:
1. Design tokens + shell (sidebar, topbar, auth pages)
2. Dashboard + shared primitives
3. SKU + Vendors + Purchase Orders (core procurement loop)
4. Inventory + Production + Logistics + Warehouse
5. Analytics + Reports + Users + Settings + polish

## Open questions (optional — I can pick sensible defaults)
- Brand accent color preference (muted sage, warm clay, or pick for you)?
- Company/brand name to show in sidebar logo area?
- Should I enable Lovable Cloud now for real auth, or keep auth as UI-only mock for this pass?
