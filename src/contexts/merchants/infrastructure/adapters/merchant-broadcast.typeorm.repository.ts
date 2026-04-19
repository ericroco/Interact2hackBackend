import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantBroadcastEntity } from '../../domain/entities/merchant-broadcast.entity';
import { MerchantBroadcastRepositoryPort } from '../../domain/ports/merchant-broadcast.repository.port';

@Injectable()
export class MerchantBroadcastTypeOrmRepository implements MerchantBroadcastRepositoryPort {
  constructor(
    @InjectRepository(MerchantBroadcastEntity)
    private readonly repo: Repository<MerchantBroadcastEntity>,
  ) {}

  save(broadcast: Omit<MerchantBroadcastEntity, 'id' | 'createdAt'>): Promise<MerchantBroadcastEntity> {
    return this.repo.save(this.repo.create(broadcast));
  }
}
