import { CouponValueCalculator } from './coupon-value-calculator.service';

describe('CouponValueCalculator', () => {
  const calc = new CouponValueCalculator();

  it('uses 18% of avgTicket for a mid-range merchant', () => {
    expect(calc.calculate(10, 1)).toBe(1.80);
  });

  it('floors to tier minimum for very low-ticket merchant', () => {
    expect(calc.calculate(2, 1)).toBe(0.50);
  });

  it('caps to tier maximum for high-ticket merchant', () => {
    expect(calc.calculate(50, 1)).toBe(2.00);
  });

  it('applies higher tier bounds for tier 3', () => {
    expect(calc.calculate(20, 3)).toBe(3.60);
  });

  it('floors tier 2 for low-ticket merchant', () => {
    expect(calc.calculate(3, 2)).toBe(1.00);
  });

  it('rounds to 2 decimal places', () => {
    expect(calc.calculate(7, 1)).toBe(1.26);
  });
});
