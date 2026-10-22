// 폴더에 넣은 이미지 목록을 코드가 읽을 수 있는 파일로 적는다. 브라우저는 폴더를 직접 읽을 수 없고,
// 서버 호출 없이 첫 화면과 콜라주에서 바로 쓰려고 dev/build 직전에 한 번 만든다.
//   public/artists/<lia|ol|let>/   → lib/artist-photos.js  (시선 소개 사진)
//   public/textures/<lia|ol|let>/  → lib/textures.js       (콜라주 재료. 파일 이름 앞부분이 역할)
import { promises as fs } from "fs";
import path from "path";

const IMG = /\.(jpe?g|png|webp|avif)$/i;
const KEYS = ["LIA", "OL", "LET"];
const pub = (...p) => path.join(process.cwd(), "public", ...p);

async function list(dir) {
  try {
    return (await fs.readdir(dir)).filter((n) => IMG.test(n));
  } catch {
    return [];
  }
}

const byName = (a, b) => a.localeCompare(b, "ko", { numeric: true });

// 시선 소개 사진: cover.* 가 맨 앞, 나머지는 이름순
const photos = {};
for (const k of KEYS) {
  const names = (await list(pub("artists", k.toLowerCase()))).sort((a, b) => {
    const ca = /^cover\./i.test(a);
    const cb = /^cover\./i.test(b);
    return ca === cb ? byName(a, b) : ca ? -1 : 1;
  });
  photos[k] = names.map((n) => `/artists/${k.toLowerCase()}/${encodeURIComponent(n)}`);
}

// 콜라주 재료: "conte-2.png" 는 conte 역할의 두 번째 변형. 역할 이름은 첫 하이픈·숫자·점 앞까지
const textures = {};
for (const k of KEYS) {
  textures[k] = {};
  for (const n of (await list(pub("textures", k.toLowerCase()))).sort(byName)) {
    const role = n.toLowerCase().split(/[-_.\d]/)[0];
    if (!role) continue;
    (textures[k][role] ??= []).push(`/textures/${k.toLowerCase()}/${encodeURIComponent(n)}`);
  }
}

const head = "// scripts/assets.mjs 가 만든 파일이다. 직접 고치지 않는다.\n";
await fs.writeFile(path.join(process.cwd(), "lib", "artist-photos.js"), `${head}export const ARTIST_PHOTOS = ${JSON.stringify(photos, null, 2)};\n`);
await fs.writeFile(path.join(process.cwd(), "lib", "textures.js"), `${head}export const TEXTURES = ${JSON.stringify(textures, null, 2)};\n`);

const count = (o) => Object.values(o).reduce((a, v) => a + v.length, 0);
console.log("[assets]", KEYS.map((k) => `${k} 사진 ${photos[k].length}장 · 재료 ${count(textures[k])}장`).join(", "));
