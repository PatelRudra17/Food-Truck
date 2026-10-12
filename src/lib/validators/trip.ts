import { z } from "zod";
import { Grade } from "@prisma/client";

export const TRIP_STATUS_OPTIONS = [
  "CREATED",
  "APPROVED",
  "LOADING",
  "LOADED",
  "DISPATCHED",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
] as const;

/** Statuses `/dispatch` (the filtered, active-work view over Trip) surfaces by default. */
export const ACTIVE_DISPATCH_STATUSES = ["CREATED", "APPROVED", "LOADING", "LOADED", "DISPATCHED"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable();

const optionalId = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))
  .nullable();

const optionalDateTime = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))
  .nullable();

export const tripLineItemSchema = z.object({
  salesOrderItemId: optionalId,
  itemId: z.string().min(1, "Item is required."),
  grade: z.nativeEnum(Grade, { message: "Grade is required." }).default(Grade.GRADE_A),
  quantity: z.coerce.number().positive("Quantity must be greater than 0."),
  cratesCount: z.coerce.number().int().nonnegative().optional().nullable(),
});

/**
 * Trip.salesOrderId/TripItem.salesOrderItemId are both OPTIONAL — the Sales Order
 * module is being built in parallel. This schema works equally for a standalone
 * ad-hoc dispatch (no salesOrderId/salesOrderItemId set) and for a trip fulfilling
 * an existing sales order.
 */
export const createTripSchema = z
  .object({
    salesOrderId: optionalId,
    customerId: z.string().min(1, "Customer is required."),
    routeId: optionalId,
    vehicleId: z.string().min(1, "Vehicle is required."),
    driverId: z.string().min(1, "Driver is required."),
    loadingStaffId: optionalId,
    departureAt: optionalDateTime,
    expectedArrivalAt: optionalDateTime,
    remarks: optionalText(1000),
    items: z.array(tripLineItemSchema).min(1, "Add at least one line item."),
    // z.coerce.boolean() would turn the string "false" into true and silently override the block.
    overrideEligibility: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on" || v === "1"),
    eligibilityOverrideReason: optionalText(500),
  })
  .refine(
    (data) => !data.overrideEligibility || (data.eligibilityOverrideReason?.trim().length ?? 0) > 0,
    {
      message: "A reason is required to override a dispatch eligibility block.",
      path: ["eligibilityOverrideReason"],
    },
  );

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type TripLineItemInput = z.infer<typeof tripLineItemSchema>;

export const tripCancelSchema = z.object({
  reason: z.string().trim().min(3, "A reason is required.").max(500),
});
export type TripCancelInput = z.infer<typeof tripCancelSchema>;
