import { devToday, seoulDay, worksByTicket } from "@/lib/server/db";
import { setDeviceCookie, ensureDevice } from "@/lib/server/device";
import { LIMITS, ipLimit, json } from "@/lib/server/http";

/**
 * POST /api/tickets → { date, day, used, limit, done, work }
 * 1장의 입장 티켓. 티켓의 번호 칸에는 오늘 날짜(day, YYMMDD)를 적는다. 작품 번호는 작품을 엮을 때 그 뒤에 순번을 붙여 매긴다.
 * 여기서는 폰에 기기 쿠키를 심고, 오늘 남은 기회를 알려 준다.
 *   - 한 사람에게 하루 세 번(WORKS_PER_DAY). 오늘 다 썼으면 마지막으로 남긴 작품과 함께 done
 *   - 아이디(서명)로도 하루 세 번을 센다. 그건 티켓에 이름을 적을 때 /api/sign 이 본다
 */
export async function POST(req) {
  if (!(await ipLimit(req, "ticket", 300))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  const dev = ensureDevice(req);
  const limit = LIMITS.worksPerDay;
  const list = dev.fresh ? [] : await devToday(dev.id);
  // 엮기 한 번이 기회 한 번(다시 엮기 포함)
  const used = list.length;
  let work = null;
  if (used >= limit) {
    for (const t of [...list].reverse()) {
      work = (await worksByTicket(t.no))[0];
      if (work) break;
    }
  }
  const { date, yymmdd } = seoulDay();
  const res = json({ date, day: yymmdd, used, limit, done: used >= limit, work: work || null });
  return dev.fresh ? setDeviceCookie(res, dev.id) : res;
}
