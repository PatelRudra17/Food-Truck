import { z } from "zod";
import { WastageReason } from "@prisma/client";

/** Tolerance (kg) for floating point rounding when checking the weight balance rule. */
export const WEIGHT_BALANCE_EPSILON = 0.001;

export const WASTE_REASON_LABELS: Record<string, string> = {
  DAMAGED: "Damaged",
  ROTTEN: "Rotten",
  QUALITY_REJECTION: "Quality Rejection",
  HANDLING_DAMAGE: "Handling Damage",
  EXPIRED: "Expired",
  OTHER: "Other",
};

/**
 * Builds the Sorting submission schema for a specific batch's raw weight.
 * The balance rule (gradeA + gradeB + gradeC + other + waste === rawWeight,
 * exactly) is enforced here via `.refine()` AND must be re-checked
 * server-side in the action against the batch's real `rawWeight` from the
 * database (never trust a client-supplied raw weight) — see
 * `submitSortingAction` in `src/lib/actions/sorting-actions.ts`.
 */
export function buildSortingSchema(rawWeight: number) {
  return z
    .object({
      batchId: z.string().min(1, "Batch is required."),
      gradeAWeight: z.coerce.number().nonnegative("Must be zero or greater.").default(0),
      gradeBWeight: z.coerce.number().nonnegative("Must be zero or greater.").default(0),
      gradeCWeight: z.coerce.number().nonnegative("Must be zero or greater.").default(0),
      otherGradeWeight: z.coerce.number().nonnegative("Must be zero or greater.").default(0),
      wasteWeight: z.coerce.number().nonnegative("Must be zero or greater.").default(0),
      wasteReason: z.nativeEnum(WastageReason).optional(),
      remarks: z.string().optional().default(""),
    })
    .refine(
      (data) =>
        Math.abs(
          data.gradeAWeight +
            data.gradeBWeight +
            data.gradeCWeight +
            data.otherGradeWeight +
            data.wasteWeight -
            rawWeight,
        ) < WEIGHT_BALANCE_EPSILON,
      {
        message: `Grade A + Grade B + Grade C + Other + Waste must add up to the raw weight (${rawWeight.toLocaleString()} kg) exactly.`,
        path: ["wasteWeight"],
      },
    )
    .refine((data) => data.wasteWeight <= 0 || !!data.wasteReason, {
      message: "Waste reason is required when waste weight is greater than zero.",
      path: ["wasteReason"],
    });
}

export type SortingInput = z.infer<ReturnType<typeof buildSortingSchema>>;
