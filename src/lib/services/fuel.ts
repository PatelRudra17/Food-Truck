import { Prisma } from "@prisma/client";

const ANOMALY_DEVIATION_RATIO = 0.3; // flag when mileage deviates >30% from baseline

export function computeFuelDerivedFields(params: {
  previousOdometerKm: Prisma.Decimal | number;
  currentOdometerKm: Prisma.Decimal | number;
  fuelQuantityLiters: Prisma.Decimal | number;
  fuelRate: Prisma.Decimal | number;
  baselineMileageKmpl?: Prisma.Decimal | number | null;
}) {
  const previous = new Prisma.Decimal(params.previousOdometerKm);
  const current = new Prisma.Decimal(params.currentOdometerKm);
  const quantity = new Prisma.Decimal(params.fuelQuantityLiters);
  const rate = new Prisma.Decimal(params.fuelRate);

  if (current.lte(previous)) {
    throw new Error("Current odometer reading must be greater than the previous reading.");
  }
  if (quantity.lte(0)) {
    throw new Error("Fuel quantity must be greater than zero.");
  }

  const distanceKm = current.minus(previous);
  const totalFuelCost = quantity.times(rate);
  const mileageKmpl = distanceKm.dividedBy(quantity);
  const fuelCostPerKm = totalFuelCost.dividedBy(distanceKm);

  let isAnomaly = false;
  let anomalyNote: string | null = null;
  if (params.baselineMileageKmpl != null) {
    const baseline = new Prisma.Decimal(params.baselineMileageKmpl);
    if (baseline.gt(0)) {
      const deviation = mileageKmpl.minus(baseline).abs().dividedBy(baseline);
      if (deviation.gt(ANOMALY_DEVIATION_RATIO)) {
        isAnomaly = true;
        anomalyNote = `Unusual fuel consumption detected: ${mileageKmpl.toFixed(2)} KM/L vs baseline ${baseline.toFixed(2)} KM/L.`;
      }
    }
  }

  return { distanceKm, totalFuelCost, mileageKmpl, fuelCostPerKm, isAnomaly, anomalyNote };
}
