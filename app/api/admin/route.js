import { listWorks, removeItem, stats } from "@/lib/server/db";
import { destroyImages } from "@/lib/server/cloud";
import { body, json } from "@/lib/server/http";

/**
 * 운영자용. 헤더 x-admin-token 이 ADMIN_TOKEN 과 같아야 한다. ADMIN_TOKEN 이 비어 있으면 꺼진다.
 *   GET  /api/admin                  → { works, stats: { total, today, works } }
 *   POST /api/admin { id, action: "delete" } → { ok }  작품을 지운다(되돌릴 수 없다).
 *        표의 줄과 Cloudinary의 사진·콜라주가 함께 사라진다. 이상한 사진이 올라왔을 때 쓴다
 * 페이지는 /admin
 */
function authorized(req) {
  const t = process.env.ADMIN_TOKEN;
  return !!t && req.headers.get("x-admin-token") === t;
}

export async function GET(req) {
  if (!authorized(req)) return json({ error: "권한이 없습니다" }, 401);
  const [works, s] = await Promise.all([listWorks({ limit: 200 }), stats()]);
  return json({ works, stats: s });
}

export async function POST(req) {
  if (!authorized(req)) return json({ error: "권한이 없습니다" }, 401);
  const b = await body(req);
  if (b?.action !== "delete" || !b.id) return json({ error: "잘못된 요청" }, 400);
  const gone = await removeItem(String(b.id));
  if (gone) await destroyImages([gone.collage, ...(gone.source || [])]);
  console.info(`[admin] 작품 ${b.id} 삭제`);
  return json({ ok: true });
}
