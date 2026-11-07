import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { captureEvent } from "../analytics";
import { WHATSAPP_INSIDERS_CHANNEL_URL } from "../whatsappInsiders";

export type InsiderOfferQuote = {
  currency: "INR" | "USD";
  originalAmountMinor: number;
  discountAmountMinor: number;
  finalAmountMinor: number;
  couponCode?: string | null;
  couponAvailable?: boolean;
  couponPreviewDiscountMinor?: number;
  couponPreviewAmountMinor?: number;
};

type Props = {
  quotes: InsiderOfferQuote[];
  templateSlug: string;
  placement: "template_card" | "template_detail" | "checkout";
  compact?: boolean;
  couponApplied?: boolean;
  couponAvailable?: boolean;
  couponBusy?: boolean;
  couponError?: string;
  couponMessage?: string;
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: () => void;
};

function formatMinor(amountMinor: number, currency: "INR" | "USD") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export default function WhatsAppInsiderOffer({
  quotes,
  templateSlug,
  placement,
  compact = false,
  couponApplied = false,
  couponAvailable = true,
  couponBusy = false,
  couponError = "",
  couponMessage = "",
  onApplyCoupon,
  onRemoveCoupon,
}: Props) {
  const [couponDraft, setCouponDraft] = useState("INSIDER10");
  const sortedQuotes = [...quotes].sort((a, b) =>
    a.currency === "INR" ? -1 : b.currency === "INR" ? 1 : 0,
  );

  function joinWhatsApp() {
    captureEvent("whatsapp_offer_clicked", {
      template_slug: templateSlug,
      placement,
    });
  }

  function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (couponDraft.trim()) onApplyCoupon?.(couponDraft.trim());
  }

  return (
    <section
      className={`whatsapp-insider-offer${compact ? " is-compact" : ""}${couponApplied ? " is-applied" : ""}`}
      aria-label="DevSphere Insiders WhatsApp exclusive offer"
    >
      <div className="whatsapp-insider-heading">
        <div>
          <span className="whatsapp-insider-eyebrow">
            <Sparkles size={13} aria-hidden="true" /> DevSphere Insiders · WhatsApp Exclusive
          </span>
          <p>
            Join our WhatsApp Insiders community and unlock an exclusive 10% discount on every template.
          </p>
        </div>
        <span className="whatsapp-insider-save">SAVE 10%</span>
      </div>

      <div className="whatsapp-insider-prices" aria-live="polite">
        {sortedQuotes.map((quote) => {
          const offerDiscount = quote.couponPreviewDiscountMinor ?? quote.discountAmountMinor;
          const offerAmount = couponApplied
            ? quote.finalAmountMinor
            : quote.couponPreviewAmountMinor ?? quote.finalAmountMinor;
          return (
            <div className="whatsapp-insider-price" key={quote.currency}>
              <span>{quote.currency}</span>
              <del>{formatMinor(quote.originalAmountMinor, quote.currency)}</del>
              <strong>{formatMinor(offerAmount, quote.currency)}</strong>
              <small>
                {couponApplied
                  ? `INSIDER10 saves ${formatMinor(quote.discountAmountMinor, quote.currency)}`
                  : `Save ${formatMinor(offerDiscount, quote.currency)}`}
              </small>
            </div>
          );
        })}
      </div>

      <a
        className="whatsapp-insider-join"
        href={WHATSAPP_INSIDERS_CHANNEL_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={joinWhatsApp}
      >
        JOIN &amp; UNLOCK 10% OFF <ArrowUpRight size={16} aria-hidden="true" />
      </a>

      {onApplyCoupon && (
        <div className="whatsapp-insider-coupon">
          <p className="whatsapp-insider-terms">
            One redemption per account. INSIDER10 cannot be combined with another coupon.
          </p>
          {couponAvailable === false ? (
            <p className="whatsapp-insider-error" role="status">
              INSIDER10 has already been used or reserved for another checkout on this account.
            </p>
          ) : couponApplied ? (
            <div className="whatsapp-insider-applied" role="status">
              <span><Check size={15} aria-hidden="true" /> INSIDER10 applied</span>
              {onRemoveCoupon && (
                <button type="button" className="whatsapp-insider-remove" onClick={onRemoveCoupon}>
                  Remove
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={submitCoupon}>
              <label htmlFor={`insider-coupon-${placement}`}>Joined? Enter your coupon code at checkout</label>
              <div className="whatsapp-insider-code-row">
                <input
                  id={`insider-coupon-${placement}`}
                  value={couponDraft}
                  onChange={(event) => setCouponDraft(event.target.value.toUpperCase())}
                  placeholder="INSIDER10"
                  autoComplete="off"
                  maxLength={40}
                  aria-invalid={Boolean(couponError)}
                  disabled={couponBusy}
                />
                <button type="submit" disabled={couponBusy || !couponDraft.trim()}>
                  {couponBusy ? "Checking…" : "Apply code"}
                </button>
              </div>
            </form>
          )}
          {couponMessage && <p className="whatsapp-insider-feedback" role="status">{couponMessage}</p>}
          {couponError && <p className="whatsapp-insider-error" role="alert">{couponError}</p>}
        </div>
      )}
    </section>
  );
}
