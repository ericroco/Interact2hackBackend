import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierConfigEntity } from '../../domain/entities/tier-config.entity';
import { TierConfigRepositoryPort } from '../../domain/ports/tier-config.repository.port';

@Injectable()
export class TierConfigTypeOrmRepository implements TierConfigRepositoryPort {
  constructor(
    @InjectRepository(TierConfigEntity)
    private readonly repo: Repository<TierConfigEntity>,
  ) {}

  findByCategoryAndTier(categoryId: string, tierLevel: number): Promise<TierConfigEntity | null> {
    return this.repo.findOneBy({ categoryId, tierLevel, isActive: true });
  }

  findAllByCategory(categoryId: string): Promise<TierConfigEntity[]> {
    return this.repo.findBy({ categoryId, isActive: true });
  }
}
