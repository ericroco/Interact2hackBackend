import { Inject, Injectable } from '@nestjs/common';
import { LoyaltyTierRepositoryPort, LOYALTY_TIER_REPOSITORY } from '../../domain/ports/loyalty-tier.repository.port';
import { LoyaltyCouponRepositoryPort, LOYALTY_COUPON_REPOSITORY } from '../../domain/ports/loyalty-coupon.repository.port';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { TierConfigRepositoryPort, TIER_CONFIG_REPOSITORY } from '../../domain/ports/tier-config.repository.port';
import { CouponStatus } from '../../domain/entities/loyalty-coupon.entity';

export interface ActiveYapaDto {
  /** ID para usar en el campo couponId del scan al canjear. */
  id: string;
  value: number;
  tierEarnedAt: number;
  expiresAt: Date;
}

export interface LoyaltyProfileEntry {
  merchantId: string;
  merchantName: string;
  tierLevel: number;
  trustPoints: number;
  pointsToNextCoupon: number | null;
  /** Lista de yapas activas. El usuario elige cuál usar pasando su id al scan. */
  activeYapas: ActiveYapaDto[];
  yapasCount: number;
  totalYapasValue: number;
  /** Fecha límite antes de que el tier baje por inactividad. Null si nunca tuvo transacción. */
  degradationDueDate: Date | null;
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
    const allCoupons = await this.couponRepo.findAllByUser(userId);

    const activeCouponsByMerchant = new Map<string, ActiveYapaDto[]>();
    for (const c of allCoupons) {
      if (c.status !== CouponStatus.ACTIVE) continue;
      if (!activeCouponsByMerchant.has(c.merchantId)) {
        activeCouponsByMerchant.set(c.merchantId, []);
      }
      activeCouponsByMerchant.get(c.merchantId)!.push({
        id: c.id,
        value: Number(c.value),
        tierEarnedAt: c.tierEarnedAt,
        expiresAt: c.expiresAt,
      });
    }

    const entries = await Promise.all(
      tiers.map(async (tier) => {
        const merchant = await this.merchantRepo.findById(tier.merchantId);
        const config = await this.tierConfigRepo.findByCategoryAndTier(
          merchant?.categoryId ?? '',
          tier.tierLevel,
        );

        const activeYapas = activeCouponsByMerchant.get(tier.merchantId) ?? [];
        const trustPoints = Number(tier.trustPoints);
        const pointsToNextCoupon = config
          ? Math.max(0, config.pointsThreshold - trustPoints)
          : null;

        const totalYapasValue = activeYapas.reduce((sum, y) => sum + y.value, 0);

        return {
          merchantId: tier.merchantId,
          merchantName: merchant?.businessName ?? 'Unknown',
          tierLevel: tier.tierLevel,
          trustPoints,
          pointsToNextCoupon,
          activeYapas,
          yapasCount: activeYapas.length,
          totalYapasValue: Math.round(totalYapasValue * 100) / 100,
          degradationDueDate: tier.degradationDueDate ?? null,
        };
      }),
    );

    return entries;
  }
}
