import { z } from "zod";
import { Grade } from "@prisma/client";

export const PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const soLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  grade: z.nativeEnum(Grade, { message: "Grade is required" }).default(Grade.GRADE_A),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate cannot be negative"),
});

export const salesOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  orderDate: z.string().min(1, "Order date is required"),
  deliveryDate: z.string().optional().or(z.literal("")),
  priority: z.enum(PRIORITY_OPTIONS).optional().or(z.literal("")),
  remarks: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(soLineItemSchema).min(1, "Add at least one line item"),
});

export type SalesOrderInput = z.infer<typeof salesOrderSchema>;
export type SoLineItemInput = z.infer<typeof soLineItemSchema>;
