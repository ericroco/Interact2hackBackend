import {
  BadRequestException,
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
const MAX_ACTIVE_YAPAS = 5;

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

    const category = await this.categoryRepo.findById(merchant.categoryId);
    if (!category) throw new UnprocessableEntityException('Merchant category not configured');

    // Validar yapa elegida por el usuario (si proporcionó couponId)
    let chosenCoupon: LoyaltyCouponEntity | null = null;
    if (dto.couponId) {
      const candidate = await this.couponRepo.findById(dto.couponId);
      if (
        !candidate ||
        candidate.userId !== userId ||
        candidate.merchantId !== dto.merchantId ||
        candidate.status !== CouponStatus.ACTIVE ||
        candidate.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Invalid or expired yapa coupon for this transaction');
      }
      chosenCoupon = candidate;
    }

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

    const avgTicketSnapshot = Number(merchant.averageTicket);
    const trustPointsEarned = isBlocked
      ? 0
      : this.effortEngine.calculate(dto.amount, avgTicketSnapshot);

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
          couponIdApplied: chosenCoupon?.id ?? null,
          couponDiscountAmount: chosenCoupon ? Number(chosenCoupon.value) : 0,
          tierAtTransaction: loyaltyTier.tierLevel,
          status: TransactionStatus.PENDING,
        }),
      );

      let currentTierLevel = loyaltyTier.tierLevel;
      let currentPoints = Number(loyaltyTier.trustPoints);

      // Redimir la yapa elegida por el usuario (si eligió una)
      if (chosenCoupon) {
        await queryRunner.manager.update(LoyaltyCouponEntity, chosenCoupon.id, {
          status: CouponStatus.REDEEMED,
          redeemedInTransactionId: transaction.id,
        });

        await queryRunner.manager.save(
          queryRunner.manager.create(PlatformSubsidyLedgerEntity, {
            couponId: chosenCoupon.id,
            transactionId: transaction.id,
            merchantId: dto.merchantId,
            userId,
            amount: chosenCoupon.value,
            status: SubsidyStatus.PENDING,
            settledAt: null,
          }),
        );
        // Al redimir NO se resetean puntos ni se sube el tier.
        // Eso ocurrió cuando se GENERÓ la yapa.
      }

      // Acumular puntos de esta transacción
      const newTrustPoints = currentPoints + trustPointsEarned;

      // Calcular degradación
      const { degradationDueDate, avgFrequencyDays } = this.degradationCalc.calculate(
        loyaltyTier.lastTransactionAt,
        loyaltyTier.avgFrequencyDays ? Number(loyaltyTier.avgFrequencyDays) : null,
        new Date(),
      );

      // Actualizar ticket promedio del local (media exponencial)
      const newAvgTicket = this.effortEngine.updateAverageTicket(avgTicketSnapshot, dto.amount);
      await queryRunner.manager.update(MerchantEntity, merchant.id, {
        averageTicket: newAvgTicket,
      });

      // Verificar si se alcanzó el umbral para generar nueva yapa
      let newCouponUnlocked: { id: string; value: number; message: string } | null = null;

      if (!isBlocked) {
        const tierConfig = await this.tierConfigRepo.findByCategoryAndTier(
          merchant.categoryId,
          currentTierLevel,
        );

        const activeYapasCount = await this.couponRepo.countActive(userId, dto.merchantId);
        const thresholdReached = tierConfig && newTrustPoints >= tierConfig.pointsThreshold;
        const canGenerateMore = activeYapasCount < MAX_ACTIVE_YAPAS;

        if (thresholdReached && canGenerateMore) {
          // Capturar tier actual ANTES de subir (para el snapshot correcto)
          const tierEarnedAt = currentTierLevel;
          const couponValue = this.couponCalc.calculate(
            newAvgTicket,
            currentTierLevel,
          );

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + COUPON_EXPIRY_DAYS);

          // Al generar la yapa: subir tier y resetear puntos
          currentTierLevel = this.tierService.nextTier(currentTierLevel);
          const newYapa = await queryRunner.manager.save(
            queryRunner.manager.create(LoyaltyCouponEntity, {
              userId,
              merchantId: dto.merchantId,
              tierEarnedAt,
              value: couponValue,
              avgTicketSnapshot: newAvgTicket,
              cashbackPctSnapshot: 0.18,
              status: CouponStatus.ACTIVE,
              redeemedInTransactionId: null,
              expiresAt,
            }),
          );

          // Resetear puntos tras ganar la yapa
          await queryRunner.manager.update(LoyaltyTierEntity, loyaltyTier.id, {
            tierLevel: currentTierLevel,
            trustPoints: 0,
            lastTransactionAt: new Date(),
            degradationDueDate,
            avgFrequencyDays,
          });

          newCouponUnlocked = {
            id: newYapa.id,
            value: couponValue,
            message: `¡Ganaste una Yapa de $${couponValue.toFixed(2)} en ${merchant.businessName}!`,
          };
        } else {
          // No se generó yapa, solo actualizar puntos normalmente
          await queryRunner.manager.update(LoyaltyTierEntity, loyaltyTier.id, {
            trustPoints: newTrustPoints,
            lastTransactionAt: new Date(),
            degradationDueDate,
            avgFrequencyDays,
          });
        }
      } else {
        // Transacción bloqueada por antifraud — actualizar solo timestamps
        await queryRunner.manager.update(LoyaltyTierEntity, loyaltyTier.id, {
          lastTransactionAt: new Date(),
        });
      }

      // Completar transacción
      await queryRunner.manager.update(TransactionEntity, transaction.id, {
        status: TransactionStatus.COMPLETED,
      });

      await queryRunner.commitTransaction();

      if (!isBlocked) {
        await this.antifraud.setVelocityLimit(userId, dto.merchantId);
      }

      // Leer estado final para la respuesta
      const finalTier = await this.loyaltyTierRepo.findByUserAndMerchant(userId, dto.merchantId);
      const finalPoints = Number(finalTier?.trustPoints ?? 0);
      const finalTierLevel = finalTier?.tierLevel ?? currentTierLevel;

      const tierConfig = await this.tierConfigRepo.findByCategoryAndTier(
        merchant.categoryId,
        finalTierLevel,
      );
      const pointsToNextCoupon = tierConfig
        ? Math.max(0, tierConfig.pointsThreshold - finalPoints)
        : null;

      const remainingActiveYapas = await this.couponRepo.countActive(userId, dto.merchantId);

      return {
        transactionId: transaction.id,
        trustPointsEarned,
        totalTrustPoints: finalPoints,
        tierLevel: finalTierLevel,
        pointsToNextCoupon,
        activeYapasCount: remainingActiveYapas,
        couponApplied: chosenCoupon
          ? { id: chosenCoupon.id, discountAmount: Number(chosenCoupon.value) }
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
