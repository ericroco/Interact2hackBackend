import { Injectable } from '@nestjs/common';

@Injectable()
export class CouponValueCalculator {
  private readonly CASHBACK_PCT = 0.18;

  private readonly TIER_BOUNDS: Record<number, { floor: number; cap: number }> = {
    1: { floor: 0.50, cap: 2.00 },
    2: { floor: 1.00, cap: 3.50 },
    3: { floor: 1.50, cap: 5.00 },
  };

  calculate(averageTicket: number, tierLevel: number): number {
    const raw = averageTicket * this.CASHBACK_PCT;
    const bounds = this.TIER_BOUNDS[tierLevel] ?? this.TIER_BOUNDS[1];
    const clamped = Math.min(Math.max(raw, bounds.floor), bounds.cap);
    return Math.round(clamped * 100) / 100;
  }
}
