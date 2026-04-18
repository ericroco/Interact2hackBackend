import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantEntity } from '../../domain/entities/merchant.entity';
import { MerchantRepositoryPort } from '../../domain/ports/merchant.repository.port';

@Injectable()
export class MerchantTypeOrmRepository implements MerchantRepositoryPort {
  constructor(
    @InjectRepository(MerchantEntity)
    private readonly repo: Repository<MerchantEntity>,
  ) {}

  findById(id: string): Promise<MerchantEntity | null> {
    return this.repo.findOneBy({ id });
  }

  findByRuc(ruc: string): Promise<MerchantEntity | null> {
    return this.repo.findOneBy({ ruc });
  }

  findByEmail(email: string): Promise<MerchantEntity | null> {
    return this.repo.findOneBy({ ownerEmail: email });
  }

  save(merchant: Omit<MerchantEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchantEntity> {
    return this.repo.save(this.repo.create(merchant));
  }

  async updateAverageTicket(id: string, newAverage: number): Promise<void> {
    await this.repo.update(id, { averageTicket: newAverage });
  }

  async updateCouponFundingBalance(id: string, newBalance: number): Promise<void> {
    await this.repo.update(id, { couponFundingBalance: newBalance });
  }
}
