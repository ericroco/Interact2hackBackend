import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { UserEntity } from '@contexts/users/domain/entities/user.entity';
import { MerchantEntity } from '@contexts/merchants/domain/entities/merchant.entity';
import { AcquisitionCouponEntity } from '@contexts/merchants/domain/entities/acquisition-coupon.entity';
import { TransactionEntity } from '@contexts/transactions/domain/entities/transaction.entity';
import { MerchantCategoryEntity } from '@contexts/loyalty/domain/entities/merchant-category.entity';
import { TierConfigEntity } from '@contexts/loyalty/domain/entities/tier-config.entity';
import { LoyaltyTierEntity } from '@contexts/loyalty/domain/entities/loyalty-tier.entity';
import { LoyaltyCouponEntity } from '@contexts/loyalty/domain/entities/loyalty-coupon.entity';
import { PlatformSubsidyLedgerEntity } from '@contexts/loyalty/domain/entities/platform-subsidy-ledger.entity';

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    entities: [
      UserEntity,
      MerchantEntity,
      AcquisitionCouponEntity,
      TransactionEntity,
      MerchantCategoryEntity,
      TierConfigEntity,
      LoyaltyTierEntity,
      LoyaltyCouponEntity,
      PlatformSubsidyLedgerEntity,
    ],
    migrations: [__dirname + '/migrations/*.{ts,js}'],
    synchronize: config.get('NODE_ENV') === 'development' || config.get('DB_SYNC') === 'true',
    logging: config.get('NODE_ENV') === 'development',
    ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
  }),
};
