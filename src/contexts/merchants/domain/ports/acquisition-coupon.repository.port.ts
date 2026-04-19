import { AcquisitionCouponEntity } from '../entities/acquisition-coupon.entity';

export interface AcquisitionCouponRepositoryPort {
  save(coupon: Omit<AcquisitionCouponEntity, 'id' | 'createdAt'>): Promise<AcquisitionCouponEntity>;
  findByMerchant(merchantId: string): Promise<AcquisitionCouponEntity[]>;
  findByCode(code: string): Promise<AcquisitionCouponEntity | null>;
  findById(id: string): Promise<AcquisitionCouponEntity | null>;
  deleteById(id: string): Promise<void>;
  markRedeemed(id: string, userId: string, redeemedAt: Date): Promise<void>;
  countActiveCoupons(merchantId: string): Promise<number>;
}

export const ACQUISITION_COUPON_REPOSITORY = 'ACQUISITION_COUPON_REPOSITORY';
