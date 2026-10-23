/**
 * LLM 흐름을 LangGraph 그래프로 세운다. 노드마다 할 일이 하나라, 어디서 실패해도 다음 노드가 받아 준다.
 *
 *   readGraph     START → llm ─┬─(성공)→ tidy ─→ END
 *                              └─(실패)→ fallback → END
 *
 *   composeGraph  START → llm ─┬─(성공)→ tidy ─┐
 *                              └─(실패)→ fallback ─┴→ proof → moderate → imagePrompt ─┬─(이미지 모델 켜짐)→ render → END
 *                                                                                    └────────────────────────────→ END
 *
 *   proof    : 맞춤법 교정이 문장을 바꿔 쓰지 않았는지 원문과 견준다. 너무 달라지면 원문을 쓴다
 *   moderate : 낱말 검사 + LLM 판정으로 서가 공개 여부를 정한다. 전시가 멈추면 안 되니
 *              LLM이 없어도 낱말 검사만으로 돌아간다
 *   imagePrompt : LLM이 읽은 장면(무엇)에 시선의 화풍(어떻게, lib/styles.js)을 입혀 이미지 프롬프트를 만든다
 *   render   : IMAGE_PROVIDER 가 켜져 있으면 그 프롬프트로 이미지를 그린다. 실패하면 캔버스 콜라주로 돌아간다
 */
import "server-only";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { cleanTag, cleanText, fallbackCompose, fallbackRead, firstLine, tidySpacing } from "@/lib/fallback";
import { invokeStructured, provider } from "./models";
import { ComposeSchema, ReadSchema, composePrompt, readPrompt } from "./prompts";
import { hasBlocked, scrubPII } from "./moderate";
import { generateImage, imageProvider } from "./imagegen";
import { buildImagePrompt } from "@/lib/styles";

const State = Annotation.Root({
  input: Annotation(),
  raw: Annotation(),
  out: Annotation(),
  source: Annotation(),
  error: Annotation(),
});

const afterLLM = (s) => (s.raw ? "tidy" : "fallback");

// ---------------------------------------------------------------------------
// 6장 — 읽어 내기
// ---------------------------------------------------------------------------

async function readLLM({ input }) {
  if (provider() === "off") return { error: "off" };
  try {
    const { system, user } = await readPrompt({ ...input, count: input.photos.length });
    const raw = await invokeStructured({ system, user, schema: ReadSchema, name: "attic_read", images: input.photos });
    return { raw };
  } catch (e) {
    console.warn("[read] LLM 실패, 대체 문장으로:", e?.message);
    return { error: e?.message || "llm" };
  }
}

function readTidy({ input, raw }) {
  const own = cleanTag(input.emotion);
  // 다이어리 2~3문장 + 시선의 작가가 그 마음을 보는 한 문장까지 담기게
  const story = scrubPII(cleanText(raw.story, 200));
  const photoTags = Array.from(new Set(raw.photoTags.map(cleanTag).filter((t) => t && t !== own))).slice(0, 3);
  if (!story || hasBlocked(story)) return readFallback({ input });
  return { out: { story, photoTags: input.photos.length ? photoTags : [] }, source: "llm" };
}

function readFallback({ input }) {
  return { out: fallbackRead({ ...input, count: input.photos.length }), source: "fallback" };
}

export const readGraph = new StateGraph(State)
  .addNode("llm", readLLM)
  .addNode("tidy", readTidy)
  .addNode("fallback", readFallback)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", afterLLM, ["tidy", "fallback"])
  .addEdge("tidy", END)
  .addEdge("fallback", END)
  .compile();

// ---------------------------------------------------------------------------
// 7장 — 작품 라벨
// ---------------------------------------------------------------------------

async function composeLLM({ input }) {
  if (provider() === "off") return { error: "off" };
  try {
    const { system, user } = await composePrompt(input);
    const raw = await invokeStructured({ system, user, schema: ComposeSchema, name: "attic_compose", images: input.images });
    return { raw };
  } catch (e) {
    console.warn("[compose] LLM 실패, 기본 문장으로:", e?.message);
    return { error: e?.message || "llm" };
  }
}

