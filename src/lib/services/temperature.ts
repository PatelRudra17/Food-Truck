import { Prisma, TemperatureStatus } from "@prisma/client";

/**
 * Warning/critical bands beyond the item's configured min/max range, in °C.
 * Business-tunable constants — move to SystemSetting if per-tenant tuning is needed later.
 */
const WARNING_BAND_C = 2;

export function computeTemperatureStatus(
  minC: Prisma.Decimal | number | null,
  maxC: Prisma.Decimal | number | null,
  currentC: Prisma.Decimal | number,
): TemperatureStatus {
  const current = new Prisma.Decimal(currentC);
  if (minC == null || maxC == null) return TemperatureStatus.NORMAL;

  const min = new Prisma.Decimal(minC);
  const max = new Prisma.Decimal(maxC);

  if (current.gte(min) && current.lte(max)) return TemperatureStatus.NORMAL;

  const deviation = current.lt(min) ? min.minus(current) : current.minus(max);
  return deviation.lte(WARNING_BAND_C) ? TemperatureStatus.WARNING : TemperatureStatus.CRITICAL;
}
