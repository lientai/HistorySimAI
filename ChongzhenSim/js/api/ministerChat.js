import { getState } from "../state.js";
import { buildMinisterChatRequestBody } from "./requestContext.js";
import { getApiBase, postJsonAndReadText } from "./httpClient.js";
import { parseMinisterReplyPayload } from "./validators.js";

function getRosterCharacters(state) {
  return Array.isArray(state?.allCharacters) && state.allCharacters.length
    ? state.allCharacters
    : (state?.ministers || []);
}

export async function requestMinisterReply(ministerId, history) {
  const state = getState();
  const config = state.config || {};
  const apiBase = getApiBase(config, "requestMinisterReply");
  if (!apiBase) return null;

  const url = `${apiBase}/api/chongzhen/ministerChat`;

  const body = buildMinisterChatRequestBody(state, ministerId, history);
  const payloadText = await postJsonAndReadText(url, body, "requestMinisterReply");
  if (payloadText == null) return null;

  const parsed = parseMinisterReplyPayload(payloadText, {
    positions: state.positionsMeta?.positions || [],
    ministers: getRosterCharacters(state),
  });
  if (!parsed.ok) {
    if (parsed.reason === "invalid-json") {
      console.error("requestMinisterReply invalid json", parsed.error, parsed.data);
    } else {
      console.error("requestMinisterReply invalid shape", parsed.data);
    }
    return null;
  }

  return parsed.value;
}
