/**
 * Development/demo seed data. Clearly separated from production data via
 * isDemoUser=true on seeded users; seeded transactional records are ordinary
 * rows created through the same engine functions the app uses at runtime.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, LedgerTxnType, ActiveStatus, StorageType, Grade, GradeLedgerTxnType, type WastageReason } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { hashPassword } from "../src/lib/auth/password";
import { encryptSensitive, maskAadhaar, maskPAN, maskLicence } from "../src/lib/crypto";
import { applyStockMovement } from "../src/lib/services/inventory";
import { applyGradeStockMovement } from "../src/lib/services/produce-inventory";
import { checkTripEligibility } from "../src/lib/services/trip-eligibility";
import { nextDocumentNumber } from "../src/lib/numbering";
import { DEFAULT_CHECKLIST_LABELS } from "../src/lib/validators/next-day-prep";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_NAMES,
} from "../src/lib/auth/permissions";

/**
 * NOTE on `writeAuditLog` (`src/lib/audit.ts`) and `computeSuggestedLabourEarnings`
 * (`src/lib/services/payroll.ts`): both modules start with `import "server-only"`,
 * a marker package whose default export unconditionally THROWS
 * ("This module cannot be imported from a Client Component module...").
 * That throw is only suppressed by Next's bundler (which resolves the
 * package's `react-server` export condition instead of `default`); this seed
 * script runs via plain `tsx prisma/seed.ts` (see package.json `db:seed`),
 * which has no such condition, so importing either module crashes immediately
 * at `import` time — verified by direct experiment before writing this file.
 * Per the task's approach-(b) fallback, both are reproduced locally below
 * (`seedAuditLog`, `computeSuggestedLabourEarningsLocal`) with byte-for-byte
 * identical DB effects to what calling the real functions would have done in
 * this same non-request script context (writeAuditLog's own headers() call is
 * already wrapped in a try/catch specifically for "outside a request scope
 * (e.g. seed script)", so it would have written ipAddress/userAgent as
 * undefined here anyway).
 */
async function seedAuditLog(params: {
  userId?: string | null;
  action:
    | "CREATE"
    | "EDIT"
    | "APPROVE"
    | "REJECT"
    | "STOCK_ADJUSTMENT"
    | "DISPATCH_OVERRIDE"
    | "VOID";
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? undefined,
      oldValues: params.oldValues === undefined ? undefined : (params.oldValues as object),
      newValues: params.newValues === undefined ? undefined : (params.newValues as object),
    },
  });
}

/** Mirrors `computeSuggestedLabourEarnings` in src/lib/services/payroll.ts (see note above). */
async function computeSuggestedLabourEarningsLocal(labourId: string, periodStart: Date, periodEnd: Date) {
  const labour = await prisma.labour.findUnique({ where: { id: labourId } });
  if (!labour) return null;

  const attendances = await prisma.attendance.findMany({
    where: { labourId, date: { gte: periodStart, lte: periodEnd } },
    select: { status: true },
  });

  const presentDays = attendances.reduce((sum, a) => {
    if (a.status === "PRESENT") return sum + 1;
    if (a.status === "HALF_DAY") return sum + 0.5;
    return sum;
  }, 0);

  const dailyWage = Number(labour.dailyWage);
  return { presentDays, dailyWage, earnings: presentDays * dailyWage };
}

const prisma = new PrismaClient();
faker.seed(42);

const DEV_PASSWORD = "DevPass!2026"; // development-only credential, never used in production

async function seedPermissionsAndRoles() {
  console.log("Seeding permissions and roles...");

  await prisma.permission.createMany({
    data: ALL_PERMISSIONS.map((code) => ({ code })),
    skipDuplicates: true,
  });
  const permissions = await prisma.permission.findMany();
  const permByCode = new Map(permissions.map((p) => [p.code, p.id]));

  const roles: Record<string, string> = {};
  for (const name of ROLE_NAMES) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, isSystem: true },
      update: {},
    });
    roles[name] = role.id;

    const codes = DEFAULT_ROLE_PERMISSIONS[name];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes
        .filter((c) => permByCode.has(c))
        .map((c) => ({ roleId: role.id, permissionId: permByCode.get(c)! })),
      skipDuplicates: true,
    });
  }
  return roles;
}

const SEED_USER_LIST: { role: string; name: string; email: string }[] = [
  { role: "Super Admin", name: "Asha Verma", email: "admin@demo.local" },
  { role: "Store Manager", name: "Rohan Mehta", email: "store.manager@demo.local" },
  { role: "Store Operator", name: "Priya Nair", email: "store.operator@demo.local" },
  { role: "Vehicle Manager", name: "Karan Singh", email: "vehicle.manager@demo.local" },
  { role: "Gate Operator", name: "Sunil Yadav", email: "gate.operator@demo.local" },
  { role: "Auditor", name: "Meera Iyer", email: "auditor@demo.local" },
  { role: "Management", name: "Vikram Rao", email: "management@demo.local" },
  { role: "HR / Payroll", name: "Divya Kulkarni", email: "hr.payroll@demo.local" },
];

async function seedUsers(roles: Record<string, string>) {
  console.log("Seeding demo users...");
  const passwordHash = await hashPassword(DEV_PASSWORD);
  const users: Record<string, { id: string }> = {};

  const seedList = SEED_USER_LIST;

  for (const u of seedList) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: roles[u.role],
        isDemoUser: true,
      },
      update: { roleId: roles[u.role] },
    });
    users[u.role] = { id: user.id };
  }
  return users;
}

async function seedSettings(adminId: string) {
  console.log("Seeding system settings...");
  const defaults: [string, unknown][] = [
    ["COMPANY_NAME", "Demo Foods & Logistics Pvt Ltd"],
    ["CURRENCY", "INR"],
    ["DATE_FORMAT", "DD/MM/YYYY"],
    ["TIME_ZONE", "Asia/Kolkata"],
    ["ALLOW_NEGATIVE_STOCK", false],
    ["DOCUMENT_EXPIRY_WARNING_DAYS", [7, 15, 30, 60]],
  ];
  for (const [key, value] of defaults) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as never, updatedById: adminId },
      update: {},
    });
  }
}

const CATEGORY_DEFS = [
  { name: "Vegetables", sub: ["Leafy Greens", "Root Vegetables"] },
  { name: "Fruits", sub: ["Citrus", "Tropical"] },
  { name: "Dairy", sub: [] as string[] },
  { name: "Grains & Pulses", sub: [] as string[] },
  { name: "Packaging Materials", sub: [] as string[] },
];

async function seedCategories() {
  console.log("Seeding categories...");
  const categoryIds: Record<string, string> = {};
  for (const def of CATEGORY_DEFS) {
    let parent = await prisma.category.findFirst({
      where: { name: def.name, parentId: null },
    });
    if (!parent) {
      parent = await prisma.category.create({ data: { name: def.name } });
    }
    categoryIds[def.name] = parent.id;
    for (const sub of def.sub) {
      const child = await prisma.category.upsert({
        where: { name_parentId: { name: sub, parentId: parent.id } },
        create: { name: sub, parentId: parent.id },
        update: {},
      });
      categoryIds[`${def.name}/${sub}`] = child.id;
    }
  }
  return categoryIds;
}

async function seedWarehouses(managerId: string) {
  console.log("Seeding warehouses...");
  const defs = [
    { code: "WH-01", name: "Main Distribution Center", address: "Plot 12, Industrial Area, Pune" },
    { code: "WH-02", name: "Cold Storage Facility", address: "Sector 5, MIDC, Nashik" },
    { code: "WH-03", name: "Regional Depot", address: "Warehouse Complex, Nagpur" },
  ];
  const warehouses = [];
  for (const def of defs) {
    const wh = await prisma.warehouse.upsert({
      where: { code: def.code },
      create: { ...def, managerId, status: ActiveStatus.ACTIVE },
      update: {},
    });
    warehouses.push(wh);
    for (let i = 1; i <= 3; i++) {
      await prisma.location.upsert({
        where: {
          warehouseId_rack_shelf_bin: {
            warehouseId: wh.id,
            rack: `R${i}`,
            shelf: "S1",
            bin: "B1",
          },
        },
        create: { warehouseId: wh.id, rack: `R${i}`, shelf: "S1", bin: "B1" },
        update: {},
      });
    }
  }
  return warehouses;
}

async function seedSuppliers() {
  console.log("Seeding suppliers...");
  const suppliers = [];
  for (let i = 1; i <= 5; i++) {
    const code = `SUP-${String(i).padStart(3, "0")}`;
    const supplier = await prisma.supplier.upsert({
      where: { code },
      create: {
        code,
        companyName: faker.company.name(),
        contactPerson: faker.person.fullName(),
        phone: faker.phone.number({ style: "national" }),
        email: faker.internet.email().toLowerCase(),
        address: faker.location.streetAddress({ useFullAddress: true }),
        gstNumber: `27AAAAA${1000 + i}A1Z${i}`,
        status: ActiveStatus.ACTIVE,
      },
      update: {},
    });
    suppliers.push(supplier);
  }
  return suppliers;
}

