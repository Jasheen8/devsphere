type TransactionClient = any;

export class ProjectDeletionError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "ProjectDeletionError";
    this.statusCode = statusCode;
  }
}

/**
 * Delete an unpaid draft only when it has no payment or affiliate financial
 * history. Locks the order rows before checking them so a concurrent verified
 * payment cannot slip between the check and deletion. Affiliate clicks remain
 * as audit evidence; only unconverted order attribution rows are removed.
 */
export async function deleteUnpaidProject(
  client: any,
  projectId: string,
  userId: string,
) {
  return client.$transaction(
    async (tx: TransactionClient) => {
      await tx.$queryRaw`
        SELECT "id" FROM "Order"
        WHERE "projectId" = ${projectId}
        ORDER BY "id"
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT "id" FROM "Project"
        WHERE "id" = ${projectId} AND "userId" = ${userId}
        FOR UPDATE
      `;

      const project = await tx.project.findFirst({
        where: { id: projectId, userId },
        include: {
          website: true,
          orders: {
            include: {
              payments: { select: { id: true, status: true, providerPaymentId: true } },
              affiliateAttribution: {
                include: { conversion: { select: { id: true } } },
              },
              affiliateConversion: { select: { id: true } },
              affiliateCommissions: {
                include: { ledgerEntries: { select: { id: true } } },
              },
            },
          },
        },
      });

      if (!project) throw new ProjectDeletionError("Project not found.", 404);
      const orderIds = project.orders.map((order: any) => order.id);
      const referencedLedgerEntries = orderIds.length
        ? await tx.affiliateLedgerEntry.findMany({
          where: { reference: { in: orderIds } },
          select: { id: true },
          take: 1,
        })
        : [];
      if (project.orders.some((order: any) => order.status === "PAID" || order.status === "REFUNDED")) {
        throw new ProjectDeletionError("Paid or refunded projects cannot be deleted.", 403);
      }
      if (project.website) {
        throw new ProjectDeletionError("Published projects cannot be deleted.", 403);
      }
      if (project.status !== "DRAFT" && project.status !== "FINALIZED") {
        throw new ProjectDeletionError("Only unpaid draft or finalized projects can be deleted.", 403);
      }

      const hasVerifiedPayment = project.orders.some((order: any) =>
        order.payments.some((payment: any) =>
          payment.status === "CAPTURED" ||
          payment.status === "REFUNDED" ||
          Boolean(payment.providerPaymentId),
        ),
      );
      const hasAnyPaymentRecord = project.orders.some((order: any) => order.payments.length > 0);
      const hasAffiliateFinancialHistory = project.orders.some((order: any) =>
        Boolean(order.affiliateConversion) ||
        Boolean(order.affiliateAttribution?.conversion) ||
        order.affiliateCommissions.length > 0 ||
        order.affiliateCommissions.some((commission: any) => commission.ledgerEntries.length > 0),
      ) || referencedLedgerEntries.length > 0;

      if (hasVerifiedPayment || hasAffiliateFinancialHistory) {
        throw new ProjectDeletionError("This project has verified payment or affiliate financial history and must be retained.");
      }
      // Payment rows are financial evidence. Never remove them through Order's
      // relation cascade; retain the order/project if one exists.
      if (hasAnyPaymentRecord) {
        throw new ProjectDeletionError("This project has payment records and must be retained to preserve payment history.");
      }

      if (orderIds.length > 0) {
        await tx.affiliateAttribution.deleteMany({
          where: { orderId: { in: orderIds }, conversion: null },
        });
        const deletedOrders = await tx.order.deleteMany({
          where: { id: { in: orderIds }, projectId, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
        });
        if (deletedOrders.count !== orderIds.length) {
          throw new ProjectDeletionError("An order changed while deletion was in progress. Please retry.");
        }
      }

      await tx.projectMedia.deleteMany({ where: { projectId } });
      await tx.projectRevision.deleteMany({ where: { projectId } });
      await tx.project.delete({ where: { id: projectId } });
      return { ok: true };
    },
    { isolationLevel: "Serializable" },
  );
}
