import type { Vehicle } from "@prisma/client";

export type DispatchCheck = {
  allowed: boolean;
  reasons: string[];
};

/**
 * Pre-dispatch eligibility check per plan requirement: a vehicle must be active,
 * available, not overdue for maintenance (unless explicitly overridden), and carry
 * valid registration/insurance/PUC/fitness/permit documents before it can be assigned.
 */
export function checkDispatchEligibility(vehicle: Vehicle): DispatchCheck {
  const now = new Date();
  const maintenanceReasons: string[] = [];
  const hardReasons: string[] = [];

  if (vehicle.status === "INACTIVE") hardReasons.push("Vehicle is marked inactive.");
  if (!["AVAILABLE", "INSIDE", "MAINTENANCE"].includes(vehicle.status)) {
    hardReasons.push(`Vehicle is not available for dispatch (status: ${vehicle.status}).`);
  }

  if (vehicle.status === "MAINTENANCE") {
    maintenanceReasons.push("Vehicle is currently under maintenance.");
  }
  if (vehicle.maintenanceState === "OVERDUE") {
    maintenanceReasons.push("Vehicle maintenance is overdue.");
  }

  const expiryChecks: [string, Date | null][] = [
    ["Registration", vehicle.registrationExpiry],
    ["Insurance", vehicle.insuranceExpiry],
    ["PUC", vehicle.pucExpiry],
    ["Fitness", vehicle.fitnessExpiry],
  ];
  for (const [label, expiry] of expiryChecks) {
    if (expiry && expiry < now) hardReasons.push(`${label} has expired.`);
  }
  // Permit is only required where applicable — only checked when a value is configured.
  if (vehicle.permitExpiry && vehicle.permitExpiry < now) {
    hardReasons.push("Permit has expired.");
  }

  const maintenanceBlocked = maintenanceReasons.length > 0 && !vehicle.maintenanceOverride;
  const reasons = [...hardReasons, ...(maintenanceBlocked ? maintenanceReasons : [])];

  return {
    allowed: hardReasons.length === 0 && !maintenanceBlocked,
    reasons,
  };
}
