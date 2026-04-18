import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { LoyaltyTierEntity, TierLevel } from '../../domain/entities/loyalty-tier.entity';
import { LoyaltyTierRepositoryPort } from '../../domain/ports/loyalty-tier.repository.port';

@Injectable()
export class LoyaltyTierTypeOrmRepository implements LoyaltyTierRepositoryPort {
  constructor(
    @InjectRepository(LoyaltyTierEntity)
    private readonly repo: Repository<LoyaltyTierEntity>,
  ) {}

  findByUserAndMerchant(userId: string, merchantId: string): Promise<LoyaltyTierEntity | null> {
    return this.repo.findOneBy({ userId, merchantId });
  }

  findAllByUser(userId: string): Promise<LoyaltyTierEntity[]> {
    return this.repo.findBy({ userId });
  }

  save(tier: Omit<LoyaltyTierEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoyaltyTierEntity> {
    return this.repo.save(this.repo.create(tier));
  }

  async updateTierLevel(id: string, tierLevel: TierLevel, degradationDueDate: Date): Promise<void> {
    await this.repo.update(id, { tierLevel, degradationDueDate });
  }

  async updateAfterTransaction(
    id: string,
    trustPoints: number,
    lastTransactionAt: Date,
    degradationDueDate: Date,
    avgFrequencyDays: number,
  ): Promise<void> {
    await this.repo.update(id, {
      trustPoints,
      lastTransactionAt,
      degradationDueDate,
      avgFrequencyDays,
    });
  }

  findExpiredForDegradation(asOf: Date): Promise<LoyaltyTierEntity[]> {
    return this.repo.findBy({ degradationDueDate: LessThanOrEqual(asOf) });
  }
}
