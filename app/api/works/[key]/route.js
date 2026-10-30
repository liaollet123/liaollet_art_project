import { getWork, removeItem, ticketInfo } from "@/lib/server/db";
import { destroyImages } from "@/lib/server/cloud";
import { readDevice } from "@/lib/server/device";
import { json } from "@/lib/server/http";

/** GET /api/works/102101-2 → { work }  공유 링크(/?work=...)로 들어온 사람에게 그 작품을 연다 */
export async function GET(_req, { params }) {
  const { key } = await params;
  const work = /^[\d-]{6,12}$/.test(key) ? await getWork(key) : null;
  return work ? json({ work }) : json({ error: "작품을 찾지 못했어요" }, 404);
}

/**
 * DELETE /api/works/2610301 → { ok }  1장 "내 작품 펼치기"에서 자기 작품을 지운다(되돌릴 수 없다).
 * 서명(아이디)은 누구나 알 수 있으니 이름으로는 지우게 하지 않는다. 그 작품 번호를 받은 기기의 쿠키일 때만 지운다.
 * 표의 줄과 Cloudinary의 사진·콜라주가 함께 사라진다. 이미 쓴 하루 기회는 돌아오지 않는다(번호는 그대로 남는다)
 */
export async function DELETE(req, { params }) {
  const { key } = await params;
  const device = readDevice(req);
  if (!device) return json({ error: "이 기기에서 만든 작품만 지울 수 있어요" }, 403);
  const work = /^\d{6,12}$/.test(key) ? await getWork(key) : null;
  if (!work) return json({ error: "작품을 찾지 못했어요" }, 404);
  const info = await ticketInfo(work.key);
  if (!info?.device || info.device !== device) return json({ error: "이 기기에서 만든 작품만 지울 수 있어요" }, 403);

  const gone = await removeItem(work.id);
  if (!gone) return json({ error: "이미 지워졌어요" }, 404);
  // 사진 지우기가 실패해도 작품은 이미 서가에서 내려갔다. Cloudinary 쪽은 destroyImages 가 조용히 넘긴다
  await destroyImages([gone.collage, ...(gone.source || [])]);
  console.info(`[works] 작품 ${work.key} 을 만든 기기가 지웠어요`);
  return json({ ok: true });
}
