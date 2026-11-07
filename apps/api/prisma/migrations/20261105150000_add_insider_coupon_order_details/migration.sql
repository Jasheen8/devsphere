ALTER TABLE "Order"
  ADD COLUMN "originalAmount" INTEGER,
  ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "couponCode" TEXT;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_discountAmount_nonnegative"
    CHECK ("discountAmount" >= 0),
  ADD CONSTRAINT "Order_originalAmount_matches_discount"
    CHECK (
      "originalAmount" IS NULL OR
      ("originalAmount" >= "amount" AND "originalAmount" - "amount" = "discountAmount")
    ),
  ADD CONSTRAINT "Order_coupon_matches_discount"
    CHECK (
      ("couponCode" IS NULL AND "discountAmount" = 0) OR
      ("couponCode" = 'INSIDER10' AND "discountAmount" > 0)
    );

CREATE INDEX "Order_userId_couponCode_status_idx"
  ON "Order"("userId", "couponCode", "status");

CREATE UNIQUE INDEX "Order_insider10_single_active_redemption_per_user"
  ON "Order"("userId")
  WHERE "couponCode" = 'INSIDER10'
    AND "status" IN ('PENDING', 'PAID', 'REFUNDED');
