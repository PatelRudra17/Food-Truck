import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { getSignedDownloadUrl } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("DOCUMENT_DOWNLOAD_DOCUMENT");
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.isDeleted) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (attachment.isSensitive && !user.permissions.includes("VIEW_SENSITIVE_DRIVER_DOCUMENTS")) {
      return NextResponse.json({ error: "You do not have permission to access this sensitive document." }, { status: 403 });
    }

    const url = await getSignedDownloadUrl(attachment.storageKey);

    await prisma.documentAccessLog.create({
      data: { attachmentId: attachment.id, userId: user.id, action: "DOWNLOAD" },
    });
    await writeAuditLog({
      userId: user.id,
      action: "DOCUMENT_DOWNLOAD",
      entityType: "Attachment",
      entityId: attachment.id,
    });

    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
