import { describe, it, expect, beforeEach } from 'vitest';
import {
  getState,
  setState,
  resetState,
  initializeAppointments,
  initializeCharacterStatus,
  getAliveCharacters,
  getDeadCharacters,
  getCharacterByPosition,
  appointCharacter,
  removeCharacterFromPosition,
  markCharacterDead,
  isCharacterAlive,
} from './state.js';

const mockPositions = [
  { id: 'neige_shoufu', name: '内阁首辅', defaultHolder: 'wen_tiren' },
  { id: 'libu_shangshu', name: '吏部尚书', defaultHolder: 'wang_yongguang' },
  { id: 'hubu_shangshu', name: '户部尚书', defaultHolder: 'bi_ziyan' },
  { id: 'bingbu_shangshu', name: '兵部尚书', defaultHolder: null },
];

const mockCharacters = [
  { id: 'wen_tiren', name: '温体仁', isAlive: true, deathReason: null, deathDay: null },
  { id: 'wang_yongguang', name: '王永光', isAlive: true, deathReason: null, deathDay: null },
  { id: 'bi_ziyan', name: '毕自严', isAlive: true, deathReason: null, deathDay: null },
  { id: 'sun_chengzong', name: '孙承宗', isAlive: true, deathReason: null, deathDay: null },
  { id: 'yuan_chonghuan', name: '袁崇焕', isAlive: false, deathReason: '凌迟处死', deathDay: 3 },
];

describe('initializeAppointments', () => {
  beforeEach(() => {
    resetState();
  });

  it('should initialize appointments from positions with defaultHolder', () => {
    const appointments = initializeAppointments(mockPositions, mockCharacters);
    
    expect(appointments['neige_shoufu']).toBe('wen_tiren');
    expect(appointments['libu_shangshu']).toBe('wang_yongguang');
    expect(appointments['hubu_shangshu']).toBe('bi_ziyan');
    expect(appointments['bingbu_shangshu']).toBeUndefined();
  });

  it('should not include positions without defaultHolder', () => {
    const appointments = initializeAppointments(mockPositions, mockCharacters);
    
    expect(appointments).not.toHaveProperty('bingbu_shangshu');
  });
});

describe('initializeCharacterStatus', () => {
  beforeEach(() => {
    resetState();
  });

  it('should initialize character status from characters data', () => {
    const status = initializeCharacterStatus(mockCharacters);
    
    expect(status['wen_tiren']).toEqual({
      isAlive: true,
      deathReason: null,
      deathDay: null,
    });
    expect(status['yuan_chonghuan']).toEqual({
      isAlive: false,
      deathReason: '凌迟处死',
      deathDay: 3,
    });
  });

  it('should update state.characterStatus', () => {
    initializeCharacterStatus(mockCharacters);
    const state = getState();
    
    expect(state.characterStatus['wen_tiren']).toBeDefined();
    expect(state.characterStatus['yuan_chonghuan']).toBeDefined();
  });
});

describe('appointCharacter', () => {
  beforeEach(() => {
    resetState();
    initializeAppointments(mockPositions, mockCharacters);
  });

  it('should appoint a character to a position', () => {
    const result = appointCharacter('bingbu_shangshu', 'sun_chengzong');
    
    expect(result.positionId).toBe('bingbu_shangshu');
    expect(result.newHolder).toBe('sun_chengzong');
    expect(result.oldHolder).toBeUndefined();
  });

  it('should replace existing holder when appointing to occupied position', () => {
    const result = appointCharacter('neige_shoufu', 'sun_chengzong');
    
    expect(result.oldHolder).toBe('wen_tiren');
    expect(result.newHolder).toBe('sun_chengzong');
    
    const state = getState();
    expect(state.appointments['neige_shoufu']).toBe('sun_chengzong');
  });

  it('should update state.appointments', () => {
    appointCharacter('bingbu_shangshu', 'sun_chengzong');
    const state = getState();
    
    expect(state.appointments['bingbu_shangshu']).toBe('sun_chengzong');
  });
});

describe('removeCharacterFromPosition', () => {
  beforeEach(() => {
    resetState();
    initializeAppointments(mockPositions, mockCharacters);
  });

  it('should remove character from position', () => {
    const result = removeCharacterFromPosition('neige_shoufu');
    
    expect(result.positionId).toBe('neige_shoufu');
    expect(result.oldHolder).toBe('wen_tiren');
    
    const state = getState();
    expect(state.appointments['neige_shoufu']).toBeUndefined();
  });

  it('should return undefined oldHolder for empty position', () => {
    const result = removeCharacterFromPosition('bingbu_shangshu');
    
    expect(result.oldHolder).toBeUndefined();
  });
});

