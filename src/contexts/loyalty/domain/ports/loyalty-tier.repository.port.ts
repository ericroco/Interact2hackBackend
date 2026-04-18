import { LoyaltyTierEntity, TierLevel } from '../entities/loyalty-tier.entity';

export interface LoyaltyTierRepositoryPort {
  findByUserAndMerchant(userId: string, merchantId: string): Promise<LoyaltyTierEntity | null>;
  findAllByUser(userId: string): Promise<LoyaltyTierEntity[]>;
  save(tier: Omit<LoyaltyTierEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyTierEntity>;
  updateTierLevel(id: string, tierLevel: TierLevel, degradationDueDate: Date): Promise<void>;
  updateAfterTransaction(
    id: string,
    trustPoints: number,
    lastTransactionAt: Date,
    degradationDueDate: Date,
    avgFrequencyDays: number,
  ): Promise<void>;
  findExpiredForDegradation(asOf: Date): Promise<LoyaltyTierEntity[]>;
}

export const LOYALTY_TIER_REPOSITORY = 'LOYALTY_TIER_REPOSITORY';
