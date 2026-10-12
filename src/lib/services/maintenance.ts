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

type DecimalLike = Prisma.Decimal | number;

export type ServiceScheduleVehicle = {
  odometerKm: DecimalLike;
  serviceIntervalDays: number | null;
  serviceIntervalKm: DecimalLike | null;
  nextServiceDate: Date | null;
  nextServiceKm: DecimalLike | null;
};

export type ServiceScheduleRecord = {
  serviceDate: Date;
  odometerKm: DecimalLike;
};

/**
 * Re-derives a vehicle's lastService / nextService / maintenanceState from its
 * latest remaining (non-archived) maintenance record. Used after a record is
 * archived so the vehicle no longer reflects the archived service.
 *
 * Mirrors createMaintenanceAction: a record only drives nextService* when the
 * vehicle has the matching service interval; otherwise the vehicle's current
 * (manually scheduled) value is kept, since no record ever changed it. When no
 * records remain, the interval-derived next value has no baseline and is
 * cleared — the schedule can be set again from the vehicle form.
 */
export function deriveServiceSchedule(
  vehicle: ServiceScheduleVehicle,
  latest: ServiceScheduleRecord | null,
): {
  lastServiceDate: Date | null;
  lastServiceKm: Prisma.Decimal | null;
  nextServiceDate: Date | null;
  nextServiceKm: Prisma.Decimal | null;
  maintenanceState: MaintenanceState;
} {
  const keptNextKm = vehicle.nextServiceKm == null ? null : new Prisma.Decimal(vehicle.nextServiceKm);

  let nextServiceDate: Date | null;
  let nextServiceKm: Prisma.Decimal | null;
  if (vehicle.serviceIntervalDays) {
    nextServiceDate = latest
      ? new Date(latest.serviceDate.getTime() + vehicle.serviceIntervalDays * 24 * 60 * 60 * 1000)
      : null;
  } else {
    nextServiceDate = vehicle.nextServiceDate;
  }
  if (vehicle.serviceIntervalKm != null && !new Prisma.Decimal(vehicle.serviceIntervalKm).isZero()) {
    nextServiceKm = latest ? new Prisma.Decimal(latest.odometerKm).plus(vehicle.serviceIntervalKm) : null;
  } else {
    nextServiceKm = keptNextKm;
  }

  return {
    lastServiceDate: latest?.serviceDate ?? null,
    lastServiceKm: latest ? new Prisma.Decimal(latest.odometerKm) : null,
    nextServiceDate,
    nextServiceKm,
    maintenanceState: computeMaintenanceState({
      currentKm: vehicle.odometerKm,
      nextServiceKm,
      nextServiceDate,
    }),
  };
}
