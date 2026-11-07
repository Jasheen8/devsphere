type PostHogClient = {
  capture: (
    event: string,
    properties?: Record<string, string | number | boolean>,
  ) => void;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

export function captureEvent(
  event: string,
  properties: Record<string, string | number | boolean> = {},
): boolean {
  if (typeof window === "undefined" || !window.posthog) return false;
  window.posthog.capture(event, properties);
  return true;
}

export function capturePageview() {
  if (typeof window === "undefined" || !window.posthog) return;
  window.posthog.capture("$pageview", {
    $current_url: window.location.href,
  });
}

export function capturePurchaseCompleted(result: any) {
  const orderId = typeof result?.orderId === "string" ? result.orderId : "";
  if (!orderId) return;

  const storageKey = `devsphere:purchase-captured:${orderId}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
  } catch {
    // Analytics should still run when browser storage is unavailable.
  }

  const properties: Record<string, string | number | boolean> = {
    order_id: orderId,
    currency: typeof result.currency === "string" ? result.currency : "unknown",
  };
  if (Number.isFinite(Number(result.amount))) {
    properties.amount_minor = Number(result.amount);
  }
  if (Number.isFinite(Number(result.originalAmountMinor))) {
    properties.original_amount_minor = Number(result.originalAmountMinor);
  }
  if (Number.isFinite(Number(result.discountAmountMinor))) {
    properties.discount_amount_minor = Number(result.discountAmountMinor);
  }
  if (typeof result.couponCode === "string") {
    properties.coupon_code = result.couponCode;
  }

  if (captureEvent("purchase_completed", properties)) {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // PostHog remains the source of the event when storage is unavailable.
    }
  }
}
