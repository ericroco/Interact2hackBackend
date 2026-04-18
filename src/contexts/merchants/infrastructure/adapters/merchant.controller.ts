import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MerchantGuard } from '@contexts/auth/infrastructure/adapters/merchant.guard';
import { GetMerchantStatsUseCase } from '../../application/use-cases/get-merchant-stats.use-case';
import { CreateAcquisitionCouponUseCase } from '../../application/use-cases/create-acquisition-coupon.use-case';
import { CreateAcquisitionCouponDto } from '../../application/ports/create-acquisition-coupon.dto';
import { AcquisitionCouponRepositoryPort, ACQUISITION_COUPON_REPOSITORY } from '../../domain/ports/acquisition-coupon.repository.port';
import { MerchantCategoryRepositoryPort, MERCHANT_CATEGORY_REPOSITORY } from '@contexts/loyalty/domain/ports/merchant-category.repository.port';
import { buildSuccess } from '@shared/application/contracts/api-response.interface';
import { Inject } from '@nestjs/common';

/** Deuna Negocios — todos los endpoints requieren token de comerciante */
@Controller('merchants')
@UseGuards(MerchantGuard)
export class MerchantController {
  constructor(
    private readonly getStats: GetMerchantStatsUseCase,
    private readonly createCoupon: CreateAcquisitionCouponUseCase,
    @Inject(ACQUISITION_COUPON_REPOSITORY)
    private readonly couponRepo: AcquisitionCouponRepositoryPort,
    @Inject(MERCHANT_CATEGORY_REPOSITORY)
    private readonly categoryRepo: MerchantCategoryRepositoryPort,
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

  /** Catálogo de categorías (público dentro de autenticados) */
  @Get('categories')
  async categories() {
    const cats = await this.categoryRepo.findAll();
    return buildSuccess(cats);
  }
}
