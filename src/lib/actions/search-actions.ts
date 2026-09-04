"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";

export type SearchResultGroup = {
  label: string;
  items: { id: string; title: string; subtitle: string; href: string }[];
};

export async function globalSearchAction(query: string): Promise<SearchResultGroup[]> {
  await requirePermission("GLOBAL_SEARCH");
  const q = query.trim();
  if (q.length < 2) return [];

  const [
    items,
    suppliers,
    vehicles,
    drivers,
    inwards,
    outwards,
    pos,
    customers,
    procurementBatches,
    crates,
    employees,
    labourers,
  ] = await Promise.all([
    prisma.item.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { itemCode: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: {
        OR: [
          { companyName: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.vehicle.findMany({
      where: { vehicleNumber: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.driver.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { employeeId: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.stockInward.findMany({
      where: { inwardNumber: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.stockOutward.findMany({
      where: { outwardNumber: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.purchaseOrder.findMany({
      where: { poNumber: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { customerCode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.procurementBatch.findMany({
      where: { batchNumber: { contains: q, mode: "insensitive" } },
      include: { item: true },
      take: 5,
    }),
    prisma.crate.findMany({
      where: { crateCode: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.employee.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { employeeCode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.labour.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { labourCode: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
  ]);

  const groups: SearchResultGroup[] = [
    {
      label: "Items",
      items: items.map((i) => ({
        id: i.id,
        title: i.name,
        subtitle: `${i.sku} · ${i.itemCode}`,
        href: `/items/${i.id}`,
      })),
    },
    {
      label: "Suppliers",
      items: suppliers.map((s) => ({
        id: s.id,
        title: s.companyName,
        subtitle: s.code,
        href: `/suppliers/${s.id}`,
      })),
    },
    {
      label: "Vehicles",
      items: vehicles.map((v) => ({
        id: v.id,
        title: v.vehicleNumber,
        subtitle: v.vehicleType,
        href: `/vehicles/${v.id}`,
      })),
    },
    {
      label: "Drivers",
      items: drivers.map((d) => ({
        id: d.id,
        title: d.fullName,
        subtitle: d.employeeId ?? "",
        href: `/drivers/${d.id}`,
      })),
    },
    {
      label: "Stock Inward",
      items: inwards.map((i) => ({
        id: i.id,
        title: i.inwardNumber,
        subtitle: i.status,
        href: `/stock/inward/${i.id}`,
      })),
    },
    {
      label: "Stock Outward",
      items: outwards.map((o) => ({
        id: o.id,
        title: o.outwardNumber,
        subtitle: o.status,
        href: `/stock/outward/${o.id}`,
      })),
    },
    {
      label: "Purchase Orders",
      items: pos.map((p) => ({
        id: p.id,
        title: p.poNumber,
        subtitle: p.status,
        href: `/purchase-orders/${p.id}`,
      })),
    },
    {
      label: "Customers",
      items: customers.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.customerCode,
        href: `/customers/${c.id}`,
      })),
    },
    {
      label: "Procurement Batches",
      items: procurementBatches.map((b) => ({
        id: b.id,
        title: b.batchNumber,
        subtitle: `${b.item.name} · ${b.status}`,
        href: `/procurement/batches/${b.id}`,
      })),
    },
    {
      label: "Crates",
      items: crates.map((c) => ({
        id: c.id,
        title: c.crateCode,
        subtitle: c.status,
        href: `/crates/${c.id}`,
      })),
    },
    {
      label: "Employees",
      items: employees.map((e) => ({
        id: e.id,
        title: e.name,
        subtitle: e.employeeCode,
        href: `/employees/${e.id}`,
      })),
    },
    {
      label: "Labour",
      items: labourers.map((l) => ({
        id: l.id,
        title: l.name,
        subtitle: l.labourCode,
        href: `/labour/${l.id}`,
      })),
    },
  ];

  return groups.filter((g) => g.items.length > 0);
}
