import { z } from "zod";

export const fuelEntrySchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required."),
  date: z.string().min(1, "Date is required."),
  time: z.string().optional().default(""),
  driverId: z.string().optional().default(""),
  tripId: z.string().optional().default(""),
  fuelStationVendor: z.string().trim().min(1, "Fuel station / vendor is required.").max(200),
  fuelType: z.string().trim().min(1, "Fuel type is required.").max(60),
  previousOdometerKm: z.coerce.number().nonnegative("Must be zero or greater."),
  currentOdometerKm: z.coerce.number().positive("Must be greater than zero."),
  fuelQuantityLiters: z.coerce.number().positive("Must be greater than zero."),
  fuelRate: z.coerce.number().positive("Must be greater than zero."),
  remarks: z.string().optional().default(""),
});

export type FuelEntryInput = z.infer<typeof fuelEntrySchema>;

export const FUEL_TYPES = ["Diesel", "Petrol", "CNG", "Electric", "Other"] as const;
