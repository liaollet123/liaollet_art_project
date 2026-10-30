import { listWorks, removeItem, stats } from "@/lib/server/db";
import { destroyImages } from "@/lib/server/cloud";
import { body, json } from "@/lib/server/http";
import { SEED_WORKS } from "@/lib/seed";

/**
 * 운영자용. 헤더 x-admin-token 이 ADMIN_TOKEN 과 같아야 한다. ADMIN_TOKEN 이 비어 있으면 꺼진다.
 *   GET  /api/admin?from=YYYY-MM-DD&to=YYYY-MM-DD → { works, stats: { total, today, works }, range }  works 마다 seed(시드 작품인지)
 *        from·to 는 둘 다 없어도, 하나만 있어도 된다(한국 시간, 종료일 포함)
 *   POST /api/admin { ids: [...], action: "delete" } → { deleted: [id], failed: [{ id, error }] }
 *        작품들을 지운다(되돌릴 수 없다). 표의 줄과 Cloudinary의 사진·콜라주가 함께 사라진다. 예전처럼 { id } 하나도 받는다
 * 페이지는 /admin
 */
function authorized(req) {
  const t = process.env.ADMIN_TOKEN;
  return !!t && req.headers.get("x-admin-token") === t;
}

// 시드 작품은 schema.sql 을 다시 실행하면 되살아난다. 운영자 화면에서 구별해 보이려고 표시한다
const SEED_TICKETS = new Set(SEED_WORKS.map((w) => String(w.ticket)));

// 기간 검색의 날짜(YYYY-MM-DD)는 전시장 기준인 한국 시간으로 읽는다. 종료일은 그날 하루를 다 넣는다(다음 날 0시 전까지)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const startOf = (d) => `${d}T00:00:00+09:00`;
const nextDayOf = (d) => new Date(new Date(startOf(d)).getTime() + 24 * 60 * 60 * 1000).toISOString();

export async function GET(req) {
  if (!authorized(req)) return json({ error: "권한이 없습니다" }, 401);
  const q = new URL(req.url).searchParams;
  const fromDay = DAY_RE.test(q.get("from") || "") ? q.get("from") : "";
  const toDay = DAY_RE.test(q.get("to") || "") ? q.get("to") : "";
  if (fromDay && toDay && fromDay > toDay) return json({ error: "시작일이 종료일보다 늦어요" }, 400);
  // 기간을 정하면 그 안의 작품은 빠짐없이 보이게 넉넉히 가져온다. 전체 보기는 최근 200장
  const ranged = !!(fromDay || toDay);
  const [works, s] = await Promise.all([
    listWorks({ limit: ranged ? 1000 : 200, from: fromDay ? startOf(fromDay) : undefined, to: toDay ? nextDayOf(toDay) : undefined }),
    stats(),
  ]);
  return json({ works: works.map((w) => ({ ...w, seed: SEED_TICKETS.has(String(w.ticket)) })), stats: s, range: { from: fromDay, to: toDay } });
}

export async function POST(req) {
  if (!authorized(req)) return json({ error: "권한이 없습니다" }, 401);
  const b = await body(req);
  const ids = (Array.isArray(b?.ids) ? b.ids : b?.id ? [b.id] : []).map(String).filter((id) => /^\d{1,12}$/.test(id)).slice(0, 200);
  if (b?.action !== "delete" || !ids.length) return json({ error: "잘못된 요청" }, 400);

  // 예전에는 지워진 줄이 없어도 ok 를 돌려줘서, 지워지지 않았는데 "지웠어요"가 떴다. 하나씩 실제로 지워졌는지 돌려준다
  const deleted = [];
  const failed = [];
  for (const id of ids) {
    try {
      const gone = await removeItem(id);
      if (!gone) {
        failed.push({ id, error: "이미 없거나 지워지지 않았어요" });
        continue;
      }
      deleted.push(id);
      // 사진 지우기가 실패해도 작품은 이미 서가에서 내려갔다. Cloudinary 쪽은 destroyImages 가 조용히 넘긴다
      await destroyImages([gone.collage, ...(gone.source || [])]);
    } catch (e) {
      console.warn(`[admin] 작품 ${id} 삭제 실패:`, e?.message);
      failed.push({ id, error: e?.message || "지우지 못했어요" });
    }
  }
  console.info(`[admin] 삭제 ${deleted.length}개${failed.length ? `, 실패 ${failed.length}개` : ""}`);
  return json({ deleted, failed });
}
