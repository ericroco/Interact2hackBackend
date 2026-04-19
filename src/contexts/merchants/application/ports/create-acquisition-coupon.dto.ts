import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length, Max, Min } from 'class-validator';

export class CreateAcquisitionCouponDto {
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

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

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quantity?: number;
}
