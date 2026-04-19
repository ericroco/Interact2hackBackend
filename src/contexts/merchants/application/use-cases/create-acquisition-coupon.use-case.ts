import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '../../domain/ports/merchant.repository.port';
import { AcquisitionCouponRepositoryPort, ACQUISITION_COUPON_REPOSITORY } from '../../domain/ports/acquisition-coupon.repository.port';
import { CreateAcquisitionCouponDto } from '../ports/create-acquisition-coupon.dto';
import { AcquisitionCouponEntity } from '../../domain/entities/acquisition-coupon.entity';

@Injectable()
export class CreateAcquisitionCouponUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    @Inject(ACQUISITION_COUPON_REPOSITORY) private readonly couponRepo: AcquisitionCouponRepositoryPort,
  ) {}

  async execute(merchantId: string, dto: CreateAcquisitionCouponDto): Promise<AcquisitionCouponEntity> {
    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant) throw new NotFoundException('Merchant not found');

    const activeCount = await this.couponRepo.countActiveCoupons(merchantId);
    if (activeCount >= 5) {
      throw new UnprocessableEntityException(
        'Has alcanzado el límite de 5 yapas activas. Elimina una para poder crear otra.',
      );
    }

    const existing = await this.couponRepo.findByCode(dto.code);
    if (existing) throw new ConflictException('Coupon code already exists');

    if (dto.minimumPurchase < dto.value) {
      throw new BadRequestException(
        `minimumPurchase ($${dto.minimumPurchase}) must be greater than or equal to coupon value ($${dto.value})`,
      );
    }

    const qty = dto.quantity ?? 1;
    const totalCost = dto.value * qty;

    if (Number(merchant.couponFundingBalance) < totalCost) {
      throw new UnprocessableEntityException(
        `Insufficient coupon funding balance. Need $${totalCost.toFixed(2)}, available: $${merchant.couponFundingBalance}`,
      );
    }

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) throw new BadRequestException('expiresAt must be in the future');

    await this.merchantRepo.updateCouponFundingBalance(
      merchantId,
      Number(merchant.couponFundingBalance) - totalCost,
    );

    return this.couponRepo.save({
      merchantId,
      name: dto.name ?? '',
      code: dto.code.toUpperCase(),
      value: dto.value,
      quantity: qty,
      minimumTicket: dto.minimumPurchase,
      isRedeemed: false,
      redeemedBy: null,
      redeemedAt: null,
      expiresAt,
    });
  }
}
