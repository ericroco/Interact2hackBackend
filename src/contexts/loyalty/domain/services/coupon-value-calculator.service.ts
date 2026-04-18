import { Injectable } from '@nestjs/common';

@Injectable()
export class CouponValueCalculator {
  /**
   * Valor del cupón = averageTicket * cashbackPct
   * Acotado por subsidyCapPct para garantizar sostenibilidad de la plataforma.
   *
   * couponValue = min(averageTicket * cashbackPct, averageTicket * subsidyCapPct)
   *
   * Ejemplo — Restaurante, Tier 2:
   *   averageTicket=$25, cashbackPct=0.12, subsidyCapPct=0.04
   *   raw = 25 * 0.12 = $3.00
   *   cap = 25 * 0.04 = $1.00  ← se aplica el cap
   *   couponValue = $1.00
   *
   * Ejemplo — Electrónica, Tier 3:
   *   averageTicket=$200, cashbackPct=0.04, subsidyCapPct=0.01
   *   raw = 200 * 0.04 = $8.00
   *   cap = 200 * 0.01 = $2.00 ← se aplica el cap
   *   couponValue = $2.00
   */
  calculate(averageTicket: number, cashbackPct: number, subsidyCapPct: number): number {
    const raw = averageTicket * cashbackPct;
    const cap = averageTicket * subsidyCapPct;
    const value = Math.min(raw, cap);
    return Math.round(value * 100) / 100;
  }
}
