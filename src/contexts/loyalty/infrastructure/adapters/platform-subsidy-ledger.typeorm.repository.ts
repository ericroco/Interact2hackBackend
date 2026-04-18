import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSubsidyLedgerEntity, SubsidyStatus } from '../../domain/entities/platform-subsidy-ledger.entity';
import { PlatformSubsidyLedgerRepositoryPort } from '../../domain/ports/platform-subsidy-ledger.repository.port';

@Injectable()
export class PlatformSubsidyLedgerTypeOrmRepository implements PlatformSubsidyLedgerRepositoryPort {
  constructor(
    @InjectRepository(PlatformSubsidyLedgerEntity)
    private readonly repo: Repository<PlatformSubsidyLedgerEntity>,
  ) {}

  save(entry: Omit<PlatformSubsidyLedgerEntity, 'id' | 'createdAt'>): Promise<PlatformSubsidyLedgerEntity> {
    return this.repo.save(this.repo.create(entry));
  }

  async updateStatus(id: string, status: SubsidyStatus, settledAt?: Date): Promise<void> {
    await this.repo.update(id, { status, ...(settledAt && { settledAt }) });
  }
}
