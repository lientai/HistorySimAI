import { isRigidMode } from "./config.js";

export function validateRigidDecision(state, decisionText, triggerConfig = {}) {
  if (!isRigidMode(state)) {
    return { ok: false, reason: "not_rigid_mode", message: "当前不是困难模式。" };
  }

  const rigid = state.rigid;
  if (!rigid) {
    return { ok: false, reason: "missing_rigid_state", message: "困难状态未初始化。" };
  }

  if (rigid.court?.strikeState) {
    return { ok: false, reason: "strike", message: "朝政停摆，无法施政。" };
  }

  const text = String(decisionText || "");
  const banned = Array.isArray(triggerConfig.forbiddenTechKeywords) ? triggerConfig.forbiddenTechKeywords : [];
  const hitKeyword = banned.find((keyword) => text.includes(keyword));
  if (hitKeyword) {
    return { ok: false, reason: "forbidden_tech", message: `禁止项触发：${hitKeyword}` };
  }

  return { ok: true };
}

