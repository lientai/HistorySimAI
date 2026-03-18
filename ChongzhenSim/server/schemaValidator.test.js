const {
  validateStoryData,
  validateMinisterChatData,
  parseAndValidateStory,
  parseAndValidateMinisterChat
} = require('./schemaValidator');

const validParagraphs = [
  '这是第一段剧情内容，描述了早朝的场景和氛围。',
  '这是第二段剧情内容，描述了大臣们的议论和反应。',
  '这是第三段剧情内容，描述了皇帝的决策和旨意。',
  '这是第四段剧情内容，描述了朝堂的整体气氛。'
];

const validHeader = {
  time: '崇祯三年四月初一',
  season: '春季',
  weather: '桃花雪',
  location: '乾清宫'
};

const validChoices = [
  { id: 'choice1', text: '选项一：增加赋税', hint: '提示一' },
  { id: 'choice2', text: '选项二：削减开支', hint: '提示二' },
  { id: 'choice3', text: '选项三：暂缓决策', hint: '提示三' }
];

describe('Schema Validator', () => {
  describe('validateStoryData', () => {
    it('should validate a valid story object', () => {
      const data = {
        header: validHeader,
        storyParagraphs: validParagraphs,
        choices: validChoices
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when header is missing', () => {
      const data = {
        storyParagraphs: validParagraphs,
        choices: validChoices
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('header'))).toBe(true);
    });

    it('should fail when storyParagraphs has less than 4 items', () => {
      const data = {
        header: validHeader,
        storyParagraphs: ['这是第一段剧情内容，描述了场景。', '这是第二段剧情内容，描述了反应。'],
        choices: validChoices
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 4'))).toBe(true);
    });

    it('should fail when choices has less than 3 items', () => {
      const data = {
        header: validHeader,
        storyParagraphs: validParagraphs,
        choices: [
          { id: 'c1', text: '选项一：增加赋税' }
        ]
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 3'))).toBe(true);
    });

    it('should fail when choices has more than 3 items', () => {
      const data = {
        header: validHeader,
        storyParagraphs: validParagraphs,
        choices: [
          { id: 'c1', text: '选项一：增加赋税' },
          { id: 'c2', text: '选项二：削减开支' },
          { id: 'c3', text: '选项三：暂缓决策' },
          { id: 'c4', text: '选项四：其他方案' }
        ]
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at most 3'))).toBe(true);
    });

    it('should validate effects with loyalty changes', () => {
      const data = {
        header: validHeader,
        storyParagraphs: validParagraphs,
        lastChoiceEffects: {
          treasury: 100000,
          loyalty: { bi_ziyan: 5, wen_tiren: -3 }
        },
        choices: [
          { id: 'c1', text: '选项一：增加赋税', effects: { treasury: 50000, loyalty: { bi_ziyan: 2 } } },
          { id: 'c2', text: '选项二：削减开支' },
          { id: 'c3', text: '选项三：暂缓决策' }
        ]
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(true);
    });

    it('should fail when loyalty delta exceeds limits', () => {
      const data = {
        header: validHeader,
        storyParagraphs: validParagraphs,
        lastChoiceEffects: {
          loyalty: { bi_ziyan: 30 }
        },
        choices: validChoices
      };
      const result = validateStoryData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('<= 20'))).toBe(true);
    });
  });

  describe('validateMinisterChatData', () => {
    it('should validate a valid minister chat response', () => {
      const data = {
        reply: '陛下圣明，臣定当竭尽全力。',
        loyaltyDelta: 1
      };
      const result = validateMinisterChatData(data);
      expect(result.valid).toBe(true);
    });

    it('should fail when reply is missing', () => {
      const data = {
        loyaltyDelta: 1
      };
      const result = validateMinisterChatData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('reply'))).toBe(true);
    });

    it('should fail when loyaltyDelta exceeds limits', () => {
      const data = {
        reply: '臣领旨。',
        loyaltyDelta: 5
      };
      const result = validateMinisterChatData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('<= 2'))).toBe(true);
    });

    it('should fail when loyaltyDelta is below minimum', () => {
      const data = {
        reply: '臣不敢苟同。',
        loyaltyDelta: -5
      };
      const result = validateMinisterChatData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('>= -2'))).toBe(true);
    });
  });

  describe('parseAndValidateStory', () => {
    it('should parse and validate valid JSON string', () => {
      const raw = JSON.stringify({
        header: validHeader,
        storyParagraphs: validParagraphs,
        choices: validChoices
      });
      const result = parseAndValidateStory(raw);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle JSON wrapped in markdown code block', () => {
      const raw = '```json\n' + JSON.stringify({
        header: validHeader,
        storyParagraphs: validParagraphs,
        choices: validChoices
      }) + '\n```';
      const result = parseAndValidateStory(raw);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should fail on invalid JSON', () => {
      const raw = 'not a valid json';
      const result = parseAndValidateStory(raw);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('JSON parse error'))).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('parseAndValidateMinisterChat', () => {
    it('should parse and validate valid JSON string', () => {
      const raw = JSON.stringify({
        reply: '臣领旨。',
        loyaltyDelta: 1
      });
      const result = parseAndValidateMinisterChat(raw);
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should fail on invalid JSON', () => {
      const raw = 'not a valid json';
      const result = parseAndValidateMinisterChat(raw);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('JSON parse error'))).toBe(true);
      expect(result.data).toBeNull();
    });
  });
});
