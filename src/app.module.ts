import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { typeOrmConfig } from '@shared/infrastructure/database/typeorm/typeorm.config';
import { RedisModule } from '@shared/infrastructure/cache/redis/redis.module';
import { DatabaseModule } from '@shared/infrastructure/database/typeorm/database.module';
import { AuthModule } from '@contexts/auth/auth.module';
import { UsersModule } from '@contexts/users/users.module';
import { MerchantsModule } from '@contexts/merchants/merchants.module';
import { LoyaltyModule } from '@contexts/loyalty/loyalty.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    ScheduleModule.forRoot(),
    RedisModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    MerchantsModule,
    LoyaltyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
