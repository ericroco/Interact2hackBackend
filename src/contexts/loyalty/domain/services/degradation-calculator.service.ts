import { Injectable } from '@nestjs/common';

const MIN_INACTIVITY_DAYS = 30;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class DegradationCalculator {
  calculate(
    lastTransactionAt: Date | null,
    currentAvgFrequencyDays: number | null,
    now: Date,
  ): { degradationDueDate: Date; avgFrequencyDays: number } {
    let avgFrequencyDays: number;

    if (!lastTransactionAt) {
      avgFrequencyDays = MIN_INACTIVITY_DAYS;
    } else {
      const daysSinceLast = (now.getTime() - lastTransactionAt.getTime()) / MS_PER_DAY;
      avgFrequencyDays =
        currentAvgFrequencyDays == null
          ? daysSinceLast
          : 0.2 * daysSinceLast + 0.8 * currentAvgFrequencyDays;
    }

    const inactivityDays = Math.max(MIN_INACTIVITY_DAYS, avgFrequencyDays * 2);
    const degradationDueDate = new Date(now.getTime() + inactivityDays * MS_PER_DAY);

    return { degradationDueDate, avgFrequencyDays };
  }
}
