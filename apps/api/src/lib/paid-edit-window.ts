export const PAID_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

type PaidEditOrder = {
  status: string;
  updatedAt: Date | string;
  payments?: Array<{
    status: string;
    createdAt: Date | string;
  }>;
};

/**
 * Paid websites can be edited for 24 hours after their first successful
 * payment. Captured payment timestamps are authoritative; order.updatedAt is
 * retained as a fallback for paid orders created before payment records were
 * stored consistently.
 */
export function getPaidEditUntil(
  orders: PaidEditOrder[],
): Date | null {
  const paidAt = orders
    .filter((order) => order.status === "PAID")
    .map((order) => {
      const capturedAt = (order.payments || [])
        .filter((payment) => payment.status === "CAPTURED")
        .map((payment) => new Date(payment.createdAt).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => a - b)[0];

      return capturedAt ?? new Date(order.updatedAt).getTime();
    })
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];

  return paidAt === undefined
    ? null
    : new Date(paidAt + PAID_EDIT_WINDOW_MS);
}

export function hasOpenPaidEditWindow(
  orders: PaidEditOrder[],
  now = Date.now(),
) {
  const editUntil = getPaidEditUntil(orders);
  return Boolean(editUntil && editUntil.getTime() > now);
}
