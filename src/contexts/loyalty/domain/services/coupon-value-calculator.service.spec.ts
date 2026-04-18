import { CouponValueCalculator } from './coupon-value-calculator.service';

describe('CouponValueCalculator', () => {
  const calc = new CouponValueCalculator();

  it('returns raw value when below subsidy cap', () => {
    // avg=$25, pct=0.04, cap=0.04 → raw=$1.00 = cap=$1.00
    expect(calc.calculate(25, 0.04, 0.04)).toBe(1.0);
  });

  it('caps at subsidy cap when cashback_pct exceeds it', () => {
    // avg=$25, pct=0.12, cap=0.04 → raw=$3.00, cap=$1.00 → returns $1.00
    expect(calc.calculate(25, 0.12, 0.04)).toBe(1.0);
  });

  it('scales proportionally with average ticket', () => {
    // Electronics: avg=$200, pct=0.04, cap=0.01 → raw=$8, cap=$2 → $2.00
    expect(calc.calculate(200, 0.04, 0.01)).toBe(2.0);
  });

  it('rounds to 2 decimal places', () => {
    const result = calc.calculate(33, 0.05, 0.10);
    expect(result).toBe(1.65);
  });
});
