import { likeWork } from "@/lib/server/db";
import { body, ipLimit, json } from "@/lib/server/http";

/**
 * POST /api/likes { id, on } → { likes }  공감 누르기(on: true)/빼기(on: false). 수는 표의 likes 칸에 남는다.
 * 같은 사람이 여러 번 누르는 것은 브라우저가 기억해 막고, 서버는 한 IP가 쏟아붓는 것만 막는다
 */
export async function POST(req) {
  if (!(await ipLimit(req, "like", 600))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  const b = await body(req);
  if (!/^\d{1,12}$/.test(String(b?.id || ""))) return json({ error: "잘못된 요청" }, 400);
  const likes = await likeWork(String(b.id), b.on ? 1 : -1);
  return likes == null ? json({ error: "작품을 찾지 못했어요" }, 404) : json({ likes });
}
