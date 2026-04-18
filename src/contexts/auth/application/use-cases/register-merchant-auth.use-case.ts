import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { MerchantCategoryRepositoryPort, MERCHANT_CATEGORY_REPOSITORY } from '@contexts/loyalty/domain/ports/merchant-category.repository.port';
import { RegisterMerchantAuthDto } from '../ports/register-merchant-auth.dto';

@Injectable()
export class RegisterMerchantAuthUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    @Inject(MERCHANT_CATEGORY_REPOSITORY) private readonly categoryRepo: MerchantCategoryRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: RegisterMerchantAuthDto): Promise<{ accessToken: string; merchantId: string }> {
    const category = await this.categoryRepo.findById(dto.categoryId);
    if (!category) throw new NotFoundException('Category not found');

    const [byRuc, byEmail] = await Promise.all([
      this.merchantRepo.findByRuc(dto.ruc),
      this.merchantRepo.findByEmail(dto.ownerEmail),
    ]);
    if (byRuc) throw new ConflictException('RUC already registered');
    if (byEmail) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const merchant = await this.merchantRepo.save({
      categoryId: dto.categoryId,
      businessName: dto.businessName,
      ruc: dto.ruc,
      ownerEmail: dto.ownerEmail,
      passwordHash,
      averageTicket: 0,
      couponFundingBalance: 5, // crédito inicial Deuna: $5 en cupones de adquisición
      isActive: true,
      loyaltyEnabled: false,
    });

    const accessToken = this.jwtService.sign({
      sub: merchant.id,
      email: merchant.ownerEmail,
      role: 'merchant',
    });

    return { accessToken, merchantId: merchant.id };
  }
}