describe('getCharacterByPosition', () => {
  beforeEach(() => {
    resetState();
    initializeAppointments(mockPositions, mockCharacters);
    setState({ ministers: mockCharacters });
  });

  it('should return character for occupied position', () => {
    const character = getCharacterByPosition('neige_shoufu');
    
    expect(character).toBeDefined();
    expect(character.id).toBe('wen_tiren');
    expect(character.name).toBe('温体仁');
  });

  it('should return null for empty position', () => {
    const character = getCharacterByPosition('bingbu_shangshu');
    
    expect(character).toBeNull();
  });

  it('should return null for non-existent position', () => {
    const character = getCharacterByPosition('non_existent_position');
    
    expect(character).toBeNull();
  });
});

describe('markCharacterDead', () => {
  beforeEach(() => {
    resetState();
    initializeAppointments(mockPositions, mockCharacters);
    initializeCharacterStatus(mockCharacters);
  });

  it('should mark character as dead', () => {
    const result = markCharacterDead('wen_tiren', '病逝', 100);
    
    expect(result.isAlive).toBe(false);
    expect(result.deathReason).toBe('病逝');
    expect(result.deathDay).toBe(100);
  });

  it('should remove dead character from all appointments', () => {
    markCharacterDead('wen_tiren', '病逝', 100);
    const state = getState();
    
    expect(state.appointments['neige_shoufu']).toBeUndefined();
  });

  it('should update characterStatus', () => {
    markCharacterDead('wen_tiren', '病逝', 100);
    const state = getState();
    
    expect(state.characterStatus['wen_tiren'].isAlive).toBe(false);
    expect(state.characterStatus['wen_tiren'].deathReason).toBe('病逝');
  });
});

describe('isCharacterAlive', () => {
  beforeEach(() => {
    resetState();
    initializeCharacterStatus(mockCharacters);
  });

  it('should return true for alive character', () => {
    expect(isCharacterAlive('wen_tiren')).toBe(true);
    expect(isCharacterAlive('wang_yongguang')).toBe(true);
  });

  it('should return false for dead character', () => {
    expect(isCharacterAlive('yuan_chonghuan')).toBe(false);
  });

  it('should return true for unknown character (default alive)', () => {
    expect(isCharacterAlive('unknown_character')).toBe(true);
  });
});

describe('getAliveCharacters', () => {
  beforeEach(() => {
    resetState();
    initializeCharacterStatus(mockCharacters);
  });

  it('should return only alive characters', () => {
    const alive = getAliveCharacters(mockCharacters);
    
    expect(alive.length).toBe(4);
    expect(alive.find(c => c.id === 'wen_tiren')).toBeDefined();
    expect(alive.find(c => c.id === 'yuan_chonghuan')).toBeUndefined();
  });
});

describe('getDeadCharacters', () => {
  beforeEach(() => {
    resetState();
    initializeCharacterStatus(mockCharacters);
  });

  it('should return only dead characters', () => {
    const dead = getDeadCharacters(mockCharacters);
    
    expect(dead.length).toBe(1);
    expect(dead[0].id).toBe('yuan_chonghuan');
  });
});

describe('integration: appointment and death', () => {
  beforeEach(() => {
    resetState();
    initializeAppointments(mockPositions, mockCharacters);
    initializeCharacterStatus(mockCharacters);
    setState({ ministers: mockCharacters });
  });

  it('should handle full appointment lifecycle', () => {
    expect(getCharacterByPosition('neige_shoufu').id).toBe('wen_tiren');
    
    const result = appointCharacter('neige_shoufu', 'sun_chengzong');
    expect(result.oldHolder).toBe('wen_tiren');
    expect(result.newHolder).toBe('sun_chengzong');
    
    expect(getCharacterByPosition('neige_shoufu').id).toBe('sun_chengzong');
    
    markCharacterDead('sun_chengzong', '殉国', 200);
    
    expect(getCharacterByPosition('neige_shoufu')).toBeNull();
    expect(isCharacterAlive('sun_chengzong')).toBe(false);
  });

  it('should handle character death while holding multiple positions', () => {
    appointCharacter('neige_shoufu', 'sun_chengzong');
    appointCharacter('bingbu_shangshu', 'sun_chengzong');
    
    const state = getState();
    expect(state.appointments['neige_shoufu']).toBe('sun_chengzong');
    expect(state.appointments['bingbu_shangshu']).toBe('sun_chengzong');
    
    markCharacterDead('sun_chengzong', '殉国', 200);
    
    const newState = getState();
    expect(newState.appointments['neige_shoufu']).toBeUndefined();
    expect(newState.appointments['bingbu_shangshu']).toBeUndefined();
  });
});
