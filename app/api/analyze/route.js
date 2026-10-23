import { ARTISTS } from "@/lib/attic";
import { readGraph } from "@/lib/server/graphs";
import { body, guard, json } from "@/lib/server/http";

/**
 * POST /api/analyze  { emotion, artist, photos: [작은 jpeg data URL, 최대 3장] }
 *   → { story, photoTags, source: "llm" | "fallback" }
 *
 * 6장의 "다 올렸어요" 꼬리표를 눌렀을 때만 부른다. LangGraph의 readGraph가
 * LLM → 다듬기, 실패하면 대체 문장으로 흐름을 정한다. 무엇이 실패해도 200으로 결과를 준다.
 */
export async function POST(req) {
  const b = await body(req);
  const artist = ARTISTS[b?.artist] ? b.artist : null;
  const emotion = String(b?.emotion || "").trim().slice(0, 24);
  if (!artist || !emotion) return json({ error: "감정과 시선이 필요합니다" }, 400);

  const blocked = await guard(req, "analyze");
  if (blocked) return blocked;

  // 비용을 지키려고 화면에서 줄인 썸네일 세 장까지만 받는다(올린 사진 모두). 큰 원본이 오면 버린다
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter((u) => typeof u === "string" && u.length < 200_000).slice(0, 3);
  const { out, source } = await readGraph.invoke({ input: { emotion, artist, photos } });
  return json({ ...out, source });
}
