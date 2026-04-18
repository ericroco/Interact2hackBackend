import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '../../domain/ports/merchant.repository.port';
import { TopUpFundDto } from '../ports/top-up-fund.dto';

export interface TopUpResult {
  merchantId: string;
  previousBalance: number;
  added: number;
  newBalance: number;
}

@Injectable()
export class TopUpMerchantFundUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
  ) {}

  async execute(merchantId: string, dto: TopUpFundDto): Promise<TopUpResult> {
    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant) throw new NotFoundException('Merchant not found');

    const previousBalance = Number(merchant.couponFundingBalance);
    const newBalance = previousBalance + dto.amount;

    await this.merchantRepo.updateCouponFundingBalance(merchantId, newBalance);

    return { merchantId, previousBalance, added: dto.amount, newBalance };
  }
}
