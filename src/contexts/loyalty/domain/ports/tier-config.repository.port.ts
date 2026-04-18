import { TierConfigEntity } from '../entities/tier-config.entity';

export interface TierConfigRepositoryPort {
  findByCategoryAndTier(categoryId: string, tierLevel: number): Promise<TierConfigEntity | null>;
  findAllByCategory(categoryId: string): Promise<TierConfigEntity[]>;
}

export const TIER_CONFIG_REPOSITORY = 'TIER_CONFIG_REPOSITORY';
