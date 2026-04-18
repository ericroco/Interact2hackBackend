import { Inject, Injectable } from '@nestjs/common';
import { LoyaltyTierRepositoryPort, LOYALTY_TIER_REPOSITORY } from '../../domain/ports/loyalty-tier.repository.port';
import { LoyaltyCouponRepositoryPort, LOYALTY_COUPON_REPOSITORY } from '../../domain/ports/loyalty-coupon.repository.port';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { TierConfigRepositoryPort, TIER_CONFIG_REPOSITORY } from '../../domain/ports/tier-config.repository.port';
import { CouponStatus } from '../../domain/entities/loyalty-coupon.entity';

export interface LoyaltyProfileEntry {
  merchantId: string;
  merchantName: string;
  tierLevel: number;
  trustPoints: number;
  pointsToNextCoupon: number | null;
  activeCoupon: { value: number; expiresAt: Date } | null;
}

@Injectable()
export class GetUserLoyaltyProfileUseCase {
  constructor(
    @Inject(LOYALTY_TIER_REPOSITORY) private readonly tierRepo: LoyaltyTierRepositoryPort,
    @Inject(LOYALTY_COUPON_REPOSITORY) private readonly couponRepo: LoyaltyCouponRepositoryPort,
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    @Inject(TIER_CONFIG_REPOSITORY) private readonly tierConfigRepo: TierConfigRepositoryPort,
  ) {}

  async execute(userId: string): Promise<LoyaltyProfileEntry[]> {
    const tiers = await this.tierRepo.findAllByUser(userId);
    const activeCoupons = await this.couponRepo.findAllByUser(userId).then((cs) =>
      cs.filter((c) => c.status === CouponStatus.ACTIVE),
    );

    const couponMap = new Map(activeCoupons.map((c) => [c.merchantId, c]));

    const entries = await Promise.all(
      tiers.map(async (tier) => {
        const merchant = await this.merchantRepo.findById(tier.merchantId);
        const config = await this.tierConfigRepo.findByCategoryAndTier(
          merchant?.categoryId ?? '',
          tier.tierLevel,
        );

        const activeCoupon = couponMap.get(tier.merchantId);
        const trustPoints = Number(tier.trustPoints);
        const pointsToNextCoupon = config
          ? Math.max(0, config.pointsThreshold - trustPoints)
          : null;

        return {
          merchantId: tier.merchantId,
          merchantName: merchant?.businessName ?? 'Unknown',
          tierLevel: tier.tierLevel,
          trustPoints,
          pointsToNextCoupon,
          activeCoupon: activeCoupon
            ? { value: Number(activeCoupon.value), expiresAt: activeCoupon.expiresAt }
            : null,
        };
      }),
    );

    return entries;
  }
}
