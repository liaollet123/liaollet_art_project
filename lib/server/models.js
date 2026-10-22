// 서버에서만 쓴다. API 키가 브라우저 번들에 섞이지 않도록 route handler와 그래프에서만 import 한다.
//
// 모델 호출은 이 파일 하나로 모은다. 그래프(lib/server/graphs.js)는 어느 모델인지 모르고
// "이 스키마(zod)에 맞는 JSON을 달라"고만 한다.
//   Gemini — LangChain의 ChatGoogleGenerativeAI + withStructuredOutput
import "server-only";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * LLM_PROVIDER=gemini | off
 * 키가 없으면 "off" — 그래프가 키워드 방식으로 대체한다.
 */
export function provider() {
  const want = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (want === "off") return "off";
  return process.env.GEMINI_API_KEY ? "gemini" : "off";
}

// 전시장 와이파이에서 관객을 오래 세워 둘 수 없다. 이 안에 못 끝내면 포기하고 대체한다
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 12000);

/** "data:image/jpeg;base64,..." 만 받는다. 다른 형식은 모델에 보내지 않는다 */
function splitDataURL(u) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(u || ""));
  return m ? { mime: m[1], data: m[2], url: u } : null;
}

/**
 * system/user 프롬프트와 사진을 보내고, zod 스키마에 맞는 객체를 돌려받는다.
 * 실패하면 예외를 던진다. 대체 경로는 그래프가 책임진다.
 */
export async function invokeStructured({ system, user, schema, name, images = [] }) {
  const p = provider();
  if (p === "off") throw new Error("LLM 키가 설정되지 않았습니다");
  const imgs = images.map(splitDataURL).filter(Boolean);
  const raw = await viaGemini({ system, user, schema, name, imgs });
  // 모델이 스키마를 어겨도 화면까지 흘러가지 않게 한 번 더 검사한다
  return schema.parse(raw);
}

let gemini;
async function viaGemini({ system, user, schema, name, imgs }) {
  gemini ??= new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
    maxOutputTokens: 1024,
    maxRetries: 1,
  });
  const chain = gemini.withStructuredOutput(schema, { name });
  const content = [...imgs.map((i) => ({ type: "image_url", image_url: i.url })), { type: "text", text: user }];
  return chain.invoke([new SystemMessage(system), new HumanMessage({ content })], { signal: AbortSignal.timeout(TIMEOUT_MS) });
}
