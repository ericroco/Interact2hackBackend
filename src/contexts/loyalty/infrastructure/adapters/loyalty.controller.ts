import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { UserGuard } from '@contexts/auth/infrastructure/adapters/user.guard';
import { ProcessTransactionUseCase } from '../../application/use-cases/process-transaction.use-case';
import { GetUserLoyaltyProfileUseCase } from '../../application/use-cases/get-user-loyalty-profile.use-case';
import { ScanTransactionDto } from '../../application/ports/scan-transaction.dto';
import { buildSuccess } from '@shared/application/contracts/api-response.interface';

@Controller('loyalty')
@UseGuards(UserGuard)
export class LoyaltyController {
  constructor(
    private readonly processTransaction: ProcessTransactionUseCase,
    private readonly getLoyaltyProfile: GetUserLoyaltyProfileUseCase,
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
}
