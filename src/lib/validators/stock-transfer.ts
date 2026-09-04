import { z } from "zod";

export const transferItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit: z.string().min(1, "Unit is required"),
  batchNumber: z.string().optional().or(z.literal("")),
});

export const createTransferSchema = z
  .object({
    sourceWarehouseId: z.string().min(1, "Source warehouse is required"),
    destWarehouseId: z.string().min(1, "Destination warehouse is required"),
    remarks: z.string().optional().or(z.literal("")),
    items: z.array(transferItemSchema).min(1, "Add at least one item"),
  })
  .refine((data) => data.sourceWarehouseId !== data.destWarehouseId, {
    message: "Source and destination warehouses must be different",
    path: ["destWarehouseId"],
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferItemInput = z.infer<typeof transferItemSchema>;

export const transferDecisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional().or(z.literal("")),
});
