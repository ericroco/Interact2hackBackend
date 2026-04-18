import { RelativeEffortEngine } from './relative-effort-engine.service';

describe('RelativeEffortEngine', () => {
  const engine = new RelativeEffortEngine();

  describe('calculate', () => {
    it('awards 10 pts when spending exactly the average ticket', () => {
      expect(engine.calculate(50, 50)).toBe(10);
    });

    it('awards more pts when spending above average', () => {
      expect(engine.calculate(100, 50)).toBe(20);
    });

    it('awards fewer pts when spending below average', () => {
      expect(engine.calculate(25, 50)).toBe(5);
    });

    it('awards 10 pts when averageTicket is 0 (new merchant — uses amount as divisor)', () => {
      expect(engine.calculate(80, 0)).toBe(10);
    });
  });

  describe('updateAverageTicket', () => {
    it('returns the amount itself when current average is 0', () => {
      expect(engine.updateAverageTicket(0, 100)).toBe(100);
    });

    it('applies exponential weighted average', () => {
      const result = engine.updateAverageTicket(50, 100);
      expect(result).toBeCloseTo(55, 5);
    });
  });
});
