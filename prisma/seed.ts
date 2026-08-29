/**
 * Development/demo seed data. Clearly separated from production data via
 * isDemoUser=true on seeded users; seeded transactional records are ordinary
 * rows created through the same engine functions the app uses at runtime.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, LedgerTxnType, ActiveStatus, StorageType } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { hashPassword } from "../src/lib/auth/password";
import { encryptSensitive, maskAadhaar, maskPAN, maskLicence } from "../src/lib/crypto";
import { applyStockMovement } from "../src/lib/services/inventory";
import { nextDocumentNumber } from "../src/lib/numbering";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_NAMES,
} from "../src/lib/auth/permissions";

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
