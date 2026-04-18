import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantEntity } from './domain/entities/merchant.entity';
import { AcquisitionCouponEntity } from './domain/entities/acquisition-coupon.entity';
import { MerchantCategoryEntity } from '@contexts/loyalty/domain/entities/merchant-category.entity';
import { MerchantTypeOrmRepository } from './infrastructure/adapters/merchant.typeorm.repository';
import { AcquisitionCouponTypeOrmRepository } from './infrastructure/adapters/acquisition-coupon.typeorm.repository';
import { MerchantCategoryTypeOrmRepository } from '@contexts/loyalty/infrastructure/adapters/merchant-category.typeorm.repository';
import { MERCHANT_REPOSITORY } from './domain/ports/merchant.repository.port';
import { ACQUISITION_COUPON_REPOSITORY } from './domain/ports/acquisition-coupon.repository.port';
import { MERCHANT_CATEGORY_REPOSITORY } from '@contexts/loyalty/domain/ports/merchant-category.repository.port';
import { MerchantController } from './infrastructure/adapters/merchant.controller';
import { GetMerchantStatsUseCase } from './application/use-cases/get-merchant-stats.use-case';
import { CreateAcquisitionCouponUseCase } from './application/use-cases/create-acquisition-coupon.use-case';
import { AuthModule } from '@contexts/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerchantEntity, AcquisitionCouponEntity, MerchantCategoryEntity]),
    forwardRef(() => AuthModule),
  ],
  providers: [
    { provide: MERCHANT_REPOSITORY, useClass: MerchantTypeOrmRepository },
    { provide: ACQUISITION_COUPON_REPOSITORY, useClass: AcquisitionCouponTypeOrmRepository },
    { provide: MERCHANT_CATEGORY_REPOSITORY, useClass: MerchantCategoryTypeOrmRepository },
    GetMerchantStatsUseCase,
    CreateAcquisitionCouponUseCase,
  ],
  controllers: [MerchantController],
  exports: [MERCHANT_REPOSITORY, ACQUISITION_COUPON_REPOSITORY, MERCHANT_CATEGORY_REPOSITORY],
})
export class MerchantsModule {}
