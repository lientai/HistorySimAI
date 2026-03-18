const STORY_SCHEMA = {
  type: "object",
  required: ["header", "storyParagraphs", "choices"],
  properties: {
    header: {
      type: "object",
      required: ["time", "season", "weather"],
      properties: {
        time: { type: "string", minLength: 1 },
        season: { type: "string", minLength: 1 },
        weather: { type: "string", minLength: 1 },
        location: { type: "string" }
      }
    },
    storyParagraphs: {
      type: "array",
      minItems: 4,
      items: { type: "string", minLength: 10 }
    },
    lastChoiceEffects: {
      type: "object",
      properties: {
        treasury: { type: "number" },
        grain: { type: "number" },
        militaryStrength: { type: "number", minimum: -30, maximum: 30 },
        civilMorale: { type: "number", minimum: -30, maximum: 30 },
        borderThreat: { type: "number", minimum: -30, maximum: 30 },
        disasterLevel: { type: "number", minimum: -30, maximum: 30 },
        corruptionLevel: { type: "number", minimum: -30, maximum: 30 },
        loyalty: {
          type: "object",
          additionalProperties: { type: "number", minimum: -20, maximum: 20 }
        }
      }
    },
    choices: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        required: ["id", "text"],
        properties: {
          id: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
          hint: { type: "string" },
          effects: {
            type: "object",
            properties: {
              treasury: { type: "number" },
              grain: { type: "number" },
              militaryStrength: { type: "number", minimum: -30, maximum: 30 },
              civilMorale: { type: "number", minimum: -30, maximum: 30 },
              borderThreat: { type: "number", minimum: -30, maximum: 30 },
              disasterLevel: { type: "number", minimum: -30, maximum: 30 },
              corruptionLevel: { type: "number", minimum: -30, maximum: 30 },
              loyalty: {
                type: "object",
                additionalProperties: { type: "number", minimum: -20, maximum: 20 }
              }
            }
          }
        }
      }
    },
    news: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "summary"],
        properties: {
          title: { type: "string", minLength: 1 },
          summary: { type: "string", minLength: 1 },
          province: { type: "string" }
        }
      }
    },
    publicOpinion: {
      type: "array",
      items: {
        type: "object",
        required: ["source", "text"],
        properties: {
          source: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 }
        }
      }
    }
  }
};

const MINISTER_CHAT_SCHEMA = {
  type: "object",
  required: ["reply"],
  properties: {
    reply: { type: "string", minLength: 1 },
    loyaltyDelta: { type: "number", minimum: -2, maximum: 2 }
  }
};

function validateSchema(data, schema, path = "") {
  const errors = [];
  
  if (!data && schema.type !== "object") {
    errors.push(`${path}: data is null or undefined`);
    return errors;
  }
  
  if (schema.type === "object") {
    if (typeof data !== "object" || Array.isArray(data)) {
      errors.push(`${path}: expected object, got ${Array.isArray(data) ? "array" : typeof data}`);
      return errors;
    }
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`${path}.${field}: required field missing`);
        }
      }
    }
    
    if (schema.properties) {
      for (const [key, value] of Object.entries(data)) {
        if (schema.properties[key]) {
          errors.push(...validateSchema(value, schema.properties[key], `${path}.${key}`));
        }
      }
    }
    
    if (schema.additionalProperties && data) {
      for (const [key, value] of Object.entries(data)) {
        if (!schema.properties || !schema.properties[key]) {
          errors.push(...validateSchema(value, schema.additionalProperties, `${path}.${key}`));
        }
      }
    }
  }
  
  if (schema.type === "array") {
    if (!Array.isArray(data)) {
      errors.push(`${path}: expected array, got ${typeof data}`);
      return errors;
    }
    
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: array must have at least ${schema.minItems} items, got ${data.length}`);
    }
    
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push(`${path}: array must have at most ${schema.maxItems} items, got ${data.length}`);
    }
    
    if (schema.items) {
      data.forEach((item, index) => {
        errors.push(...validateSchema(item, schema.items, `${path}[${index}]`));
      });
    }
  }
  
  if (schema.type === "string") {
    if (typeof data !== "string") {
      errors.push(`${path}: expected string, got ${typeof data}`);
    } else if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string must be at least ${schema.minLength} characters, got ${data.length}`);
    }
  }
  
  if (schema.type === "number") {
    if (typeof data !== "number" || !Number.isFinite(data)) {
      errors.push(`${path}: expected number, got ${typeof data}`);
    } else {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push(`${path}: number must be >= ${schema.minimum}, got ${data}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push(`${path}: number must be <= ${schema.maximum}, got ${data}`);
      }
    }
  }
  
  return errors;
}

function validateStoryData(data) {
  const errors = validateSchema(data, STORY_SCHEMA, "story");
  return { valid: errors.length === 0, errors };
}

function validateMinisterChatData(data) {
  const errors = validateSchema(data, MINISTER_CHAT_SCHEMA, "ministerChat");
  return { valid: errors.length === 0, errors };
}

function parseAndValidateStory(raw) {
  let data;
  try {
    let str = (raw || "").trim();
    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) str = codeBlockMatch[1].trim();
    data = JSON.parse(str);
  } catch (e) {
    return { valid: false, errors: [`JSON parse error: ${e.message}`], data: null };
  }
  
  const result = validateStoryData(data);
  return { ...result, data };
}

function parseAndValidateMinisterChat(raw) {
  let data;
  try {
    let str = (raw || "").trim();
    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) str = codeBlockMatch[1].trim();
    data = JSON.parse(str);
  } catch (e) {
    return { valid: false, errors: [`JSON parse error: ${e.message}`], data: null };
  }
  
  const result = validateMinisterChatData(data);
  return { ...result, data };
}

module.exports = {
  STORY_SCHEMA,
  MINISTER_CHAT_SCHEMA,
  validateSchema,
  validateStoryData,
  validateMinisterChatData,
  parseAndValidateStory,
  parseAndValidateMinisterChat
};
