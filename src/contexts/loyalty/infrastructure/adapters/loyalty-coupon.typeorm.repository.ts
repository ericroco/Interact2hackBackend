import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { CouponStatus, LoyaltyCouponEntity } from '../../domain/entities/loyalty-coupon.entity';
import { LoyaltyCouponRepositoryPort } from '../../domain/ports/loyalty-coupon.repository.port';

@Injectable()
export class LoyaltyCouponTypeOrmRepository implements LoyaltyCouponRepositoryPort {
  constructor(
    @InjectRepository(LoyaltyCouponEntity)
    private readonly repo: Repository<LoyaltyCouponEntity>,
  ) {}

  findById(id: string): Promise<LoyaltyCouponEntity | null> {
    return this.repo.findOneBy({ id });
  }

  findActiveByUserAndMerchant(userId: string, merchantId: string): Promise<LoyaltyCouponEntity[]> {
    return this.repo.find({
      where: { userId, merchantId, status: CouponStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
  }

  async countActive(userId: string, merchantId: string): Promise<number> {
    return this.repo.count({ where: { userId, merchantId, status: CouponStatus.ACTIVE } });
  }

  findAllByUser(userId: string): Promise<LoyaltyCouponEntity[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  save(coupon: Omit<LoyaltyCouponEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyCouponEntity> {
    return this.repo.save(this.repo.create(coupon));
  }

  async markRedeemed(id: string, transactionId: string): Promise<void> {
    await this.repo.update(id, {
      status: CouponStatus.REDEEMED,
      redeemedInTransactionId: transactionId,
    });
  }

  async expireOldCoupons(asOf: Date): Promise<number> {
    const result = await this.repo.update(
      { status: CouponStatus.ACTIVE, expiresAt: LessThan(asOf) },
      { status: CouponStatus.EXPIRED },
    );
    return result.affected ?? 0;
  }
}
