// Net debt computation + greedy settlement minimization

export interface BillLike {
  id: string;
  total_amount: number;
  paid_by: string | null; // null = fund
  splits: { user_id: string; amount: number }[];
}

export interface PaymentLike {
  from_user: string;
  to_user: string;
  amount: number;
  status: string;
}

/**
 * Net balance per user inside a group.
 * Positive = group owes them (they paid more than they consumed).
 * Negative = they owe the group.
 */
export function computeBalances(
  memberIds: string[],
  bills: BillLike[],
  payments: PaymentLike[],
): Record<string, number> {
  const bal: Record<string, number> = {};
  memberIds.forEach((id) => (bal[id] = 0));

  for (const b of bills) {
    if (b.paid_by) {
      bal[b.paid_by] = (bal[b.paid_by] ?? 0) + Number(b.total_amount);
    }
    for (const s of b.splits) {
      bal[s.user_id] = (bal[s.user_id] ?? 0) - Number(s.amount);
    }
  }
  for (const p of payments) {
    if (p.status !== "accepted") continue;
    // from_user paid to_user → from_user's debt decreases (balance up), to_user's credit decreases (balance down)
    bal[p.from_user] = (bal[p.from_user] ?? 0) + Number(p.amount);
    bal[p.to_user] = (bal[p.to_user] ?? 0) - Number(p.amount);
  }
  // round to 2 decimals
  for (const k of Object.keys(bal)) bal[k] = Math.round(bal[k] * 100) / 100;
  return bal;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Greedy minimization: match biggest debtor with biggest creditor until settled.
 */
export function minimizeTransfers(balances: Record<string, number>): Transfer[] {
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];
  for (const [id, v] of Object.entries(balances)) {
    if (v < -0.01) debtors.push({ id, amt: -v });
    else if (v > 0.01) creditors.push({ id, amt: v });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const out: Transfer[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({
      from: debtors[i].id,
      to: creditors[j].id,
      amount: Math.round(pay * 100) / 100,
    });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return out;
}
