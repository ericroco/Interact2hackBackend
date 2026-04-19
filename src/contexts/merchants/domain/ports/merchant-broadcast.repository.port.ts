import { MerchantBroadcastEntity } from '../entities/merchant-broadcast.entity';

export interface MerchantBroadcastRepositoryPort {
  save(broadcast: Omit<MerchantBroadcastEntity, 'id' | 'createdAt'>): Promise<MerchantBroadcastEntity>;
}

export const MERCHANT_BROADCAST_REPOSITORY = 'MERCHANT_BROADCAST_REPOSITORY';
