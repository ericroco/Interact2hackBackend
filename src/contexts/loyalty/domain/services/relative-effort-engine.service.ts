import { Injectable } from '@nestjs/common';

@Injectable()
export class RelativeEffortEngine {
  /**
   * Puntos de Confianza = (monto / ticket_promedio_local) * 10
   *
   * Si averageTicket es 0 (local nuevo sin historial), el primer ticket del local
   * se toma como referencia base: se ganan exactamente 10 puntos.
   */
  calculate(amount: number, averageTicket: number): number {
    const divisor = averageTicket > 0 ? averageTicket : amount;
    return (amount / divisor) * 10;
  }

  /**
   * Media exponencial ponderada para actualizar el ticket promedio del local.
   * alpha=0.1 da más peso al historial que a la transacción nueva.
   */
  updateAverageTicket(currentAverage: number, newAmount: number, alpha = 0.1): number {
    if (currentAverage === 0) return newAmount;
    return alpha * newAmount + (1 - alpha) * currentAverage;
  }
}
