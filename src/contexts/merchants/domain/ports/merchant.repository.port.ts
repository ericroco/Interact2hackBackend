import { MerchantEntity } from '../entities/merchant.entity';

export interface MerchantRepositoryPort {
  findById(id: string): Promise<MerchantEntity | null>;
  findByRuc(ruc: string): Promise<MerchantEntity | null>;
  findByEmail(email: string): Promise<MerchantEntity | null>;
  findByBusinessName(name: string): Promise<MerchantEntity | null>;
  save(merchant: Omit<MerchantEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MerchantEntity>;
  updateAverageTicket(id: string, newAverage: number): Promise<void>;
  updateCouponFundingBalance(id: string, newBalance: number): Promise<void>;
  updateLoyaltyEnabled(id: string, enabled: boolean): Promise<void>;
}

export const MERCHANT_REPOSITORY = 'MERCHANT_REPOSITORY';
