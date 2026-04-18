import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class ScanTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  merchantId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}
