import { getWork } from "@/lib/server/db";
import { json } from "@/lib/server/http";

/** GET /api/works/102101-2 → { work }  공유 링크(/?work=...)로 들어온 사람에게 그 작품을 연다 */
export async function GET(_req, { params }) {
  const { key } = await params;
  const work = /^[\d-]{6,12}$/.test(key) ? await getWork(key) : null;
  return work ? json({ work }) : json({ error: "작품을 찾지 못했어요" }, 404);
}
