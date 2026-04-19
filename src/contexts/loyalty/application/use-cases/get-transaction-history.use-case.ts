import { Inject, Injectable } from '@nestjs/common';
import { TransactionRepositoryPort, TRANSACTION_REPOSITORY } from '@contexts/transactions/domain/ports/transaction.repository.port';

export interface TransactionHistoryDto {
  id: string;
  date: string;
  amount: number;
  pointsEarned: number;
  discountUsed?: number;
}

@Injectable()
export class GetTransactionHistoryUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) 
    private readonly transactionRepo: TransactionRepositoryPort,
  ) {}

  async execute(userId: string, merchantId: string): Promise<TransactionHistoryDto[]> {
    const transactions = await this.transactionRepo.findByUserAndMerchant(userId, merchantId, 50);
    
    return transactions.map((tx) => {
      // Formatear al estilo "18 Abr 2026, 10:30" que el front estaba esperando, 
      // o simplemente un ISO string y que el front parsee (preferible delegar al front).
      // Mejor enviamos simple string ISO y dejamos que Flutter formatee.
      return {
        id: tx.id,
        date: tx.createdAt.toISOString(),
        amount: Number(tx.amount),
        pointsEarned: Number(tx.trustPointsEarned),
        discountUsed: Number(tx.couponDiscountAmount),
      };
    });
  }
}
