import { ARTISTS } from "@/lib/attic";
import { countWorks, insertWork, listWorks, toWork, worksByTicket } from "@/lib/server/db";
import { uploadImage } from "@/lib/server/cloud";
import { LIMITS, body, guard, json } from "@/lib/server/http";
import { hasBlocked, scrubPII } from "@/lib/server/moderate";

/**
 * GET  /api/works            → { works }  서가의 작품 (최근 60장)
 * GET  /api/works?ticket=NO  → { works }  그 티켓으로 남긴 작품
 * POST /api/works  { ticket, artist, source[], collage, story, tags[], signature, publishable }
 *   → { work }  표 한 줄로 저장한다. 사진과 콜라주는 Cloudinary에 올리고 주소만 남긴다.
 *   거르기에 걸리면 저장하지 않고 { hidden: true, work } 만 돌려준다(서가에는 오르지 않는다)
 */
export async function GET(req) {
  const no = new URL(req.url).searchParams.get("ticket");
  if (no) return json({ works: /^\d{6,8}$/.test(no) ? await worksByTicket(no) : [] });
  return json({ works: await listWorks({ limit: 60 }) });
}

const JPEG = /^data:image\/jpeg;base64,/;

export async function POST(req) {
  const b = await body(req);
  const blocked = await guard(req, b?.ticket);
  if (blocked) return blocked;
  if (!ARTISTS[b.artist]) return json({ error: "시선이 필요합니다" }, 400);

  // 티켓 하나에 작품 한 장
  if ((await countWorks(b.ticket)) >= LIMITS.worksPerTicket) return json({ error: "limit", limited: true }, 429);

  // 콜라주(675x900)와 올린 사진(긴 변 1024px)은 jpeg 만 받고, 크기를 제한한다
  const collage = String(b.collage || "");
  const source = Array.isArray(b.source) ? b.source.slice(0, 3).map(String) : [];
  if (!JPEG.test(collage) || collage.length > 700_000) return json({ error: "이미지가 올바르지 않아요" }, 400);
  if (source.some((s) => !JPEG.test(s) || s.length > 500_000)) return json({ error: "사진이 올바르지 않아요" }, 400);

  const story = scrubPII(String(b.story || "").slice(0, 400));
  const signature = scrubPII(String(b.signature || "").slice(0, 10));
  const tags = (Array.isArray(b.tags) ? b.tags : []).slice(0, 12).map((t) => String(t).slice(0, 12));

  // 그래프의 판정(publishable)은 브라우저를 거쳐 오므로 막는 쪽으로만 믿는다. 낱말 검사는 서버에서 다시 한다
  if (b.publishable === false || hasBlocked([story, signature, ...tags].join(" "))) {
    return json({ hidden: true, work: { ...toWork({ id: "local", ticket: b.ticket, artist: b.artist, story, tags, signature, collage, source: [] }) } });
  }

  let urls;
  try {
    urls = await Promise.all([uploadImage(collage, "liaollet/collage"), ...source.map((s) => uploadImage(s, "liaollet/source"))]);
  } catch (e) {
    console.warn("[works] 이미지 업로드 실패:", e?.message);
    return json({ error: "이미지를 올리지 못했어요" }, 502);
  }

  const work = await insertWork({ ticket: b.ticket, artist: b.artist, source: urls.slice(1), collage: urls[0], story, tags, signature });
  if (work.duplicate) return json({ error: "limit", limited: true }, 429);
  return json({ work });
}
