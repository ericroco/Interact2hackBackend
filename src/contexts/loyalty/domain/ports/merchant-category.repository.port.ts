import { MerchantCategoryEntity } from '../entities/merchant-category.entity';

export interface MerchantCategoryRepositoryPort {
  findById(id: string): Promise<MerchantCategoryEntity | null>;
  findByCode(code: string): Promise<MerchantCategoryEntity | null>;
  findAll(): Promise<MerchantCategoryEntity[]>;
}

export const MERCHANT_CATEGORY_REPOSITORY = 'MERCHANT_CATEGORY_REPOSITORY';
