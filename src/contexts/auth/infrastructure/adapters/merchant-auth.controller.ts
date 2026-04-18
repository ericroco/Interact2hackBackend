import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterMerchantAuthUseCase } from '../../application/use-cases/register-merchant-auth.use-case';
import { LoginMerchantUseCase } from '../../application/use-cases/login-merchant.use-case';
import { RegisterMerchantAuthDto } from '../../application/ports/register-merchant-auth.dto';
import { LoginMerchantDto } from '../../application/ports/login-merchant.dto';
import { buildSuccess } from '@shared/application/contracts/api-response.interface';

@Controller('merchants/auth')
export class MerchantAuthController {
  constructor(
    private readonly registerUseCase: RegisterMerchantAuthUseCase,
    private readonly loginUseCase: LoginMerchantUseCase,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterMerchantAuthDto) {
    const result = await this.registerUseCase.execute(dto);
    return buildSuccess(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginMerchantDto) {
    const result = await this.loginUseCase.execute(dto);
    return buildSuccess(result);
  }
}
