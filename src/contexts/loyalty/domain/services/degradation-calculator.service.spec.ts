import { DegradationCalculator } from './degradation-calculator.service';

describe('DegradationCalculator', () => {
  const calc = new DegradationCalculator();
  const now = new Date('2025-01-15T12:00:00Z');

  it('uses 30 days when there is no previous transaction', () => {
    const { degradationDueDate, avgFrequencyDays } = calc.calculate(null, null, now);
    const expectedDays = 30;
    const diff = (degradationDueDate.getTime() - now.getTime()) / 86_400_000;
    expect(diff).toBeCloseTo(expectedDays, 0);
    expect(avgFrequencyDays).toBe(30);
  });

  it('uses MAX(30, freq*2) when frequency < 15 days', () => {
    const lastTx = new Date('2025-01-10T12:00:00Z');
    const { degradationDueDate } = calc.calculate(lastTx, 5, now);
    const diff = (degradationDueDate.getTime() - now.getTime()) / 86_400_000;
    expect(diff).toBeCloseTo(30, 0);
  });

  it('uses freq*2 when frequency > 15 days', () => {
    const lastTx = new Date('2024-12-16T12:00:00Z');
    const { degradationDueDate } = calc.calculate(lastTx, 30, now);
    const diff = (degradationDueDate.getTime() - now.getTime()) / 86_400_000;
    expect(diff).toBeGreaterThan(30);
  });
});
