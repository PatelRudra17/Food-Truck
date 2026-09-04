import Link from "next/link";
import { Search, ScanLine } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";

export const metadata = { title: "Scan Item" };

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("ITEM_VIEW");
  const sp = await searchParams;
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const [results, batchMatches, crateMatches] =
    q.length >= 2
      ? await Promise.all([
          prisma.item.findMany({
            where: {
              OR: [
                { sku: { equals: q, mode: "insensitive" } },
                { itemCode: { equals: q, mode: "insensitive" } },
                { barcode: { equals: q, mode: "insensitive" } },
                { qrCodePayload: { equals: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            },
            include: { category: true, warehouse: true },
            take: 12,
            orderBy: { name: "asc" },
          }),
          // A batch code or crate code is also a valid scan target per the
          // build doc's "Show: Matched item, current stock, warehouse, batch,
          // recent movement" requirement.
          prisma.procurementBatch.findMany({
            where: { batchNumber: { equals: q, mode: "insensitive" } },
            include: { item: true, warehouse: true, supplier: true },
            take: 5,
          }),
          prisma.crate.findMany({
            where: { crateCode: { equals: q, mode: "insensitive" } },
            include: { customer: true },
            take: 5,
          }),
        ])
      : [[], [], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan Item"
        description="Manually enter a barcode, QR payload, SKU, or item code to find matching inventory."
      />

      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
          <CardDescription>Camera scanning is not enabled here yet, but manual scan input works now.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Enter barcode, QR payload, SKU, item code, or name..."
              className="sm:max-w-xl"
            />
            <Button type="submit">
              <Search className="h-4 w-4" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {q.length < 2 ? (
        <EmptyState
          icon={ScanLine}
          title="Ready to scan"
          description="Enter at least 2 characters to search for an item, batch, or crate code."
        />
      ) : results.length === 0 && batchMatches.length === 0 && crateMatches.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title="No match found"
          description={`No item, batch, or crate was found for "${q}". Check the code and try again.`}
        />
      ) : (
        <div className="space-y-6">
          {results.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <CardDescription>
                      {item.sku} · {item.itemCode}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Category:</span> {item.category.name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Warehouse:</span> {item.warehouse?.name ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Stock:</span> {Number(item.currentStock).toLocaleString()} {item.unit}
                    </p>
                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/items/${item.id}`}>Open Item</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {batchMatches.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {batchMatches.map((batch) => (
                <Card key={batch.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{batch.batchNumber}</CardTitle>
                    <CardDescription>{batch.item.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Status:</span> <StatusBadge status={batch.status} />
                    </p>
                    <p>
                      <span className="text-muted-foreground">Vendor:</span> {batch.supplier.companyName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Warehouse:</span> {batch.warehouse.name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Raw Weight:</span> {Number(batch.rawWeight).toLocaleString()}
                    </p>
                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/procurement/batches/${batch.id}`}>Open Batch</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {crateMatches.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {crateMatches.map((crate) => (
                <Card key={crate.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{crate.crateCode}</CardTitle>
                    <CardDescription>{crate.crateType}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Status:</span> <StatusBadge status={crate.status} />
                    </p>
                    <p>
                      <span className="text-muted-foreground">Location:</span> {crate.currentLocation ?? "—"}
                    </p>
                    {crate.customer && (
                      <p>
                        <span className="text-muted-foreground">Customer:</span> {crate.customer.name}
                      </p>
                    )}
                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/crates/${crate.id}`}>Open Crate</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
