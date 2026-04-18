import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString, Length, Min } from 'class-validator';

export class CreateAcquisitionCouponDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  value: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  minimumPurchase: number;

  @IsString()
  @IsNotEmpty()
  @Length(4, 20)
  code: string;

  @IsDateString()
  expiresAt: string;
}
