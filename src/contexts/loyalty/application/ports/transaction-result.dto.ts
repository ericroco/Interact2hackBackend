export interface CouponAppliedDto {
  id: string;
  discountAmount: number;
}

export interface CouponUnlockedDto {
  id: string;
  value: number;
  message: string;
}

export interface TransactionResultDto {
  transactionId: string;
  trustPointsEarned: number;
  totalTrustPoints: number;
  tierLevel: number;
  pointsToNextCoupon: number | null;
  activeYapasCount: number;
  couponApplied: CouponAppliedDto | null;
  couponUnlocked: CouponUnlockedDto | null;
  antifraudBlocked: boolean;
}
