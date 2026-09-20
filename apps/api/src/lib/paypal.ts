type PayPalHeaders = Record<string, string | undefined>;

const paypalBaseUrl =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

function requirePayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal is not configured. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret };
}

async function readPayPalResponse(response: Response) {
  const text = await response.text();

  let body: any = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      body?.message ||
      body?.details?.[0]?.description ||
      `PayPal request failed with HTTP ${response.status}`;

    throw new Error(message);
  }

  return body;
}

export async function getPayPalAccessToken() {
  const { clientId, clientSecret } = requirePayPalConfig();

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`,
    "utf8",
  ).toString("base64");

  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  const body = await readPayPalResponse(response);

  const accessToken = String(body?.access_token || "");

  if (!accessToken) {
    throw new Error("PayPal access token was not returned");
  }

  return accessToken;
}

async function paypalRequest(
  path: string,
  init: RequestInit = {},
  accessToken: string,
) {
  const response = await fetch(`${paypalBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  return readPayPalResponse(response);
}

export async function createPayPalOrder(args: {
  amountUsd: number;
  referenceId: string;
  description: string;
}) {
  if (
    !Number.isFinite(args.amountUsd) ||
    args.amountUsd <= 0
  ) {
    throw new Error("Invalid PayPal amount");
  }

  if (!args.referenceId) {
    throw new Error("PayPal reference ID is required");
  }

  if (!args.description) {
    throw new Error("PayPal order description is required");
  }

  const token = await getPayPalAccessToken();

  const value = args.amountUsd.toFixed(2);

  return paypalRequest(
    "/v2/checkout/orders",
    {
      method: "POST",
      headers: {
        // Same logical order => same idempotency key on retries.
        "PayPal-Request-Id": `create-${args.referenceId}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: args.referenceId.slice(0, 256),
            custom_id: args.referenceId.slice(0, 255),
            invoice_id: args.referenceId.slice(0, 127),
            description: args.description.slice(0, 127),
            amount: {
              currency_code: "USD",
              value,
            },
          },
        ],
      }),
    },
    token,
  );
}

export async function getPayPalOrder(
  providerOrderId: string,
) {
  if (!providerOrderId) {
    throw new Error("PayPal order ID is required");
  }

  const token = await getPayPalAccessToken();

  return paypalRequest(
    `/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`,
    {
      method: "GET",
    },
    token,
  );
}

export async function capturePayPalOrder(
  providerOrderId: string,
  requestId: string,
) {
  if (!providerOrderId) {
    throw new Error("PayPal order ID is required");
  }

  if (!requestId) {
    throw new Error("PayPal capture request ID is required");
  }

  const token = await getPayPalAccessToken();

  return paypalRequest(
    `/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        // IMPORTANT:
        // requestId must remain the same when the same capture
        // operation is retried.
        "PayPal-Request-Id": `capture-${requestId}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({}),
    },
    token,
  );
}

function header(
  headers: PayPalHeaders,
  name: string,
) {
  return (
    headers[name.toLowerCase()] ||
    headers[name] ||
    ""
  );
}

export async function verifyPayPalWebhook(
  headers: PayPalHeaders,
  rawBody: string,
) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured");
  }

  if (!rawBody) {
    return false;
  }

  const transmissionId = header(
    headers,
    "paypal-transmission-id",
  );

  const transmissionTime = header(
    headers,
    "paypal-transmission-time",
  );

  const certUrl = header(
    headers,
    "paypal-cert-url",
  );

  const authAlgo = header(
    headers,
    "paypal-auth-algo",
  );

  const transmissionSig = header(
    headers,
    "paypal-transmission-sig",
  );

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false;
  }

  let webhookEvent: any;

  try {
    webhookEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const token = await getPayPalAccessToken();

  const body = await paypalRequest(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    },
    token,
  );

  return (
    body?.verification_status === "SUCCESS"
  );
}

export function getPayPalClientId() {
  return process.env.PAYPAL_CLIENT_ID || "";
}

export function extractPayPalCapture(
  order: any,
): {
  id: string;
  status: string;
  amount: number;
  currency: string;
} | null {
  const capture =
    order?.purchase_units?.[0]?.payments?.captures?.find(
      (item: any) => item?.id,
    );

  if (!capture?.id) {
    return null;
  }

  return {
    id: String(capture.id),
    status: String(capture.status || ""),
    amount: Number(capture.amount?.value || 0),
    currency: String(
      capture.amount?.currency_code || "",
    ),
  };
}

export function extractPayPalOrderIdFromCaptureWebhook(
  event: any,
) {
  return String(
    event?.resource?.supplementary_data?.related_ids
      ?.order_id || "",
  );
}