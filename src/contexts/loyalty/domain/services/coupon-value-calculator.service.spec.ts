import { CouponValueCalculator } from './coupon-value-calculator.service';

describe('CouponValueCalculator', () => {
  const calc = new CouponValueCalculator();

  it('uses 18% of avgTicket for a mid-range merchant', () => {
    // avg=$10, tier1 → 10*0.18=$1.80, within [$0.50,$2.00]
    expect(calc.calculate(10, 1)).toBe(1.80);
  });

  it('floors to tier minimum for very low-ticket merchant', () => {
    // avg=$2, tier1 → 2*0.18=$0.36 < $0.50 → $0.50
    expect(calc.calculate(2, 1)).toBe(0.50);
  });

  it('caps to tier maximum for high-ticket merchant', () => {
    // avg=$50, tier1 → 50*0.18=$9.00 > $2.00 → $2.00
    expect(calc.calculate(50, 1)).toBe(2.00);
  });

  it('applies higher tier bounds for tier 3', () => {
    // avg=$20, tier3 → 20*0.18=$3.60, within [$1.50,$5.00]
    expect(calc.calculate(20, 3)).toBe(3.60);
  });

  it('floors tier 2 for low-ticket merchant', () => {
    // avg=$3, tier2 → 3*0.18=$0.54 < $1.00 → $1.00
    expect(calc.calculate(3, 2)).toBe(1.00);
  });

  it('rounds to 2 decimal places', () => {
    // avg=$7, tier1 → 7*0.18=$1.26
    expect(calc.calculate(7, 1)).toBe(1.26);
  });
});
