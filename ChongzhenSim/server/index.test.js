const request = require('supertest');
const { createApp } = require('./index');

const mockCharactersData = {
  ministers: [
    {
      id: 'bi_ziyan',
      name: '毕自严',
      role: '户部尚书',
      faction: 'donglin',
      factionLabel: '东林党',
      loyalty: 20,
      summary: '毕自严，字景曾，淄川人。万历二十年进士。',
      attitude: '忧心国库空虚，主张节流开源。',
      openingLine: '陛下，户部库房已近见底。'
    },
    {
      id: 'wen_tiren',
      name: '温体仁',
      role: '内阁首辅',
      faction: 'eunuch',
      factionLabel: '阉党余部',
      loyalty: 60,
      summary: '温体仁，字长卿，乌程人。',
      attitude: '处处迎合圣意，暗中排斥东林。',
      openingLine: '陛下英明神武。'
    }
  ]
};

describe('API Endpoints', () => {
  describe('POST /api/chongzhen/story', () => {
    it('should return 500 when LLM_API_KEY is not configured', async () => {
      const { app } = createApp({ 
        config: {}, 
        charactersData: mockCharactersData,
        allowMissingConfig: true 
      });
      
      const res = await request(app)
        .post('/api/chongzhen/story')
        .send({ state: { currentDay: 1, currentPhase: 'morning' } });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('LLM_API_KEY not configured');
    });

    it('should accept valid state object', async () => {
      const { app } = createApp({ 
        config: {}, 
        charactersData: mockCharactersData,
        allowMissingConfig: true 
      });
      
      const res = await request(app)
        .post('/api/chongzhen/story')
        .send({
          state: {
            currentDay: 5,
            currentPhase: 'afternoon',
            nation: {
              treasury: 1000000,
              grain: 50000,
              militaryStrength: 60,
              civilMorale: 50,
              borderThreat: 70,
              disasterLevel: 40,
              corruptionLevel: 60
            }
          },
          lastChoiceId: 'test_choice',
          lastChoiceText: '测试选项'
        });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/chongzhen/ministerChat', () => {
    it('should return 500 when LLM_API_KEY is not configured', async () => {
      const { app } = createApp({ 
        config: {}, 
        charactersData: mockCharactersData,
        allowMissingConfig: true 
      });
      
      const res = await request(app)
        .post('/api/chongzhen/ministerChat')
        .send({ ministerId: 'bi_ziyan', history: [] });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('LLM_API_KEY not configured');
    });

    it('should return 400 when ministerId is missing', async () => {
      const { app } = createApp({ 
        config: { LLM_API_KEY: 'test-key' }, 
        charactersData: mockCharactersData,
        allowMissingConfig: true 
      });
      
      const res = await request(app)
        .post('/api/chongzhen/ministerChat')
        .send({ history: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ministerId is required');
    });

    it('should return 404 when minister is not found', async () => {
      const { app } = createApp({ 
        config: { LLM_API_KEY: 'test-key' }, 
        charactersData: mockCharactersData,
        allowMissingConfig: true 
      });
      
      const res = await request(app)
        .post('/api/chongzhen/ministerChat')
        .send({ ministerId: 'non_existent_minister', history: [] });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('minister not found');
    });

    it('should return 500 when charactersData is not loaded', async () => {
      const { app } = createApp({ 
        config: { LLM_API_KEY: 'test-key' }, 
        charactersData: { ministers: null },
        allowMissingConfig: true 
      });
      
      const res = await request(app)
        .post('/api/chongzhen/ministerChat')
        .send({ ministerId: 'bi_ziyan', history: [] });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('characters.json not loaded');
    });
  });
});

describe('buildUserMessage', () => {
  const createTestApp = () => createApp({ 
    config: {}, 
    charactersData: mockCharactersData,
    allowMissingConfig: true 
  });

  it('should generate correct message for first turn', () => {
    const { buildUserMessage } = createTestApp();
    const body = {
      state: {
        currentDay: 1,
        currentYear: 3,
        currentMonth: 4,
        currentPhase: 'morning',
        weather: '晴',
        nation: {
          treasury: 500000,
          grain: 30000,
          militaryStrength: 60,
          civilMorale: 35,
          borderThreat: 75,
          disasterLevel: 70,
          corruptionLevel: 80
        }
      }
    };
    const message = buildUserMessage(body);
    expect(message).toContain('崇祯3年4月（第1回合）早朝');
    expect(message).toContain('季节=春');
    expect(message).toContain('天气=晴');
    expect(message).toContain('新开档第一回合');
    expect(message).toContain('国库=500,000两');
  });

  it('should generate correct message for subsequent turns', () => {
    const { buildUserMessage } = createTestApp();
    const body = {
      state: {
        currentDay: 2,
        currentYear: 3,
        currentMonth: 7,
        currentPhase: 'afternoon',
        weather: '暴雨',
        nation: {
          treasury: 1000000,
          grain: 50000,
          militaryStrength: 70,
          civilMorale: 60,
          borderThreat: 50,
          disasterLevel: 40,
          corruptionLevel: 50
        }
      },
      lastChoiceId: 'increase_tax',
      lastChoiceText: '加征商税'
    };
    const message = buildUserMessage(body);
    expect(message).toContain('崇祯3年7月（第2回合）午后');
    expect(message).toContain('季节=夏');
    expect(message).toContain('天气=暴雨');
    expect(message).toContain('上一回合陛下选择了');
    expect(message).toContain('increase_tax');
    expect(message).toContain('加征商税');
  });

  it('should include custom edict hint for custom_edict choice', () => {
    const { buildUserMessage } = createTestApp();
    const body = {
      state: {
        currentDay: 3,
        currentPhase: 'evening',
        nation: { treasury: 500000, grain: 30000 }
      },
      lastChoiceId: 'custom_edict',
      lastChoiceText: '自拟诏书内容'
    };
    const message = buildUserMessage(body);
    expect(message).toContain('自拟诏书');
    expect(message).toContain('lastChoiceEffects');
  });

  it('should include court chat summary when provided', () => {
    const { buildUserMessage } = createTestApp();
    const body = {
      state: {
        currentDay: 1,
        currentPhase: 'morning',
        nation: { treasury: 500000 }
      },
      courtChatSummary: '陛下与毕自严讨论了国库问题'
    };
    const message = buildUserMessage(body);
    expect(message).toContain('私下议事记录');
    expect(message).toContain('毕自严');
  });

  it('should include implemented policies context for reasoning', () => {
    const { buildUserMessage } = createTestApp();
    const body = {
      state: {
        currentDay: 2,
        currentYear: 3,
        currentMonth: 4,
        currentPhase: 'morning',
        weather: '晴',
        nation: { treasury: 500000, grain: 30000 }
      },
      unlockedPolicies: ['civil_tax_reform', 'military_border_fort'],
      customPolicies: [{ id: 'cp_1', name: '赈济先行' }],
    };
    const message = buildUserMessage(body);
    expect(message).toContain('已实施国策');
    expect(message).toContain('civil_tax_reform');
    expect(message).toContain('赈济先行');
    expect(message).toContain('纳入全局推理');
  });

  it('should format treasury status correctly', () => {
    const { buildUserMessage } = createTestApp();
    const testCases = [
      { treasury: 6000000, expected: '极度充裕' },
      { treasury: 2000000, expected: '充裕' },
      { treasury: 500000, expected: '一般' },
      { treasury: 150000, expected: '紧张' },
      { treasury: 50000, expected: '极度空虚' }
    ];

    testCases.forEach(({ treasury, expected }) => {
      const body = {
        state: {
          currentDay: 1,
          currentPhase: 'morning',
          nation: { treasury }
        }
      };
      const message = buildUserMessage(body);
      expect(message).toContain(expected);
    });
  });

  it('should format phase labels correctly', () => {
    const { buildUserMessage } = createTestApp();
    const phases = [
      { phase: 'morning', label: '早朝' },
      { phase: 'afternoon', label: '午后' },
      { phase: 'evening', label: '夜间' }
    ];

    phases.forEach(({ phase, label }) => {
      const body = {
        state: { currentDay: 1, currentPhase: phase, nation: {} }
      };
      const message = buildUserMessage(body);
      expect(message).toContain(label);
    });
  });

  it('should include minister list in message', () => {
    const { buildUserMessage } = createTestApp();
    const body = {
      state: {
        currentDay: 1,
        currentPhase: 'morning',
        nation: { treasury: 500000 }
      }
    };
    const message = buildUserMessage(body);
    expect(message).toContain('bi_ziyan');
    expect(message).toContain('毕自严');
  });
});

describe('Appointment API', () => {
  const mockPositionsData = {
    positions: [
      { id: 'neige_shoufu', name: '内阁首辅', department: '内阁' },
      { id: 'libu_shangshu', name: '吏部尚书', department: '吏部' },
      { id: 'hubu_shangshu', name: '户部尚书', department: '户部' },
    ],
    departments: [
      { id: 'neige', name: '内阁' },
      { id: 'libu', name: '吏部' },
      { id: 'hubu', name: '户部' },
    ]
  };

  const createTestAppWithPositions = () => createApp({ 
    config: {}, 
    charactersData: mockCharactersData,
    positionsData: mockPositionsData,
    allowMissingConfig: true 
  });

  describe('GET /api/chongzhen/characters', () => {
    it('should return characters list', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app).get('/api/chongzhen/characters');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.characters).toHaveLength(2);
      expect(res.body.characters[0].id).toBe('bi_ziyan');
    });

    it('should include positions and departments', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app).get('/api/chongzhen/characters');
      expect(res.status).toBe(200);
      expect(res.body.positions).toBeDefined();
      expect(res.body.departments).toBeDefined();
    });
  });

  describe('GET /api/chongzhen/positions', () => {
    it('should return positions list', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app).get('/api/chongzhen/positions');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.positions).toHaveLength(3);
    });

    it('should include departments and ranks', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app).get('/api/chongzhen/positions');
      expect(res.status).toBe(200);
      expect(res.body.departments).toBeDefined();
      expect(res.body.ranks).toBeDefined();
    });
  });

  describe('POST /api/chongzhen/appoint', () => {
    it('should return 400 when positionId is missing', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ characterId: 'bi_ziyan' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('positionId and characterId are required');
    });

    it('should return 400 when characterId is missing', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ positionId: 'neige_shoufu' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('positionId and characterId are required');
    });

    it('should return 404 when position not found', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ positionId: 'non_existent', characterId: 'bi_ziyan' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('position not found');
    });

    it('should return 404 when character not found', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ positionId: 'neige_shoufu', characterId: 'non_existent' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('character not found');
    });

    it('should return 400 when character is dead', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ 
          positionId: 'neige_shoufu', 
          characterId: 'bi_ziyan',
          state: {
            characterStatus: {
              'bi_ziyan': { isAlive: false, deathReason: '病逝', deathDay: 10 }
            }
          }
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('该角色已故，无法任命');
    });

    it('should successfully appoint a character', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ 
          positionId: 'neige_shoufu', 
          characterId: 'bi_ziyan',
          state: { appointments: {} }
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.appointment.positionId).toBe('neige_shoufu');
      expect(res.body.appointment.characterId).toBe('bi_ziyan');
      expect(res.body.appointment.characterName).toBe('毕自严');
    });

    it('should replace existing holder when appointing', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ 
          positionId: 'neige_shoufu', 
          characterId: 'bi_ziyan',
          state: { 
            appointments: { 'neige_shoufu': 'wen_tiren' }
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.appointment.oldHolder).toBe('wen_tiren');
    });

    it('should remove character from old position when moving', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/appoint')
        .send({ 
          positionId: 'neige_shoufu', 
          characterId: 'bi_ziyan',
          state: { 
            appointments: { 'hubu_shangshu': 'bi_ziyan' }
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.appointment.oldPosition).toBe('hubu_shangshu');
      expect(res.body.appointments['hubu_shangshu']).toBeUndefined();
      expect(res.body.appointments['neige_shoufu']).toBe('bi_ziyan');
    });
  });

  describe('POST /api/chongzhen/punish', () => {
    it('should return 400 when characterId is missing', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ action: 'execute' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('characterId and action are required');
    });

    it('should return 400 when action is missing', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ characterId: 'bi_ziyan' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('characterId and action are required');
    });

    it('should return 404 when character not found', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ characterId: 'non_existent', action: 'execute' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('character not found');
    });

    it('should return 400 when character is already dead', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ 
          characterId: 'bi_ziyan', 
          action: 'execute',
          state: {
            characterStatus: {
              'bi_ziyan': { isAlive: false }
            }
          }
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('该角色已故');
    });

    it('should return 400 for invalid action', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ characterId: 'bi_ziyan', action: 'invalid_action' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid action');
    });

    it('should execute character and remove from position', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ 
          characterId: 'bi_ziyan', 
          action: 'execute',
          reason: '贪赃枉法',
          state: {
            currentDay: 100,
            appointments: { 'hubu_shangshu': 'bi_ziyan' }
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('execute');
      expect(res.body.characterId).toBe('bi_ziyan');
      expect(res.body.characterStatus['bi_ziyan'].isAlive).toBe(false);
      expect(res.body.characterStatus['bi_ziyan'].deathReason).toBe('贪赃枉法');
      expect(res.body.characterStatus['bi_ziyan'].deathDay).toBe(100);
      expect(res.body.removedPosition).toBe('hubu_shangshu');
      expect(res.body.appointments['hubu_shangshu']).toBeUndefined();
    });

    it('should exile character and remove from position', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ 
          characterId: 'bi_ziyan', 
          action: 'exile',
          reason: '失职',
          state: {
            appointments: { 'hubu_shangshu': 'bi_ziyan' }
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('exile');
      expect(res.body.characterStatus['bi_ziyan'].exiled).toBe(true);
      expect(res.body.characterStatus['bi_ziyan'].exileReason).toBe('失职');
      expect(res.body.removedPosition).toBe('hubu_shangshu');
    });

    it('should demote character and remove from position', async () => {
      const { app } = createTestAppWithPositions();
      
      const res = await request(app)
        .post('/api/chongzhen/punish')
        .send({ 
          characterId: 'bi_ziyan', 
          action: 'demote',
          state: {
            appointments: { 'hubu_shangshu': 'bi_ziyan' }
          }
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.action).toBe('demote');
      expect(res.body.removedPosition).toBe('hubu_shangshu');
      expect(res.body.appointments['hubu_shangshu']).toBeUndefined();
    });
  });
});
