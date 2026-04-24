function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(text) {
  return String(text || "").replace(/\s+/g, "");
}

function toPattern(text) {
  return escapeRegExp(compactText(text));
}

function splitActionClauses(text) {
  return String(text || "")
    .split(/[，；。！？\n]+|(?=(?:并|并且|同时|另行|另|再|仍|并命)?(?:任命|擢升|擢任|改任|命|着|免去|罢免|革去|撤去|免职|去职|撤职|赐死|赐予自尽|赐自尽|赐予|自尽|饮鸩|毒酒))/)
    .map((part) => compactText(part))
    .filter(Boolean);
}

function buildCurrentHolderByPosition(currentAppointments) {
  const source = currentAppointments && typeof currentAppointments === "object" ? currentAppointments : {};
  const map = {};
  Object.entries(source).forEach(([positionId, characterId]) => {
    if (typeof positionId !== "string" || typeof characterId !== "string") return;
    if (!positionId.trim() || !characterId.trim()) return;
    map[positionId.trim()] = characterId.trim();
  });
  return map;
}

function buildCurrentPositionByCharacter(currentAppointments) {
  const byPosition = buildCurrentHolderByPosition(currentAppointments);
  const map = {};
  Object.entries(byPosition).forEach(([positionId, characterId]) => {
    map[characterId] = positionId;
  });
  return map;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalizePositionText(value) {
  const raw = normalizeString(value);
  if (!raw) return "";
  let text = compactText(raw);
  text = text.replace(/督察院/g, "都察院");
  text = text.replace(/^都察院/, "");
  return text;
}

function buildAlternation(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((value) => escapeRegExp(value))
    .join("|");
}

function buildPositionResolvers(positions) {
  const byId = new Map();
  const byName = new Map();
  const byCanonicalName = new Map();
  const aliasesById = new Map();
  (Array.isArray(positions) ? positions : []).forEach((position) => {
    const id = normalizeString(position?.id);
    const name = normalizeString(position?.name);
    if (id) byId.set(id, id);
    if (name) byName.set(name, id || name);
    const canonicalName = canonicalizePositionText(name);
    if (canonicalName) byCanonicalName.set(canonicalName, id || name);
    const aliases = new Set();
    if (name) aliases.add(compactText(name));
    if (canonicalName) aliases.add(canonicalName);
    if (id) aliasesById.set(id || name, Array.from(aliases).filter(Boolean));
  });

  return {
    resolvePositionId(raw) {
      const text = normalizeString(raw);
      if (!text) return "";
      if (byId.has(text)) return byId.get(text);
      if (byName.has(text)) return byName.get(text);
      const canonical = canonicalizePositionText(text);
      if (!canonical) return "";
      if (byCanonicalName.has(canonical)) return byCanonicalName.get(canonical);

      let bestId = "";
      let bestLen = 0;
      for (const [nameKey, id] of byCanonicalName.entries()) {
        if (!nameKey) continue;
        if (canonical.includes(nameKey) || nameKey.includes(canonical)) {
          if (nameKey.length > bestLen) {
            bestLen = nameKey.length;
            bestId = id;
          }
        }
      }
      if (bestId) return bestId;
      return "";
    },
    getPositionAliases() {
      return aliasesById;
    },
  };
}

function buildMinisterResolvers(ministers) {
  const byId = new Map();
  const byName = new Map();
  const aliasesById = new Map();
  (Array.isArray(ministers) ? ministers : []).forEach((minister) => {
    const id = normalizeString(minister?.id);
    const name = normalizeString(minister?.name);
    if (id) byId.set(id, id);
    if (name) byName.set(name, id || name);
    const aliases = new Set();
    if (name) aliases.add(compactText(name));
    if (id) aliasesById.set(id || name, Array.from(aliases).filter(Boolean));
  });

  return {
    resolveMinisterId(raw) {
      const text = normalizeString(raw);
      if (!text) return "";
      if (byId.has(text)) return byId.get(text);
      if (byName.has(text)) return byName.get(text);
      return "";
    },
    getMinisterAliases() {
      return aliasesById;
    },
  };
}

function collectRegexMatches(text, regex) {
  const matches = [];
  if (!text || !(regex instanceof RegExp)) return matches;
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    matches.push(match);
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
    match = regex.exec(text);
  }
  return matches;
}

export function normalizeAppointmentEffects(effects, context = {}) {
  if (!effects || typeof effects !== "object" || Array.isArray(effects)) return effects;

  const { resolvePositionId } = buildPositionResolvers(context.positions || []);
  const { resolveMinisterId } = buildMinisterResolvers(context.ministers || []);

  const next = { ...effects };

  if (next.appointments && typeof next.appointments === "object" && !Array.isArray(next.appointments)) {
    const normalizedAppointments = {};
    Object.entries(next.appointments).forEach(([rawPosition, rawMinister]) => {
      const positionId = resolvePositionId(rawPosition);
      const ministerId = resolveMinisterId(rawMinister);
      if (!positionId || !ministerId) return;
      normalizedAppointments[positionId] = ministerId;
    });
    if (Object.keys(normalizedAppointments).length) next.appointments = normalizedAppointments;
    else delete next.appointments;
  }

  if (Array.isArray(next.appointmentDismissals)) {
    const normalizedDismissals = Array.from(
      new Set(
        next.appointmentDismissals
          .map((raw) => resolvePositionId(raw))
          .filter(Boolean)
      )
    );
    if (normalizedDismissals.length) next.appointmentDismissals = normalizedDismissals;
    else delete next.appointmentDismissals;
  }

  return next;
}

