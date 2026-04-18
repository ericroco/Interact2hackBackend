import { PlatformSubsidyLedgerEntity, SubsidyStatus } from '../entities/platform-subsidy-ledger.entity';

export interface PlatformSubsidyLedgerRepositoryPort {
  save(entry: Omit<PlatformSubsidyLedgerEntity, 'id' | 'createdAt'>): Promise<PlatformSubsidyLedgerEntity>;
  updateStatus(id: string, status: SubsidyStatus, settledAt?: Date): Promise<void>;
}

export const PLATFORM_SUBSIDY_LEDGER_REPOSITORY = 'PLATFORM_SUBSIDY_LEDGER_REPOSITORY';
