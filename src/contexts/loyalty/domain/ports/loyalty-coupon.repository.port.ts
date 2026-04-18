import { LoyaltyCouponEntity } from '../entities/loyalty-coupon.entity';

export interface LoyaltyCouponRepositoryPort {
  /** Busca una yapa activa por su ID (para validar elección del usuario). */
  findById(id: string): Promise<LoyaltyCouponEntity | null>;
  /** Devuelve todas las yapas activas de un usuario en un local específico. */
  findActiveByUserAndMerchant(userId: string, merchantId: string): Promise<LoyaltyCouponEntity[]>;
  /** Cuenta cuántas yapas activas tiene el usuario en un local (límite: 5). */
  countActive(userId: string, merchantId: string): Promise<number>;
  findAllByUser(userId: string): Promise<LoyaltyCouponEntity[]>;
  save(coupon: Omit<LoyaltyCouponEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyCouponEntity>;
  markRedeemed(id: string, transactionId: string): Promise<void>;
  expireOldCoupons(asOf: Date): Promise<number>;
}

export const LOYALTY_COUPON_REPOSITORY = 'LOYALTY_COUPON_REPOSITORY';