type ItemDef = {
  name: string;
  categoryPath: string;
  unit: string;
  temperatureSensitive?: boolean;
  minTemp?: number;
  maxTemp?: number;
  storageType?: StorageType;
  shelfLifeDays?: number;
};

const ITEM_DEFS: ItemDef[] = [
  { name: "Tomato", categoryPath: "Vegetables/Root Vegetables", unit: "KG", temperatureSensitive: true, minTemp: 10, maxTemp: 15, storageType: StorageType.COLD_ROOM, shelfLifeDays: 7 },
  { name: "Potato", categoryPath: "Vegetables/Root Vegetables", unit: "KG", temperatureSensitive: true, minTemp: 7, maxTemp: 10, storageType: StorageType.COLD_ROOM, shelfLifeDays: 30 },
  { name: "Onion", categoryPath: "Vegetables/Root Vegetables", unit: "KG", temperatureSensitive: false, storageType: StorageType.DRY_STORAGE, shelfLifeDays: 45 },
  { name: "Spinach", categoryPath: "Vegetables/Leafy Greens", unit: "KG", temperatureSensitive: true, minTemp: 0, maxTemp: 4, storageType: StorageType.COLD_ROOM, shelfLifeDays: 4 },
  { name: "Lettuce", categoryPath: "Vegetables/Leafy Greens", unit: "KG", temperatureSensitive: true, minTemp: 0, maxTemp: 4, storageType: StorageType.COLD_ROOM, shelfLifeDays: 5 },
  { name: "Cabbage", categoryPath: "Vegetables/Leafy Greens", unit: "KG", temperatureSensitive: true, minTemp: 0, maxTemp: 5, storageType: StorageType.COLD_ROOM, shelfLifeDays: 14 },
  { name: "Carrot", categoryPath: "Vegetables/Root Vegetables", unit: "KG", temperatureSensitive: true, minTemp: 0, maxTemp: 4, storageType: StorageType.COLD_ROOM, shelfLifeDays: 21 },
  { name: "Cauliflower", categoryPath: "Vegetables/Leafy Greens", unit: "KG", temperatureSensitive: true, minTemp: 0, maxTemp: 4, storageType: StorageType.COLD_ROOM, shelfLifeDays: 10 },
  { name: "Green Chilli", categoryPath: "Vegetables/Root Vegetables", unit: "KG", temperatureSensitive: true, minTemp: 7, maxTemp: 10, storageType: StorageType.COLD_ROOM, shelfLifeDays: 10 },
  { name: "Capsicum", categoryPath: "Vegetables/Root Vegetables", unit: "KG", temperatureSensitive: true, minTemp: 7, maxTemp: 10, storageType: StorageType.COLD_ROOM, shelfLifeDays: 12 },
  { name: "Orange", categoryPath: "Fruits/Citrus", unit: "KG", temperatureSensitive: true, minTemp: 4, maxTemp: 8, storageType: StorageType.COLD_ROOM, shelfLifeDays: 21 },
  { name: "Lemon", categoryPath: "Fruits/Citrus", unit: "KG", temperatureSensitive: false, storageType: StorageType.AMBIENT, shelfLifeDays: 20 },
  { name: "Banana", categoryPath: "Fruits/Tropical", unit: "KG", temperatureSensitive: true, minTemp: 13, maxTemp: 15, storageType: StorageType.COLD_ROOM, shelfLifeDays: 6 },
  { name: "Mango", categoryPath: "Fruits/Tropical", unit: "KG", temperatureSensitive: true, minTemp: 10, maxTemp: 13, storageType: StorageType.COLD_ROOM, shelfLifeDays: 8 },
  { name: "Milk (1L Pack)", categoryPath: "Dairy", unit: "PACK", temperatureSensitive: true, minTemp: 2, maxTemp: 4, storageType: StorageType.COLD_ROOM, shelfLifeDays: 5 },
  { name: "Paneer", categoryPath: "Dairy", unit: "KG", temperatureSensitive: true, minTemp: 2, maxTemp: 5, storageType: StorageType.COLD_ROOM, shelfLifeDays: 7 },
  { name: "Basmati Rice", categoryPath: "Grains & Pulses", unit: "KG", storageType: StorageType.DRY_STORAGE, shelfLifeDays: 365 },
  { name: "Toor Dal", categoryPath: "Grains & Pulses", unit: "KG", storageType: StorageType.DRY_STORAGE, shelfLifeDays: 270 },
  { name: "Wheat Flour", categoryPath: "Grains & Pulses", unit: "KG", storageType: StorageType.DRY_STORAGE, shelfLifeDays: 180 },
  { name: "Corrugated Box - Small", categoryPath: "Packaging Materials", unit: "PCS", storageType: StorageType.AMBIENT },
  { name: "Corrugated Box - Large", categoryPath: "Packaging Materials", unit: "PCS", storageType: StorageType.AMBIENT },
  { name: "Plastic Crates", categoryPath: "Packaging Materials", unit: "PCS", storageType: StorageType.AMBIENT },
];

async function seedItems(
  categoryIds: Record<string, string>,
  warehouseId: string,
  supplierIds: string[],
) {
  console.log("Seeding items...");
  const items = [];
  for (let i = 0; i < ITEM_DEFS.length; i++) {
    const def = ITEM_DEFS[i];
    const sku = `SKU-${String(i + 1).padStart(4, "0")}`;
    const itemCode = `ITM-${String(i + 1).padStart(4, "0")}`;
    const item = await prisma.item.upsert({
      where: { sku },
      create: {
        sku,
        itemCode,
        name: def.name,
        categoryId: categoryIds[def.categoryPath] ?? categoryIds[def.categoryPath.split("/")[0]],
        unit: def.unit,
        minStock: 50,
        maxStock: 2000,
        reorderLevel: 100,
        openingStock: 0,
        currentStock: 0,
        warehouseId,
        supplierId: supplierIds[i % supplierIds.length],
        purchasePrice: faker.number.float({ min: 10, max: 200, fractionDigits: 2 }),
        taxPercent: 5,
        hsnCode: `07${String(1000 + i)}`,
        barcode: `890${String(1000000 + i)}`,
        qrCodePayload: `ITEM:${itemCode}`,
        batchTracked: true,
        expiryTracked: !!def.shelfLifeDays && def.shelfLifeDays < 60,
        isActive: true,
        isTemperatureSensitive: !!def.temperatureSensitive,
        storageMinTempC: def.minTemp,
        storageMaxTempC: def.maxTemp,
        storageType: def.storageType,
        storageLocationText: def.storageType === "COLD_ROOM" ? "Cold Room A" : undefined,
        shelfLifeDays: def.shelfLifeDays,
      },
      update: {},
    });
    items.push(item);
  }
  return items;
}

async function seedOpeningStockAndTransactions(
  items: Awaited<ReturnType<typeof seedItems>>,
  warehouseId: string,
  supplierId: string,
  storeManagerId: string,
) {
  console.log("Seeding opening stock, inward and outward transactions...");
  for (const item of items) {
    const openingQty = faker.number.int({ min: 200, max: 800 });
    await prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        itemId: item.id,
        warehouseId,
        transactionType: LedgerTxnType.OPENING,
        quantity: openingQty,
        referenceType: "OPENING_BALANCE",
        referenceId: item.id,
        referenceNumber: `OPEN-${item.itemCode}`,
        userId: storeManagerId,
        reason: "Initial opening stock (seed data)",
      });
    });
  }

  // A handful of realistic inward/outward documents on top of opening stock.
  for (let i = 0; i < 6; i++) {
    const item = items[i % items.length];
    const qty = faker.number.int({ min: 20, max: 150 });
    await prisma.$transaction(async (tx) => {
      const inwardNumber = await nextDocumentNumber(tx, "STOCK_INWARD");
      const inward = await tx.stockInward.create({
        data: {
          inwardNumber,
          date: faker.date.recent({ days: 20 }),
          supplierId,
          invoiceNumber: `INV-${faker.string.alphanumeric(8).toUpperCase()}`,
          warehouseId,
          receivedById: storeManagerId,
          status: "RECEIVED",
          items: {
            create: [{ itemId: item.id, quantity: qty, unit: item.unit, rate: 50, total: qty * 50 }],
          },
        },
      });
      await applyStockMovement(tx, {
        itemId: item.id,
        warehouseId,
        transactionType: LedgerTxnType.INWARD,
        quantity: qty,
        referenceType: "STOCK_INWARD",
        referenceId: inward.id,
        referenceNumber: inwardNumber,
        userId: storeManagerId,
      });
    });
  }

  for (let i = 0; i < 4; i++) {
    const item = items[(i + 2) % items.length];
    const qty = faker.number.int({ min: 10, max: 60 });
    await prisma.$transaction(async (tx) => {
      const outwardNumber = await nextDocumentNumber(tx, "STOCK_OUTWARD");
      const outward = await tx.stockOutward.create({
        data: {
          outwardNumber,
          date: faker.date.recent({ days: 10 }),
          department: "Retail Operations",
          warehouseId,
          requestedById: storeManagerId,
          approvedById: storeManagerId,
          status: "ISSUED",
          items: {
            create: [
              { itemId: item.id, availableQtySnapshot: item.currentStock, requestedQty: qty, unit: item.unit },
            ],
          },
        },
      });
      await applyStockMovement(tx, {
        itemId: item.id,
        warehouseId,
        transactionType: LedgerTxnType.OUTWARD,
        quantity: qty,
        referenceType: "STOCK_OUTWARD",
        referenceId: outward.id,
        referenceNumber: outwardNumber,
        userId: storeManagerId,
      });
    });
  }
}

