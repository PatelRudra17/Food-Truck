import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SELF_APPROVAL_MESSAGE, SETTING_KEYS, isSelfApproval } from "@/lib/validators/settings";

type Tx = Prisma.TransactionClient | PrismaClient;

/** The REQUIRE_SEPARATE_APPROVER system setting (off unless explicitly enabled). */
export async function isSeparateApproverRequired(tx: Tx = prisma): Promise<boolean> {
  const setting = await tx.systemSetting.findUnique({ where: { key: SETTING_KEYS.REQUIRE_SEPARATE_APPROVER } });
  return setting?.value === true;
}

/**
 * Separation of duties: when REQUIRE_SEPARATE_APPROVER is on, the user who created or
 * submitted a request may not approve it. Nobody is exempt, Super Admin included.
 */
export async function assertSeparateApprover(
  tx: Tx,
  approverId: string,
  requesterIds: readonly (string | null | undefined)[],
): Promise<void> {
  if (!isSelfApproval(approverId, requesterIds)) return;
  if (await isSeparateApproverRequired(tx)) throw new Error(SELF_APPROVAL_MESSAGE);
}
