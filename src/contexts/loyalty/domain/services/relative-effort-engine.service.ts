import { Injectable } from '@nestjs/common';

@Injectable()
export class RelativeEffortEngine {
  // Boost acumulativo por tier: Tier1=0%, Tier2=+5%, Tier3=+10%
  private readonly TIER_BOOST: Record<number, number> = { 1: 0, 2: 0.05, 3: 0.10 };

  /**
   * Puntos de Confianza = (monto / ticket_promedio_local) * 10 * (1 + tierBoost)
   *
   * Tier 1 (LOW):    sin boost   → factor 1.00
   * Tier 2 (MEDIUM): +5% boost   → factor 1.05
   * Tier 3 (HIGH):   +10% boost  → factor 1.10
   */
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
