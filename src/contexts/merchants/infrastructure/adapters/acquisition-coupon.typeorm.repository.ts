import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async markRedeemed(id: string, userId: string, redeemedAt: Date): Promise<void> {
    await this.repo.update(id, { isRedeemed: true, redeemedBy: userId, redeemedAt });
  }
}
