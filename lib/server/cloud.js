// 서버에서만 쓴다. 사진과 콜라주는 Cloudinary에 올리고, 표에는 주소(URL)만 남긴다.
// 서명 업로드라 API Secret 이 브라우저로 나가지 않는다. SDK 없이 REST 로 부른다.
import "server-only";
import { createHash } from "crypto";

const cfg = () => ({
  cloud: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudEnabled = () => {
  const c = cfg();
  return !!(c.cloud && c.key && c.secret);
};

// 서명: "알파벳순으로 이은 파라미터 + API Secret" 의 SHA-1
const sign = (params, secret) =>
  createHash("sha1")
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&") + secret
    )
    .digest("hex");

let warned = false;

/** data URL 을 올리고 https 주소를 돌려준다. 키가 없으면(내 컴퓨터 개발용) data URL 을 그대로 돌려준다 */
export async function uploadImage(dataUrl, folder) {
  if (!cloudEnabled()) {
    if (!warned) {
      warned = true;
      console.warn("[cloudinary] 키가 없어 이미지를 저장소에 그대로 넣습니다. 배포에서는 CLOUDINARY_* 를 설정하세요.");
    }
    return dataUrl;
  }
  const c = cfg();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  const form = new FormData();
  form.set("file", dataUrl);
  form.set("api_key", c.key);
  form.set("timestamp", String(timestamp));
  form.set("folder", folder);
  form.set("signature", sign(params, c.secret));
  const r = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Cloudinary 업로드 실패 ${r.status}`);
  return (await r.json()).secure_url;
}

/** 운영자가 작품을 지울 때 Cloudinary 의 사진도 지운다. 실패해도 작품 삭제는 막지 않는다 */
export async function destroyImages(urls) {
  if (!cloudEnabled()) return;
  const c = cfg();
  for (const u of urls.filter((x) => typeof x === "string" && x.includes("res.cloudinary.com"))) {
    const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(u);
    if (!m) continue;
    const timestamp = Math.floor(Date.now() / 1000);
    const public_id = m[1];
    const form = new FormData();
    form.set("public_id", public_id);
    form.set("api_key", c.key);
    form.set("timestamp", String(timestamp));
    form.set("signature", sign({ public_id, timestamp }, c.secret));
    await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/destroy`, { method: "POST", body: form, signal: AbortSignal.timeout(10000) }).catch(() => {});
  }
}
