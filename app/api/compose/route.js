import { ARTISTS } from "@/lib/attic";
import { composeGraph } from "@/lib/server/graphs";
import { body, guard, json } from "@/lib/server/http";

/**
 * POST /api/compose  { emotion, artist, answer, hints, photos, images: [썸네일 data URL, 최대 3장] }
 *   → { fixed, line, title, keywords, relation, note, scene, motifs, publishable,
 *       image: { prompt, negative, url? }, source }
 *   image.url 은 IMAGE_PROVIDER 가 켜져 있고 생성에 성공했을 때만 온다
 *
 * 콜라주는 브라우저 캔버스가 그리고, 여기서는 작품 라벨을 쓴다.
 * LangGraph의 composeGraph가 LLM → 다듬기 → 맞춤법 검증 → 공개 거르기 → 이미지 프롬프트 → (이미지 생성) 순으로 지난다.
 */
export async function POST(req) {
  const b = await body(req);
  const artist = ARTISTS[b?.artist] ? b.artist : null;
  const emotion = String(b?.emotion || "").trim().slice(0, 24);
  if (!artist || !emotion) return json({ error: "감정과 시선이 필요합니다" }, 400);

  const blocked = await guard(req, "compose");
  if (blocked) return blocked;

  const input = {
    emotion,
    artist,
    answer: String(b.answer || "").trim().slice(0, 400),
    // 6장에서 다락방이 적어 준 이야기(reading.story). 편지에서 관객이 쓴 말과 비중을 나눌 때 쓴다
    story: String(b.story || "").trim().slice(0, 400),
    hints: (Array.isArray(b.hints) ? b.hints : []).map((t) => String(t).slice(0, 12)).slice(0, 6),
    photos: Math.max(0, Math.min(3, Number(b.photos) || 0)),
    // 장면을 읽고 이미지를 다시 그릴 때 참고하는 썸네일. 크기를 넘는 것은 버린다
    images: (Array.isArray(b.images) ? b.images : []).filter((u) => typeof u === "string" && u.length < 200_000).slice(0, 3),
  };
  const { out, source } = await composeGraph.invoke({ input });
  return json({ ...out, source });
}