async function seedDrivers() {
  console.log("Seeding drivers and driver documents...");
  const drivers = [];
  for (let i = 1; i <= 10; i++) {
    const employeeId = `DRV-${String(i).padStart(3, "0")}`;
    const fullName = faker.person.fullName();
    const driver = await prisma.driver.upsert({
      where: { employeeId },
      create: {
        employeeId,
        fullName,
        mobile: faker.phone.number({ style: "national" }),
        address: faker.location.streetAddress({ useFullAddress: true }),
        joiningDate: faker.date.past({ years: 3 }),
        emergencyContact: faker.phone.number({ style: "national" }),
        status: "ACTIVE",
      },
      update: {},
    });

    const aadhaar = faker.string.numeric(12);
    const pan = `${faker.string.alpha({ length: 5, casing: "upper" })}${faker.string.numeric(4)}${faker.string.alpha({ length: 1, casing: "upper" })}`;
    const dl = `MH${faker.string.numeric(2)}${faker.string.numeric(11)}`;

    await prisma.driverDocument.createMany({
      data: [
        {
          driverId: driver.id,
          docType: "AADHAAR",
          numberEncrypted: encryptSensitive(aadhaar),
          numberMasked: maskAadhaar(aadhaar),
          isSensitive: true,
          verificationStatus: "VERIFIED",
        },
        {
          driverId: driver.id,
          docType: "PAN",
          numberEncrypted: encryptSensitive(pan),
          numberMasked: maskPAN(pan),
          isSensitive: true,
          verificationStatus: "VERIFIED",
        },
        {
          driverId: driver.id,
          docType: "DRIVING_LICENCE",
          numberEncrypted: encryptSensitive(dl),
          numberMasked: maskLicence(dl),
          licenceClass: "LMV/HMV",
          issueDate: faker.date.past({ years: 5 }),
          expiryDate:
            i % 5 === 0
              ? faker.date.recent({ days: 10 })
              : faker.date.soon({ days: faker.number.int({ min: 1, max: 400 }) }),
          issuingAuthority: "RTO",
          isSensitive: true,
          verificationStatus: "VERIFIED",
        },
      ],
      skipDuplicates: true,
    });

    drivers.push(driver);
  }
  return drivers;
}

async function seedVehicles(drivers: Awaited<ReturnType<typeof seedDrivers>>) {
  console.log("Seeding vehicles, documents, fuel and maintenance history...");
  const vehicles = [];
  const types = ["Truck", "Mini Van", "Tempo", "Refrigerated Truck"];

  for (let i = 1; i <= 10; i++) {
    const vehicleNumber = `MH${12 + (i % 9)}AB${1000 + i}`;
    const odometer = faker.number.int({ min: 15000, max: 60000 });
    const serviceIntervalKm = 5000;
    const lastServiceKm = odometer - faker.number.int({ min: 500, max: 5200 });
    const nextServiceKm = lastServiceKm + serviceIntervalKm;

    const vehicle = await prisma.vehicle.upsert({
      where: { vehicleNumber },
      create: {
        vehicleNumber,
        vehicleType: types[i % types.length],
        manufacturer: faker.vehicle.manufacturer(),
        model: faker.vehicle.model(),
        ownerCompany: "Demo Foods & Logistics Pvt Ltd",
        registrationDate: faker.date.past({ years: 4 }),
        registrationExpiry: faker.date.future({ years: 1 }),
        insuranceExpiry:
          i % 6 === 0 ? faker.date.recent({ days: 5 }) : faker.date.soon({ days: 90 }),
        pucExpiry: i % 7 === 0 ? faker.date.recent({ days: 5 }) : faker.date.soon({ days: 60 }),
        fitnessExpiry: faker.date.future({ years: 1 }),
        capacity: `${faker.number.int({ min: 1, max: 10 })} Ton`,
        currentDriverId: drivers[i % drivers.length].id,
        currentLocation: "Main Distribution Center",
        status: "AVAILABLE",
        fuelType: "Diesel",
        odometerKm: odometer,
        fuelEfficiencyTargetKmpl: 10,
        fuelCostPerKmTarget: 9.5,
        lastServiceKm,
        lastServiceDate: faker.date.past({ years: 1 }),
        nextServiceKm,
        nextServiceDate: faker.date.soon({ days: 20 }),
        serviceIntervalDays: 90,
        serviceIntervalKm,
      },
      update: {},
    });
    vehicles.push(vehicle);

    await prisma.vehicleDocument.createMany({
      data: [
        { vehicleId: vehicle.id, docType: "REGISTRATION", expiryDate: vehicle.registrationExpiry, verificationStatus: "VERIFIED" },
        { vehicleId: vehicle.id, docType: "INSURANCE", expiryDate: vehicle.insuranceExpiry, verificationStatus: "VERIFIED" },
        { vehicleId: vehicle.id, docType: "PUC", expiryDate: vehicle.pucExpiry, verificationStatus: "VERIFIED" },
        { vehicleId: vehicle.id, docType: "FITNESS", expiryDate: vehicle.fitnessExpiry, verificationStatus: "VERIFIED" },
      ],
      skipDuplicates: true,
    });
  }
  return vehicles;
}

async function seedFuelAndMaintenance(
  vehicles: Awaited<ReturnType<typeof seedVehicles>>,
  vehicleManagerId: string,
) {
  console.log("Seeding fuel entries and maintenance history...");
  for (const vehicle of vehicles) {
    let odometer = Number(vehicle.odometerKm) - faker.number.int({ min: 400, max: 1200 });
    for (let i = 0; i < 3; i++) {
      const distance = faker.number.int({ min: 150, max: 450 });
      const current = odometer + distance;
      const quantity = distance / faker.number.int({ min: 8, max: 12 });
      await prisma.fuelEntry.create({
        data: {
          vehicleId: vehicle.id,
          date: faker.date.recent({ days: 30 - i * 10 }),
          driverId: vehicle.currentDriverId,
          fuelStationVendor: faker.company.name(),
          fuelType: "Diesel",
          previousOdometerKm: odometer,
          currentOdometerKm: current,
          distanceKm: distance,
          fuelQuantityLiters: quantity,
          fuelRate: 95,
          totalFuelCost: quantity * 95,
          mileageKmpl: distance / quantity,
          fuelCostPerKm: (quantity * 95) / distance,
          enteredById: vehicleManagerId,
        },
      });
      odometer = current;
    }

    await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: vehicle.id,
        maintenanceType: "REGULAR_SERVICE",
        serviceDate: vehicle.lastServiceDate ?? faker.date.past(),
        odometerKm: vehicle.lastServiceKm ?? 0,
        serviceCenterVendor: faker.company.name(),
        technician: faker.person.fullName(),
        workPerformed: "Routine service, oil change, brake inspection",
        labourCost: 800,
        partsCost: 1200,
        otherCost: 0,
        totalCost: 2000,
        createdById: vehicleManagerId,
      },
    });
  }
}

async function seedTemperatureLogs(
  items: Awaited<ReturnType<typeof seedItems>>,
  warehouseId: string,
  recordedById: string,
) {
  console.log("Seeding storage temperature logs...");
  const { computeTemperatureStatus } = await import("../src/lib/services/temperature");
  const sensitiveItems = items.filter((i) => i.isTemperatureSensitive);

  for (const item of sensitiveItems) {
    for (let i = 0; i < 3; i++) {
      const min = item.storageMinTempC ? Number(item.storageMinTempC) : 0;
      const max = item.storageMaxTempC ? Number(item.storageMaxTempC) : 10;
      const drift = i === 2 ? faker.number.float({ min: 3, max: 6, fractionDigits: 1 }) : 0;
      const recordedTempC = faker.number.float({ min, max, fractionDigits: 1 }) + drift;
      const status = computeTemperatureStatus(min, max, recordedTempC);
      await prisma.storageTemperatureLog.create({
        data: {
          itemId: item.id,
          warehouseId,
          recordedTempC,
          recordedById,
          status,
          source: "MANUAL",
        },
      });
    }
  }
}

async function seedNotifications(users: Record<string, { id: string }>) {
  console.log("Seeding notifications...");
  await prisma.notification.createMany({
    data: [
      {
        userId: users["Store Manager"].id,
        type: "LOW_STOCK",
        title: "Low stock alert",
        message: "Several items have fallen below their reorder level.",
      },
      {
        userId: users["Vehicle Manager"].id,
        type: "DOCUMENT_EXPIRING",
        title: "Vehicle document expiring soon",
        message: "One or more vehicle documents expire within 30 days.",
      },
      {
        userId: users["Store Manager"].id,
        type: "PENDING_APPROVAL",
        title: "Approval pending",
        message: "A stock adjustment is waiting for your approval.",
      },
    ],
  });
}