function composeTidy({ input, raw }) {
  const own = cleanTag(input.emotion);
  const title = cleanText(raw.title, 20).replace(/[.。]$/, "");
  if (!title) return composeFallback({ input });
  return {
    out: {
      title,
      line: cleanText(raw.line, 40),
      fixed: String(raw.fixed || "").trim().slice(0, 400),
      keywords: Array.from(new Set(raw.keywords.map(cleanTag).filter((t) => t && t !== own))).slice(0, 4),
      letter: (raw.letter || []).map((l) => cleanText(l, 90)).filter(Boolean).slice(0, 3),
      relation: cleanText(raw.relation, 100),
      scene: cleanText(raw.scene, 400),
      motifs: raw.motifs.map((m) => cleanText(m, 40)).filter(Boolean).slice(0, 3),
      publishable: raw.publishable,
    },
    source: "llm",
  };
}

function composeFallback({ input }) {
  return { out: fallbackCompose(input), source: "fallback" };
}

/** 편지가 세 문장보다 짧게 왔으면 기본 편지로 채운다. 결과 화면의 편지가 비지 않게 */
function letterGuard(out, input) {
  return out.letter?.length >= 3 ? out : { ...out, letter: fallbackCompose({ ...input, answer: out.fixed || input.answer }).letter };
}

/** 공백과 문장 부호를 뺀 두 글이 얼마나 같은지 (0~1). 레벤슈타인 거리로 잰다 */
export function sameness(a, b) {
  const x = String(a || "").replace(/[\s.,!?~·'"…]/g, "");
  const y = String(b || "").replace(/[\s.,!?~·'"…]/g, "");
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

function proof({ input, out }) {
  const original = input.answer || "";
  // 맞춤법만 고쳤다면 글자는 거의 그대로다. 85%보다 덜 같으면 모델이 문장을 바꿔 쓴 것으로 보고 원문을 쓴다
  const fixed = out.fixed && sameness(out.fixed, original) >= 0.85 ? out.fixed : tidySpacing(original);
  const norm = (s) => String(s || "").replace(/\s/g, "");
  // 작품에 새길 한 줄은 관객의 글 안에 있는 구절이어야 한다
  const line = out.line && norm(fixed).includes(norm(out.line).replace(/…$/, "")) ? out.line : firstLine(fixed);
  return { out: { ...out, fixed: scrubPII(fixed), line: scrubPII(line) } };
}

function moderate({ input, out }) {
  const blocked = hasBlocked([out.fixed, out.title, out.line].join(" "));
  const o = letterGuard(out, input);
  // 편지에 걸리는 낱말이 섞였으면 기본 편지로 바꾼다(편지는 관객 본인만 보지만 그래도)
  const letter = hasBlocked(o.letter.join(" ")) ? fallbackCompose(input).letter : o.letter.map(scrubPII);
  return { out: { ...o, letter, publishable: out.publishable !== false && !blocked } };
}

function imagePrompt({ input, out }) {
  const { prompt, negative } = buildImagePrompt({
    artist: input.artist,
    emotion: input.emotion,
    scene: out.scene,
    motifs: out.motifs,
    relation: out.relation,
  });
  return { out: { ...out, image: { prompt, negative } } };
}

// 공개하지 않을 작품에는 이미지를 그리지 않는다(비용도, 위험한 이미지도 만들지 않게)
const afterPrompt = (s) => (imageProvider() !== "off" && s.out.publishable ? "render" : END);

async function render({ input, out }) {
  try {
    const url = await generateImage({ ...out.image, images: input.images });
    return { out: { ...out, image: { ...out.image, url } } };
  } catch (e) {
    console.warn("[render] 이미지 생성 실패, 캔버스 콜라주로:", e?.message);
    return {};
  }
}

export const composeGraph = new StateGraph(State)
  .addNode("llm", composeLLM)
  .addNode("tidy", composeTidy)
  .addNode("fallback", composeFallback)
  .addNode("proof", proof)
  .addNode("moderate", moderate)
  .addNode("imagePrompt", imagePrompt)
  .addNode("render", render)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", afterLLM, ["tidy", "fallback"])
  .addEdge("tidy", "proof")
  .addEdge("fallback", "proof")
  .addEdge("proof", "moderate")
  .addEdge("moderate", "imagePrompt")
  .addConditionalEdges("imagePrompt", afterPrompt, ["render", END])
  .addEdge("render", END)
  .compile();
