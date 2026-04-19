import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { LoyaltyTierEntity } from '../../domain/entities/loyalty-tier.entity';
import { LoyaltyCouponEntity, CouponStatus } from '../../domain/entities/loyalty-coupon.entity';
import { TierClassificationService } from '../../domain/services/tier-classification.service';

@Injectable()
export class DegradationCron {
  private readonly logger = new Logger(DegradationCron.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tierService: TierClassificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDegradation(): Promise<void> {
    const now = new Date();
    this.logger.log('Running tier degradation job...');

    const expiredTiers = await this.dataSource
      .getRepository(LoyaltyTierEntity)
      .createQueryBuilder('lt')
      .where('lt.degradation_due_date <= :now', { now })
      .getMany();

    if (!expiredTiers.length) {
      this.logger.log('No tiers to degrade');
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let degraded = 0;

      for (const tier of expiredTiers) {
        const newTierLevel = this.tierService.downgradeTier(tier.tierLevel);

        await queryRunner.manager.update(LoyaltyTierEntity, tier.id, {
          tierLevel: newTierLevel,
          degradationDueDate: null,
        });

        await queryRunner.manager.update(
          LoyaltyCouponEntity,
          { userId: tier.userId, merchantId: tier.merchantId, status: CouponStatus.ACTIVE },
          { status: CouponStatus.EXPIRED },
        );

        degraded++;
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Degraded ${degraded} tier(s)`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Degradation job failed', err);
    } finally {
      await queryRunner.release();
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expireCoupons(): Promise<void> {
    const now = new Date();
    const result = await this.dataSource
      .getRepository(LoyaltyCouponEntity)
      .createQueryBuilder()
      .update()
      .set({ status: CouponStatus.EXPIRED })
      .where('status = :status AND expires_at <= :now', { status: CouponStatus.ACTIVE, now })
      .execute();

    this.logger.log(`Expired ${result.affected ?? 0} coupon(s)`);
  }
}