async function seedCustomers() {
  console.log("Seeding customers...");
  const customers = [];
  for (let i = 1; i <= 6; i++) {
    const customerCode = `CUST-${String(i).padStart(3, "0")}`;
    const customer = await prisma.customer.upsert({
      where: { customerCode },
      create: {
        customerCode,
        name: faker.company.name(),
        contactPerson: faker.person.fullName(),
        phone: faker.phone.number({ style: "national" }),
        email: faker.internet.email().toLowerCase(),
        address: faker.location.streetAddress({ useFullAddress: true }),
        location: faker.location.city(),
        gstNumber: `27BBBBB${1000 + i}B1Z${i}`,
        status: ActiveStatus.ACTIVE,
      },
      update: {},
    });
    customers.push(customer);
  }
  return customers;
}

async function seedRoutesAndClusters() {
  console.log("Seeding route clusters and routes...");
  const clusterDefs = ["North Zone", "South Zone", "City Core"];
  const clusters = [];
  for (const name of clusterDefs) {
    const cluster = await prisma.routeCluster.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    clusters.push(cluster);
  }

  const routeDefs = [
    { name: "Pune City Loop", startLocation: "Main Distribution Center", destination: "Pune City Market", km: 18 },
    { name: "Nashik Highway Run", startLocation: "Cold Storage Facility", destination: "Nashik Wholesale Market", km: 45 },
    { name: "Nagpur Depot Circuit", startLocation: "Regional Depot", destination: "Nagpur Retail Cluster", km: 12 },
  ];
  const routes = [];
  for (let i = 0; i < routeDefs.length; i++) {
    const def = routeDefs[i];
    const routeNumber = `RT-${String(i + 1).padStart(3, "0")}`;
    const route = await prisma.route.upsert({
      where: { routeNumber },
      create: {
        routeNumber,
        name: def.name,
        startLocation: def.startLocation,
        destination: def.destination,
        routeClusterId: clusters[i % clusters.length].id,
        estimatedDistanceKm: def.km,
        estimatedTimeMinutes: def.km * 3,
      },
      update: {},
    });
    routes.push(route);
  }
  return { clusters, routes };
}

async function seedCrates() {
  console.log("Seeding crates...");
  const crates = [];
  for (let i = 1; i <= 40; i++) {
    const crateCode = `CRT-${String(i).padStart(4, "0")}`;
    const crate = await prisma.crate.upsert({
      where: { crateCode },
      create: {
        crateCode,
        crateType: i % 4 === 0 ? "Large Plastic Crate" : "Standard Plastic Crate",
        capacity: i % 4 === 0 ? "40 KG" : "20 KG",
        status: "AVAILABLE",
        currentLocation: "Main Distribution Center",
        condition: "Good",
      },
      update: {},
    });
    crates.push(crate);
  }
  return crates;
}

async function seedShifts(supervisorId: string) {
  console.log("Seeding shifts...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const shiftDefs = [
    { shiftName: "Morning Shift", startHour: 6, endHour: 14 },
    { shiftName: "Evening Shift", startHour: 14, endHour: 22 },
  ];
  const shifts = [];
  for (const def of shiftDefs) {
    const start = new Date(today);
    start.setHours(def.startHour, 0, 0, 0);
    const end = new Date(today);
    end.setHours(def.endHour, 0, 0, 0);

    const existing = await prisma.shift.findFirst({
      where: { shiftName: def.shiftName, date: today },
    });
    const shift =
      existing ??
      (await prisma.shift.create({
        data: {
          shiftName: def.shiftName,
          date: today,
          startTime: start,
          endTime: end,
          supervisorId,
          status: "ACTIVE",
        },
      }));
    shifts.push(shift);
  }
  return shifts;
}

async function seedEmployeesAndLabour(shifts: Awaited<ReturnType<typeof seedShifts>>) {
  console.log("Seeding employees and labour...");

  const departments = ["Sorting Floor", "Warehouse", "Dispatch", "Security"];
  for (let i = 1; i <= 8; i++) {
    const employeeCode = `EMP-${String(i).padStart(3, "0")}`;
    await prisma.employee.upsert({
      where: { employeeCode },
      create: {
        employeeCode,
        name: faker.person.fullName(),
        mobile: faker.phone.number({ style: "national" }),
        department: departments[i % departments.length],
        roleTitle: "Staff",
        joiningDate: faker.date.past({ years: 2 }),
        shiftId: shifts[i % shifts.length].id,
        status: "ACTIVE",
      },
      update: {},
    });
  }

  for (let i = 1; i <= 12; i++) {
    const labourCode = `LAB-${String(i).padStart(3, "0")}`;
    await prisma.labour.upsert({
      where: { labourCode },
      create: {
        labourCode,
        name: faker.person.fullName(),
        mobile: faker.phone.number({ style: "national" }),
        workType: i % 2 === 0 ? "Sorting" : "Loading/Unloading",
        dailyWage: faker.number.int({ min: 400, max: 700 }),
        shiftId: shifts[i % shifts.length].id,
        status: "ACTIVE",
      },
      update: {},
    });
  }
}

// ==================================================
// KISHAN CORPORATION TRANSACTIONAL DEMO DATA
//
// Procurement -> Unloading -> Sorting/Grading -> Sales Orders -> Trips ->
// Crate Returns -> Attendance -> Payroll -> Cleaning -> Next-Day Prep.
//
// Every module below already ships a real server action in
// src/lib/actions/*, but each one calls requirePermission(...) as its first
// line, which resolves the current user via getSessionUser() -> cookies()
// (src/lib/auth/session.ts) — there is no HTTP request/cookie jar in this
// script's execution context, and none of these actions separate their
// business logic from the requirePermission() call into a standalone
// service function we could call instead. So per the task's approach (b),
// every function below reproduces the corresponding action's transaction
// body verbatim (same Prisma writes, same status transitions, same
// ordering), substituting a hardcoded seeded user id for requirePermission's
// return value, and reusing the REAL shared engine functions wherever one
// exists and is safely importable here: `nextDocumentNumber`,
// `applyGradeStockMovement`, `applyStockMovement` (transitively, inside
// applyGradeStockMovement), and `checkTripEligibility`. See the top-of-file
// note for why `writeAuditLog` and `computeSuggestedLabourEarnings` are
// reproduced locally (`seedAuditLog` / `computeSuggestedLabourEarningsLocal`)
// instead of imported.
// ==================================================

type SeedItem = Awaited<ReturnType<typeof seedItems>>[number];
type SeedSupplier = Awaited<ReturnType<typeof seedSuppliers>>[number];
type SeedVehicle = Awaited<ReturnType<typeof seedVehicles>>[number];
type SeedDriver = Awaited<ReturnType<typeof seedDrivers>>[number];
type SeedCustomer = Awaited<ReturnType<typeof seedCustomers>>[number];
type SeedCrate = Awaited<ReturnType<typeof seedCrates>>[number];

type SeededBatch = {
  id: string;
  batchNumber: string;
  itemId: string;
  warehouseId: string;
  rawWeight: number;
  gateEntryId: string;
  grades: { a: number; b: number; c: number; waste: number; wasteReason: WastageReason };
};

/**
 * Procurement (§ Procurement module): create + submit a couple of
 * Procurement documents, each preceded by a real gate-in / followed by a
 * real gate-out (mirrors recordVehicleInAction/recordVehicleOutAction in
 * src/lib/actions/gate-actions.ts) so the resulting ProcurementBatch rows
 * carry a genuine traceability chain, exactly like createProcurementAction /
 * submitProcurementAction in src/lib/actions/procurement-actions.ts.
 */
