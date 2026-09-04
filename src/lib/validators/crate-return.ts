import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable();

/**
 * Per-crate outcome, used when the org tracks individual Crate rows for a
 * customer. `CrateReturn` itself only stores aggregate counts (per schema) —
 * this array is NOT persisted verbatim; it is consumed to update the
 * individual `Crate.status` rows and to derive the aggregate counts when
 * provided. See crate-return-actions.ts for the documented limitation.
 */
export const crateOutcomeSchema = z.object({
  crateId: z.string().min(1),
  outcome: z.enum(["RETURNED", "DAMAGED", "MISSING"]),
});

export const createCrateReturnSchema = z
  .object({
    tripId: z.string().min(1, "Trip is required."),
    cratesDispatched: z.coerce.number().int().min(0, "Cannot be negative."),
    cratesReturned: z.coerce.number().int().min(0, "Cannot be negative.").default(0),
    cratesDamaged: z.coerce.number().int().min(0, "Cannot be negative.").default(0),
    cratesMissing: z.coerce.number().int().min(0, "Cannot be negative.").default(0),
    returnDate: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null))
      .nullable(),
    condition: optionalText(200),
    remarks: optionalText(1000),
    crateOutcomes: z.array(crateOutcomeSchema).optional().default([]),
  })
  .refine((data) => data.cratesReturned + data.cratesDamaged + data.cratesMissing <= data.cratesDispatched, {
    message: "Returned + damaged + missing crates cannot exceed crates dispatched.",
    path: ["cratesReturned"],
  });

export type CreateCrateReturnInput = z.infer<typeof createCrateReturnSchema>;
export type CrateOutcomeInput = z.infer<typeof crateOutcomeSchema>;
