import { IsBoolean } from 'class-validator';

export class ToggleLoyaltyDto {
  @IsBoolean()
  enabled: boolean;
}
