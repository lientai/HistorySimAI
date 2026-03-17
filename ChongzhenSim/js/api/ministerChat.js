import { getState } from "../state.js";

export async function requestMinisterReply(ministerId, history) {
  const state = getState();
  const config = state.config || {};
  const apiBase = (config.apiBase || "").replace(/\/$/, "");
  if (!apiBase) {
    console.error("ministerChat apiBase not configured");
    return null;
  }

  const url = `${apiBase}/api/chongzhen/ministerChat`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ministerId,
        history,
        currentQuarterFocus: state.currentQuarterFocus || null,
        currentQuarterAgenda: state.currentQuarterAgenda || [],
        customPolicies: state.customPolicies || [],
      }),
    });
  } catch (e) {
    console.error("requestMinisterReply fetch error", e);
    return null;
  }

  let payloadText;
  try {
    payloadText = await res.text();
  } catch (e) {
    console.error("requestMinisterReply read body error", e);
    return null;
  }

  if (!res.ok) {
    console.error("requestMinisterReply non-ok", res.status, payloadText);
    return null;
  }

  let data;
  try {
    data = JSON.parse(payloadText);
  } catch (e) {
    console.error("requestMinisterReply invalid json", e, payloadText);
    return null;
  }

  if (!data || typeof data.reply !== "string") {
    console.error("requestMinisterReply invalid shape", data);
    return null;
  }

  const loyaltyDelta =
    typeof data.loyaltyDelta === "number" && Number.isFinite(data.loyaltyDelta)
      ? Math.max(-2, Math.min(2, Math.round(data.loyaltyDelta)))
      : undefined;
  return { reply: data.reply, loyaltyDelta };
}