export function deriveAppointmentEffectsFromText(edictText, context = {}) {
  const text = compactText(edictText);
  if (!text) return null;

  const ministers = Array.isArray(context.ministers) ? context.ministers : [];
  const positions = Array.isArray(context.positions) ? context.positions : [];
  const currentAppointments = buildCurrentHolderByPosition(context.currentAppointments);
  const currentPositionByCharacter = buildCurrentPositionByCharacter(context.currentAppointments);
  const { resolvePositionId, getPositionAliases } = buildPositionResolvers(positions);
  const { resolveMinisterId, getMinisterAliases } = buildMinisterResolvers(ministers);

  const appointMap = {};
  const dismissSet = new Set();
  const deathMap = {};

  const appointKeyword = "(?:任命|擢升|擢任|改任|命|着)";
  const dismissKeyword = "(?:免去|罢免|革去|撤去|免职|去职|撤职)";
  const deathKeyword = "(?:赐死|赐予自尽|赐自尽|赐予|自尽|饮鸩|毒酒)";
  const relationKeyword = "(?:为|任|出任|担任|署理|兼任|转任|掌|仍掌)";
  const ministerPattern = buildAlternation(
    Array.from(getMinisterAliases().values()).flat()
  );
  const positionPattern = buildAlternation(
    Array.from(getPositionAliases().values()).flat()
  );

  if (!ministerPattern || !positionPattern) return null;

  const clauses = splitActionClauses(edictText);

  let lastMentionedMinisterIds = [];

  clauses.forEach((clause) => {
    if (!clause) return;

    const clauseAppointments = {};
    const hasAppointKeyword = new RegExp(appointKeyword).test(clause);
    const hasDismissKeyword = new RegExp(dismissKeyword).test(clause);
    const hasDeathKeyword = new RegExp(deathKeyword).test(clause);
    const mentionedMinisterIds = collectRegexMatches(clause, new RegExp(`(${ministerPattern})`, "g"))
      .map((match) => resolveMinisterId(match[1]))
      .filter(Boolean);

    if (hasDeathKeyword) {
      const deathTargets = mentionedMinisterIds.length ? mentionedMinisterIds : lastMentionedMinisterIds;
      deathTargets.forEach((ministerId) => {
        if (ministerId) deathMap[ministerId] = "赐死";
      });
    }

    const hasExplicitAppointmentPair = new RegExp(`(${ministerPattern})(?:${relationKeyword})(${positionPattern})`).test(clause);

    if (hasAppointKeyword || (hasExplicitAppointmentPair && !hasDismissKeyword && !hasDeathKeyword)) {
      const pairRegex = new RegExp(`(${ministerPattern})(?:${relationKeyword})(${positionPattern})`, "g");
      collectRegexMatches(clause, pairRegex).forEach((match) => {
        const ministerId = resolveMinisterId(match[1]);
        const positionId = resolvePositionId(match[2]);
        if (!ministerId || !positionId) return;
        clauseAppointments[positionId] = ministerId;
      });

      if (!Object.keys(clauseAppointments).length) {
        const loosePairRegex = new RegExp(`(?:${appointKeyword})(${ministerPattern})(?:${positionPattern})`, "g");
        collectRegexMatches(clause, loosePairRegex).forEach((match) => {
          const ministerId = resolveMinisterId(match[1]);
          const chunk = match[0].replace(new RegExp(`^(?:${appointKeyword})`), "").replace(match[1], "");
          const positionId = resolvePositionId(chunk);
          if (!ministerId || !positionId) return;
          clauseAppointments[positionId] = ministerId;
        });
      }
    }

    Object.entries(clauseAppointments).forEach(([positionId, ministerId]) => {
      appointMap[positionId] = ministerId;
    });

    if (hasDismissKeyword) {
      const positionRegex = new RegExp(`(${positionPattern})`, "g");
      collectRegexMatches(clause, positionRegex).forEach((match) => {
        const positionId = resolvePositionId(match[1]);
        if (positionId && !clauseAppointments[positionId]) dismissSet.add(positionId);
      });

      const ministerRegex = new RegExp(`(${ministerPattern})`, "g");
      collectRegexMatches(clause, ministerRegex).forEach((match) => {
        const ministerId = resolveMinisterId(match[1]);
        const currentPositionId = currentPositionByCharacter[ministerId];
        if (currentPositionId && !clauseAppointments[currentPositionId]) dismissSet.add(currentPositionId);
      });
    }

    if (mentionedMinisterIds.length) {
      lastMentionedMinisterIds = Array.from(new Set(mentionedMinisterIds));
    }
  });

  // If the same position is both dismissed and appointed in one edict, keep the appointment result only.
  Object.keys(appointMap).forEach((positionId) => dismissSet.delete(positionId));

  const appointmentDismissals = Array.from(dismissSet);
  if (!Object.keys(appointMap).length && !appointmentDismissals.length && !Object.keys(deathMap).length) return null;

  const next = {};
  if (Object.keys(appointMap).length) next.appointments = appointMap;
  if (appointmentDismissals.length) next.appointmentDismissals = appointmentDismissals;
  if (Object.keys(deathMap).length) next.characterDeath = deathMap;
  return next;
}
