export async function requestStoryTurn(state, lastChoice) {
  const config = state.config || {};
  const apiBase = (config.apiBase || "").replace(/\/$/, "");
  if (!apiBase) return null;

  const url = `${apiBase}/api/chongzhen/story`;
  const body = {
    state: {
      currentDay: state.currentDay,
      currentPhase: state.currentPhase,
      currentMonth: state.currentMonth,
      currentYear: state.currentYear,
      nation: state.nation || {},
      prestige: state.prestige,
      executionRate: state.executionRate,
    },
  };
  if (Array.isArray(state.currentQuarterAgenda) && state.currentQuarterAgenda.length) {
    body.currentQuarterAgenda = state.currentQuarterAgenda;
  }
  if (state.currentQuarterFocus) {
    body.currentQuarterFocus = state.currentQuarterFocus;
  }
  if (state.playerAbilities) {
    body.playerAbilities = state.playerAbilities;
  }
  if (Array.isArray(state.unlockedPolicies) && state.unlockedPolicies.length) {
    body.unlockedPolicies = state.unlockedPolicies;
  }
  if (Array.isArray(state.customPolicies) && state.customPolicies.length) {
    body.customPolicies = state.customPolicies;
  }
  if (lastChoice) {
    body.lastChoiceId = lastChoice.id;
    body.lastChoiceText = lastChoice.text;
    if (lastChoice.hint) body.lastChoiceHint = lastChoice.hint;
  }
  const courtChatSummary = buildCourtChatSummary(state);
  if (courtChatSummary) body.courtChatSummary = courtChatSummary;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("requestStoryTurn fetch error", e);
    return null;
  }

  const raw = await res.text();
  if (!res.ok) {
    console.error("requestStoryTurn non-ok", res.status, raw);
    return null;
  }

  const parsed = parseLLMContent(raw);
  if (!parsed || !parsed.storyParagraphs || !Array.isArray(parsed.choices) || parsed.choices.length < 3) {
    console.error("requestStoryTurn invalid shape", {
      rawPreview: raw?.slice?.(0, 200) + (raw?.length > 200 ? "..." : ""),
      rawLength: raw?.length,
      parsed,
      note: "期望 { storyParagraphs: [...], choices: [...] }，至少 3 个 choices",
    });
    return null;
  }

  const phaseKey = state.currentPhase || "morning";
  const phaseLabel = phaseKey === "morning" ? "早朝" : phaseKey === "afternoon" ? "午后" : "夜间";
  const expectedTime = `崇祯${state.currentYear || 1}年${state.currentMonth || 1}月 ${phaseLabel}`;
  const header = { ...(parsed.header || {}) };
  header.time = expectedTime;

  return {
    header,
    storyParagraphs: parsed.storyParagraphs,
    choices: parsed.choices.slice(0, 3),
    news: Array.isArray(parsed.news) ? parsed.news : [],
    publicOpinion: Array.isArray(parsed.publicOpinion) ? parsed.publicOpinion : [],
  };
}

const COURT_CHAT_SUMMARY_MAX_LEN = 800;
const COURT_CHAT_TAKE_PER_MINISTER = 5;

function buildCourtChatSummary(state) {
  const courtChats = state.courtChats || {};
  const ministers = state.ministers || [];
  const nameById = Object.fromEntries(ministers.map((m) => [m.id, m.name || m.id]));
  const parts = [];
  let len = 0;
  for (const [ministerId, list] of Object.entries(courtChats)) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const name = nameById[ministerId] || ministerId;
    const recent = list.slice(-COURT_CHAT_TAKE_PER_MINISTER);
    for (const m of recent) {
      const role = m.from === "player" ? "陛下" : "臣";
      const line = `「${name}」：${role}：${(m.text || "").trim()}`;
      if (len + line.length + 1 > COURT_CHAT_SUMMARY_MAX_LEN) return parts.join("\n").slice(0, COURT_CHAT_SUMMARY_MAX_LEN);
      parts.push(line);
      len += line.length + 1;
    }
  }
  return parts.join("\n");
}

function parseLLMContent(raw) {
  let str = (raw || "").trim();
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) str = codeBlockMatch[1].trim();

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  };

  const normalize = (s) => {
    let t = s;

    // 智能引号 / 全角标点 -> 普通 ASCII
    t = t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    t = t.replace(/，/g, ',').replace(/：/g, ':').replace(/；/g, ';');

    // 去掉 + 前缀数字（JSON 不允许 '+2'）
    t = t.replace(/:\s*\+([0-9]+)/g, ': $1');
    t = t.replace(/\s\+([0-9]+)([\s,}])/g, ' $1$2');

    // 去掉多余的尾随逗号
    t = t.replace(/,\s*([}\]])/g, '$1');

    return t;
  };

  // 1) 优先尝试完整解析
  const normalized = normalize(str);
  let parsed = tryParse(normalized);
  if (parsed) return parsed;

  // 2) 如果 LLM 包了一层字符串
  parsed = tryParse(str);
  if (typeof parsed === 'string') {
    const nested = tryParse(parsed);
    if (nested) return nested;
  }

  // 3) 最后：尝试从文本中提取首个完整 JSON 对象再解析（容忍说明文字、额外文本）
  const findFirstJsonObject = (text) => {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    let begin = -1;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        if (depth === 0) begin = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && begin !== -1) {
          const substr = text.slice(begin, i + 1);
          const candidate = tryParse(normalize(substr));
          if (candidate) return candidate;
        }
      }
    }
    return null;
  };

  parsed = findFirstJsonObject(str);
  if (parsed) return parsed;

  return null;
}
