import { AcquisitionCouponEntity } from '../entities/acquisition-coupon.entity';

export interface AcquisitionCouponRepositoryPort {
  save(coupon: Omit<AcquisitionCouponEntity, 'id' | 'createdAt'>): Promise<AcquisitionCouponEntity>;
  findByMerchant(merchantId: string): Promise<AcquisitionCouponEntity[]>;
  findByCode(code: string): Promise<AcquisitionCouponEntity | null>;
  markRedeemed(id: string, userId: string, redeemedAt: Date): Promise<void>;
}

export const ACQUISITION_COUPON_REPOSITORY = 'ACQUISITION_COUPON_REPOSITORY';
