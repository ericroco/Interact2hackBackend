import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity, TransactionStatus } from '../../domain/entities/transaction.entity';
import { TransactionRepositoryPort } from '../../domain/ports/transaction.repository.port';

@Injectable()
export class TransactionTypeOrmRepository implements TransactionRepositoryPort {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly repo: Repository<TransactionEntity>,
  ) {}

  findById(id: string): Promise<TransactionEntity | null> {
    return this.repo.findOneBy({ id });
  }

  findByUserAndMerchant(
    userId: string,
    merchantId: string,
    limit = 20,
  ): Promise<TransactionEntity[]> {
    return this.repo.find({
      where: { userId, merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  save(tx: Omit<TransactionEntity, 'id' | 'createdAt'>): Promise<TransactionEntity> {
    return this.repo.save(this.repo.create(tx));
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<void> {
    await this.repo.update(id, { status });
  }
}
