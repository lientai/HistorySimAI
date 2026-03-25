import { describe, it, expect } from 'vitest';
import {
  applyEffects,
  getTreasuryStatus,
  getGrainStatus,
  getMoraleStatus,
  getBorderStatus,
  getCorruptionStatus,
  getPhaseLabel,
  getNextPhase,
  shouldIncrementDay,
  formatTreasury,
  formatGrain,
  clamp,
  calculateLoyaltyDelta
} from './effectsProcessor.js';


describe('applyEffects', () => {
  it('should return unchanged state when effects is null', () => {
    const nation = { treasury: 500000, grain: 30000 };
    const loyalty = { bi_ziyan: 50 };
    const result = applyEffects(nation, null, loyalty);
    expect(result.nation).toEqual(nation);
    expect(result.loyalty).toEqual(loyalty);
  });

  it('should apply treasury effects correctly', () => {
    const nation = { treasury: 500000 };
    const effects = { treasury: 100000 };
    const result = applyEffects(nation, effects, {});
    expect(result.nation.treasury).toBe(600000);
  });

  it('should not allow negative treasury', () => {
    const nation = { treasury: 100000 };
    const effects = { treasury: -200000 };
    const result = applyEffects(nation, effects, {});
    expect(result.nation.treasury).toBe(0);
  });

  it('should apply grain effects correctly', () => {
    const nation = { grain: 30000 };
    const effects = { grain: 10000 };
    const result = applyEffects(nation, effects, {});
    expect(result.nation.grain).toBe(40000);
  });

  it('should clamp percent values between 0 and 100', () => {
    const nation = { militaryStrength: 90 };
    const effects = { militaryStrength: 20 };
    const result = applyEffects(nation, effects, {});
    expect(result.nation.militaryStrength).toBe(100);
  });

  it('should clamp delta to max 30 for percent values', () => {
    const nation = { militaryStrength: 50 };
    const effects = { militaryStrength: 50 };
    const result = applyEffects(nation, effects, {});
    expect(result.nation.militaryStrength).toBe(80);
  });

  it('should apply loyalty effects correctly', () => {
    const loyalty = { bi_ziyan: 50 };
    const effects = { loyalty: { bi_ziyan: 10 } };
    const result = applyEffects({}, effects, loyalty);
    expect(result.loyalty.bi_ziyan).toBe(60);
  });

  it('should clamp loyalty between 0 and 100', () => {
    const loyalty = { bi_ziyan: 95 };
    const effects = { loyalty: { bi_ziyan: 10 } };
    const result = applyEffects({}, effects, loyalty);
    expect(result.loyalty.bi_ziyan).toBe(100);
  });

  it('should clamp loyalty delta to max 20', () => {
    const loyalty = { bi_ziyan: 50 };
    const effects = { loyalty: { bi_ziyan: 30 } };
    const result = applyEffects({}, effects, loyalty);
    expect(result.loyalty.bi_ziyan).toBe(70);
  });
});

describe('getTreasuryStatus', () => {
  it('should return 极度充裕 for treasury >= 5000000', () => {
    expect(getTreasuryStatus(6000000)).toBe('极度充裕');
  });

  it('should return 充裕 for treasury >= 1000000', () => {
    expect(getTreasuryStatus(2000000)).toBe('充裕');
  });

  it('should return 一般 for treasury >= 300000', () => {
    expect(getTreasuryStatus(500000)).toBe('一般');
  });

  it('should return 紧张 for treasury >= 100000', () => {
    expect(getTreasuryStatus(150000)).toBe('紧张');
  });

  it('should return 极度空虚 for treasury < 100000', () => {
    expect(getTreasuryStatus(50000)).toBe('极度空虚');
  });
});

describe('getGrainStatus', () => {
  it('should return correct status based on grain level', () => {
    expect(getGrainStatus(150000)).toBe('极度充裕');
    expect(getGrainStatus(60000)).toBe('充裕');
    expect(getGrainStatus(30000)).toBe('一般');
    expect(getGrainStatus(15000)).toBe('紧张');
    expect(getGrainStatus(5000)).toBe('极度空虚');
  });
});

describe('getMoraleStatus', () => {
  it('should return correct status based on morale level', () => {
    expect(getMoraleStatus(80)).toBe('民心归附');
    expect(getMoraleStatus(60)).toBe('民心尚可');
    expect(getMoraleStatus(40)).toBe('民心不稳');
    expect(getMoraleStatus(20)).toBe('民怨沸腾');
  });
});

describe('getBorderStatus', () => {
  it('should return correct status based on border threat', () => {
    expect(getBorderStatus(80)).toBe('边患严重');
    expect(getBorderStatus(60)).toBe('边患尚可');
    expect(getBorderStatus(40)).toBe('边境安稳');
    expect(getBorderStatus(20)).toBe('边境太平');
  });
});

describe('getCorruptionStatus', () => {
  it('should return correct status based on corruption level', () => {
    expect(getCorruptionStatus(80)).toBe('贪腐横行');
    expect(getCorruptionStatus(60)).toBe('贪腐尚可');
    expect(getCorruptionStatus(40)).toBe('吏治清明');
    expect(getCorruptionStatus(20)).toBe('吏治严明');
  });
});

describe('getPhaseLabel', () => {
  it('should return correct Chinese label for each phase', () => {
    expect(getPhaseLabel('morning')).toBe('早朝');
    expect(getPhaseLabel('afternoon')).toBe('午后');
    expect(getPhaseLabel('evening')).toBe('夜间');
  });

  it('should return the input if phase is unknown', () => {
    expect(getPhaseLabel('unknown')).toBe('unknown');
  });
});

describe('getNextPhase', () => {
  it('should return next phase in sequence', () => {
    expect(getNextPhase('morning')).toBe('afternoon');
    expect(getNextPhase('afternoon')).toBe('evening');
    expect(getNextPhase('evening')).toBe('morning');
  });
});

describe('shouldIncrementDay', () => {
  it('should return true only for evening phase', () => {
    expect(shouldIncrementDay('morning')).toBe(false);
    expect(shouldIncrementDay('afternoon')).toBe(false);
    expect(shouldIncrementDay('evening')).toBe(true);
  });
});

describe('formatTreasury', () => {
  it('should format treasury with locale string and unit', () => {
    expect(formatTreasury(1000000)).toBe('1,000,000两');
    expect(formatTreasury(500)).toBe('500两');
  });
});

describe('formatGrain', () => {
  it('should format grain with locale string and unit', () => {
    expect(formatGrain(30000)).toBe('30,000石');
    expect(formatGrain(100)).toBe('100石');
  });
});

describe('clamp', () => {
  it('should clamp value within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });
});

describe('calculateLoyaltyDelta', () => {
  it('should calculate new loyalty with clamping', () => {
    expect(calculateLoyaltyDelta(50, 10)).toBe(60);
    expect(calculateLoyaltyDelta(95, 10)).toBe(100);
    expect(calculateLoyaltyDelta(10, -20)).toBe(0);
  });

  it('should clamp delta to max 20', () => {
    expect(calculateLoyaltyDelta(50, 30)).toBe(70);
    expect(calculateLoyaltyDelta(50, -30)).toBe(30);
  });
});