async function seedProcurementAndBatches(
  storeManagerId: string,
  gateOperatorId: string,
  items: SeedItem[],
  suppliers: SeedSupplier[],
  warehouseId: string,
  vehicles: SeedVehicle[],
  drivers: SeedDriver[],
): Promise<SeededBatch[]> {
  console.log("Seeding procurement documents and batches...");

  const tomato = items.find((i) => i.name === "Tomato")!;
  const potato = items.find((i) => i.name === "Potato")!;

  const defs = [
    {
      item: tomato,
      supplier: suppliers[0],
      vehicle: vehicles[0],
      driver: drivers[0],
      weight: 500,
      price: 25,
      grades: { a: 300, b: 125, c: 40, waste: 35, wasteReason: "QUALITY_REJECTION" as WastageReason },
    },
    {
      item: potato,
      supplier: suppliers[1],
      vehicle: vehicles[1],
      driver: drivers[1],
      weight: 400,
      price: 18,
      grades: { a: 240, b: 100, c: 32, waste: 28, wasteReason: "HANDLING_DAMAGE" as WastageReason },
    },
  ];

  const batches: SeededBatch[] = [];

  for (const def of defs) {
    // --- Gate in (mirrors recordVehicleInAction) ---
    const alreadyInside = await prisma.vehicleGateEntry.findFirst({
      where: { vehicleId: def.vehicle.id, status: "INSIDE" },
    });
    if (alreadyInside) {
      console.log(`  Vehicle ${def.vehicle.vehicleNumber} already has an open gate entry; skipping its procurement.`);
      continue;
    }

    const gateEntry = await prisma.$transaction(async (tx) => {
      const gateEntryNumber = await nextDocumentNumber(tx, "GATE_ENTRY");
      const entry = await tx.vehicleGateEntry.create({
        data: {
          gateEntryNumber,
          vehicleId: def.vehicle.id,
          driverId: def.driver.id,
          supplierId: def.supplier.id,
          purpose: "Produce delivery",
          material: def.item.name,
          securityStaffId: gateOperatorId,
          timeIn: faker.date.recent({ days: 3 }),
          status: "INSIDE",
        },
      });
      await tx.vehicle.update({ where: { id: def.vehicle.id }, data: { status: "INSIDE" } });
      return entry;
    });
    await seedAuditLog({
      userId: gateOperatorId,
      action: "CREATE",
      entityType: "VehicleGateEntry",
      entityId: gateEntry.id,
      newValues: { gateEntryNumber: gateEntry.gateEntryNumber },
    });

    // --- Procurement DRAFT (mirrors createProcurementAction) ---
    const procurement = await prisma.$transaction(async (tx) => {
      const procurementNumber = await nextDocumentNumber(tx, "PROCUREMENT");
      return tx.procurement.create({
        data: {
          procurementNumber,
          date: gateEntry.timeIn,
          supplierId: def.supplier.id,
          vehicleId: def.vehicle.id,
          driverId: def.driver.id,
          gateEntryId: gateEntry.id,
          warehouseId,
          invoiceNumber: `INV-${faker.string.alphanumeric(8).toUpperCase()}`,
          status: "DRAFT",
          createdById: storeManagerId,
          items: {
            create: [
              {
                itemId: def.item.id,
                quantity: def.weight,
                unit: def.item.unit,
                weight: def.weight,
                purchasePrice: def.price,
                total: def.weight * def.price,
              },
            ],
          },
        },
        include: { items: true },
      });
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "CREATE",
      entityType: "Procurement",
      entityId: procurement.id,
      newValues: { procurementNumber: procurement.procurementNumber },
    });

    // --- Submit -> create ProcurementBatch rows (mirrors submitProcurementAction) ---
    const createdBatches = await prisma.$transaction(async (tx) => {
      const result: { id: string; batchNumber: string }[] = [];
      for (const line of procurement.items) {
        const batchNumber = await nextDocumentNumber(tx, "PROCUREMENT_BATCH");
        const batch = await tx.procurementBatch.create({
          data: {
            batchNumber,
            procurementId: procurement.id,
            procurementItemId: line.id,
            supplierId: procurement.supplierId,
            itemId: line.itemId,
            vehicleId: procurement.vehicleId,
            driverId: procurement.driverId,
            gateEntryId: procurement.gateEntryId,
            warehouseId: procurement.warehouseId,
            rawWeight: line.weight,
            date: procurement.date,
            status: "PENDING_UNLOADING",
          },
        });
        result.push({ id: batch.id, batchNumber: batch.batchNumber });
      }
      await tx.procurement.update({ where: { id: procurement.id }, data: { status: "SUBMITTED" } });
      return result;
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Procurement",
      entityId: procurement.id,
      oldValues: { status: "DRAFT" },
      newValues: { status: "SUBMITTED", batchCount: createdBatches.length },
    });

    for (const b of createdBatches) {
      batches.push({
        id: b.id,
        batchNumber: b.batchNumber,
        itemId: def.item.id,
        warehouseId,
        rawWeight: def.weight,
        gateEntryId: gateEntry.id,
        grades: def.grades,
      });
    }
  }

  return batches;
}

/**
 * Unloading (src/lib/actions/unloading-actions.ts): one Unloading row per
 * gate entry, transitioning every PENDING_UNLOADING batch on that gate entry
 * to PENDING_SORTING, then a real gate-out to free the vehicle again.
 */
async function seedUnloading(batches: SeededBatch[], storeManagerId: string, gateOperatorId: string) {
  console.log("Seeding unloading records...");

  const gateEntryIds = [...new Set(batches.map((b) => b.gateEntryId))];
  for (const gateEntryId of gateEntryIds) {
    const gateEntry = await prisma.vehicleGateEntry.findUniqueOrThrow({ where: { id: gateEntryId } });
    const batchesForEntry = batches.filter((b) => b.gateEntryId === gateEntryId);
    const totalWeight = batchesForEntry.reduce((sum, b) => sum + b.rawWeight, 0);

    // startUnloadingAction
    const unloading = await prisma.unloading.create({
      data: {
        gateEntryId,
        vehicleId: gateEntry.vehicleId,
        driverId: gateEntry.driverId,
        supplierId: gateEntry.supplierId,
        arrivalAt: gateEntry.timeIn,
        unloadingStartAt: new Date(),
        unloadingStaffId: gateOperatorId,
      },
    });
    await seedAuditLog({
      userId: gateOperatorId,
      action: "CREATE",
      entityType: "Unloading",
      entityId: unloading.id,
      newValues: { gateEntryId },
    });

    // completeUnloadingAction
    //
    // SCHEMA/ACTION GAP: completeUnloadingAction (src/lib/actions/unloading-actions.ts)
    // only advances ProcurementBatch.status to PENDING_SORTING — it never
    // credits any grade-aware stock. submitSortingAction (sorting-actions.ts)
    // then unconditionally DECREASES Grade.RAW for the batch's full
    // rawWeight, which throws InsufficientGradeStockError against a real,
    // never-seeded database too (verified by running this script before this
    // fix was added). produce-inventory.ts's own mapping-table comment
    // documents exactly this missing call ("PROCUREMENT + INCREASE ->
    // INWARD (goods received, grade=RAW)"), so unloading completion is
    // evidently where it belongs — added here via the real
    // `applyGradeStockMovement` engine, not by editing unloading-actions.ts.
    const batchCount = await prisma.$transaction(async (tx) => {
      await tx.unloading.update({
        where: { id: unloading.id },
        data: { unloadingEndAt: new Date(), weight: totalWeight, unloadingStaffId: gateOperatorId },
      });
      const result = await tx.procurementBatch.updateMany({
        where: { gateEntryId, status: "PENDING_UNLOADING" },
        data: { status: "PENDING_SORTING" },
      });
      for (const batch of batchesForEntry) {
        await applyGradeStockMovement(tx, {
          itemId: batch.itemId,
          warehouseId: batch.warehouseId,
          grade: Grade.RAW,
          transactionType: GradeLedgerTxnType.PROCUREMENT,
          direction: "INCREASE",
          quantity: batch.rawWeight,
          referenceType: "Unloading",
          referenceId: unloading.id,
          referenceNumber: batch.batchNumber,
          batchId: batch.id,
          userId: storeManagerId,
        });
      }
      return result.count;
    });
    await seedAuditLog({
      userId: gateOperatorId,
      action: "EDIT",
      entityType: "Unloading",
      entityId: unloading.id,
      newValues: { weight: totalWeight, completed: true, batchesAdvanced: batchCount },
    });

    // recordVehicleOutAction
    await prisma.$transaction(async (tx) => {
      const gateExitNumber = await nextDocumentNumber(tx, "GATE_EXIT");
      const timeOut = new Date();
      const totalTimeInsideMinutes = Math.max(
        0,
        Math.round((timeOut.getTime() - gateEntry.timeIn.getTime()) / 60000),
      );
      await tx.vehicleGateExit.create({
        data: {
          gateExitNumber,
          gateEntryId,
          vehicleId: gateEntry.vehicleId,
          driverId: gateEntry.driverId,
          timeOut,
          material: "Produce delivered",
          totalTimeInsideMinutes,
        },
      });
      await tx.vehicleGateEntry.update({ where: { id: gateEntryId }, data: { status: "OUT" } });
      await tx.vehicle.update({ where: { id: gateEntry.vehicleId }, data: { status: "AVAILABLE" } });
    });
    await seedAuditLog({
      userId: gateOperatorId,
      action: "CREATE",
      entityType: "VehicleGateExit",
      entityId: gateEntryId,
      newValues: { gateEntryId },
    });
  }
}

/**
 * Sorting/Grading + Wastage (submitSortingAction in
 * src/lib/actions/sorting-actions.ts): for each PENDING_SORTING batch,
 * grade splits are chosen so gradeA + gradeB + gradeC + waste sums EXACTLY
 * to rawWeight (60% / 25% / 8% / 7%, otherGradeWeight always 0), using the
 * real `applyGradeStockMovement` engine for every grade movement and
 * creating the Wastage row the same way the action does.
 */
