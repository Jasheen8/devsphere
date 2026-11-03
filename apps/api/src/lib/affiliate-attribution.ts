export type AffiliateAttributionSnapshot = {
  clickId: string;
  affiliateProfileId: string;
  referralLinkId: string;
  offerId: string;
  commissionBps: number;
  offerVersion: number;
  policyVersion: number;
  expiresAt: Date;
};

/** Shared eligibility rule used at checkout and in database-backed tests. */
export function buildAffiliateAttributionSnapshot(
  click: any,
  policy: any,
  buyerUserId: string,
  projectTemplateId: string,
  now = new Date(),
): AffiliateAttributionSnapshot | null {
  const clickExpiration = click?.expiresAt instanceof Date
    ? click.expiresAt
    : new Date(click?.expiresAt || 0);
  const clickedAt = click?.clickedAt instanceof Date
    ? click.clickedAt
    : new Date(click?.clickedAt || 0);
  if (
    !click ||
    !policy?.enabled ||
    !Number.isFinite(clickExpiration.getTime()) ||
    !Number.isFinite(clickedAt.getTime()) ||
    clickExpiration <= now ||
    clickedAt > now ||
    click.affiliateProfile?.status !== "APPROVED" ||
    click.affiliateProfile?.userId === buyerUserId ||
    !click.referralLink?.active ||
    click.referralLink?.offer?.status !== "ACTIVE" ||
    click.referralLink.offer.startsAt > now ||
    (click.referralLink.offer.endsAt && click.referralLink.offer.endsAt <= now) ||
    click.referralLink.offer.template?.id !== projectTemplateId ||
    !click.referralLink.offer.template?.published ||
    click.referralLink.offer.template?.isFree
  ) {
    return null;
  }

  return {
    clickId: click.id,
    affiliateProfileId: click.affiliateProfileId,
    referralLinkId: click.referralLinkId,
    offerId: click.referralLink.offerId,
    commissionBps: click.referralLink.offer.commissionBps,
    offerVersion: click.referralLink.offer.version,
    policyVersion: policy.version,
    expiresAt: clickExpiration,
  };
}
