import { LoyaltyCouponEntity } from '../entities/loyalty-coupon.entity';

export interface LoyaltyCouponRepositoryPort {
  findById(id: string): Promise<LoyaltyCouponEntity | null>;
  findActiveByUserAndMerchant(userId: string, merchantId: string): Promise<LoyaltyCouponEntity[]>;
  countActive(userId: string, merchantId: string): Promise<number>;
  findAllByUser(userId: string): Promise<LoyaltyCouponEntity[]>;
  save(coupon: Omit<LoyaltyCouponEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyCouponEntity>;
  markRedeemed(id: string, transactionId: string): Promise<void>;
  expireOldCoupons(asOf: Date): Promise<number>;
}

export const LOYALTY_COUPON_REPOSITORY = 'LOYALTY_COUPON_REPOSITORY';
