import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '../../domain/ports/merchant.repository.port';
import { AcquisitionCouponRepositoryPort, ACQUISITION_COUPON_REPOSITORY } from '../../domain/ports/acquisition-coupon.repository.port';
import { MerchantBroadcastRepositoryPort, MERCHANT_BROADCAST_REPOSITORY } from '../../domain/ports/merchant-broadcast.repository.port';
import { MerchantBroadcastEntity } from '../../domain/entities/merchant-broadcast.entity';

@Injectable()
export class PublishCouponUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    @Inject(ACQUISITION_COUPON_REPOSITORY) private readonly couponRepo: AcquisitionCouponRepositoryPort,
    @Inject(MERCHANT_BROADCAST_REPOSITORY) private readonly broadcastRepo: MerchantBroadcastRepositoryPort,
  ) {}

  async execute(merchantId: string, couponId: string): Promise<MerchantBroadcastEntity> {
    const coupon = await this.couponRepo.findById(couponId);
    if (!coupon || coupon.merchantId !== merchantId) {
      throw new NotFoundException('Yapa no encontrada');
    }

    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant) throw new NotFoundException('Negocio no encontrado');

    const value = Number(coupon.value).toFixed(2);
    const couponName = coupon.name ? coupon.name : 'Vuelve a la tienda';
    const message = `¡${couponName}! | ¡Vuelve a la tienda y recibe cashback de $${value}! Abre tu Radar y encuéntralo.`;

    return this.broadcastRepo.save({
      merchantId,
      merchantName: merchant.businessName,
      couponId,
      message,
      couponValue: coupon.value,
      latitude: merchant.latitude,
      longitude: merchant.longitude,
    });
  }
}
