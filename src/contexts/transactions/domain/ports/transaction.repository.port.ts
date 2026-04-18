import { TransactionEntity, TransactionStatus } from '../entities/transaction.entity';

export interface TransactionRepositoryPort {
  findById(id: string): Promise<TransactionEntity | null>;
  findByUserAndMerchant(userId: string, merchantId: string, limit?: number): Promise<TransactionEntity[]>;
  save(transaction: Omit<TransactionEntity, 'id' | 'createdAt'>): Promise<TransactionEntity>;
  updateStatus(id: string, status: TransactionStatus): Promise<void>;
}

export const TRANSACTION_REPOSITORY = 'TRANSACTION_REPOSITORY';
