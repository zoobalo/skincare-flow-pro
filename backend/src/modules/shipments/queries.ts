import { db } from "../../db/client.ts";

export const getAllShipments = () =>
  db.query.shipments.findMany({
    orderBy: (s, { desc }) => [desc(s.pickupDate)],
    with: {
      purchaseOrder: {
        columns: { id: true, poNumber: true, status: true },
        with: { vendor: { columns: { id: true, name: true } } },
      },
    },
  });

export const getShipmentById = (id: string) =>
  db.query.shipments.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: { purchaseOrder: { with: { vendor: true, sku: true } } },
  });
