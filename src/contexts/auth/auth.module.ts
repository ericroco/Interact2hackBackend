import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantEntity } from '@contexts/merchants/domain/entities/merchant.entity';
import { MerchantCategoryEntity } from '@contexts/loyalty/domain/entities/merchant-category.entity';
import { MerchantTypeOrmRepository } from '@contexts/merchants/infrastructure/adapters/merchant.typeorm.repository';
import { MerchantCategoryTypeOrmRepository } from '@contexts/loyalty/infrastructure/adapters/merchant-category.typeorm.repository';
import { MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { MERCHANT_CATEGORY_REPOSITORY } from '@contexts/loyalty/domain/ports/merchant-category.repository.port';
import { UsersModule } from '@contexts/users/users.module';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { RegisterMerchantAuthUseCase } from './application/use-cases/register-merchant-auth.use-case';
import { LoginMerchantUseCase } from './application/use-cases/login-merchant.use-case';
import { AuthGuard } from './infrastructure/adapters/auth.guard';
import { UserGuard } from './infrastructure/adapters/user.guard';
import { MerchantGuard } from './infrastructure/adapters/merchant.guard';
import { AuthController } from './infrastructure/adapters/auth.controller';
import { MerchantAuthController } from './infrastructure/adapters/merchant-auth.controller';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([MerchantEntity, MerchantCategoryEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRATION', '3600s') },
      }),
    }),
  ],
  providers: [
    { provide: MERCHANT_REPOSITORY, useClass: MerchantTypeOrmRepository },
    { provide: MERCHANT_CATEGORY_REPOSITORY, useClass: MerchantCategoryTypeOrmRepository },
    RegisterUserUseCase,
    LoginUserUseCase,
    RegisterMerchantAuthUseCase,
    LoginMerchantUseCase,
    AuthGuard,
    UserGuard,
    MerchantGuard,
  ],
  controllers: [AuthController, MerchantAuthController],
  exports: [AuthGuard, UserGuard, MerchantGuard, JwtModule],
})
export class AuthModule {}
