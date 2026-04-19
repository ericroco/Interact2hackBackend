import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Request, UseGuards, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { UserGuard } from '@contexts/auth/infrastructure/adapters/user.guard';
import { ProcessTransactionUseCase } from '../../application/use-cases/process-transaction.use-case';
import { GetUserLoyaltyProfileUseCase } from '../../application/use-cases/get-user-loyalty-profile.use-case';
import { GetTransactionHistoryUseCase } from '../../application/use-cases/get-transaction-history.use-case';
import { ScanTransactionDto } from '../../application/ports/scan-transaction.dto';
import { buildSuccess } from '@shared/application/contracts/api-response.interface';
import { LoyaltyTierEntity } from '../../domain/entities/loyalty-tier.entity';
import { MerchantBroadcastEntity } from '@contexts/merchants/domain/entities/merchant-broadcast.entity';

@Controller('loyalty')
@UseGuards(UserGuard)
export class LoyaltyController {
  constructor(
    private readonly processTransaction: ProcessTransactionUseCase,
    private readonly getLoyaltyProfile: GetUserLoyaltyProfileUseCase,
    private readonly getTransactionHistory: GetTransactionHistoryUseCase,
    @InjectRepository(LoyaltyTierEntity)
    private readonly tierRepo: Repository<LoyaltyTierEntity>,
    @InjectRepository(MerchantBroadcastEntity)
    private readonly broadcastRepo: Repository<MerchantBroadcastEntity>,
  ) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async scan(@Request() req: any, @Body() dto: ScanTransactionDto) {
    const result = await this.processTransaction.execute(req.user.sub, dto);
    return buildSuccess(result);
  }

  @Get('profile')
  async profile(@Request() req: any) {
    const result = await this.getLoyaltyProfile.execute(req.user.sub);
    return buildSuccess(result);
  }

  @Get('merchants/:merchantId/transactions')
  async getMerchantTransactions(
    @Request() req: any,
    @Param('merchantId') merchantId: string,
  ) {
    const result = await this.getTransactionHistory.execute(req.user.sub, merchantId);
    return buildSuccess(result);
  }

  @Get('broadcasts')
  async getBroadcasts(@Request() req: any, @Query('since') since?: string) {
    const tiers = await this.tierRepo.findBy({ userId: req.user.sub });
    if (tiers.length === 0) return buildSuccess([]);

    const sinceDate = since
      ? new Date(since)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const broadcasts = await this.broadcastRepo.find({
      where: {
        merchantId: In(tiers.map((t) => t.merchantId)),
        createdAt: MoreThanOrEqual(sinceDate),
      },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return buildSuccess(broadcasts);
  }
}
