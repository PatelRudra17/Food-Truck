import { Prisma, MaintenanceState } from "@prisma/client";

/**
 * Distance/time thresholds that classify how close a vehicle is to its next
 * service. Business-tunable constants.
 */
const DUE_SOON_BUFFER_KM = 1000;
const DUE_GRACE_KM = 50; // window around the exact threshold still shown as "DUE" rather than "OVERDUE"
const DUE_SOON_BUFFER_DAYS = 14;
const DUE_GRACE_DAYS = 1;

const RANK: Record<MaintenanceState, number> = {
  UP_TO_DATE: 0,
  DUE_SOON: 1,
  DUE: 2,
  OVERDUE: 3,
};

function byDistance(
  currentKm: Prisma.Decimal | number,
  nextServiceKm: Prisma.Decimal | number | null,
): MaintenanceState {
  if (nextServiceKm == null) return MaintenanceState.UP_TO_DATE;
  const current = new Prisma.Decimal(currentKm);
  const next = new Prisma.Decimal(nextServiceKm);
  const remaining = next.minus(current); // positive = km left before due

  if (remaining.gt(DUE_SOON_BUFFER_KM)) return MaintenanceState.UP_TO_DATE;
  if (remaining.gt(DUE_GRACE_KM)) return MaintenanceState.DUE_SOON;
  if (remaining.gte(-DUE_GRACE_KM)) return MaintenanceState.DUE;
  return MaintenanceState.OVERDUE;
}

function byDate(nextServiceDate: Date | null): MaintenanceState {
  if (!nextServiceDate) return MaintenanceState.UP_TO_DATE;
  const remainingDays = Math.floor(
    (nextServiceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (remainingDays > DUE_SOON_BUFFER_DAYS) return MaintenanceState.UP_TO_DATE;
  if (remainingDays > DUE_GRACE_DAYS) return MaintenanceState.DUE_SOON;
  if (remainingDays >= -DUE_GRACE_DAYS) return MaintenanceState.DUE;
  return MaintenanceState.OVERDUE;
}

/** Worse-of distance-based and date-based schedule status. */
export function computeMaintenanceState(params: {
  currentKm: Prisma.Decimal | number;
  nextServiceKm: Prisma.Decimal | number | null;
  nextServiceDate: Date | null;
}): MaintenanceState {
  const a = byDistance(params.currentKm, params.nextServiceKm);
  const b = byDate(params.nextServiceDate);
  return RANK[a] >= RANK[b] ? a : b;
}