async function seedSorting(batches: SeededBatch[], storeManagerId: string) {
  console.log("Seeding sorting/grading and wastage...");

  for (const batch of batches) {
    const { a, b, c, waste, wasteReason } = batch.grades;

    const sorting = await prisma.$transaction(async (tx) => {
      const created = await tx.sorting.create({
        data: {
          batchId: batch.id,
          rawWeight: batch.rawWeight,
          gradeAWeight: a,
          gradeBWeight: b,
          gradeCWeight: c,
          otherGradeWeight: 0,
          wasteWeight: waste,
          wasteReason,
          sortedById: storeManagerId,
          remarks: "Seed data: routine grading",
        },
      });

      await applyGradeStockMovement(tx, {
        itemId: batch.itemId,
        warehouseId: batch.warehouseId,
        grade: Grade.RAW,
        transactionType: GradeLedgerTxnType.SORTING,
        direction: "DECREASE",
        quantity: batch.rawWeight,
        referenceType: "SORTING",
        referenceId: created.id,
        referenceNumber: batch.batchNumber,
        batchId: batch.id,
        userId: storeManagerId,
      });

      const produced: [Grade, number][] = [
        [Grade.GRADE_A, a],
        [Grade.GRADE_B, b],
        [Grade.GRADE_C, c],
      ];
      for (const [grade, weight] of produced) {
        if (weight > 0) {
          await applyGradeStockMovement(tx, {
            itemId: batch.itemId,
            warehouseId: batch.warehouseId,
            grade,
            transactionType: GradeLedgerTxnType.SORTING,
            direction: "INCREASE",
            quantity: weight,
            referenceType: "SORTING",
            referenceId: created.id,
            referenceNumber: batch.batchNumber,
            batchId: batch.id,
            userId: storeManagerId,
          });
        }
      }

      if (waste > 0) {
        const wastageNumber = await nextDocumentNumber(tx, "WASTAGE");
        await tx.wastage.create({
          data: {
            wastageNumber,
            stage: "SORTING",
            batchId: batch.id,
            itemId: batch.itemId,
            warehouseId: batch.warehouseId,
            quantity: waste,
            reason: wasteReason,
            date: new Date(),
            recordedById: storeManagerId,
            remarks: "Seed data: sorting waste",
          },
        });
      }

      await tx.procurementBatch.update({ where: { id: batch.id }, data: { status: "SORTED" } });
      return created;
    });

    await seedAuditLog({
      userId: storeManagerId,
      action: "CREATE",
      entityType: "Sorting",
      entityId: sorting.id,
      newValues: { batchNumber: batch.batchNumber, gradeAWeight: a, gradeBWeight: b, gradeCWeight: c, wasteWeight: waste },
    });
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Sales Orders (src/lib/actions/sales-order-actions.ts): SO1 walks all the
 * way to APPROVED (create -> submit -> approve); SO2 is left PENDING so the
 * live app has an approval waiting.
 */
async function seedSalesOrders(customers: SeedCustomer[], items: SeedItem[], storeManagerId: string) {
  console.log("Seeding sales orders...");

  const tomato = items.find((i) => i.name === "Tomato")!;
  const potato = items.find((i) => i.name === "Potato")!;

  async function createSalesOrderDirect(
    customerId: string,
    lines: { itemId: string; grade: Grade; quantity: number; rate: number }[],
    priority: string,
  ) {
    const withTotals = lines.map((l) => ({ ...l, total: round2(l.quantity * l.rate) }));
    const totalAmount = round2(withTotals.reduce((sum, l) => sum + l.total, 0));

    const so = await prisma.$transaction(async (tx) => {
      const soNumber = await nextDocumentNumber(tx, "SALES_ORDER");
      return tx.salesOrder.create({
        data: {
          soNumber,
          customerId,
          orderDate: faker.date.recent({ days: 5 }),
          deliveryDate: faker.date.soon({ days: 3 }),
          priority,
          totalAmount,
          status: "DRAFT",
          createdById: storeManagerId,
          items: {
            create: withTotals.map((l) => ({
              itemId: l.itemId,
              grade: l.grade,
              quantity: l.quantity,
              rate: l.rate,
              total: l.total,
              fulfilledQty: 0,
            })),
          },
        },
        include: { items: true },
      });
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "CREATE",
      entityType: "SalesOrder",
      entityId: so.id,
      newValues: { soNumber: so.soNumber, totalAmount },
    });
    return so;
  }

  async function submitSalesOrderDirect(id: string) {
    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({ where: { id }, data: { status: "PENDING" } });
      await tx.approval.create({
        data: { entityType: "SalesOrder", entityId: id, requestedById: storeManagerId, salesOrderFk: id },
      });
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "SalesOrder",
      entityId: id,
      oldValues: { status: "DRAFT" },
      newValues: { status: "PENDING" },
    });
  }

  async function approveSalesOrderDirect(id: string) {
    await prisma.$transaction(async (tx) => {
      const approval = await tx.approval.findFirst({
        where: { salesOrderFk: id, decision: "PENDING" },
        orderBy: { requestedAt: "desc" },
      });
      if (approval) {
        await tx.approval.update({
          where: { id: approval.id },
          data: { decision: "APPROVED", decidedById: storeManagerId, decidedAt: new Date() },
        });
      }
      await tx.salesOrder.update({ where: { id }, data: { status: "APPROVED", approvedById: storeManagerId } });
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "APPROVE",
      entityType: "SalesOrder",
      entityId: id,
      newValues: { decision: "APPROVED" },
    });
  }

  const so1 = await createSalesOrderDirect(
    customers[0].id,
    [
      { itemId: tomato.id, grade: Grade.GRADE_A, quantity: 100, rate: 40 },
      { itemId: potato.id, grade: Grade.GRADE_A, quantity: 80, rate: 22 },
    ],
    "HIGH",
  );
  await submitSalesOrderDirect(so1.id);
  await approveSalesOrderDirect(so1.id);

  const so2 = await createSalesOrderDirect(
    customers[1].id,
    [{ itemId: tomato.id, grade: Grade.GRADE_A, quantity: 50, rate: 42 }],
    "NORMAL",
  );
  await submitSalesOrderDirect(so2.id);

  return { so1, so2, tomatoId: tomato.id, potatoId: potato.id };
}

/**
 * Trips (src/lib/actions/trip-actions.ts). Trip1 fulfils SO1's line items and
 * is walked through its entire lifecycle to RETURNED so there is real
 * historical dispatch/delivery data. Trip2 is left at CREATED and Trip3 at
 * LOADING so the live Dispatch board has pending work to show, per the task.
 * Eligibility is checked with the real `checkTripEligibility` before each
 * trip is created, exactly like createTripAction does.
 */
