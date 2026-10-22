import { countWorks, ticketFor, worksByTicket } from "@/lib/server/db";
import { setDeviceCookie, ensureDevice } from "@/lib/server/device";
import { LIMITS, ipLimit, json } from "@/lib/server/http";

/**
 * POST /api/tickets → { no, seq, date, existing, made, work }
 * 한 사람(기기)에게 하루 한 장. 오늘 이미 받았으면 같은 티켓을, 이미 작품을 남겼으면 그 작품도 함께 돌려준다.
 * 티켓 번호는 MMDD(한국 시간) + 그날 전시 전체의 입장 순번.
 */
export async function POST(req) {
  if (!(await ipLimit(req, "ticket", 300))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  const dev = ensureDevice(req);
  const t = await ticketFor(dev.id);
  const made = t.existing ? await countWorks(t.no) : 0;
  const work = made ? (await worksByTicket(t.no))[0] || null : null;
  const res = json({ ...t, made, limit: LIMITS.worksPerTicket, done: made >= LIMITS.worksPerTicket, work });
  return dev.fresh ? setDeviceCookie(res, dev.id) : res;
}
