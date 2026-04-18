import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MerchantRepositoryPort, MERCHANT_REPOSITORY } from '@contexts/merchants/domain/ports/merchant.repository.port';
import { LoginMerchantDto } from '../ports/login-merchant.dto';

@Injectable()
export class LoginMerchantUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepo: MerchantRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginMerchantDto): Promise<{ accessToken: string; merchantId: string }> {
    const merchant = await this.merchantRepo.findByEmail(dto.ownerEmail);
    if (!merchant || !merchant.isActive) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, merchant.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.jwtService.sign({
      sub: merchant.id,
      email: merchant.ownerEmail,
      role: 'merchant',
    });

    return { accessToken, merchantId: merchant.id };
  }
}
