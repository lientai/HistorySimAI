function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(text) {
  return String(text || "").replace(/\s+/g, "");
}

function toPattern(text) {
  return escapeRegExp(compactText(text));
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

function buildPositionResolvers(positions) {
  const byId = new Map();
  const byName = new Map();
  const byCanonicalName = new Map();
  (Array.isArray(positions) ? positions : []).forEach((position) => {
    const id = normalizeString(position?.id);
    const name = normalizeString(position?.name);
    if (id) byId.set(id, id);
    if (name) byName.set(name, id || name);
    const canonicalName = canonicalizePositionText(name);
    if (canonicalName) byCanonicalName.set(canonicalName, id || name);
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
  };
}

function buildMinisterResolvers(ministers) {
  const byId = new Map();
  const byName = new Map();
  (Array.isArray(ministers) ? ministers : []).forEach((minister) => {
    const id = normalizeString(minister?.id);
    const name = normalizeString(minister?.name);
    if (id) byId.set(id, id);
    if (name) byName.set(name, id || name);
  });

  return {
    resolveMinisterId(raw) {
      const text = normalizeString(raw);
      if (!text) return "";
      if (byId.has(text)) return byId.get(text);
      if (byName.has(text)) return byName.get(text);
      return "";
    },
  };
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

  const appointMap = {};
  const dismissSet = new Set();
  const deathMap = {};

  const appointKeyword = "(?:任命|擢升|擢任|改任|出任|署理|兼任|命)";
  const dismissKeyword = "(?:免去|罢免|革去|撤去|免职|去职|撤职)";
  const deathKeyword = "(?:赐死|赐予自尽|赐自尽|赐予|自尽|饮鸩|毒酒)";

  positions.forEach((position) => {
    if (!position || typeof position.id !== "string" || typeof position.name !== "string") return;
    const positionId = position.id.trim();
    const positionName = position.name.trim();
    if (!positionId || !positionName) return;

    const posPattern = toPattern(positionName);
    const dismissByPosition = new RegExp(`${dismissKeyword}.{0,10}${posPattern}|${posPattern}.{0,8}${dismissKeyword}`);
    if (dismissByPosition.test(text)) {
      dismissSet.add(positionId);
    }

    ministers.forEach((minister) => {
      if (!minister || typeof minister.id !== "string" || typeof minister.name !== "string") return;
      const characterId = minister.id.trim();
      const characterName = minister.name.trim();
      if (!characterId || !characterName) return;

      const charPattern = toPattern(characterName);

      const appointPattern = new RegExp(
        `${appointKeyword}.{0,10}${charPattern}.{0,8}(?:为|任|出任|担任)?${posPattern}|${charPattern}.{0,8}${appointKeyword}.{0,8}(?:为|任|出任|担任)?${posPattern}|${charPattern}.{0,4}(?:为|任|出任|担任)${posPattern}`
      );
      if (appointPattern.test(text)) {
        appointMap[positionId] = characterId;
      }

      const dismissByPersonAndPosition = new RegExp(
        `${dismissKeyword}.{0,8}${charPattern}.{0,8}${posPattern}|${charPattern}.{0,8}${dismissKeyword}.{0,8}${posPattern}`
      );
      if (dismissByPersonAndPosition.test(text)) {
        dismissSet.add(positionId);
      }
    });
  });

  ministers.forEach((minister) => {
    if (!minister || typeof minister.id !== "string" || typeof minister.name !== "string") return;
    const characterId = minister.id.trim();
    const characterName = minister.name.trim();
    if (!characterId || !characterName) return;

    const currentPositionId = currentPositionByCharacter[characterId];
    if (!currentPositionId) return;

    const charPattern = toPattern(characterName);
    const dismissByPerson = new RegExp(`${dismissKeyword}.{0,8}${charPattern}|${charPattern}.{0,8}${dismissKeyword}`);
    if (dismissByPerson.test(text)) {
      dismissSet.add(currentPositionId);
    }

    // Death pattern: "赐死 官员名" or "官员名 赐死" (within 2 characters to stay within same action clause)
    const deathPattern = new RegExp(`${deathKeyword}.{0,2}${charPattern}|${charPattern}.{0,2}${deathKeyword}`);
    if (deathPattern.test(text)) {
      deathMap[characterId] = "赐死";
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
