import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Maps stored FuelEntry.tripId values to display labels. New entries store the
 * Trip id; rows saved before trip linking may hold free text, which is shown as-is.
 */
export async function fuelTripLabels(tripIds: (string | null)[]): Promise<Map<string, string>> {
  const values = [...new Set(tripIds.filter((v): v is string => !!v))];
  const labels = new Map<string, string>(values.map((v) => [v, v]));
  if (values.length === 0) return labels;

  const trips = await prisma.trip.findMany({
    where: { id: { in: values } },
    select: { id: true, tripNumber: true },
  });
  for (const t of trips) {
    labels.set(t.id, t.tripNumber);
  }
  return labels;
}
