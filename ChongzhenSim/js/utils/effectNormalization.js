export const EFFECT_KEY_ALIASES = {
  silver: "treasury",
  money: "treasury",
  gold: "treasury",
  fund: "treasury",
  funds: "treasury",
  taels: "treasury",
  liang: "treasury",
  silverTaels: "treasury",
  currency: "treasury",
  "国库": "treasury",
  "库银": "treasury",
  "白银": "treasury",
  "银两": "treasury",
  "银子": "treasury",
  "现银": "treasury",
  "饷银": "treasury",
  "帑银": "treasury",
  "钱款": "treasury",
  food: "grain",
  grainReserve: "grain",
  grainStock: "grain",
  foodSupply: "grain",
  rations: "grain",
  provisions: "grain",
  "粮食": "grain",
  "粮储": "grain",
  "粮草": "grain",
  "军粮": "grain",
  "漕粮": "grain",
  "存粮": "grain",
  "粮仓": "grain",
  "米粮": "grain",
  "口粮": "grain",
  "赈粮": "grain",
};

export function normalizeResourceEffectEntries(rawEffects, parseValue) {
  const source = rawEffects && typeof rawEffects === "object" && !Array.isArray(rawEffects) ? rawEffects : {};
  const normalized = { ...source };
  const nestedNation = source.nation && typeof source.nation === "object" && !Array.isArray(source.nation)
    ? source.nation
    : null;

  const addEntry = (rawKey, value) => {
    const parsedValue = typeof parseValue === "function" ? parseValue(value) : value;
    if (parsedValue == null) return;
    const canonicalKey = EFFECT_KEY_ALIASES[rawKey] || rawKey;
    normalized[canonicalKey] = (typeof normalized[canonicalKey] === "number" ? normalized[canonicalKey] : 0) + parsedValue;
  };

  if (nestedNation) {
    Object.entries(nestedNation).forEach(([key, value]) => addEntry(key, value));
    delete normalized.nation;
  }

  Object.entries(source).forEach(([key, value]) => {
    if (key === "nation") return;
    if (!Object.prototype.hasOwnProperty.call(EFFECT_KEY_ALIASES, key)) return;
    addEntry(key, value);
    delete normalized[key];
  });

  return normalized;
}