async function seedTrips(
  storeManagerId: string,
  customers: SeedCustomer[],
  vehicles: SeedVehicle[],
  drivers: SeedDriver[],
  routes: { id: string }[],
  so1Id: string,
  tomatoId: string,
  potatoId: string,
) {
  console.log("Seeding trips through their lifecycle...");

  async function createTripDirect(params: {
    salesOrderId?: string;
    customerId: string;
    routeId?: string;
    vehicleId: string;
    driverId: string;
    items: { salesOrderItemId?: string; itemId: string; grade: Grade; quantity: number; cratesCount?: number }[];
  }) {
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: params.vehicleId } });
    const driver = await prisma.driver.findUniqueOrThrow({ where: { id: params.driverId } });
    const itemIds = [...new Set(params.items.map((l) => l.itemId))];
    const itemRows = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(itemRows.map((i) => [i.id, i]));

    const eligibilityItems = params.items.map((line) => {
      const item = itemsById.get(line.itemId)!;
      return {
        itemId: item.id,
        itemName: item.name,
        warehouseId: item.warehouseId!,
        grade: line.grade,
        quantity: line.quantity,
      };
    });
    const eligibility = await checkTripEligibility({ vehicle, driver, items: eligibilityItems });
    if (!eligibility.allowed) {
      throw new Error(`Seed trip is not eligible for dispatch: ${eligibility.reasons.join(" ")}`);
    }

    const trip = await prisma.$transaction(async (tx) => {
      const tripNumber = await nextDocumentNumber(tx, "TRIP");
      const created = await tx.trip.create({
        data: {
          tripNumber,
          salesOrderId: params.salesOrderId ?? null,
          customerId: params.customerId,
          routeId: params.routeId ?? null,
          vehicleId: params.vehicleId,
          driverId: params.driverId,
          status: "CREATED",
          createdById: storeManagerId,
          items: {
            create: params.items.map((l) => ({
              salesOrderItemId: l.salesOrderItemId ?? null,
              itemId: l.itemId,
              grade: l.grade,
              quantity: l.quantity,
              cratesCount: l.cratesCount ?? null,
            })),
          },
        },
      });
      for (const line of params.items) {
        if (!line.salesOrderItemId) continue;
        try {
          await tx.salesOrderItem.update({
            where: { id: line.salesOrderItemId },
            data: { fulfilledQty: { increment: line.quantity } },
          });
        } catch {
          // best-effort, same as createTripAction
        }
      }
      return created;
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "CREATE",
      entityType: "Trip",
      entityId: trip.id,
      newValues: { tripNumber: trip.tripNumber, customerId: params.customerId, itemCount: params.items.length },
    });
    return trip;
  }

  async function approveTripDirect(id: string) {
    await prisma.trip.update({ where: { id }, data: { status: "APPROVED" } });
    await seedAuditLog({
      userId: storeManagerId,
      action: "APPROVE",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "CREATED" },
      newValues: { status: "APPROVED" },
    });
  }

  async function startTripLoadingDirect(id: string) {
    await prisma.trip.update({ where: { id }, data: { status: "LOADING" } });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "APPROVED" },
      newValues: { status: "LOADING" },
    });
  }

  async function markTripLoadedDirect(id: string) {
    await prisma.trip.update({ where: { id }, data: { status: "LOADED" } });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "LOADING" },
      newValues: { status: "LOADED" },
    });
  }

  async function dispatchTripDirect(id: string) {
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id }, include: { items: true } });
    const itemIds = [...new Set(trip.items.map((l) => l.itemId))];
    const itemRows = await prisma.item.findMany({ where: { id: { in: itemIds } } });
    const itemsById = new Map(itemRows.map((i) => [i.id, i]));

    await prisma.$transaction(async (tx) => {
      for (const line of trip.items) {
        const item = itemsById.get(line.itemId)!;
        await applyGradeStockMovement(tx, {
          itemId: line.itemId,
          warehouseId: item.warehouseId!,
          grade: line.grade,
          transactionType: GradeLedgerTxnType.DISPATCH,
          direction: "DECREASE",
          quantity: line.quantity,
          referenceType: "Trip",
          referenceId: trip.id,
          referenceNumber: trip.tripNumber,
          userId: storeManagerId,
        });
      }
      await tx.trip.update({
        where: { id },
        data: { status: "DISPATCHED", departureAt: trip.departureAt ?? new Date() },
      });
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "LOADED" },
      newValues: { status: "DISPATCHED" },
    });
  }

  async function markTripDeliveredDirect(id: string) {
    await prisma.trip.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "DISPATCHED" },
      newValues: { status: "DELIVERED" },
    });
  }

  async function markTripReturnedDirect(id: string) {
    await prisma.trip.update({ where: { id }, data: { status: "RETURNED", returnedAt: new Date() } });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Trip",
      entityId: id,
      oldValues: { status: "DELIVERED" },
      newValues: { status: "RETURNED" },
    });
  }

  const so1 = await prisma.salesOrder.findUniqueOrThrow({ where: { id: so1Id }, include: { items: true } });
  const so1TomatoItem = so1.items.find((i) => i.itemId === tomatoId)!;
  const so1PotatoItem = so1.items.find((i) => i.itemId === potatoId)!;

  // Trip 1: fulfils SO1, walked all the way to RETURNED.
  const trip1 = await createTripDirect({
    salesOrderId: so1.id,
    customerId: customers[0].id,
    routeId: routes[0]?.id,
    vehicleId: vehicles[2].id,
    driverId: drivers[2].id,
    items: [
      { salesOrderItemId: so1TomatoItem.id, itemId: tomatoId, grade: Grade.GRADE_A, quantity: 100, cratesCount: 10 },
      { salesOrderItemId: so1PotatoItem.id, itemId: potatoId, grade: Grade.GRADE_A, quantity: 80, cratesCount: 8 },
    ],
  });
  await approveTripDirect(trip1.id);
  await startTripLoadingDirect(trip1.id);
  await markTripLoadedDirect(trip1.id);
  await dispatchTripDirect(trip1.id);
  await markTripDeliveredDirect(trip1.id);
  await markTripReturnedDirect(trip1.id);

  // Trip 2: ad-hoc dispatch, left CREATED (pending approval work).
  await createTripDirect({
    customerId: customers[2 % customers.length].id,
    routeId: routes[1]?.id,
    vehicleId: vehicles[3].id,
    driverId: drivers[3].id,
    items: [{ itemId: tomatoId, grade: Grade.GRADE_A, quantity: 50, cratesCount: 5 }],
  });

  // Trip 3: ad-hoc dispatch, walked to LOADING (pending loading-completion work).
  const trip3 = await createTripDirect({
    customerId: customers[0].id,
    routeId: routes[2]?.id,
    vehicleId: vehicles[0].id,
    driverId: drivers[0].id,
    items: [{ itemId: potatoId, grade: Grade.GRADE_A, quantity: 30, cratesCount: 3 }],
  });
  await approveTripDirect(trip3.id);
  await startTripLoadingDirect(trip3.id);

  return { trip1Id: trip1.id, tripVehicleId: trip1.vehicleId };
}

/**
 * Crate Return (src/lib/actions/crate-return-actions.ts): for the completed
 * (RETURNED) trip, mark a pool of physical crates as having gone out with it
 * (Crate.customerId/status), then run the same per-crate-outcome logic the
 * action runs — most RETURNED (-> CLEANING), one DAMAGED, one MISSING.
 */
async function seedCrateReturn(
  tripId: string,
  customerId: string,
  crates: SeedCrate[],
  storeManagerId: string,
) {
  console.log("Seeding crate return for the completed trip...");

  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });

  const availablePool = crates.filter((c) => c.status === "AVAILABLE");
  const chosen = availablePool.slice(0, Math.min(18, availablePool.length));
  if (chosen.length === 0) {
    console.log("  No AVAILABLE crates left to seed a crate return with; skipping.");
    return { returnedCrateIds: [] as string[] };
  }

  for (const c of chosen) {
    await prisma.crate.update({ where: { id: c.id }, data: { status: "WITH_CUSTOMER", customerId } });
  }

  const dispatched = chosen.length;
  const missing = dispatched >= 3 ? 1 : 0;
  const damaged = dispatched >= 2 ? 1 : 0;
  const returnedIds = chosen.slice(0, dispatched - missing - damaged).map((c) => c.id);
  const damagedIds = damaged > 0 ? [chosen[dispatched - missing - damaged].id] : [];
  const missingIds = missing > 0 ? [chosen[dispatched - missing].id] : [];

  const result = await prisma.$transaction(async (tx) => {
    const returnNumber = await nextDocumentNumber(tx, "CRATE_RETURN");
    const crateReturn = await tx.crateReturn.create({
      data: {
        returnNumber,
        tripId: trip.id,
        customerId,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        cratesDispatched: dispatched,
        cratesReturned: returnedIds.length,
        cratesDamaged: damagedIds.length,
        cratesMissing: missingIds.length,
        returnDate: new Date(),
        condition: "Mostly good, minor wear",
        remarks: "Seed data: routine crate return",
      },
    });

    const applied: { id: string; status: string }[] = [];
    for (const id of returnedIds) {
      await tx.crate.update({ where: { id }, data: { status: "CLEANING", customerId: null } });
      applied.push({ id, status: "CLEANING" });
    }
    for (const id of damagedIds) {
      await tx.crate.update({ where: { id }, data: { status: "DAMAGED" } });
      applied.push({ id, status: "DAMAGED" });
    }
    for (const id of missingIds) {
      await tx.crate.update({ where: { id }, data: { status: "MISSING" } });
      applied.push({ id, status: "MISSING" });
    }

    return { crateReturn, applied };
  });

  await seedAuditLog({
    userId: storeManagerId,
    action: "CREATE",
    entityType: "CrateReturn",
    entityId: result.crateReturn.id,
    newValues: {
      returnNumber: result.crateReturn.returnNumber,
      tripId: trip.id,
      cratesDispatched: dispatched,
      cratesReturned: returnedIds.length,
      cratesDamaged: damagedIds.length,
      cratesMissing: missingIds.length,
    },
  });
  for (const u of result.applied) {
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "Crate",
      entityId: u.id,
      newValues: { status: u.status, reason: `Crate return ${result.crateReturn.returnNumber}` },
    });
  }

  return { returnedCrateIds: returnedIds };
}

/**
 * Attendance (src/lib/actions/attendance-actions.ts): marks every seeded
 * Employee/Labour for the last 6 days, upserting on the same
 * (date, employeeId)/(date, labourId) unique keys the real action upserts
 * on, so re-running the seed script never violates those constraints.
 */
async function seedAttendance(
  employees: { id: string; shiftId: string | null }[],
  labourers: { id: string; shiftId: string | null }[],
  hrPayrollId: string,
) {
  console.log("Seeding attendance for the last 6 days...");

  const DAYS = 6;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);

    for (const emp of employees) {
      const roll = faker.number.float({ min: 0, max: 1 });
      const status = roll < 0.85 ? "PRESENT" : roll < 0.93 ? "HALF_DAY" : "ABSENT";
      const where = { date_employeeId: { date, employeeId: emp.id } };
      const existing = await prisma.attendance.findUnique({ where });
      const record = await prisma.attendance.upsert({
        where,
        create: {
          date,
          employeeId: emp.id,
          shiftId: emp.shiftId,
          status,
          overtimeHours: status === "PRESENT" ? faker.number.int({ min: 0, max: 2 }) : 0,
        },
        update: { status },
      });
      await seedAuditLog({
        userId: hrPayrollId,
        action: existing ? "EDIT" : "CREATE",
        entityType: "Attendance",
        entityId: record.id,
        newValues: { date, status },
      });
    }

    for (const lab of labourers) {
      const roll = faker.number.float({ min: 0, max: 1 });
      const status = roll < 0.8 ? "PRESENT" : roll < 0.9 ? "HALF_DAY" : "ABSENT";
      const where = { date_labourId: { date, labourId: lab.id } };
      const existing = await prisma.attendance.findUnique({ where });
      const record = await prisma.attendance.upsert({
        where,
        create: { date, labourId: lab.id, shiftId: lab.shiftId, status, overtimeHours: 0 },
        update: { status },
      });
      await seedAuditLog({
        userId: hrPayrollId,
        action: existing ? "EDIT" : "CREATE",
        entityType: "Attendance",
        entityId: record.id,
        newValues: { date, status },
      });
    }
  }
}

