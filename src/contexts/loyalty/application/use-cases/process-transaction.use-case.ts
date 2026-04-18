import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { LoyaltyTierRepositoryPort, LOYALTY_TIER_REPOSITORY } from '../../domain/ports/loyalty-tier.repository.port';
import { LoyaltyCouponRepositoryPort, LOYALTY_COUPON_REPOSITORY } from '../../domain/ports/loyalty-coupon.repository.port';
import { TierConfigRepositoryPort, TIER_CONFIG_REPOSITORY } from '../../domain/ports/tier-config.repository.port';
import { MerchantCategoryRepositoryPort, MERCHANT_CATEGORY_REPOSITORY } from '../../domain/ports/merchant-category.repository.port';
import { PlatformSubsidyLedgerRepositoryPort, PLATFORM_SUBSIDY_LEDGER_REPOSITORY } from '../../domain/ports/platform-subsidy-ledger.repository.port';
import { RelativeEffortEngine } from '../../domain/services/relative-effort-engine.service';
import { DegradationCalculator } from '../../domain/services/degradation-calculator.service';
import { CouponValueCalculator } from '../../domain/services/coupon-value-calculator.service';
import { TierClassificationService } from '../../domain/services/tier-classification.service';
import { RedisAntifraudRepository } from '@shared/infrastructure/cache/redis/redis.antifraud.repository';
import { ScanTransactionDto } from '../ports/scan-transaction.dto';
import { TransactionResultDto } from '../ports/transaction-result.dto';
import { TransactionEntity, TransactionStatus } from '@contexts/transactions/domain/entities/transaction.entity';
import { LoyaltyTierEntity, TierLevel } from '../../domain/entities/loyalty-tier.entity';
import { CouponStatus, LoyaltyCouponEntity } from '../../domain/entities/loyalty-coupon.entity';
import { PlatformSubsidyLedgerEntity, SubsidyStatus } from '../../domain/entities/platform-subsidy-ledger.entity';
import { MerchantEntity } from '@contexts/merchants/domain/entities/merchant.entity';

const COUPON_EXPIRY_DAYS = 30;

