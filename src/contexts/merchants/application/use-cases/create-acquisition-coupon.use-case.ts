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

    const existing = await this.couponRepo.findByCode(dto.code);
    if (existing) throw new ConflictException('Coupon code already exists');

    if (dto.minimumPurchase < dto.value) {
      throw new BadRequestException(
        `minimumPurchase ($${dto.minimumPurchase}) must be greater than or equal to coupon value ($${dto.value})`,
      );
    }

    if (Number(merchant.couponFundingBalance) < dto.value) {
      throw new UnprocessableEntityException(
        `Insufficient coupon funding balance. Available: $${merchant.couponFundingBalance}`,
      );
    }

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) throw new BadRequestException('expiresAt must be in the future');

    await this.merchantRepo.updateCouponFundingBalance(
      merchantId,
      Number(merchant.couponFundingBalance) - dto.value,
    );

    return this.couponRepo.save({
      merchantId,
      code: dto.code.toUpperCase(),
      value: dto.value,
      minimumTicket: dto.minimumPurchase,
      isRedeemed: false,
      redeemedBy: null,
      redeemedAt: null,
      expiresAt,
    });
  }
}
