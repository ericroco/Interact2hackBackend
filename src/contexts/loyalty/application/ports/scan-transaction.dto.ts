import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class ScanTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  merchantId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  /** UUID de la yapa que el usuario elige canjear en esta compra. Opcional. */
  @IsUUID()
  @IsOptional()
  couponId?: string;
}
