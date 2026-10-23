import { devToday, issueTicket, normSign, seoulDay, signOwner, signToday, SIGN_RE } from "@/lib/server/db";
import { readDevice } from "@/lib/server/device";
import { LIMITS, body, ipLimit, json } from "@/lib/server/http";
import { hasBlocked } from "@/lib/server/moderate";

/**
 * POST /api/sign  { signature, check } → { no, seq, date, signature, used, limit }
 *   check: true 면 확인만 하고 번호는 매기지 않는다 → { ok, signature, used, limit }
 *   실패하면 { error, code } — code: "format" | "taken" | "limit" | "device"
 *
 * 1장에서 티켓을 받으면 "오늘의 창작자님은 누구신가요?"에 이름을 적고, check 로 먼저 확인한다(들어가기 전에 막히는 게 낫다).
 * 번호는 6장에서 감각을 엮고 작품을 그리기 직전에 매긴다(입장만 하고 돌아간 사람 때문에 번호가 비지 않게).
 *
 * 서명은 아이디다. 이 아이디로 남긴 작품을 1장의 "이미 남긴 기록이 있나요?"에서 찾는다.
 *   - 아이디는 처음 쓴 폰의 것. 다른 폰에서 같은 아이디를 쓰면 막는다(남의 이름으로 작품이 섞이지 않게)
 *   - 하루 세 번은 아이디와 폰 양쪽으로 센다. 아이디를 바꿔 가며 같은 폰에서 더 만들 수 없게
 *   - 여기서 작품 번호(YYMMDD + 누적 순번)를 매긴다. 엮을 때마다 새 번호다(다시 엮기도 기회 한 번)
 */
export async function POST(req) {
  if (!(await ipLimit(req, "sign", 300))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  const dev = readDevice(req);
  if (!dev) return json({ error: "처음 화면에서 다시 들어와 주세요", code: "device" }, 401);
  const b = await body(req);
  const signature = normSign(b?.signature);
  if (!SIGN_RE.test(signature)) return json({ error: "한글·영문·숫자로 2~10자, 띄어쓰기 없이 적어 주세요", code: "format" }, 400);
  // 실명 대신 별명을 적어 달라고 안내하지만 가려낼 수는 없다. 낱말 검사만 한다
  if (hasBlocked(signature)) return json({ error: "다른 서명을 적어 주세요", code: "format" }, 400);

  const owner = await signOwner(signature);
  if (owner && owner !== dev) return json({ error: "이미 다른 분이 쓰고 있는 이름이에요. 다른 이름을 적어 주세요", code: "taken" }, 409);

  // 엮기 한 번 = 기회 한 번 = 작품 번호 하나. 다시 엮기도 새 작품이라 한 번으로 센다(아이디와 폰 양쪽으로)
  const limit = LIMITS.worksPerDay;
  const used = Math.max((await devToday(dev)).length, await signToday(signature));
  if (used >= limit) return json({ error: `오늘은 기회를 모두 썼어요. 한 사람이 하루에 ${limit}장까지 남길 수 있어요`, code: "limit", used, limit }, 429);
  if (b?.check) return json({ ok: true, signature, used, limit });

  const t = await issueTicket(dev, signature);
  return json({ ...t, date: seoulDay().date, signature, used: used + 1, limit });
}
