import { Injectable } from '@nestjs/common';
import { TierLevel } from '../entities/loyalty-tier.entity';

@Injectable()
export class TierClassificationService {
  isMaxTier(tierLevel: TierLevel): boolean {
    return tierLevel === TierLevel.HIGH;
  }

  nextTier(current: TierLevel): TierLevel {
    if (current === TierLevel.LOW) return TierLevel.MEDIUM;
    if (current === TierLevel.MEDIUM) return TierLevel.HIGH;
    return TierLevel.HIGH;
  }

  downgradeTier(current: TierLevel): TierLevel {
    if (current === TierLevel.HIGH) return TierLevel.MEDIUM;
    if (current === TierLevel.MEDIUM) return TierLevel.LOW;
    return TierLevel.LOW;
  }
}
