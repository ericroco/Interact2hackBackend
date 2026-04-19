import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MerchantGuard } from '@contexts/auth/infrastructure/adapters/merchant.guard';
import { GetMerchantStatsUseCase } from '../../application/use-cases/get-merchant-stats.use-case';
import { CreateAcquisitionCouponUseCase } from '../../application/use-cases/create-acquisition-coupon.use-case';
import { TopUpMerchantFundUseCase } from '../../application/use-cases/top-up-merchant-fund.use-case';
import { ToggleLoyaltyUseCase } from '../../application/use-cases/toggle-loyalty.use-case';
import { PublishCouponUseCase } from '../../application/use-cases/publish-coupon.use-case';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '../../domain/ports/merchant.repository.port';
import { CreateAcquisitionCouponDto } from '../../application/ports/create-acquisition-coupon.dto';
import { TopUpFundDto } from '../../application/ports/top-up-fund.dto';
import { ToggleLoyaltyDto } from '../../application/ports/toggle-loyalty.dto';
import { AcquisitionCouponRepositoryPort, ACQUISITION_COUPON_REPOSITORY } from '../../domain/ports/acquisition-coupon.repository.port';
import { MerchantCategoryRepositoryPort, MERCHANT_CATEGORY_REPOSITORY } from '@contexts/loyalty/domain/ports/merchant-category.repository.port';
import { buildSuccess } from '@shared/application/contracts/api-response.interface';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Deuna Negocios — todos los endpoints requieren token de comerciante */
@Controller('merchants')
@UseGuards(MerchantGuard)
export class MerchantController {
  constructor(
    private readonly getStats: GetMerchantStatsUseCase,
    private readonly createCoupon: CreateAcquisitionCouponUseCase,
    private readonly topUpFund: TopUpMerchantFundUseCase,
    private readonly toggleLoyalty: ToggleLoyaltyUseCase,
    private readonly publishCouponUseCase: PublishCouponUseCase,
    @Inject(ACQUISITION_COUPON_REPOSITORY)
    private readonly couponRepo: AcquisitionCouponRepositoryPort,
    @Inject(MERCHANT_CATEGORY_REPOSITORY)
    private readonly categoryRepo: MerchantCategoryRepositoryPort,
    @Inject(MERCHANT_REPOSITORY)
    private readonly merchantRepo: MerchantRepositoryPort,
    private readonly dataSource: DataSource,
  ) {}

  /** Dashboard principal de Deuna Negocios */
  @Get('me/stats')
  async stats(@Request() req: any) {
    const result = await this.getStats.execute(req.user.sub);
    return buildSuccess(result);
  }

  /** Emitir cupón de adquisición (financiado por el comerciante) */
  @Post('me/coupons')
  @HttpCode(HttpStatus.CREATED)
  async issueCoupon(@Request() req: any, @Body() dto: CreateAcquisitionCouponDto) {
    const result = await this.createCoupon.execute(req.user.sub, dto);
    return buildSuccess(result);
  }

  /** Listar cupones de adquisición del local */
  @Get('me/coupons')
  async listCoupons(@Request() req: any) {
    const coupons = await this.couponRepo.findByMerchant(req.user.sub);
    return buildSuccess(coupons);
  }

  /** Recargar saldo de financiamiento de cupones */
  @Post('me/fund')
  @HttpCode(HttpStatus.OK)
  async topUp(@Request() req: any, @Body() dto: TopUpFundDto) {
    const result = await this.topUpFund.execute(req.user.sub, dto);
    return buildSuccess(result);
  }

  /** Activar / desactivar el programa de lealtad del local */
  @Patch('me/loyalty')
  @HttpCode(HttpStatus.OK)
  async setLoyalty(@Request() req: any, @Body() dto: ToggleLoyaltyDto) {
    const result = await this.toggleLoyalty.execute(req.user.sub, dto);
    return buildSuccess(result);
  }

  /** Eliminar cupón de adquisición (restaura balance si no fue canjeado) */
  @Delete('me/coupons/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCoupon(@Request() req: any, @Param('id') id: string) {
    const coupon = await this.couponRepo.findById(id);
    if (!coupon || coupon.merchantId !== req.user.sub) {
      throw new NotFoundException('Coupon not found');
    }
    if (!coupon.isRedeemed) {
      const merchant = await this.merchantRepo.findById(req.user.sub);
      if (merchant) {
        const refund = Number(coupon.value) * (coupon.quantity ?? 1);
        await this.merchantRepo.updateCouponFundingBalance(
          req.user.sub,
          Number(merchant.couponFundingBalance) + refund,
        );
      }
    }
    await this.couponRepo.deleteById(id);
    return buildSuccess({ deleted: true });
  }

  /** Publicar yapa — genera un broadcast a clientes del negocio */
  @Post('me/coupons/:id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Request() req: any, @Param('id') id: string) {
    const result = await this.publishCouponUseCase.execute(req.user.sub, id);
    return buildSuccess(result);
  }

  /** Catálogo de categorías (público dentro de autenticados) */
  @Get('categories')
  async categories() {
    const cats = await this.categoryRepo.findAll();
    return buildSuccess(cats);
  }

  /** Últimas transacciones recibidas por el comerciante */
  @Get('me/transactions')
  async myTransactions(
    @Request() req: any,
    @Query('limit') limit = '10',
  ) {
    const rows = await this.dataSource.query<{
      id: string;
      amount: string;
      status: string;
      date: string;
    }[]>(
      `SELECT id, amount, status, created_at AS date
       FROM transactions
       WHERE merchant_id = $1 AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.sub, Math.min(Number(limit), 50)],
    );
    return buildSuccess(
      rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        status: r.status,
        date: r.date,
      })),
    );
  }
}
