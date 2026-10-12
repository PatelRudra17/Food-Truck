import { NextRequest } from "next/server";
import { dateParam } from "@/lib/validators/common";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";
import { writeAuditLog } from "@/lib/audit";
import { fuelTripLabels } from "@/lib/services/fuel-trips";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const user = await requirePermission("FUEL_EXPORT");

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const vehicleId = sp.get("vehicleId") || "";
  const driverId = sp.get("driverId") || "";
  const fuelType = sp.get("fuelType") || "";
  const fuelStation = sp.get("fuelStation")?.trim() || "";
  const dateFrom = dateParam(sp.get("dateFrom"));
  const dateTo = dateParam(sp.get("dateTo"));
  const showVoided = sp.get("showVoided") === "1";

  const where: Prisma.FuelEntryWhereInput = {
    ...(showVoided ? {} : { isVoided: false }),
    ...(q ? { vehicle: { vehicleNumber: { contains: q, mode: "insensitive" } } } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(driverId ? { driverId } : {}),
    ...(fuelType ? { fuelType } : {}),
    ...(fuelStation ? { fuelStationVendor: { contains: fuelStation, mode: "insensitive" } } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const entries = await prisma.fuelEntry.findMany({
    where,
    include: {
      vehicle: { select: { vehicleNumber: true } },
      driver: { select: { fullName: true } },
    },
    orderBy: { date: "desc" },
  });

  const tripLabels = await fuelTripLabels(entries.map((e) => e.tripId));

  const rows = entries.map((e) => [
    format(e.date, "dd MMM yyyy"),
    e.vehicle.vehicleNumber,
    e.driver?.fullName ?? "",
    e.tripId ? (tripLabels.get(e.tripId) ?? e.tripId) : "",
    e.fuelStationVendor ?? "",
    e.fuelType,
    Number(e.previousOdometerKm),
    Number(e.currentOdometerKm),
    Number(e.distanceKm),
    Number(e.fuelQuantityLiters),
    Number(e.fuelRate),
    Number(e.totalFuelCost),
    e.mileageKmpl != null ? Number(e.mileageKmpl) : "",
    e.fuelCostPerKm != null ? Number(e.fuelCostPerKm) : "",
    e.isAnomaly ? "Yes" : "No",
    e.isVoided ? "Yes" : "No",
  ]);

  const buffer = await buildExcelBuffer({
    sheetName: "Fuel Entries",
    headers: [
      "Date",
      "Vehicle",
      "Driver",
      "Trip",
      "Fuel Station",
      "Fuel Type",
      "Prev Odometer (km)",
      "Current Odometer (km)",
      "Distance (km)",
      "Fuel Qty (L)",
      "Fuel Rate (₹/L)",
      "Total Cost (₹)",
      "Mileage (km/L)",
      "Cost / km (₹)",
      "Anomaly",
      "Voided",
    ],
    rows,
  });

  await writeAuditLog({
    userId: user.id,
    action: "EXPORT",
    entityType: "FuelEntry",
    newValues: { filters: Object.fromEntries(sp.entries()), rowCount: rows.length },
  });

  return new Response(new Uint8Array(buffer), {
    headers: fileResponseHeaders(`fuel-entries-${format(new Date(), "yyyyMMdd-HHmmss")}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  });
}