@Injectable()
export class ProcessTransactionUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    @Inject(LOYALTY_TIER_REPOSITORY) private readonly loyaltyTierRepo: LoyaltyTierRepositoryPort,
    @Inject(LOYALTY_COUPON_REPOSITORY) private readonly couponRepo: LoyaltyCouponRepositoryPort,
    @Inject(TIER_CONFIG_REPOSITORY) private readonly tierConfigRepo: TierConfigRepositoryPort,
    @Inject(MERCHANT_CATEGORY_REPOSITORY) private readonly categoryRepo: MerchantCategoryRepositoryPort,
    @Inject(PLATFORM_SUBSIDY_LEDGER_REPOSITORY) private readonly subsidyRepo: PlatformSubsidyLedgerRepositoryPort,
    private readonly effortEngine: RelativeEffortEngine,
    private readonly degradationCalc: DegradationCalculator,
    private readonly couponCalc: CouponValueCalculator,
    private readonly tierService: TierClassificationService,
    private readonly antifraud: RedisAntifraudRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(userId: string, dto: ScanTransactionDto): Promise<TransactionResultDto> {
    const merchant = await this.merchantRepo.findById(dto.merchantId);
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (!merchant.loyaltyEnabled) throw new UnprocessableEntityException('Loyalty program not enabled for this merchant');

    const category = await this.categoryRepo.findById(merchant.categoryId);
    if (!category) throw new UnprocessableEntityException('Merchant category not configured');

    const isBlocked = await this.antifraud.isVelocityLimitActive(userId, dto.merchantId);

    let loyaltyTier = await this.loyaltyTierRepo.findByUserAndMerchant(userId, dto.merchantId);
    if (!loyaltyTier) {
      loyaltyTier = await this.loyaltyTierRepo.save({
        userId,
        merchantId: dto.merchantId,
        tierLevel: TierLevel.LOW,
        trustPoints: 0,
        lastTransactionAt: null,
        degradationDueDate: null,
        avgFrequencyDays: null,
      });
    }

    const activeCoupon = await this.couponRepo.findActive(userId, dto.merchantId);

    const avgTicketSnapshot = Number(merchant.averageTicket);
    const trustPointsEarned = isBlocked
      ? 0
      : this.effortEngine.calculate(dto.amount, avgTicketSnapshot, loyaltyTier.tierLevel);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Insertar transacción en estado PENDING
      const transaction = await queryRunner.manager.save(
        queryRunner.manager.create(TransactionEntity, {
          userId,
          merchantId: dto.merchantId,
          amount: dto.amount,
          trustPointsEarned,
          avgTicketSnapshot,
          couponIdApplied: activeCoupon?.id ?? null,
          couponDiscountAmount: activeCoupon?.value ?? 0,
          tierAtTransaction: loyaltyTier.tierLevel,
          status: TransactionStatus.PENDING,
        }),
      );

      let currentTierLevel = loyaltyTier.tierLevel;
      let currentPoints = Number(loyaltyTier.trustPoints);

      // Redimir cupón activo si existe
      if (activeCoupon) {
        await queryRunner.manager.update(LoyaltyCouponEntity, activeCoupon.id, {
          status: CouponStatus.REDEEMED,
          redeemedInTransactionId: transaction.id,
        });

        await queryRunner.manager.save(
          queryRunner.manager.create(PlatformSubsidyLedgerEntity, {
            couponId: activeCoupon.id,
            transactionId: transaction.id,
            merchantId: dto.merchantId,
            userId,
            amount: activeCoupon.value,
            status: SubsidyStatus.PENDING,
            settledAt: null,
          }),
        );

        // Subir tier y resetear puntos al redimir
        currentTierLevel = this.tierService.nextTier(currentTierLevel);
        currentPoints = 0;

        await queryRunner.manager.update(LoyaltyTierEntity, loyaltyTier.id, {
          tierLevel: currentTierLevel,
          trustPoints: 0,
        });
      }

      // Acumular puntos de esta transacción
      const newTrustPoints = currentPoints + trustPointsEarned;

      // Calcular degradación
      const { degradationDueDate, avgFrequencyDays } = this.degradationCalc.calculate(
        loyaltyTier.lastTransactionAt,
        loyaltyTier.avgFrequencyDays ? Number(loyaltyTier.avgFrequencyDays) : null,
        new Date(),
      );

      await queryRunner.manager.update(LoyaltyTierEntity, loyaltyTier.id, {
        trustPoints: newTrustPoints,
        lastTransactionAt: new Date(),
        degradationDueDate,
        avgFrequencyDays,
      });

      // Actualizar ticket promedio del local (media exponencial)
      const newAvgTicket = this.effortEngine.updateAverageTicket(avgTicketSnapshot, dto.amount);
      await queryRunner.manager.update(MerchantEntity, merchant.id, {
        averageTicket: newAvgTicket,
      });

      // Verificar si se alcanzó el umbral para generar nuevo cupón
      let newCouponUnlocked: { value: number; message: string } | null = null;

      if (!isBlocked) {
        const tierConfig = await this.tierConfigRepo.findByCategoryAndTier(
          merchant.categoryId,
          currentTierLevel,
        );

        const hasActiveAfterRedemption = false; // el cupón ya se consumió arriba
        const thresholdReached = tierConfig && newTrustPoints >= tierConfig.pointsThreshold;
        const noActiveCoupon = !activeCoupon || !hasActiveAfterRedemption;

        if (thresholdReached && noActiveCoupon) {
          const couponValue = this.couponCalc.calculate(newAvgTicket, currentTierLevel);

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + COUPON_EXPIRY_DAYS);

          await queryRunner.manager.save(
            queryRunner.manager.create(LoyaltyCouponEntity, {
              userId,
              merchantId: dto.merchantId,
              tierEarnedAt: currentTierLevel,
              value: couponValue,
              avgTicketSnapshot: newAvgTicket,
              cashbackPctSnapshot: Number(tierConfig!.cashbackPct),
              status: CouponStatus.ACTIVE,
              redeemedInTransactionId: null,
              expiresAt,
            }),
          );

          newCouponUnlocked = {
            value: couponValue,
            message: `¡Tienes una Yapa de $${couponValue.toFixed(2)} en ${merchant.businessName}!`,
          };
        }
      }

      // Completar transacción
      await queryRunner.manager.update(TransactionEntity, transaction.id, {
        status: TransactionStatus.COMPLETED,
      });

      await queryRunner.commitTransaction();

      if (!isBlocked) {
        await this.antifraud.setVelocityLimit(userId, dto.merchantId);
      }

      const tierConfig = await this.tierConfigRepo.findByCategoryAndTier(
        merchant.categoryId,
        currentTierLevel,
      );
      const pointsToNextCoupon = tierConfig
        ? Math.max(0, tierConfig.pointsThreshold - newTrustPoints)
        : null;

      return {
        transactionId: transaction.id,
        trustPointsEarned,
        totalTrustPoints: newTrustPoints,
        tierLevel: currentTierLevel,
        pointsToNextCoupon,
        couponApplied: activeCoupon
          ? { id: activeCoupon.id, discountAmount: Number(activeCoupon.value) }
          : null,
        couponUnlocked: newCouponUnlocked,
        antifraudBlocked: isBlocked,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
