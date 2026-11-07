import "server-only";
import type { Provider, WalletEntryKind } from "@prisma/client";
import { db } from "./db";
import { topupFeePercent } from "./wallet-math";

export { topupBreakdown, topupFeePercent, MIN_TOPUP_CENTS, MAX_TOPUP_CENTS } from "./wallet-math";

/**
 * Adds a ledger entry and moves the balance in one transaction. With a `reference`,
 * the call is idempotent: a repeat with the same reference changes the existing
 * entry's amount (and the balance by the difference) instead of adding a new one.
 * Returns the new balance.
 */
export async function recordWalletEntry(input: {
  businessId: string;
  kind: WalletEntryKind;
  amountCents: number;
  note: string;
  provider?: Provider;
  reference?: string;
}) {
  return db.$transaction(async (tx) => {
    let delta = input.amountCents;
    if (input.reference) {
      const existing = await tx.walletEntry.findUnique({
        where: { businessId_reference: { businessId: input.businessId, reference: input.reference } },
      });
      if (existing) {
        delta = input.amountCents - existing.amountCents;
        if (delta !== 0) {
          await tx.walletEntry.update({ where: { id: existing.id }, data: { amountCents: input.amountCents, note: input.note } });
        }
      } else {
        await tx.walletEntry.create({ data: { ...input } });
      }
    } else {
      await tx.walletEntry.create({ data: { ...input } });
    }
    const b = await tx.business.update({
      where: { id: input.businessId },
      data: { walletBalanceCents: { increment: delta } },
      select: { walletBalanceCents: true },
    });
    return b.walletBalanceCents;
  });
}

export function feeNote(planPercent: number) {
  const pct = topupFeePercent(planPercent);
  return pct > 0
    ? `A ${pct}% management fee is added at checkout. 100% of the amount you choose goes to your ads.`
    : "100% of the amount you add goes to your ads.";
}
