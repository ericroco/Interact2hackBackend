import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be a valid E.164 number' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
