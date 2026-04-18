import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '../../domain/ports/merchant.repository.port';

export interface MerchantStats {
  merchantId: string;
  businessName: string;
  averageTicket: number;
  couponFundingBalance: number;
  tierDistribution: { tier1: number; tier2: number; tier3: number };
  activeLoyaltyCoupons: number;
  totalCompletedTransactions: number;
  totalGmv: number;
  pendingSubsidyAmount: number;
}

@Injectable()
export class GetMerchantStatsUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    private readonly dataSource: DataSource,
  ) {}

  async execute(merchantId: string): Promise<MerchantStats> {
    const merchant = await this.merchantRepo.findById(merchantId);
    if (!merchant) throw new NotFoundException('Merchant not found');

    const [tierRows, couponCount, txRows, subsidyRows] = await Promise.all([
      this.dataSource.query<{ tier_level: string; count: string }[]>(
        `SELECT tier_level, COUNT(*)::int AS count
         FROM loyalty_tiers
         WHERE merchant_id = $1
         GROUP BY tier_level`,
        [merchantId],
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count
         FROM loyalty_coupons
         WHERE merchant_id = $1 AND status = 'active'`,
        [merchantId],
      ),
      this.dataSource.query<{ count: string; total_gmv: string }[]>(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0) AS total_gmv
         FROM transactions
         WHERE merchant_id = $1 AND status = 'completed'`,
        [merchantId],
      ),
      this.dataSource.query<{ total: string }[]>(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM platform_subsidies_ledger
         WHERE merchant_id = $1 AND status = 'pending'`,
        [merchantId],
      ),
    ]);

    const tierDist = { tier1: 0, tier2: 0, tier3: 0 };
    for (const row of tierRows) {
      if (row.tier_level === '1') tierDist.tier1 = Number(row.count);
      else if (row.tier_level === '2') tierDist.tier2 = Number(row.count);
      else if (row.tier_level === '3') tierDist.tier3 = Number(row.count);
    }

    return {
      merchantId,
      businessName: merchant.businessName,
      averageTicket: Number(merchant.averageTicket),
      couponFundingBalance: Number(merchant.couponFundingBalance),
      tierDistribution: tierDist,
      activeLoyaltyCoupons: Number(couponCount[0]?.count ?? 0),
      totalCompletedTransactions: Number(txRows[0]?.count ?? 0),
      totalGmv: Number(txRows[0]?.total_gmv ?? 0),
      pendingSubsidyAmount: Number(subsidyRows[0]?.total ?? 0),
    };
  }
}
