import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AcquisitionCouponEntity } from '../../domain/entities/acquisition-coupon.entity';
import { AcquisitionCouponRepositoryPort } from '../../domain/ports/acquisition-coupon.repository.port';

@Injectable()
export class AcquisitionCouponTypeOrmRepository implements AcquisitionCouponRepositoryPort {
  constructor(
    @InjectRepository(AcquisitionCouponEntity)
    private readonly repo: Repository<AcquisitionCouponEntity>,
  ) {}

  save(coupon: Omit<AcquisitionCouponEntity, 'id' | 'createdAt'>): Promise<AcquisitionCouponEntity> {
    return this.repo.save(this.repo.create(coupon));
  }

  findByMerchant(merchantId: string): Promise<AcquisitionCouponEntity[]> {
    return this.repo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
  }

  findByCode(code: string): Promise<AcquisitionCouponEntity | null> {
    return this.repo.findOneBy({ code });
  }

  findById(id: string): Promise<AcquisitionCouponEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async markRedeemed(id: string, userId: string, redeemedAt: Date): Promise<void> {
    await this.repo.update(id, { isRedeemed: true, redeemedBy: userId, redeemedAt });
  }

  countActiveCoupons(merchantId: string): Promise<number> {
    return this.repo.count({
      where: {
        merchantId,
        isRedeemed: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }
}
