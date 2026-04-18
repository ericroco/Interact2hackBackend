import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantCategoryEntity } from '../../domain/entities/merchant-category.entity';
import { MerchantCategoryRepositoryPort } from '../../domain/ports/merchant-category.repository.port';

@Injectable()
export class MerchantCategoryTypeOrmRepository implements MerchantCategoryRepositoryPort {
  constructor(
    @InjectRepository(MerchantCategoryEntity)
    private readonly repo: Repository<MerchantCategoryEntity>,
  ) {}

  findById(id: string): Promise<MerchantCategoryEntity | null> {
    return this.repo.findOneBy({ id });
  }

  findByCode(code: string): Promise<MerchantCategoryEntity | null> {
    return this.repo.findOneBy({ code });
  }

  findAll(): Promise<MerchantCategoryEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }
}
