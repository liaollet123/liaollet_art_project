import { likeWork } from "@/lib/server/db";
import { ensureDevice, setDeviceCookie } from "@/lib/server/device";
import { body, ipLimit, json } from "@/lib/server/http";

/**
 * POST /api/likes { id, on } → { likes }  공감 누르기(on: true)/빼기(on: false). 수는 표의 likes 칸에 남는다.
 * 브라우저의 기억만으로는 연타를 막지 못해서, 누가 눌렀는지를 서버가 기기 쿠키로 센다.
 * 같은 기기가 몇 번을 보내도 한 작품에 공감은 하나다
 */
export async function POST(req) {
  if (!(await ipLimit(req, "like", 600))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  const b = await body(req);
  if (!/^\d{1,12}$/.test(String(b?.id || ""))) return json({ error: "잘못된 요청" }, 400);
  const dev = ensureDevice(req);
  const likes = await likeWork(String(b.id), dev.id, !!b.on);
  const res = likes == null ? json({ error: "작품을 찾지 못했어요" }, 404) : json({ likes });
  return dev.fresh ? setDeviceCookie(res, dev.id) : res;
}
