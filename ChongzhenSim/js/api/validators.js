function asParagraphArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n{2,}|\r\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function stripEnglishParenAfterChinese(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/([\u4e00-\u9fa5]{2,})\s*[（(]\s*[A-Za-z0-9_\-\s]+\s*[）)]/g, "$1")
    .replace(/([\u4e00-\u9fa5]{2,})\s*[（(]\s*[A-Za-z][A-Za-z0-9_\-\s,:;\.]*\s*[）)]/g, "$1");
}

const EFFECT_DELTA_LIMITS = {
  treasury: 300000,
  grain: 30000,
  militaryStrength: 12,
  civilMorale: 12,
  borderThreat: 12,
  disasterLevel: 12,
  corruptionLevel: 12,
};

function parseNumberish(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/[，,]/g, "")
    .replace(/[＋+]/g, "+")
    .replace(/[－-]/g, "-");
  if (!normalized) return null;
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampDelta(key, value) {
  const limit = EFFECT_DELTA_LIMITS[key];
  if (typeof limit !== "number") return value;
  return Math.max(-limit, Math.min(limit, value));
}

export function sanitizeStoryEffects(effects) {
  if (!effects || typeof effects !== "object" || Array.isArray(effects)) return {};
  const out = { ...effects };

  for (const [key, value] of Object.entries(out)) {
    const numeric = parseNumberish(value);
    if (numeric != null) {
      out[key] = clampDelta(key, numeric);
    }
  }

  if (out.loyalty && typeof out.loyalty === "object" && !Array.isArray(out.loyalty)) {
    const loyalty = {};
    for (const [id, delta] of Object.entries(out.loyalty)) {
      const numeric = parseNumberish(delta);
      if (numeric == null) continue;
      loyalty[id] = Math.max(-10, Math.min(10, numeric));
    }
    out.loyalty = loyalty;
  }

  if (out.hostileDamage && typeof out.hostileDamage === "object" && !Array.isArray(out.hostileDamage)) {
    const hostileDamage = {};
    for (const [targetId, delta] of Object.entries(out.hostileDamage)) {
      const numeric = parseNumberish(delta);
      if (numeric == null) continue;
      hostileDamage[targetId] = Math.max(-25, Math.min(25, numeric));
    }
    out.hostileDamage = hostileDamage;
  }

  return out;
}

function normalizeChoice(item, index) {
  if (!item) return null;
  if (typeof item === "string") {
    return {
      id: `choice_${index + 1}`,
      text: item,
      hint: "",
      effects: {},
    };
  }
  if (typeof item !== "object") return null;

  const text = String(item.text ?? item.title ?? item.name ?? "").trim();
  if (!text) return null;
  return {
    id: String(item.id ?? `choice_${index + 1}`),
    text: stripEnglishParenAfterChinese(text),
    hint: typeof item.hint === "string" ? stripEnglishParenAfterChinese(item.hint) : "",
    effects: sanitizeStoryEffects(item.effects && typeof item.effects === "object" ? item.effects : {}),
  };
}

function buildFallbackStoryChoice(index, state) {
  const nation = state?.nation || {};
  const treasury = nation.treasury || 0;
  const grain = nation.grain || 0;

  if (index === 1) {
    return {
      id: "fallback_relief",
      text: "下旨安抚地方并限额赈济",
      hint: "稳民心、控支出",
      effects: {
        treasury: treasury > 250000 ? -80000 : -30000,
        grain: grain > 12000 ? -6000 : -2000,
        civilMorale: 4,
        unrest: -2,
      },
    };
  }
  if (index === 2) {
    return {
      id: "fallback_admin",
      text: "整饬吏治并核查地方仓库",
      hint: "压贪腐、稳执行",
      effects: {
        corruptionLevel: -4,
        civilMorale: 1,
        treasury: 20000,
      },
    };
  }
  return {
    id: "fallback_military",
    text: "调拨军饷巩固边备",
    hint: "保边患、控军力波动",
    effects: {
      treasury: -120000,
      militaryStrength: 3,
      borderThreat: -3,
    },
  };
}

export function normalizeStoryPayload(parsed, state) {
  if (!parsed || typeof parsed !== "object") return null;

  const storyParagraphs = asParagraphArray(
    parsed.storyParagraphs
      ?? parsed.story
      ?? parsed.narrative
      ?? parsed.content
  ).map((line) => stripEnglishParenAfterChinese(String(line || "")));
  if (!storyParagraphs.length) return null;

  const candidateChoices =
    parsed.choices
    ?? parsed.options
    ?? parsed.decisions
    ?? parsed.actions
    ?? [];

  const choices = asParagraphArray(candidateChoices)
    .map((item, idx) => normalizeChoice(item, idx))
    .filter(Boolean);

  while (choices.length < 3) {
    const fallbackId = choices.length + 1;
    choices.push(buildFallbackStoryChoice(fallbackId, state));
  }

  return {
    header: parsed.header && typeof parsed.header === "object" ? parsed.header : {},
    storyParagraphs,
    choices: choices.slice(0, 3),
    news: Array.isArray(parsed.news) ? parsed.news : [],
    publicOpinion: Array.isArray(parsed.publicOpinion) ? parsed.publicOpinion : [],
  };
}

export function parseMinisterReplyPayload(payloadText) {
  let data;
  try {
    data = JSON.parse(payloadText);
  } catch (e) {
    return { ok: false, reason: "invalid-json", error: e, data: payloadText };
  }

  if (!data || typeof data.reply !== "string") {
    return { ok: false, reason: "invalid-shape", data };
  }

  const loyaltyDelta =
    typeof data.loyaltyDelta === "number" && Number.isFinite(data.loyaltyDelta)
      ? Math.max(-2, Math.min(2, Math.round(data.loyaltyDelta)))
      : undefined;

  return {
    ok: true,
    value: {
      reply: data.reply,
      loyaltyDelta,
    },
  };
}
