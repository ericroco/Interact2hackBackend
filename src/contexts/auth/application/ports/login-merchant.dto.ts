import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginMerchantDto {
  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
