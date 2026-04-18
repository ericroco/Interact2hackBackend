import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class CreateAcquisitionCouponDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  value: number;

  @IsString()
  @IsNotEmpty()
  @Length(4, 20)
  code: string;

  @IsDateString()
  expiresAt: string;
}
