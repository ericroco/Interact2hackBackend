import { Injectable } from '@nestjs/common';

@Injectable()
export class RelativeEffortEngine {
  private readonly TIER_BOOST: Record<number, number> = { 1: 0, 2: 0.05, 3: 0.10 };

  calculate(amount: number, averageTicket: number, tierLevel = 1): number {
    const divisor = averageTicket > 0 ? averageTicket : amount;
    const boost = this.TIER_BOOST[tierLevel] ?? 0;
    return (amount / divisor) * 10 * (1 + boost);
  }

  updateAverageTicket(currentAverage: number, newAmount: number, alpha = 0.1): number {
    if (currentAverage === 0) return newAmount;
    return alpha * newAmount + (1 - alpha) * currentAverage;
  }
}
