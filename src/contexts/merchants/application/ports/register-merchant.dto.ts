import { IsNotEmpty, IsString, IsUUID, Length, Matches } from 'class-validator';

export class RegisterMerchantDto {
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  businessName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,13}$/, { message: 'ruc must be 10-13 digits' })
  ruc: string;
}
