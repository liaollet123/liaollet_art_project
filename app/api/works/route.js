import { ARTISTS } from "@/lib/attic";
import { countWorks, insertWork, listWorks, normSign, ownedTickets, toWork, worksBySign, worksByTicket } from "@/lib/server/db";
import { readDevice } from "@/lib/server/device";
import { uploadImage } from "@/lib/server/cloud";
import { LIMITS, body, guardTicket, json } from "@/lib/server/http";
import { hasBlocked, scrubPII } from "@/lib/server/moderate";

/**
 * GET  /api/works            → { works }  서가의 작품 (최근 60장)
 * GET  /api/works?ticket=NO  → { works }  그 작품 번호의 작품
 * GET  /api/works?sign=아이디 → { works }  그 아이디(서명)로 남긴 작품들, 최근 것부터. 이 폰이 만든 작품에는 mine: true
 * POST /api/works  { ticket, artist, source[], collage, story, tags[], letter[], publishable }
 *   ticket 은 6장에서 엮을 때 받은 작품 번호. 서명(1장에서 적은 이름)은 그 번호에 묶인 아이디를 서버가 쓴다(브라우저가 보낸 이름은 믿지 않는다)
 *   → { work }  표 한 줄로 저장한다. 사진과 콜라주는 Cloudinary에 올리고 주소만 남긴다.
 *   거르기에 걸리면 저장하지 않고 { hidden: true, work } 만 돌려준다(서가에는 오르지 않는다)
 */
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const no = q.get("ticket");
  if (no) return json({ works: /^\d{6,12}$/.test(no) ? await worksByTicket(no) : [] });
  // 검색은 대소문자를 가리지 않는 "같음"이라 글자를 제한한다. 한 글자 시드 서명("윤")도 찾을 수 있게 1자부터
  const sign = normSign(q.get("sign"));
  if (q.has("sign")) {
    const works = /^[가-힣a-zA-Z0-9]{1,10}$/.test(sign) ? await worksBySign(sign) : [];
    // 이 폰이 받은 번호의 작품에만 mine 을 붙인다. 화면은 그 작품에만 지우기 버튼을 보인다(실제로 지울 수 있는지는 DELETE 가 다시 확인한다)
    const own = await ownedTickets(readDevice(req), works.map((w) => w.key));
    return json({ works: works.map((w) => ({ ...w, mine: own.has(w.key) })) });
  }
  return json({ works: await listWorks({ limit: 60 }) });
}

const JPEG = /^data:image\/jpeg;base64,/;

export async function POST(req) {
  const b = await body(req);
  const { res, info } = await guardTicket(req, b?.ticket);
  if (res) return res;
  if (!ARTISTS[b.artist]) return json({ error: "시선이 필요합니다" }, 400);

  // 티켓 하나에 작품 한 장
  if ((await countWorks(b.ticket)) >= LIMITS.worksPerTicket) return json({ error: "limit", limited: true }, 429);

  // 콜라주(675x900)와 올린 사진(긴 변 1024px)은 jpeg 만 받고, 크기를 제한한다
  const collage = String(b.collage || "");
  const source = Array.isArray(b.source) ? b.source.slice(0, 3).map(String) : [];
  if (!JPEG.test(collage) || collage.length > 700_000) return json({ error: "이미지가 올바르지 않아요" }, 400);
  if (source.some((s) => !JPEG.test(s) || s.length > 500_000)) return json({ error: "사진이 올바르지 않아요" }, 400);

  const story = scrubPII(String(b.story || "").slice(0, 400));
  const signature = info.signature;
  const tags = (Array.isArray(b.tags) ? b.tags : []).slice(0, 12).map((t) => String(t).slice(0, 12));
  // 결과 장의 아티스트 편지. 나중에 1장 "내 작품 펼치기"에서 같은 모습으로 다시 보이려면 함께 남겨야 한다
  const letter = (Array.isArray(b.letter) ? b.letter : []).slice(0, 5).map((s) => scrubPII(String(s).slice(0, 200))).filter(Boolean);

  // 그래프의 판정(publishable)은 브라우저를 거쳐 오므로 막는 쪽으로만 믿는다. 낱말 검사는 서버에서 다시 한다
  if (b.publishable === false || hasBlocked([story, signature, ...tags, ...letter].join(" "))) {
    return json({ hidden: true, work: { ...toWork({ id: "local", ticket: b.ticket, artist: b.artist, story, tags, signature, letter, collage, source: [] }) } });
  }

  let urls;
  try {
    urls = await Promise.all([uploadImage(collage, "liaollet/collage"), ...source.map((s) => uploadImage(s, "liaollet/source"))]);
  } catch (e) {
    console.warn("[works] 이미지 업로드 실패:", e?.message);
    return json({ error: "이미지를 올리지 못했어요" }, 502);
  }

  const work = await insertWork({ ticket: b.ticket, artist: b.artist, source: urls.slice(1), collage: urls[0], story, tags, signature, letter });
  if (work.duplicate) return json({ error: "limit", limited: true }, 429);
  return json({ work });
}
