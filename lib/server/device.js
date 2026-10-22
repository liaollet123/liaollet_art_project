// 한 사람을 구별하는 방법: 처음 들어온 폰에 서명된 쿠키(기기 ID)를 심는다.
// 로그인 없이 익명으로 쓰는 전시라 완벽하지는 않다(시크릿 창이나 쿠키 삭제로 피할 수 있다).
// 그래도 IP는 쓰지 않는다. 전시장 와이파이에서는 모든 관람객이 같은 IP로 보인다.
import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const NAME = "attic_dev";

// 서명 키. 배포에서는 반드시 DEVICE_SECRET 을 둔다(없으면 서버가 켜질 때마다 바뀌어 쿠키가 무효가 된다)
const SECRET = process.env.DEVICE_SECRET || (globalThis.__atticDevSecret ??= randomUUID());

const sign = (id) => createHmac("sha256", SECRET).update(id).digest("base64url").slice(0, 22);

/** 요청의 쿠키에서 기기 ID를 꺼낸다. 없거나 서명이 틀리면 null */
export function readDevice(req) {
  const raw = req.cookies.get(NAME)?.value || "";
  const [id, mac] = raw.split(".");
  if (!id || !mac) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/** 기기 ID를 꺼내되, 없으면 새로 만들어 응답에 심을 준비를 한다 */
export function ensureDevice(req) {
  const id = readDevice(req);
  return id ? { id, fresh: false } : { id: randomUUID(), fresh: true };
}

export function setDeviceCookie(res, id) {
  res.cookies.set(NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 120, // 전시 기간을 넉넉히 덮는다
  });
  return res;
}
