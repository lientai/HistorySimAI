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
      appointments: state.appointments || {},
      characterStatus: state.characterStatus || {},
    },
  };
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
  console.log("[requestStoryTurn] Raw LLM response:", raw);
  if (!res.ok) {
    console.error("requestStoryTurn non-ok", res.status, raw);
    return null;
  }

  const parsed = parseLLMContent(raw);
  console.log("[requestStoryTurn] LLM response parsed:", JSON.stringify(parsed, null, 2));
  if (!parsed || !parsed.storyParagraphs || !Array.isArray(parsed.choices) || parsed.choices.length < 3) {
    console.error("requestStoryTurn invalid shape", parsed);
    return null;
  }

  return {
    header: parsed.header || {},
    storyParagraphs: parsed.storyParagraphs,
    choices: parsed.choices.slice(0, 3),
    lastChoiceEffects: parsed.lastChoiceEffects || null,
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
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}
