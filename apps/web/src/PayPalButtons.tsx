import { useEffect, useRef } from "react";
import { api } from "./lib/api";

declare global {
  interface Window {
    paypal?: any;
  }
}

let paypalSdkPromise: Promise<void> | null = null;

function loadPayPalSdk(clientId: string) {
  if (window.paypal) {
    return Promise.resolve();
  }

  if (paypalSdkPromise) {
    return paypalSdkPromise;
  }

  const src =
    `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
    `&currency=USD&intent=capture&components=buttons`;

  paypalSdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-devsphere-paypal-sdk="true"]',
    ) as HTMLScriptElement | null;

    if (existing) {
      const finish = () => {
        if (window.paypal) {
          resolve();
        } else {
          reject(
            new Error(
              "PayPal SDK loaded but is unavailable.",
            ),
          );
        }
      };

      if (window.paypal) {
        resolve();
        return;
      }

      existing.addEventListener("load", finish, {
        once: true,
      });

      existing.addEventListener(
        "error",
        () => {
          reject(
            new Error("Unable to load PayPal."),
          );
        },
        { once: true },
      );

      return;
    }

    const script = document.createElement("script");

    script.src = src;
    script.async = true;
    script.dataset.devspherePaypalSdk = "true";

    script.onload = () => {
      if (window.paypal) {
        resolve();
      } else {
        reject(
          new Error(
            "PayPal SDK loaded but is unavailable.",
          ),
        );
      }
    };

    script.onerror = () => {
      reject(new Error("Unable to load PayPal."));
    };

    document.body.appendChild(script);
  }).catch((error) => {
    paypalSdkPromise = null;
    throw error;
  });

  return paypalSdkPromise;
}

type Props = {
  projectId: string;
  planId: string;
  revealMethod:
    | "NORMAL"
    | "QR"
    | "PIN"
    | "LETTER"
    | "GIFT"
    | "PUZZLE";
  scannerStyle:
    | "HEART"
    | "SQUARE"
    | null;
  disabled?: boolean;
  onSuccess: (result: any) => void;
  onError: (error: any) => void;
};

export default function PayPalButtons({
  projectId,
  planId,
  revealMethod,
  scannerStyle,
  disabled = false,
  onSuccess,
  onError,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);

  useEffect(() => {
    successRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    let buttons: any = null;

    async function init() {
      if (
        disabled ||
        !projectId ||
        !planId ||
        !containerRef.current
      ) {
        return;
      }

      try {
        /*
         * Get the public PayPal client ID from the server.
         * Never expose the PayPal secret to the browser.
         */
        const config = await api<{
          paypalClientId: string;
          paypalEnabled: boolean;
        }>("/payments/config");

        if (
          !config.paypalEnabled ||
          !config.paypalClientId
        ) {
          throw new Error(
            "PayPal is not configured for international payments.",
          );
        }

        await loadPayPalSdk(
          config.paypalClientId,
        );

        if (
          cancelled ||
          !containerRef.current ||
          !window.paypal
        ) {
          return;
        }

        buttons = window.paypal.Buttons({
          style: {
            layout: "vertical",
            shape: "rect",
            label: "paypal",
            height: 48,
          },

          /*
           * PayPal calls this when the customer clicks
           * the PayPal button.
           *
           * Our backend creates the real PayPal order.
           */
          createOrder: async () => {
            const order = await api<any>(
              "/payments/create-order",
              {
                method: "POST",
                body: JSON.stringify({
                  projectId,
                  planId,
                  currency: "USD",
                  revealMethod,
                  scannerStyle,
                }),
              },
            );

            /*
             * Already paid:
             * send the customer directly to the
             * existing website instead of creating
             * another payment.
             */
            if (order?.alreadyPaid) {
              successRef.current(order);

              throw new Error(
                "PAYMENT_ALREADY_COMPLETED",
              );
            }

            if (!order?.providerOrderId) {
              throw new Error(
                "PayPal order was not created.",
              );
            }

            return order.providerOrderId;
          },

          /*
           * Customer approved PayPal payment.
           *
           * Capture happens on our server.
           */
          onApprove: async (data: any) => {
            try {
              const result = await api<any>(
                "/payments/paypal/capture",
                {
                  method: "POST",
                  body: JSON.stringify({
                    paypalOrderId: data.orderID,
                  }),
                },
              );

              if (
                result?.ok ||
                result?.status === "PAID" ||
                result?.url ||
                result?.alreadyPaid
              ) {
                successRef.current(result);
                return;
              }

              throw new Error(
                "PayPal payment was captured but no website result was returned.",
              );
            } catch (captureError: any) {
              /*
               * IMPORTANT:
               *
               * The PayPal capture may already have succeeded
               * even when the browser loses the response.
               *
               * Ask the server to reconcile the order before
               * telling the customer that payment failed.
               */
              try {
                const recovery = await api<any>(
                  `/payments/resume/${encodeURIComponent(
                    projectId,
                  )}`,
                  {
                    method: "POST",
                  },
                );

                if (
                  recovery?.paid &&
                  recovery?.url
                ) {
                  successRef.current(
                    recovery,
                  );
                  return;
                }
              } catch (recoveryError) {
                console.warn(
                  "PayPal payment recovery failed:",
                  recoveryError,
                );
              }

              errorRef.current(
                captureError,
              );
            }
          },

          onCancel: () => {
            /*
             * Customer intentionally cancelled
             * the PayPal checkout.
             *
             * No payment should be recorded
             * by our backend unless PayPal actually
             * completed a capture.
             */
          },

          onError: (error: any) => {
            /*
             * createOrder() deliberately throws this
             * when the project was already paid.
             *
             * We already sent the customer to the
             * successful result, so don't show an
             * additional error.
             */
            if (
              String(
                error?.message || "",
              ) ===
              "PAYMENT_ALREADY_COMPLETED"
            ) {
              return;
            }

            errorRef.current(error);
          },
        });

        if (
          buttons?.isEligible &&
          !buttons.isEligible()
        ) {
          throw new Error(
            "PayPal is not available for this customer.",
          );
        }

        await buttons.render(
          containerRef.current,
        );
      } catch (error) {
        if (!cancelled) {
          errorRef.current(error);
        }
      }
    }

    init();

    return () => {
      cancelled = true;

      try {
        buttons?.close?.();
      } catch {
        // Ignore PayPal SDK cleanup errors.
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [
    projectId,
    planId,
    revealMethod,
    scannerStyle,
    disabled,
  ]);

  if (disabled) {
    return (
      <div className="muted">
        Loading payment…
      </div>
    );
  }

  return <div ref={containerRef} />;
}