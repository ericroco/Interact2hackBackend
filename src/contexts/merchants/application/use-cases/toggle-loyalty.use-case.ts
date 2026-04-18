import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '../../domain/ports/merchant.repository.port';
import { ToggleLoyaltyDto } from '../ports/toggle-loyalty.dto';

@Injectable()
export class ToggleLoyaltyUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
  ) {}

  async execute(merchantId: string, dto: ToggleLoyaltyDto): Promise<{ loyaltyEnabled: boolean }> {
    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant) throw new NotFoundException('Merchant not found');

    await this.merchantRepo.updateLoyaltyEnabled(merchantId, dto.enabled);

    return { loyaltyEnabled: dto.enabled };
  }
}
