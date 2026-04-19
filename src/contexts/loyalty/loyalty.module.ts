import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantCategoryEntity } from './domain/entities/merchant-category.entity';
import { TierConfigEntity } from './domain/entities/tier-config.entity';
import { LoyaltyTierEntity } from './domain/entities/loyalty-tier.entity';
import { LoyaltyCouponEntity } from './domain/entities/loyalty-coupon.entity';
import { PlatformSubsidyLedgerEntity } from './domain/entities/platform-subsidy-ledger.entity';
import { TransactionEntity } from '@contexts/transactions/domain/entities/transaction.entity';
import { MerchantEntity } from '@contexts/merchants/domain/entities/merchant.entity';
import { MerchantBroadcastEntity } from '@contexts/merchants/domain/entities/merchant-broadcast.entity';
import { MerchantCategoryTypeOrmRepository } from './infrastructure/adapters/merchant-category.typeorm.repository';
import { TierConfigTypeOrmRepository } from './infrastructure/adapters/tier-config.typeorm.repository';
import { LoyaltyTierTypeOrmRepository } from './infrastructure/adapters/loyalty-tier.typeorm.repository';
import { LoyaltyCouponTypeOrmRepository } from './infrastructure/adapters/loyalty-coupon.typeorm.repository';
import { PlatformSubsidyLedgerTypeOrmRepository } from './infrastructure/adapters/platform-subsidy-ledger.typeorm.repository';
import { MerchantTypeOrmRepository } from '@contexts/merchants/infrastructure/adapters/merchant.typeorm.repository';
import { MERCHANT_CATEGORY_REPOSITORY } from './domain/ports/merchant-category.repository.port';
import { TIER_CONFIG_REPOSITORY } from './domain/ports/tier-config.repository.port';
import { LOYALTY_TIER_REPOSITORY } from './domain/ports/loyalty-tier.repository.port';
import { LOYALTY_COUPON_REPOSITORY } from './domain/ports/loyalty-coupon.repository.port';
import { PLATFORM_SUBSIDY_LEDGER_REPOSITORY } from './domain/ports/platform-subsidy-ledger.repository.port';
import { MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { RelativeEffortEngine } from './domain/services/relative-effort-engine.service';
import { DegradationCalculator } from './domain/services/degradation-calculator.service';
import { CouponValueCalculator } from './domain/services/coupon-value-calculator.service';
import { TierClassificationService } from './domain/services/tier-classification.service';
import { ProcessTransactionUseCase } from './application/use-cases/process-transaction.use-case';
import { GetUserLoyaltyProfileUseCase } from './application/use-cases/get-user-loyalty-profile.use-case';
import { LoyaltyController } from './infrastructure/adapters/loyalty.controller';
import { DegradationCron } from './infrastructure/adapters/degradation.cron';
import { AuthModule } from '@contexts/auth/auth.module';
import { GetTransactionHistoryUseCase } from './application/use-cases/get-transaction-history.use-case';
import { TRANSACTION_REPOSITORY } from '@contexts/transactions/domain/ports/transaction.repository.port';
import { TransactionTypeOrmRepository } from '@contexts/transactions/infrastructure/adapters/transaction.typeorm.repository';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      MerchantCategoryEntity,
      TierConfigEntity,
      LoyaltyTierEntity,
      LoyaltyCouponEntity,
      PlatformSubsidyLedgerEntity,
      TransactionEntity,
      MerchantEntity,
      MerchantBroadcastEntity,
    ]),
  ],
  providers: [
    { provide: MERCHANT_CATEGORY_REPOSITORY, useClass: MerchantCategoryTypeOrmRepository },
    { provide: TIER_CONFIG_REPOSITORY, useClass: TierConfigTypeOrmRepository },
    { provide: LOYALTY_TIER_REPOSITORY, useClass: LoyaltyTierTypeOrmRepository },
    { provide: LOYALTY_COUPON_REPOSITORY, useClass: LoyaltyCouponTypeOrmRepository },
    { provide: PLATFORM_SUBSIDY_LEDGER_REPOSITORY, useClass: PlatformSubsidyLedgerTypeOrmRepository },
    { provide: MERCHANT_REPOSITORY, useClass: MerchantTypeOrmRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: TransactionTypeOrmRepository },
    RelativeEffortEngine,
    DegradationCalculator,
    CouponValueCalculator,
    TierClassificationService,
    ProcessTransactionUseCase,
    GetUserLoyaltyProfileUseCase,
    GetTransactionHistoryUseCase,
    DegradationCron,
  ],
  controllers: [LoyaltyController],
  exports: [LOYALTY_TIER_REPOSITORY, LOYALTY_COUPON_REPOSITORY, TIER_CONFIG_REPOSITORY],
})
export class LoyaltyModule {}