/**
 * Payroll (src/lib/actions/payroll-actions.ts): runs one past period (the
 * same 6-day window just attended) for two Labour records — using the real
 * suggested-earnings formula (see computeSuggestedLabourEarningsLocal note
 * at the top of the file) — and two Employee records (no suggested formula
 * exists for employees in the real module either; a flat figure is entered
 * exactly like a user would type into the Run Payroll form).
 */
async function seedPayroll(
  employees: { id: string }[],
  labourers: { id: string }[],
  hrPayrollId: string,
) {
  console.log("Seeding payroll for one past period...");

  const periodEnd = new Date();
  periodEnd.setHours(0, 0, 0, 0);
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 5);

  for (const lab of labourers.slice(0, 2)) {
    const suggestion = await computeSuggestedLabourEarningsLocal(lab.id, periodStart, periodEnd);
    if (!suggestion) continue;
    const earnings = suggestion.earnings;
    const netSalary = earnings;
    const created = await prisma.salary.create({
      data: {
        labourId: lab.id,
        periodStart,
        periodEnd,
        earnings,
        overtimeAmount: 0,
        advances: 0,
        deductions: 0,
        netSalary,
        paymentStatus: "PENDING",
      },
    });
    await seedAuditLog({
      userId: hrPayrollId,
      action: "CREATE",
      entityType: "Salary",
      entityId: created.id,
      newValues: { labourId: lab.id, earnings, netSalary },
    });
  }

  for (const [index, emp] of employees.slice(0, 2).entries()) {
    const earnings = 3500;
    const overtimeAmount = 200;
    const advances = 0;
    const deductions = 100;
    const netSalary = earnings + overtimeAmount - advances - deductions;
    const created = await prisma.salary.create({
      data: {
        employeeId: emp.id,
        periodStart,
        periodEnd,
        earnings,
        overtimeAmount,
        advances,
        deductions,
        netSalary,
        paymentStatus: "PENDING",
      },
    });
    await seedAuditLog({
      userId: hrPayrollId,
      action: "CREATE",
      entityType: "Salary",
      entityId: created.id,
      newValues: { employeeId: emp.id, earnings, netSalary },
    });

    // Leave one paid, one pending, so there is real historical data either way.
    if (index === 0) {
      await prisma.salary.update({ where: { id: created.id }, data: { paymentStatus: "PAID", paidAt: new Date() } });
      await seedAuditLog({
        userId: hrPayrollId,
        action: "APPROVE",
        entityType: "Salary",
        entityId: created.id,
        oldValues: { paymentStatus: "PENDING" },
        newValues: { paymentStatus: "PAID" },
      });
    }
  }
}

/**
 * Cleaning (src/lib/actions/cleaning-actions.ts): one VEHICLE record for the
 * trip vehicle after its return, and one CRATE record for a crate that just
 * came back from the crate return above (if any were seeded).
 */
async function seedCleaning(vehicleId: string, crateId: string | undefined, storeManagerId: string) {
  console.log("Seeding cleaning records...");

  const vehicleCleaning = await prisma.cleaning.create({
    data: {
      entityType: "VEHICLE",
      vehicleId,
      cleaningType: "Post-trip wash",
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(),
      staffId: storeManagerId,
      status: "COMPLETED",
      remarks: "Seed data: post-delivery vehicle wash",
    },
  });
  await seedAuditLog({
    userId: storeManagerId,
    action: "CREATE",
    entityType: "Cleaning",
    entityId: vehicleCleaning.id,
    newValues: { entityType: "VEHICLE", vehicleId },
  });

  if (crateId) {
    const crateCleaning = await prisma.cleaning.create({
      data: {
        entityType: "CRATE",
        crateId,
        cleaningType: "Wash and sanitize",
        startTime: new Date(),
        staffId: storeManagerId,
        status: "IN_PROGRESS",
        remarks: "Seed data: crate cleaning after return",
      },
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "CREATE",
      entityType: "Cleaning",
      entityId: crateCleaning.id,
      newValues: { entityType: "CRATE", crateId },
    });
  }
}

/**
 * Next-Day Preparation (src/lib/actions/next-day-prep-actions.ts): one
 * checklist for today, with the same default checklist labels the real
 * action seeds (DEFAULT_CHECKLIST_LABELS), plus one item completed and one
 * assigned so the page shows realistic mixed progress. Guarded by the same
 * unique `date` the real action relies on, so re-running the seed script on
 * the same calendar day is a no-op here instead of crashing.
 */
async function seedNextDayPreparation(storeManagerId: string) {
  console.log("Seeding next-day preparation checklist...");

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const existing = await prisma.nextDayPreparation.findUnique({ where: { date } });
  if (existing) {
    console.log("  A NextDayPreparation for today already exists; skipping.");
    return;
  }

  const prep = await prisma.$transaction(async (tx) => {
    const created = await tx.nextDayPreparation.create({
      data: { date, createdById: storeManagerId, remarks: "Seed data: routine next-day prep" },
    });
    await tx.nextDayChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_LABELS.map((label) => ({ preparationId: created.id, label })),
    });
    return created;
  });
  await seedAuditLog({
    userId: storeManagerId,
    action: "CREATE",
    entityType: "NextDayPreparation",
    entityId: prep.id,
    newValues: { date },
  });

  const items = await prisma.nextDayChecklistItem.findMany({ where: { preparationId: prep.id } });
  const vehicleItem = items.find((i) => i.label === "Vehicle availability");
  const driverItem = items.find((i) => i.label === "Driver availability");

  if (vehicleItem) {
    await prisma.nextDayChecklistItem.update({
      where: { id: vehicleItem.id },
      data: { status: "COMPLETE", remark: "Checked, all vehicles ready." },
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "NextDayChecklistItem",
      entityId: vehicleItem.id,
      newValues: { status: "COMPLETE" },
    });
  }
  if (driverItem) {
    await prisma.nextDayChecklistItem.update({
      where: { id: driverItem.id },
      data: { assignedToId: storeManagerId, status: "ASSIGNED" },
    });
    await seedAuditLog({
      userId: storeManagerId,
      action: "EDIT",
      entityType: "NextDayChecklistItem",
      entityId: driverItem.id,
      newValues: { assignedToId: storeManagerId, status: "ASSIGNED" },
    });
  }
}

async function main() {
  console.log("Starting seed...\n");

  const roles = await seedPermissionsAndRoles();
  const users = await seedUsers(roles);
  await seedSettings(users["Super Admin"].id);

  const categoryIds = await seedCategories();
  const warehouses = await seedWarehouses(users["Store Manager"].id);
  const suppliers = await seedSuppliers();
  const items = await seedItems(
    categoryIds,
    warehouses[0].id,
    suppliers.map((s) => s.id),
  );

  await seedOpeningStockAndTransactions(
    items,
    warehouses[0].id,
    suppliers[0].id,
    users["Store Manager"].id,
  );

  const drivers = await seedDrivers();
  const vehicles = await seedVehicles(drivers);
  await seedFuelAndMaintenance(vehicles, users["Vehicle Manager"].id);
  await seedTemperatureLogs(items, warehouses[1].id, users["Store Operator"].id);
  await seedNotifications(users);

  const customers = await seedCustomers();
  const { routes } = await seedRoutesAndClusters();
  const crates = await seedCrates();
  const shifts = await seedShifts(users["Store Manager"].id);
  await seedEmployeesAndLabour(shifts);

  // --- Kishan Corporation transactional demo data ---
  const batches = await seedProcurementAndBatches(
    users["Store Manager"].id,
    users["Gate Operator"].id,
    items,
    suppliers,
    warehouses[0].id,
    vehicles,
    drivers,
  );
  await seedUnloading(batches, users["Store Manager"].id, users["Gate Operator"].id);
  await seedSorting(batches, users["Store Manager"].id);

  const { so1, tomatoId, potatoId } = await seedSalesOrders(customers, items, users["Store Manager"].id);
  const { trip1Id, tripVehicleId } = await seedTrips(
    users["Store Manager"].id,
    customers,
    vehicles,
    drivers,
    routes,
    so1.id,
    tomatoId,
    potatoId,
  );
  const { returnedCrateIds } = await seedCrateReturn(trip1Id, customers[0].id, crates, users["Store Manager"].id);

  const employees = await prisma.employee.findMany({ select: { id: true, shiftId: true } });
  const labourers = await prisma.labour.findMany({ select: { id: true, shiftId: true } });
  await seedAttendance(employees, labourers, users["HR / Payroll"].id);
  await seedPayroll(employees, labourers, users["HR / Payroll"].id);

  await seedCleaning(tripVehicleId, returnedCrateIds[0], users["Store Manager"].id);
  await seedNextDayPreparation(users["Store Manager"].id);

  console.log("\nSeed complete.");
  console.log("\nDevelopment login credentials (all use the same password):");
  console.log(`  Password: ${DEV_PASSWORD}\n`);
  for (const u of SEED_USER_LIST) {
    console.log(`  ${u.role.padEnd(16)} ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
