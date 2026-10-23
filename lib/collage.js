"use client";

import { TEXTURES } from "./textures.js";
import { ARTIST_PHOTOS } from "./artist-photos.js";
import { COLLAGE_SOURCES } from "./collage-sources.js";

// 콜라주를 브라우저 캔버스로 그린다. 서버로 사진을 보내지 않아도 작품이 완성되도록.
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });

// ---------------------------------------------------------------------------
// 콜라주 그리기. 관객이 올린 사진을 세 사람의 시선으로 다시 엮는다.
// 위는 시선의 그림, 아래는 제목·글귀·태그·서명 줄이 적힌 종이 띠(이전 서가 형식).
//   LIA — 여백, 반투명, 세피아, 부드러운 톤
//   OL  — 찢겨진 질감, 모노톤, 빛번짐, 깨어짐
//   LET — 비비드한 색감, 생동감, 에너지, 겹침·레이어
// 같은 시선이라도 작품마다 달라지게, 세 가지를 매번 섞는다.
//   1) 네 가지 특성의 비율(mixFor): 어떤 작품은 여백이 넓고, 어떤 작품은 세피아가 짙다
//   2) 시선의 소스 사진(4장, public/artists/<시선>/)을 재료로 잘라 관객 사진과 겹친다
//   3) 관객 사진에서 뽑은 색(photoPalette)을 색종이·종이 톤·테이프에 섞고, 구도를 흔든다(jitter)
// ---------------------------------------------------------------------------

const W = 900;
const H = 1200;

const BG = { LIA: "#faf7f2", OL: "#0e0f12", LET: "#e7e4e2" };

// 아래 글 띠(제목·글귀·태그·서명 줄). 위는 시선의 그림, 아래는 밝은 종이 띠로 완전히 나눠 글이 그림에 겹치지 않게
const BAND_Y = 760;
const BAND = {
  LIA: { band: "rgba(255,252,246,0.96)", ink: "#2b1d12", soft: "#6b5742" },
  OL: { band: "rgba(250,249,246,0.97)", ink: "#141210", soft: "#5f5a52" },
  LET: { band: "rgba(255,253,249,0.97)", ink: "#1c1420", soft: "#6a5560" },
};

/** 주어진 폭에 맞춰 줄을 나눈다. maxLines를 넘으면 말줄임 */
function wrap(g, str, maxWidth, maxLines) {
  const lines = [];
  let line = "";
  for (const ch of str) {
    if (g.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = "";
      if (lines.length === maxLines) break;
    }
    line += ch;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (g.measureText(last).width > maxWidth - 20) lines[maxLines - 1] = last.slice(0, -1) + "…";
  }
  return lines;
}

/**
 * 캔버스는 글꼴이 아직 안 불러와졌으면 기본 글꼴로 그려 버린다. 첫 작품이 다른 글씨로 찍히지 않게
 * 띠에 쓰는 글꼴을 먼저 불러 둔다. 3초가 넘으면 기다리지 않고 그린다(전시가 멈추면 안 된다)
 */
async function fontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  const want = ["700 50px 'Nanum Myeongjo'", "italic 29px 'Nanum Myeongjo'", "700 27px 'Nanum Myeongjo'", "38px 'Nanum Pen Script'"];
  await Promise.race([Promise.all(want.map((f) => document.fonts.load(f, "가나다 LIAOLLET"))), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
}

const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 시선의 네 특성을 이번 작품에서 얼마나 세게 쓸지. 0.25~1 사이로 매번 달리 뽑되,
 * 한 특성은 늘 강하게(0.85 이상) 두어 그 작품의 인상이 흐려지지 않게 한다
 */
function mixFor(artist) {
  const keys = { LIA: ["space", "veil", "sepia", "soft"], OL: ["torn", "mono", "bleed", "crack"], LET: ["vivid", "energy", "overlap", "layer"] }[artist] || [];
  const m = Object.fromEntries(keys.map((k) => [k, rand(0.25, 1)]));
  if (keys.length) m[pickOne(keys)] = rand(0.85, 1);
  return m;
}

/**
 * 콜라주 재료 사진을 한 번만 불러 둔다.
 * 운영자가 public/collage/<시선>/ 에 소스 사진을 넣었으면 그것을, 없으면 시선 폴더(public/artists)의 사진을 쓴다.
 * 섞는 방식(blend)이 붙은 소스는 그 방식으로 그대로 얹고(applySources), 아닌 것은 시선의 색으로 보정해 조각으로 쓴다
 */
const srcCache = {};
function loadSources(artist) {
  const list = (COLLAGE_SOURCES[artist] || []).length ? COLLAGE_SOURCES[artist] : (ARTIST_PHOTOS[artist] || []).map((src) => ({ src, blend: "" }));
  srcCache[artist] ??= Promise.all(
    list.map((s) =>
      loadImage(s.src)
        .then((im) => Object.assign(im, { blend: s.blend }))
        .catch(() => null)
    )
  ).then((a) => a.filter(Boolean));
  return srcCache[artist];
}

/**
 * 섞는 방식이 정해진 소스 사진을 화면에 얹는다(작품마다 무작위로 1~3장, 크기·자리·각도·세기도 무작위).
 * screen 은 빛만, multiply 는 어두운 결만 남으니 실제 재료 사진의 질감이 그대로 작품에 들어간다
 */
function applySources(g, list) {
  for (const im of list) {
    const k = Math.max(W / im.width, H / im.height) * rand(0.55, 1.25);
    const w = im.width * k;
    const h = im.height * k;
    g.save();
    g.translate(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.8));
    g.rotate(rand(-0.35, 0.35));
    if (Math.random() < 0.5) g.scale(-1, 1);
    g.globalCompositeOperation = im.blend === "normal" ? "source-over" : im.blend;
    g.globalAlpha = im.blend === "normal" ? rand(0.85, 1) : rand(0.5, 0.95);
    g.drawImage(im, -w / 2, -h / 2, w, h);
    g.restore();
  }
}

/**
 * 관객 사진의 색: 작게 줄여 색상 12칸으로 나누고, 채도 x 개수가 큰 칸의 대표색을 고른다.
 * { avg: 평균색, vivid: 진한 색 최대 4개 } — 색종이·테이프·종이 톤에 섞는다
 */
function photoPalette(ims) {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const x = c.getContext("2d", { willReadFrequently: true });
  const bins = Array.from({ length: 12 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (const im of ims) {
    x.drawImage(im, 0, 0, 24, 24);
    const p = x.getImageData(0, 0, 24, 24).data;
    for (let i = 0; i < p.length; i += 4) {
      const R = p[i], G = p[i + 1], B = p[i + 2];
      ar += R; ag += G; ab += B; an++;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      const sat = mx ? (mx - mn) / mx : 0;
      if (sat < 0.18 || mx < 40) continue;
      let h = mx === R ? (G - B) / (mx - mn) : mx === G ? 2 + (B - R) / (mx - mn) : 4 + (R - G) / (mx - mn);
      h = ((h * 60) + 360) % 360;
      const bin = bins[Math.floor(h / 30)];
      bin.n += sat; bin.r += R * sat; bin.g += G * sat; bin.b += B * sat;
    }
  }
  const avg = an ? [ar / an, ag / an, ab / an] : [200, 190, 175];
  const vivid = bins
    .filter((b) => b.n > 0.5)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((b) => {
      // 색종이로 쓸 만큼 채도와 밝기를 끌어올린다
      let [R, G, B] = [b.r / b.n, b.g / b.n, b.b / b.n];
      const l = luma(R, G, B);
      [R, G, B] = [R, G, B].map((v) => clamp(l + (v - l) * 1.9 + 30));
      return `rgb(${R | 0},${G | 0},${B | 0})`;
    });
  return { avg, vivid };
}

/** 정해 둔 자리를 작품마다 조금씩 흔든다. mirror 면 좌우를 뒤집어 구도 자체가 바뀐다 */
function jitter(s, { mirror = false, move = 34, scale = 1, turn = 0.05 } = {}) {
  return { ...s, x: (mirror ? W - s.x : s.x) + rand(-move, move), y: s.y + rand(-move, move), w: s.w * scale * rand(0.9, 1.1), r: (mirror ? -s.r : s.r) + rand(-turn, turn) };
}

/** 소스 사진 한 장의 일부를 잘라 낸 재료 조각: 사진의 어느 부분을 얼마나 확대할지도 매번 다르다 */
function srcPiece(im, w, h, grade, amt) {
  return graded(im, w, h, grade, { zoom: rand(1, 2.2), ox: Math.random(), oy: Math.random(), amt });
}

// ---------------------------------------------------------------------------
// 재료 텍스처(public/textures/<시선>/). 실제 종이·획·테이프 스캔을 넣으면 그것을 쓰고,
// 없는 재료는 아래 그리기 함수가 도형으로 대신한다. 파일 하나가 빠져도 작품은 나온다
// ---------------------------------------------------------------------------

const texCache = {};

/** 시선의 재료를 한 번만 불러 둔다. { 역할: [Image, ...] } */
function loadTextures(artist) {
  texCache[artist] ??= (async () => {
    const out = {};
    for (const [role, urls] of Object.entries(TEXTURES[artist] || {})) {
      const ims = (await Promise.all(urls.map((u) => loadImage(u).catch(() => null)))).filter(Boolean);
      if (ims.length) out[role] = ims;
    }
    return out;
  })();
  return texCache[artist];
}

/** 같은 역할의 재료가 여러 장이면 작품마다 다른 것을 고른다 */
const pick = (T, role) => {
  const a = T[role];
  return a ? a[Math.floor(Math.random() * a.length)] : null;
};

/** 바탕 종이: 캔버스를 빈틈없이 덮는다 */
function cover(g, im) {
  const k = Math.max(W / im.width, H / im.height);
  g.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k);
}

/** 재료 한 장을 (x, y) 중심에 w 폭으로 놓는다. h 를 주지 않으면 재료의 비율을 따른다 */
function place(g, im, x, y, w, h, r = 0, { alpha = 1, op = "source-over", shadow = null } = {}) {
  const hh = h ?? w * (im.height / im.width);
  g.save();
  g.translate(x, y);
  g.rotate(r);
  g.globalAlpha = alpha;
  g.globalCompositeOperation = op;
  if (shadow) {
    g.shadowColor = shadow;
    g.shadowBlur = 18;
    g.shadowOffsetY = 5;
  }
  g.drawImage(im, -w / 2, -hh / 2, w, hh);
  g.restore();
}

/** 획 재료(가로로 긴 PNG)를 두 점 사이에 눕힌다 */
function stroke(g, im, x0, y0, x1, y1, alpha = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  place(g, im, (x0 + x1) / 2, (y0 + y1) / 2, len, null, Math.atan2(y1 - y0, x1 - x0), { alpha });
}

/** 그레인 타일을 화면 전체에 겹친다(overlay 합성이라 밝은 곳과 어두운 곳에 고루 앉는다) */
function grainTex(g, im, alpha) {
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(im, "repeat");
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** 손으로 찢은 종이 가장자리. jag 가 클수록 거칠다 */
function tornPath(g, w, h, jag = 13) {
  const n = 40;
  g.beginPath();
  for (let k = 0; k <= n; k++) g.lineTo(-w / 2 + (w * k) / n, -h / 2 + Math.random() * jag);
  for (let k = 0; k <= n; k++) g.lineTo(w / 2 - Math.random() * jag, -h / 2 + (h * k) / n);
  for (let k = 0; k <= n; k++) g.lineTo(w / 2 - (w * k) / n, h / 2 - Math.random() * jag);
  for (let k = 0; k <= n; k++) g.lineTo(-w / 2 + Math.random() * jag, h / 2 - (h * k) / n);
  g.closePath();
}

/**
 * 작품 제목. 감정 낱말을 그대로 크게 쓰지 않고, 관객의 글에서 길어 올린 이름을 붙인다.
 * LLM(/api/compose)이 붙으면 그 제목을 쓰고, 그전에는 글의 첫 마디를 쓴다.
 */
export function titleFrom(answer, emotion) {
  const first = String(answer || "").replace(/\s+/g, " ").trim().split(/[,.?!，。]/)[0].trim();
  if (!first) return `${emotion}의 한 장`;
  return first.length > 14 ? first.slice(0, 14).trim() + "…" : first;
}

// ---------------------------------------------------------------------------
// 시선별 사진 보정. 브라우저마다 캔버스 filter 지원이 달라(특히 iOS Safari) 픽셀을 직접 고친다
// ---------------------------------------------------------------------------

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * 사진을 w x h 로 잘라 담은 뒤(cover) 픽셀마다 grade(r,g,b)를 적용한 캔버스.
 * zoom/ox/oy 로 사진의 다른 부분을 확대해 담을 수 있다(LET이 한 장으로 여러 순간을 겹칠 때).
 * 너무 밝거나 어두운 사진도 시선의 색이 살도록, 먼저 밝기 범위를 넓혀 둔다(자동 레벨).
 * amt(0~1)는 보정의 세기: 1이면 시선의 색으로 완전히, 낮을수록 관객 사진의 원래 색이 비친다
 */
function graded(im, w, h, grade, { zoom = 1, ox = 0.5, oy = 0.5, amt = 1 } = {}) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  const x = c.getContext("2d");
  const k = Math.max(c.width / im.width, c.height / im.height) * zoom;
  x.drawImage(im, (c.width - im.width * k) * ox, (c.height - im.height * k) * oy, im.width * k, im.height * k);
  const d = x.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 16) hist[Math.round(luma(p[i], p[i + 1], p[i + 2]))]++;
  const total = hist.reduce((a, b) => a + b, 0);
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const span = Math.max(40, hi - lo);
  const lv = (v) => ((v - lo) * 255) / span;
  for (let i = 0; i < p.length; i += 4) {
    const [r, gg, b] = grade(lv(p[i]), lv(p[i + 1]), lv(p[i + 2]));
    p[i] = clamp(p[i] + (r - p[i]) * amt);
    p[i + 1] = clamp(p[i + 1] + (gg - p[i + 1]) * amt);
    p[i + 2] = clamp(p[i + 2] + (b - p[i + 2]) * amt);
  }
  x.putImageData(d, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// 세 시선이 함께 쓰는 손질 도구
// ---------------------------------------------------------------------------

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * 흐림. 캔버스 filter 는 iOS Safari 가 받지 않아, 작게 줄였다가 다시 키우는 방식으로 번지게 한다.
 * k 가 클수록 많이 흐리다(대략 픽셀 반지름)
 */
function softBlur(src, k) {
  const w = src.width;
  const h = src.height;
  const small = canvasOf(w / Math.max(1, k), h / Math.max(1, k));
  const sg = small.getContext("2d");
  sg.imageSmoothingQuality = "high";
  sg.drawImage(src, 0, 0, small.width, small.height);
  const out = canvasOf(w, h);
  const og = out.getContext("2d");
  og.imageSmoothingQuality = "high";
  og.drawImage(small, 0, 0, w, h);
  return out;
}

/** 가장자리를 투명하게 녹인다. amt 가 클수록 안쪽까지 녹는다(LIA 의 부드러운 경계). 가운데는 또렷하게 남는다 */
function feather(c, amt) {
  const x = c.getContext("2d");
  const e = 0.04 + 0.2 * amt;
  x.save();
  x.globalCompositeOperation = "destination-in";
  for (const horiz of [true, false]) {
    const lg = horiz ? x.createLinearGradient(0, 0, c.width, 0) : x.createLinearGradient(0, 0, 0, c.height);
    lg.addColorStop(0, "rgba(0,0,0,0)");
    lg.addColorStop(e, "rgba(0,0,0,1)");
    lg.addColorStop(1 - e, "rgba(0,0,0,1)");
    lg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = lg;
    x.fillRect(0, 0, c.width, c.height);
  }
  x.restore();
  return c;
}

/** 움직임 흐림: 같은 그림을 한 방향으로 조금씩 밀어 겹친다(흔들린 사진처럼) */
function motionBlur(c, dx, dy, n = 10) {
  const out = canvasOf(c.width, c.height);
  const x = out.getContext("2d");
  x.globalAlpha = 1 / n;
  x.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    x.drawImage(c, dx * t, dy * t);
  }
  return out;
}

/** 색 갈라짐: 빨강·초록·파랑을 조금씩 어긋나게(프리즘과 필름의 색 번짐) */
function rgbSplit(c, d) {
  const out = canvasOf(c.width, c.height);
  const o = out.getContext("2d");
  const offs = [["#ff0000", -d, 0], ["#00ff00", 0, d * 0.3], ["#0000ff", d, 0]];
  for (const [col, ox, oy] of offs) {
    const t = canvasOf(c.width, c.height);
    const tx = t.getContext("2d");
    tx.drawImage(c, 0, 0);
    tx.globalCompositeOperation = "multiply";
    tx.fillStyle = col;
    tx.fillRect(0, 0, t.width, t.height);
    tx.globalCompositeOperation = "destination-in";
    tx.drawImage(c, 0, 0);
    o.globalCompositeOperation = "lighter";
    o.drawImage(t, ox, oy);
  }
  return out;
}

/** 지금까지 그린 화면의 한 부분을 떠 온다(젖은 유리, 겹침 효과를 그 위에 다시 얹으려고) */
function snapshot(g, x, y, w, h) {
  const c = canvasOf(w, h);
  c.getContext("2d").drawImage(g.canvas, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}

/** "#rrggbb" 나 "rgb(...)" 를 [r,g,b] 로 */
const rgbCache = {};
function toRGB(col) {
  if (rgbCache[col]) return rgbCache[col];
  const x = canvasOf(1, 1).getContext("2d");
  x.fillStyle = col;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return (rgbCache[col] = [d[0], d[1], d[2]]);
}
const shade = (col, d) => {
  const [r, g, b] = toRGB(col);
  return `rgb(${clamp(r + d) | 0},${clamp(g + d) | 0},${clamp(b + d) | 0})`;
};

function grain(g, n, color, size = 1.6) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = color(Math.random());
    g.fillRect(Math.random() * W, Math.random() * H, size, size);
  }
}

/** 사진 한 장을 시선의 색으로 보정해 원하는 크기의 캔버스로(가로세로 비율은 사진을 따르되 범위 안에서) */
function photoCanvas(im, w, grade, opt = {}) {
  const ratio = Math.min(1.45, Math.max(0.72, im.height / im.width));
  return graded(im, w, w * ratio, grade, opt);
}

// ---------------------------------------------------------------------------
// 색 보정 — 시선마다 소스 사진의 톤을 관객 사진에 입힌다
// ---------------------------------------------------------------------------

// LIA: 물가의 햇빛, 젖은 유리 너머 꽃, 볼이 붉은 옆얼굴처럼 밝고 공기 같은 톤.
// 검은 곳을 들어 올리고 대비를 낮춘 뒤, 색은 절반쯤 빼고 밝은 곳에 분홍빛 온기를 얹는다
const gradeLIA = (r, g, b) => {
  const l = luma(r, g, b);
  const lift = 62 + l * 0.76;
  const k = lift / Math.max(1, l);
  const sat = 0.55;
  let R = lift + (r * k - lift) * sat;
  let G = lift + (g * k - lift) * sat;
  let B = lift + (b * k - lift) * sat;
  const t = lift / 255;
  return [R + 10 * t + 4, G + 2 * t, B + 4 - 6 * t];
};
// 세피아 쪽으로 기울인 LIA(sepia 비율이 높을 때 섞는다)
const gradeLIASepia = (r, g, b) => {
  const v = 52 + luma(r, g, b) * 0.78;
  return [v * 1.08 + 6, v * 0.98 + 2, v * 0.84 - 2];
};

// OL: 깨진 유리와 빛, 어둠 속 실루엣. 검은 곳을 더 깊게 누르고 밝은 곳만 남기는 강한 흑백, 살짝 차가운 빛
const gradeOL = (r, g, b) => {
  const l = luma(r, g, b) / 255;
  const s = 1 / (1 + Math.exp(-11 * (l - 0.56)));
  const v = Math.pow(s, 1.15) * 250 + (Math.random() - 0.5) * 30;
  return [v * 0.97, v * 0.985, v * 1.02];
};

// LET: 두껍게 바른 물감처럼 쨍하게. 채도를 크게 올리고 색 단계를 줄여(포스터처럼) 면이 또렷하게
const gradeLET = (r, g, b) => {
  const l = luma(r, g, b);
  const sat = 2.2;
  let R = l + (r - l) * sat;
  let G = l + (g - l) * sat;
  let B = l + (b - l) * sat;
  const q = (v) => Math.round(clamp((v - 128) * 1.2 + 136) / 42) * 42;
  return [q(R + 14), q(G + 4), q(B - 4)];
};

// ---------------------------------------------------------------------------
// LIA — 여백, 반투명, 세피아, 부드러운 톤
// ---------------------------------------------------------------------------

/** 젖은 유리에 맺힌 물방울 */
function droplets(g, x, y, w, h, n) {
  for (let i = 0; i < n; i++) {
    const r = rand(1.5, 7) * (Math.random() < 0.12 ? 2 : 1);
    const px = x + rand(0, w);
    const py = y + rand(0, h);
    const rg = g.createRadialGradient(px - r * 0.3, py - r * 0.35, 0, px, py, r);
    rg.addColorStop(0, "rgba(255,255,255,0.85)");
    rg.addColorStop(0.5, "rgba(255,255,255,0.25)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(90,80,90,0.16)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(px + r * 0.15, py + r * 0.2, r * 0.92, 0.2, Math.PI * 1.1);
    g.stroke();
  }
  // 흘러내린 물줄기 몇 가닥
  for (let i = 0; i < n / 25; i++) {
    const px = x + rand(0, w);
    const py = y + rand(0, h * 0.5);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = rand(1, 2.2);
    g.beginPath();
    g.moveTo(px, py);
    g.bezierCurveTo(px + rand(-6, 6), py + 60, px + rand(-8, 8), py + 140, px + rand(-6, 6), py + rand(160, 320));
    g.stroke();
  }
}

/** 나뭇잎 그림자: 가지를 따라 모인 잎 덩어리를 크게 흐려 겹친다(물가의 뒷모습 사진의 얼룩진 그늘). 점이 아니라 그늘로 보이게 */
function leafShadow(g, alpha) {
  const c = canvasOf(W / 6, H / 6);
  const x = c.getContext("2d");
  x.fillStyle = "#6f7f99";
  const fromLeft = Math.random() < 0.5;
  const branches = 2 + Math.floor(Math.random() * 2);
  for (let b = 0; b < branches; b++) {
    let px = fromLeft ? rand(-10, 20) : rand(W / 6 - 20, W / 6 + 10);
    let py = rand(H / 6 * 0.45, H / 6);
    const a = fromLeft ? rand(-0.9, -0.2) : Math.PI + rand(0.2, 0.9);
    for (let k = 0; k < 26; k++) {
      px += Math.cos(a) * rand(1.5, 3.5);
      py += Math.sin(a) * rand(1.5, 3.5);
      x.beginPath();
      x.ellipse(px + rand(-6, 6), py + rand(-6, 6), rand(2.5, 6), rand(1.5, 3.5), rand(0, Math.PI), 0, Math.PI * 2);
      x.fill();
    }
  }
  g.save();
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = alpha;
  g.drawImage(softBlur(c, 2.2), 0, 0, W, H);
  g.restore();
}

/**
 * 밝은 종이 위에 관객 사진을 공기처럼 놓는다. 사진은 파스텔로 들어 올리고(sepia 비율만큼 세피아로 기울고),
 * 가장자리는 녹고(soft), 빛이 번진다(bloom). 일부는 물방울 맺힌 젖은 유리 뒤로 흐려지고(veil),
 * 잎 그림자가 얼룩지며, 나머지는 넓게 비워 둔다(space). LIA 소스 사진이 먼 쪽에 옅게 스민다
 */
function drawLIA(g, imgs, T, S, M, P) {
  const bg = "#faf7f2";
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const paper = pick(T, "paper");
  if (paper) cover(g, paper);
  else grain(g, 2400, (a) => `rgba(150,120,100,${a * 0.04})`);
  // 관객 사진의 평균색을 분홍빛 공기에 섞어 종이 온도를 사진마다 다르게
  const [ar, ag, ab] = P.avg;
  const wash = g.createRadialGradient(W * rand(0.3, 0.7), H * rand(0.2, 0.5), 40, W / 2, H / 2, 820);
  wash.addColorStop(0, `rgba(${(ar + 255 * 2) / 3 | 0},${(ag + 228 * 2) / 3 | 0},${(ab + 226 * 2) / 3 | 0},0.55)`);
  wash.addColorStop(1, "rgba(250,247,242,0)");
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);

  const mirror = Math.random() < 0.5;
  const fx = (x) => (mirror ? W - x : x);
  // 벽을 대각으로 가르는 푸른 그림자 띠(장미와 잎 그림자 사진의 벽): 반쯤의 작품에
  if (Math.random() < 0.5) {
    g.save();
    g.globalCompositeOperation = "multiply";
    const y0 = rand(-200, 300);
    const lg = g.createLinearGradient(0, y0, W * 0.4, y0 + 600);
    lg.addColorStop(0, "rgba(70,96,120,0.55)");
    lg.addColorStop(0.55, "rgba(90,116,138,0.35)");
    lg.addColorStop(0.62, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(fx(0), y0);
    g.lineTo(fx(W), y0 - 260);
    g.lineTo(fx(W), y0 + rand(80, 220));
    g.lineTo(fx(0), y0 + rand(420, 620));
    g.closePath();
    g.fill();
    g.restore();
  }
  // 여백이 넓을수록 사진이 작고 한쪽으로 비켜 선다
  const mainW = 640 - 260 * M.space + rand(-30, 30);
  const tone = (r, gg, b) => {
    const a = gradeLIA(r, gg, b);
    const s2 = gradeLIASepia(r, gg, b);
    const t = M.sepia * 0.75;
    return [a[0] + (s2[0] - a[0]) * t, a[1] + (s2[1] - a[1]) * t, a[2] + (s2[2] - a[2]) * t];
  };

  // 먼 쪽에 LIA 소스 사진이 옅게(물가, 꽃, 옆얼굴 중 하나)
  if (S.length) {
    const w = rand(300, 460);
    const c = feather(srcPiece(pickOne(S), w, w * rand(1.1, 1.4), tone, 1), 0.9);
    g.save();
    g.globalAlpha = 0.22 + 0.3 * M.veil;
    g.drawImage(c, fx(rand(120, 300)) - w / 2, rand(240, 700) - c.height / 2);
    g.restore();
  }

  const n = Math.min(imgs.length, 3);
  const cx = fx(rand(430, 560));
  const cy = rand(470, 600);
  const pics = imgs.slice(0, n).map((im, i) => {
    const w = i === 0 ? mainW : mainW * rand(0.38, 0.55);
    const c = photoCanvas(im, w, tone, i ? { zoom: rand(1, 1.6), ox: Math.random(), oy: Math.random() } : {});
    return { c, x: i === 0 ? cx : fx(rand(180, 720)), y: i === 0 ? cy : rand(300, 940), r: rand(-0.03, 0.03) };
  });
  pics.forEach((p, i) => {
    // 부드러움이 클 때는 반쯤 흔들린 사진처럼(춤추는 사람의 흐린 움직임)
    const moved = M.soft > 0.55 && Math.random() < 0.5 ? motionBlur(p.c, rand(-40, 40), rand(10, 50), 12) : p.c;
    const c = feather(moved, 0.06 + 0.32 * M.soft);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.r);
    g.globalAlpha = i ? 0.82 : 1;
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
    // 빛 번짐(bloom): 흐린 사본을 밝게 겹친다
    const bl = softBlur(c, 9);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.r);
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.1 + 0.2 * M.soft;
    g.drawImage(bl, -bl.width / 2, -bl.height / 2);
    g.restore();
  });

  // 젖은 유리: 화면 한 부분을 떠서 흐리게 다시 얹고 물방울을 맺힌다(veil 이 클수록 넓고 짙다)
  const main = pics[0];
  // 사진의 한쪽 일부만 유리 뒤로: 얼굴이나 중심이 다 가려지지 않게
  const gw = main.c.width * rand(0.28, 0.5) * (0.7 + 0.5 * M.veil);
  const gh = main.c.height * rand(0.45, 0.8);
  const gx = Math.max(0, Math.min(W - gw, Math.random() < 0.5 ? main.x - main.c.width * 0.55 : main.x + main.c.width * 0.55 - gw));
  const gy = Math.max(0, Math.min(H - gh, main.y - main.c.height * rand(0.1, 0.5)));
  const glass = softBlur(snapshot(g, gx, gy, gw, gh), 6 + 7 * M.veil);
  // 유리에 우윳빛을 얹은 뒤 가장자리를 녹여, 네모난 판이 아니라 김이 서린 자리처럼 보이게
  const gx2 = glass.getContext("2d");
  gx2.fillStyle = `rgba(255,255,255,${0.12 + 0.18 * M.veil})`;
  gx2.fillRect(0, 0, glass.width, glass.height);
  feather(glass, 0.9);
  g.save();
  g.globalAlpha = 0.55 + 0.35 * M.veil;
  g.drawImage(glass, gx, gy);
  g.restore();
  droplets(g, gx + gw * 0.12, gy + gh * 0.12, gw * 0.76, gh * 0.76, Math.round(30 + 80 * M.veil));

  // 잎 그림자(물가의 얼룩진 그늘): 반쯤의 작품에만, 부드러움이 클수록 옅게
  if (Math.random() < 0.6) leafShadow(g, 0.1 + 0.12 * (1 - M.soft * 0.5));

  // 한쪽 모서리에서 드는 복숭아빛 햇빛
  const lx = Math.random() < 0.5 ? 0 : W;
  const ly = rand(0, H * 0.4);
  const sun = g.createRadialGradient(lx, ly, 10, lx, ly, rand(500, 800));
  sun.addColorStop(0, "rgba(255,226,200,0.55)");
  sun.addColorStop(1, "rgba(255,226,200,0)");
  g.save();
  g.globalCompositeOperation = "screen";
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);
  g.restore();
  // 따뜻한 필름: 호박빛을 아주 옅게 곱하고, 한쪽 가장자리에 분홍빛 빛샘
  g.save();
  g.globalCompositeOperation = "multiply";
  g.fillStyle = `rgba(244,226,196,${0.12 + 0.18 * M.sepia})`;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "screen";
  const ex = Math.random() < 0.5 ? W : 0;
  const leak = g.createLinearGradient(ex, 0, W - ex, 0);
  leak.addColorStop(0, "rgba(255,190,200,0.35)");
  leak.addColorStop(0.25, "rgba(255,210,190,0)");
  g.fillStyle = leak;
  g.fillRect(0, 0, W, H);
  g.restore();
  // 고운 필름 입자
  grain(g, 4200, (a) => `rgba(120,100,110,${a * 0.08})`, 1.3);
  return bg;
}

// ---------------------------------------------------------------------------
// OL — 찢겨진 질감, 모노톤, 빛번짐, 깨어짐
// ---------------------------------------------------------------------------

/** 깨짐: 한 점에서 유리가 갈라지듯 뻗는 금. 밝은 금과 그 옆의 어두운 그늘을 같이 그어 깨져 보이게 */
function cracks(g, cx, cy, reach) {
  const arms = 8 + Math.floor(Math.random() * 4);
  for (let i = 0; i < arms; i++) {
    let a = (i / arms) * Math.PI * 2 + rand(-0.25, 0.25);
    let x = cx;
    let y = cy;
    const pts = [[x, y]];
    const len = reach * rand(0.45, 1);
    for (let d = 0; d < len; d += rand(14, 30)) {
      a += rand(-0.22, 0.22);
      x += Math.cos(a) * rand(14, 30);
      y += Math.sin(a) * rand(14, 30);
      pts.push([x, y]);
    }
    for (const [col, off, lw] of [["rgba(0,0,0,0.5)", 1.2, 1.6], ["rgba(255,255,255,0.85)", 0, 1.1]]) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      pts.forEach(([px, py], k) => (k ? g.lineTo(px + off, py + off) : g.moveTo(px + off, py + off)));
      g.stroke();
    }
  }
}

/** 깨진 유리 조각: 한 점 둘레에 뾰족한 조각들이 빛을 받아 하얗게 번득인다(소스의 깨진 유리와 빛) */
function shards(g, cx, cy, n, reach) {
  g.save();
  g.globalCompositeOperation = "screen";
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(0.1, 1) * reach;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const len = rand(30, 140);
    const wid = rand(6, 26);
    const b = a + rand(-0.6, 0.6);
    const p1 = [x + Math.cos(b) * len, y + Math.sin(b) * len];
    const p2 = [x + Math.cos(b + Math.PI / 2) * wid, y + Math.sin(b + Math.PI / 2) * wid];
    const lg = g.createLinearGradient(x, y, p1[0], p1[1]);
    lg.addColorStop(0, `rgba(255,255,255,${rand(0.25, 0.6)})`);
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(p1[0], p1[1]);
    g.lineTo(p2[0], p2[1]);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 0.8;
    g.stroke();
  }
  g.restore();
}

/** 빛번짐 한 점: 흰 빛과 한쪽으로 새는 빛줄기 */
function lightBleed(g, x, y, r) {
  g.save();
  g.globalCompositeOperation = "screen";
  const rg = g.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, "rgba(255,250,240,0.9)");
  rg.addColorStop(0.3, "rgba(240,232,220,0.35)");
  rg.addColorStop(1, "rgba(240,232,220,0)");
  g.fillStyle = rg;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.translate(x, y);
  g.rotate(rand(-0.9, -0.3));
  const lg = g.createLinearGradient(0, -r * 0.06, 0, r * 0.06);
  lg.addColorStop(0, "rgba(255,255,255,0)");
  lg.addColorStop(0.5, "rgba(255,255,255,0.55)");
  lg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lg;
  g.fillRect(-r * 1.8, -r * 0.06, r * 3.6, r * 0.12);
  g.restore();
}

/** 손으로 찢은 선: 두 점 사이를 크고 작은 들쭉날쭉함으로 잇는다 */
function tearLine(x0, y0, x1, y1, jag) {
  const n = 28;
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const nl = Math.hypot(nx, ny) || 1;
  const pts = [];
  let drift = 0;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    drift += rand(-1, 1) * jag * 0.5;
    drift *= 0.85;
    const o = drift + rand(-jag, jag) * 0.4;
    pts.push([x0 + (x1 - x0) * t + (nx / nl) * o, y0 + (y1 - y0) * t + (ny / nl) * o]);
  }
  return pts;
}

/** 찢긴 종이의 흰 섬유 가장자리: 거친 흰 선과 잔털 */
function fiberEdge(g, pts, w) {
  g.save();
  g.lineJoin = "round";
  g.strokeStyle = "rgba(236,233,226,0.92)";
  g.lineWidth = w;
  g.beginPath();
  pts.forEach(([x, y], k) => (k ? g.lineTo(x + rand(-0.8, 0.8), y + rand(-0.8, 0.8)) : g.moveTo(x, y)));
  g.stroke();
  g.strokeStyle = "rgba(245,243,238,0.6)";
  g.lineWidth = 0.7;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    for (let h = 0; h < 3; h++) {
      const t = Math.random();
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const a = rand(0, Math.PI * 2);
      const l = rand(2, 7);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
  g.restore();
}

/**
 * 낙서: 거침없는 먹선(또는 흰 분필선). 관성을 가진 펜 끝이 휘감고(loop) 꺾이며(zigzag) 지나간다.
 * 선 굵기는 누르는 힘처럼 들쭉날쭉하고, 같은 길을 두세 번 덧그어 손맛이 난다
 */
function scribble(g, x, y, w, h, col, strokes) {
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let s2 = 0; s2 < strokes; s2++) {
    let px = x + rand(0, w);
    let py = y + rand(0, h);
    let a = rand(0, Math.PI * 2);
    const loopy = Math.random() < 0.55;
    const steps = Math.round(rand(40, 110));
    const pts = [[px, py]];
    for (let k = 0; k < steps; k++) {
      a += loopy ? rand(0.25, 0.6) : (k % 6 < 3 ? 1 : -1) * rand(1.6, 2.6);
      const step = loopy ? rand(5, 11) : rand(10, 22);
      px = Math.max(x, Math.min(x + w, px + Math.cos(a) * step + rand(-2, 2)));
      py = Math.max(y, Math.min(y + h, py + Math.sin(a) * step + (loopy ? rand(-1, 2.5) : rand(-3, 3))));
      pts.push([px, py]);
    }
    for (let pass = 0; pass < 2 + Math.floor(Math.random() * 2); pass++) {
      g.strokeStyle = col;
      g.globalAlpha = rand(0.45, 0.9);
      for (let k = 1; k < pts.length; k++) {
        g.lineWidth = rand(1, 3.6);
        g.beginPath();
        g.moveTo(pts[k - 1][0] + pass * 1.2, pts[k - 1][1] + pass);
        g.lineTo(pts[k][0] + pass * 1.2, pts[k][1] + pass);
        g.stroke();
      }
    }
  }
  g.restore();
}

/** 구겨진 종이 결: 접힌 자국마다 한쪽은 밝게, 한쪽은 어둡게 */
function crumple(g, x, y, w, h, n, alpha) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let k = 0; k < n; k++) {
    const pts = tearLine(x + rand(-0.1, 1.1) * w, y + rand(-0.1, 0.2) * h, x + rand(-0.1, 1.1) * w, y + rand(0.8, 1.1) * h, 18);
    for (const [col, off, lw] of [["rgba(255,255,255,", -1.2, 1.4], ["rgba(0,0,0,", 1.2, 2]]) {
      g.strokeStyle = col + alpha * rand(0.5, 1) + ")";
      g.lineWidth = lw;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px + off, py) : g.moveTo(px + off, py)));
      g.stroke();
    }
  }
  g.restore();
}

/** 손글씨처럼 흘려 쓴 낙서 줄: 가로로 나아가며 작은 고리와 사선이 이어진다. 여러 줄이 얼굴 높이를 덮는다 */
function scrawlRows(g, x, y, w, h, rows, col, wobble) {
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = col;
  for (let k = 0; k < rows; k++) {
    let px = x + rand(-20, 30);
    const base = y + (h * (k + rand(0.2, 0.8))) / rows;
    let py = base;
    g.lineWidth = rand(1.2, 3.2);
    g.globalAlpha = rand(0.55, 0.95);
    g.beginPath();
    g.moveTo(px, py);
    while (px < x + w + rand(-60, 40)) {
      const kind = Math.random();
      if (kind < 0.55) {
        // 고리 한 개
        const r0 = rand(4, 11) * wobble;
        g.bezierCurveTo(px + r0, py - r0 * 2.2, px + r0 * 2.2, py - r0 * 1.6, px + r0 * 1.2, py + rand(-2, 3));
        px += r0 * 1.2;
      } else if (kind < 0.8) {
        // 위로 치켜 긋는 사선
        const l = rand(12, 30);
        g.lineTo(px + l * 0.5, py - l * rand(0.6, 1.4));
        g.lineTo(px + l, py + rand(-3, 4));
        px += l;
      } else {
        // 길게 미끄러지는 획
        const l = rand(30, 80);
        g.quadraticCurveTo(px + l / 2, py + rand(-6, 6), px + l, py + rand(-4, 4));
        px += l;
      }
      py = base + rand(-6, 6) * wobble;
    }
    g.stroke();
  }
  g.restore();
}

/** 빛의 호: 어둠을 가르는 휘어진 빛줄기. 가운데는 희고 가장자리에 주황·파랑 무지개 테가 번진다 */
function lightArc(g, alpha) {
  const c = canvasOf(W / 2, H / 2);
  const x = c.getContext("2d");
  const cx = rand(-0.2, 0.3) * W / 2;
  const cy = rand(-0.4, 0.1) * H / 2;
  const R = rand(0.75, 1.05) * W / 2;
  const a0 = rand(0.1, 0.6);
  const a1 = a0 + rand(0.9, 1.4);
  for (const [col, dr, lw] of [["rgba(255,140,60,0.9)", -9, 7], ["rgba(255,250,240,1)", 0, 9], ["rgba(70,140,255,0.9)", 10, 8]]) {
    x.strokeStyle = col;
    x.lineWidth = lw;
    x.beginPath();
    x.arc(cx, cy, R + dr, a0, a1);
    x.stroke();
  }
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = alpha;
  g.drawImage(softBlur(c, 3), 0, 0, W, H);
  g.restore();
}

/** 입자 빛 번짐: 어둠 속에 흩날리는 고운 입자로 된 빛(필름 입자가 보이는 흰 빛) */
function grainyLight(g, alpha) {
  const c = canvasOf(W / 3, H / 3);
  const x = c.getContext("2d");
  for (let k = 0; k < 5; k++) {
    const px = rand(0, W / 3);
    const py = rand(0, H / 3);
    const rg = x.createRadialGradient(px, py, 0, px, py, rand(20, 70));
    rg.addColorStop(0, "rgba(255,255,255,0.9)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg;
    x.save();
    x.translate(px, py);
    x.scale(rand(1.8, 3.2), 1);
    x.translate(-px, -py);
    x.fillRect(0, 0, W / 3, H / 3);
    x.restore();
  }
  // 입자: 빛이 있는 곳만 점점이
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = Math.random() * 255 < d.data[i + 3] * 1.1 ? 255 : 0;
  x.putImageData(d, 0, 0);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = alpha;
  g.drawImage(softBlur(c, 1.3), 0, 0, W, H);
  g.restore();
}

/** 잉크 손자국: 다섯 손가락을 끌고 간 마른 먹 자국과 흘러내린 가는 줄기, 작은 튐 */
function inkHand(g, x, y, s, a) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = "rgba(14,13,12,0.85)";
  for (let f = 0; f < 5; f++) {
    const ang = -0.9 + f * 0.42 + rand(-0.08, 0.08);
    const len = s * rand(0.6, 1.1);
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      const px = Math.cos(ang) * (s * 0.35 + len * t);
      const py = Math.sin(ang) * (s * 0.35 + len * t);
      if (Math.random() < 0.18) continue;
      g.globalAlpha = rand(0.35, 0.9);
      g.beginPath();
      g.ellipse(px, py, s * 0.07 * (1 - t * 0.5), s * 0.035, ang, 0, Math.PI * 2);
      g.fill();
    }
  }
  // 손바닥: 마른 붓처럼 갈라진 결
  for (let k = 0; k < 140; k++) {
    g.globalAlpha = rand(0.15, 0.6);
    g.fillRect(rand(-s * 0.3, s * 0.3), rand(-s * 0.25, s * 0.25), rand(1, 3), rand(4, 12));
  }
  // 흘러내린 줄기와 튄 먹
  g.strokeStyle = "rgba(14,13,12,0.85)";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(s * 0.3, s * 0.1);
  g.bezierCurveTo(s * 0.6, s * 0.3, s * 0.9, s * 0.5, s * 1.3, s * 0.75);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    g.globalAlpha = 0.8;
    g.beginPath();
    g.arc(rand(-s, s), rand(-s, s), rand(1, 4), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** 불규칙한 덩어리 모양의 점들: 타원의 반지름을 느린 물결과 잔떨림으로 흔든다(네모를 벗어난 자유로운 윤곽) */
function blobPoints(w, h, rough) {
  const n = 64;
  const ph = [rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)];
  const amp = [rand(0.06, 0.16), rand(0.03, 0.09), rand(0.01, 0.04)].map((a) => a * (0.6 + rough));
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const m = 1 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(5 * a + ph[1]) + amp[2] * Math.sin(11 * a + ph[2]) + rand(-0.012, 0.012) * rough;
    pts.push([(Math.cos(a) * w * m) / 2, (Math.sin(a) * h * m) / 2]);
  }
  return pts;
}
function tracePoints(g, pts, scale = 1, jit = 0) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x * scale + rand(-jit, jit);
    const py = y * scale + rand(-jit, jit);
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  });
  g.closePath();
}

/** 낙서 같은 외곽선: 같은 윤곽을 손으로 여러 번, 조금씩 어긋나게 덧긋고 몇 획은 밖으로 삐져나간다 */
function sketchOutline(g, pts, col, passes) {
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = col;
  for (let k = 0; k < passes; k++) {
    g.globalAlpha = rand(0.45, 0.9);
    g.lineWidth = rand(0.7, 1.8);
    const sc = rand(0.98, 1.06);
    // 한 바퀴를 다 돌지 않고 끊기는 획이 손맛을 낸다
    const start = Math.floor(rand(0, pts.length));
    const len = Math.floor(rand(0.55, 1.05) * pts.length);
    g.beginPath();
    for (let i = 0; i <= len; i++) {
      const [x, y] = pts[(start + i) % pts.length];
      const px = x * sc + rand(-3, 3);
      const py = y * sc + rand(-3, 3);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    // 밖으로 삐져나가는 짧은 획
    const [ex, ey] = pts[(start + len) % pts.length];
    g.beginPath();
    g.moveTo(ex * sc, ey * sc);
    g.lineTo(ex * sc * rand(1.08, 1.3) + rand(-20, 20), ey * sc * rand(1.08, 1.3) + rand(-20, 20));
    g.stroke();
  }
  g.restore();
}

/**
 * 어둠 위의 흑백. 관객 사진은 찢겨진 종이에 인화된 것처럼 놓이고(torn), 반쯤은 흔들려 번진다.
 * 얼굴 높이를 손글씨 같은 낙서 줄이 덮고(흰 분필 또는 먹), 어둠을 가르는 빛의 호와 입자 빛이 번진다(bleed).
 * 가끔 잉크 손자국이 남고, crack 이 크면 깨진 금이 지난다. mono 가 낮으면 차가운 푸른 빛이 섞인다.
 * 사진 수(세 장까지)와 재료 사진(시선 폴더에서 무작위 1~3장)의 비율은 작품마다 다르다
 */
function drawOL(g, imgs, T, S, M, P) {
  const [ar, , ab] = P.avg;
  const bg = ar > ab ? "#100f0e" : "#0b0d11";
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const mirror = Math.random() < 0.5;
  const fx = (x) => (mirror ? W - x : x);
  const tone = (r, gg, b) => gradeOL(r, gg, b);
  const amt = 0.75 + 0.25 * M.mono;
  const jag = 6 + 12 * M.torn;

  /**
   * 자유로운 윤곽으로 오려 낸 사진 한 장: 네모 대신 불규칙한 덩어리 모양, 가장자리 일부는 찢긴 섬유,
   * 둘레를 낙서 같은 외곽선이 여러 번 감싼다(흰 분필 또는 먹). 종이의 접힌 자국은 남긴다
   */
  const tornSheet = (c, x, y, r, a = 1) => {
    const w = c.width;
    const h = c.height;
    const pts = blobPoints(w * 0.98, h * 0.98, M.torn);
    g.save();
    g.translate(x, y);
    g.rotate(r);
    g.globalAlpha = a;
    g.save();
    tracePoints(g, pts);
    g.clip();
    g.drawImage(c, -w / 2, -h / 2);
    crumple(g, -w / 2, -h / 2, w, h, 2 + Math.round(4 * M.torn), 0.18);
    // 가장자리 안쪽을 어둠으로 살짝 녹여 네모난 인화지 느낌을 지운다
    const rg = g.createRadialGradient(0, 0, Math.min(w, h) * 0.3, 0, 0, Math.max(w, h) * 0.56);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = rg;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
    // 윤곽 한 구간은 찢긴 종이 섬유
    const from = Math.floor(rand(0, pts.length));
    const seg = Array.from({ length: Math.floor(pts.length * rand(0.2, 0.45)) }, (_, k) => pts[(from + k) % pts.length]);
    fiberEdge(g, seg, rand(2, 3.5));
    // 낙서 같은 외곽선
    const light = Math.random() < 0.65;
    sketchOutline(g, pts, light ? "rgba(240,238,233,0.85)" : "rgba(20,16,16,0.9)", 1 + Math.round(rand(1, 2)));
    g.restore();
  };

  // 재료 사진: 어두운 곳은 사라지고 빛만 남게 크게 겹친다
  S.forEach((src, k) => {
    const w = rand(500, 820);
    g.save();
    g.globalCompositeOperation = "screen";
    g.globalAlpha = (0.25 + 0.35 * M.bleed) / (k + 1);
    g.translate(fx(rand(300, 600)), rand(360, 760));
    g.rotate(rand(-0.3, 0.3));
    const c = srcPiece(src, w, w * 1.3, tone, 0.9);
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
  });

  // 관객 사진: 크게 한 장(찢겨진 종이에 인화), 나머지는 작게. 반쯤은 흔들려 번진다
  const pw = rand(540, 700);
  let pc = photoCanvas(imgs[0], pw, tone, { amt });
  if (Math.random() < 0.5) pc = motionBlur(pc, rand(-50, 50), rand(-20, 20), 10);
  if (M.mono < 0.55) {
    // 차가운 푸른 빛: 밝은 곳 가장자리에 파란 테
    const t = pc.getContext("2d");
    t.globalCompositeOperation = "color";
    t.fillStyle = "rgba(60,120,230,0.35)";
    t.fillRect(0, 0, pc.width, pc.height);
  }
  const ph = pc.height;
  const cx = fx(rand(420, 480));
  const cy = rand(500, 620);
  const rot = rand(-0.05, 0.05);
  tornSheet(pc, cx, cy, rot);
  imgs.slice(1, 3).forEach((im) => {
    const w = rand(220, 320);
    const c = photoCanvas(im, w, tone, { amt, zoom: rand(1, 1.5), ox: Math.random(), oy: Math.random() });
    tornSheet(c, fx(rand(560, 760)), rand(760, 980), rand(-0.25, 0.25));
  });

  // 찢긴 틈 한두 곳(흰 섬유 가장자리, 틈으로 새는 빛)
  const rips = Math.round(M.torn * 1.4);
  for (let k = 0; k < rips; k++) {
    const a0 = rand(0.2, 0.8);
    const p0 = [cx + (a0 - 0.5) * pw * 0.8, cy - ph * 0.42];
    const p1 = [cx + (a0 - 0.5 + rand(-0.3, 0.3)) * pw, cy + ph * rand(-0.1, 0.5)];
    const line = tearLine(p0[0], p0[1], p1[0], p1[1], jag);
    const gap = rand(4, 8) + 10 * M.torn;
    const L = line.map(([x, y]) => [x - gap / 2, y]);
    const R = line.map(([x, y]) => [x + gap / 2, y]);
    g.fillStyle = bg;
    g.beginPath();
    [...L, ...[...R].reverse()].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    fiberEdge(g, L, rand(2, 3.5));
    fiberEdge(g, R, rand(2, 3.5));
  }

  // 손글씨 낙서 줄: 사진의 위쪽 3분의 1~가운데(얼굴 높이)를 가로로 덮는다
  const light = Math.random() < 0.6;
  scrawlRows(g, cx - pw / 2 - 30, cy - ph * rand(0.42, 0.3), pw + 60, ph * rand(0.3, 0.5), 3 + Math.round(5 * rand(0.3, 1)), light ? "rgba(238,236,232,0.95)" : "rgba(20,14,16,0.95)", rand(0.8, 1.3));

  // 잉크 손자국: 가끔
  if (Math.random() < 0.35) inkHand(g, fx(rand(150, 750)), rand(200, 900), rand(70, 120), rand(-0.6, 0.6));

  // 깨짐: crack 이 클 때만 가늘게
  if (M.crack > 0.6) cracks(g, cx + pw * rand(-0.25, 0.25), cy + ph * rand(-0.2, 0.2), 80 + 160 * M.crack);

  // 빛번짐: 빛의 호, 입자 빛, 사진의 밝은 곳이 흐리게 번진다
  if (Math.random() < 0.45) lightArc(g, 0.3 + 0.3 * M.bleed);
  grainyLight(g, 0.18 + 0.25 * M.bleed);
  const shot = snapshot(g, 0, 0, W, H);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.2 + 0.35 * M.bleed;
  g.drawImage(softBlur(shot, 14), 0, 0);
  g.restore();

  // 거친 그레인과 가장자리 어둠
  grain(g, 9000, (a) => (a > 0.5 ? `rgba(255,255,255,${(a - 0.5) * 0.14})` : `rgba(0,0,0,${a * 0.3})`), 1.3);
  const vg = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 800);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return bg;
}

// ---------------------------------------------------------------------------
// LET — 비비드한 색감, 생동감, 에너지, 겹침·레이어
// ---------------------------------------------------------------------------

/**
 * 두껍게 바른 붓 자국 한 획(소스의 대각선 붓 터치·물감 덩어리).
 * 매끈한 면 대신 털 자국을 수십 줄 겹친다: 줄마다 시작과 끝이 달라 가장자리가 거칠고, 끝은 물감이 모자라 갈라지며,
 * 가끔 다른 물감(mix)과 흰 물감이 섞인 줄이 지나고, 위쪽에는 끊어진 윤이 난다
 */
function brush(g, x0, y0, x1, y1, w, col, mix) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const bend = rand(-0.06, 0.06) * len;
  g.save();
  g.translate(x0, y0);
  g.rotate(Math.atan2(y1 - y0, x1 - x0));
  g.lineCap = "round";
  // 털 사이가 비지 않게 옅은 바탕을 거칠게 한 겹
  g.fillStyle = col;
  g.globalAlpha = 0.55;
  g.beginPath();
  const n0 = 18;
  for (let k = 0; k <= n0; k++) g.lineTo((len * k) / n0, -w / 2 + rand(0, w * 0.18) + bend * Math.sin((Math.PI * k) / n0));
  for (let k = n0; k >= 0; k--) g.lineTo((len * k) / n0 - rand(0, w * 0.3) * (k === n0 ? 1 : 0), w / 2 - rand(0, w * 0.18) + bend * Math.sin((Math.PI * k) / n0));
  g.closePath();
  g.fill();
  const n = Math.round(w / 1.3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = -w / 2 + t * w + rand(-0.8, 0.8);
    const s0 = rand(0, w * 0.7);
    const e0 = len - rand(0, w * 1.4);
    const pc = Math.random();
    g.strokeStyle = pc < 0.12 && mix ? shade(mix, rand(-10, 20)) : pc < 0.18 ? "rgba(250,246,236,0.9)" : shade(col, rand(-40, 34));
    g.globalAlpha = rand(0.55, 0.95);
    g.lineWidth = rand(1.4, 3.4);
    g.beginPath();
    g.moveTo(s0, y);
    g.quadraticCurveTo(len / 2, y + bend * Math.sin(Math.PI * 0.5) + rand(-1.5, 1.5), e0, y + rand(-2, 2));
    g.stroke();
  }
  // 끝이 갈라진 마른 붓
  for (let i = 0; i < n * 0.7; i++) {
    const y = rand(-w / 2, w / 2);
    const st = len - rand(w * 0.3, w * 1.1);
    g.strokeStyle = shade(col, rand(-30, 20));
    g.globalAlpha = rand(0.3, 0.8);
    g.lineWidth = rand(0.7, 1.8);
    g.beginPath();
    g.moveTo(st, y);
    g.lineTo(st + rand(w * 0.3, w * 1.2), y + rand(-2.5, 2.5));
    g.stroke();
  }
  // 끊어진 윤
  for (let k = 0; k < 3; k++) {
    const a0 = rand(0.1, 0.6) * len;
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.globalAlpha = rand(0.3, 0.6);
    g.lineWidth = rand(1, 2.4);
    g.beginPath();
    const yy = -w * rand(0.18, 0.36);
    g.moveTo(a0, yy);
    g.lineTo(a0 + rand(30, 110), yy + rand(-2, 2));
    g.stroke();
  }
  g.restore();
}

/** 비비드한 색종이 한 장: 가위로 자른 듯 살짝 고르지 않은 면. 곱하기로 겹쳐, 겹친 자리마다 새 색이 생긴다 */
function colorPaper(g, x, y, w, h, r, col, alpha = 0.88) {
  g.save();
  g.translate(x, y);
  g.rotate(r);
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = alpha;
  g.fillStyle = col;
  tornPath(g, w, h, 2.5);
  g.fill();
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 0.08;
  for (let i = 0; i < 220; i++) {
    g.fillStyle = Math.random() < 0.5 ? "#fff" : "#000";
    g.fillRect(rand(-w / 2, w / 2), rand(-h / 2, h / 2), 2, 2);
  }
  g.restore();
}

/**
 * 쨍한 사진 필름 한 장: 색을 입힌 사진을 반투명하게 겹친다(이중 노출).
 * 곱하기와 밝게(screen)를 번갈아 써서, 필름끼리 겹친 자리에 새 색과 새 장면이 생긴다. 반쯤은 필름 테두리와 구멍이 남는다
 */
function filmFrame(g, c, x, y, w, h, r, tint, op, rebate) {
  g.save();
  g.translate(x, y);
  g.rotate(r);
  g.globalCompositeOperation = op;
  g.globalAlpha = op === "screen" ? 0.85 : 0.9;
  g.drawImage(c, 0, 0, c.width, Math.min(c.height, h * (c.width / w)), -w / 2, -h / 2, w, h);
  // 필름의 색: 사진 위에 쨍한 색을 한 겹 덮어 그 색으로 물들인다
  g.globalCompositeOperation = op === "screen" ? "multiply" : "overlay";
  g.globalAlpha = 0.45;
  g.fillStyle = tint;
  g.fillRect(-w / 2, -h / 2, w, h);
  if (rebate) {
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 0.88;
    const bw = Math.max(18, h * 0.07);
    g.fillStyle = "#1a1410";
    g.fillRect(-w / 2, -h / 2 - bw, w, bw);
    g.fillRect(-w / 2, h / 2, w, bw);
    g.fillStyle = "rgba(255,236,200,0.85)";
    for (let k = -w / 2 + 10; k < w / 2 - 14; k += 26) {
      g.fillRect(k, -h / 2 - bw * 0.72, 12, bw * 0.44);
      g.fillRect(k, h / 2 + bw * 0.28, 12, bw * 0.44);
    }
  }
  g.restore();
}

/** 반투명 색 젤 필름 한 장: 겹친 자리에 새 색이 생기고, 윤과 잔 긁힘, 접힌 가장자리가 보인다 */
function gelSheet(g, x, y, w, h, r, col) {
  g.save();
  g.translate(x, y);
  g.rotate(r);
  const rr = Math.min(w, h) * rand(0.04, 0.18);
  const shape = () => {
    g.beginPath();
    g.moveTo(-w / 2 + rr, -h / 2);
    g.lineTo(w / 2 - rr, -h / 2 + rand(-6, 6));
    g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
    g.lineTo(w / 2 + rand(-8, 8), h / 2 - rr);
    g.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2);
    g.lineTo(-w / 2 + rr, h / 2 + rand(-6, 6));
    g.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr);
    g.lineTo(-w / 2 + rand(-8, 8), -h / 2 + rr);
    g.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
    g.closePath();
  };
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = rand(0.72, 0.92);
  g.fillStyle = col;
  shape();
  g.fill();
  // 접힌 가장자리: 같은 색을 더 진하게
  g.globalAlpha = 0.55;
  g.strokeStyle = shade(col, -60);
  g.lineWidth = rand(3, 9);
  shape();
  g.stroke();
  g.save();
  shape();
  g.clip();
  // 윤: 한쪽 위에서 비스듬히 드는 빛
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 1;
  const lg = g.createLinearGradient(-w / 2, -h / 2, -w / 2 + w * 0.5, -h / 2 + h * 0.5);
  lg.addColorStop(0, "rgba(255,255,255,0.45)");
  lg.addColorStop(0.4, "rgba(255,255,255,0)");
  g.fillStyle = lg;
  g.fillRect(-w / 2, -h / 2, w, h);
  // 잔 긁힘
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 0.6;
  for (let k = 0; k < 40; k++) {
    const px = rand(-w / 2, w / 2);
    const py = rand(-h / 2, h / 2);
    const a = rand(-0.8, -0.3);
    const l = rand(6, 40);
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
  g.restore();
}

/**
 * 반투명한 색 젤 필름이 겹치고(layer, 겹친 자리마다 새 색), 관객 사진은 색이 갈라진 쨍한 필름이 되어 이중 노출처럼 겹친다(overlap, vivid).
 * 젤은 energy 만큼 기울어 생동감을 준다(빛번짐·붓 자국·필름 구멍 같은 장식은 넣지 않는다). 바탕은 옅은 회백색 벽이나 파란 하늘.
 * 색은 주황·빨강·코발트·분홍·청록·와인에 관객 사진의 진한 색을 섞는다. 재료 사진(시선 폴더 무작위 1~3장)도 젤처럼 겹친다
 */
function drawLET(g, imgs, T, S, M, P) {
  const sky = Math.random() < 0.45;
  const bg = sky ? "#4f7fae" : "#e7e4e2";
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  grain(g, 6000, (a) => `rgba(${sky ? "255,255,255" : "70,60,60"},${a * 0.08})`, 1.4);
  const mirror = Math.random() < 0.5;
  const fx = (x) => (mirror ? W - x : x);
  const base = ["#ff6a2b", "#e8121f", "#2233d6", "#e8788a", "#0f3d4a", "#7a1428", "#ff9a3c"];
  const color = () => (P.vivid.length && Math.random() < 0.4 ? pickOne(P.vivid) : pickOne(base));
  const tone = (r, gg, b) => gradeLET(r, gg, b);
  const amt = 0.55 + 0.45 * M.vivid;

  // 색 젤 필름(layer 가 클수록 장수가 많고, energy 가 클수록 더 기울어 생동감이 난다)
  const gels = 3 + Math.round(M.layer * 4);
  const tilt = 0.15 + 0.35 * M.energy;
  for (let k = 0; k < gels; k++) {
    gelSheet(g, fx(rand(120, 780)), rand(140, 1040), rand(280, 620), rand(220, 520), rand(-tilt, tilt), color());
  }
  // 재료 사진도 젤처럼 곱하기로 겹친다
  S.forEach((src) => {
    const w = rand(300, 520);
    const c = srcPiece(src, w, w * rand(0.7, 1.2), tone, 0.6);
    g.save();
    g.translate(fx(rand(150, 750)), rand(200, 1000));
    g.rotate(rand(-0.3, 0.3));
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = rand(0.6, 0.85);
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
  });

  // 관객 사진: 색이 갈라진 쨍한 필름으로, 이중 노출처럼 겹친다(overlap 이 클수록 겹이 많다). 올린 사진은 모두 쓴다
  const layers = Math.max(imgs.length, 2 + Math.round(M.overlap * 2));
  const tints = ["#ff2d55", "#00b3ff", "#ffd400", "#ff6a00", "#7a3cff", ...P.vivid];
  for (let k = 0; k < layers; k++) {
    const im = imgs[k % imgs.length];
    const w = k === 0 ? rand(460, 580) : rand(320, 460);
    let c = photoCanvas(im, w, tone, k === 0 ? { amt } : { amt, zoom: rand(1.1, 1.9), ox: Math.random(), oy: Math.random() });
    c = rgbSplit(c, rand(3, 6) + 6 * M.vivid);
    const h = k === 0 ? c.height : c.height * rand(0.6, 0.9);
    const x = k === 0 ? fx(rand(400, 500)) : fx(rand(250, 650));
    const y = k === 0 ? rand(440, 560) : rand(300, 860);
    const r = k === 0 ? rand(-0.06, 0.06) : rand(-0.22, 0.22);
    filmFrame(g, c, x, y, w, h, r, pickOne(tints), k === 0 ? "source-over" : k % 2 ? "multiply" : "screen", false);
  }

  return bg;
}

/** 재료가 없을 때의 햇빛: 방사형 번짐과 빛줄기 */
function drawSun(g) {
  g.save();
  g.globalCompositeOperation = "screen";
  const sun = g.createRadialGradient(W - 90, 80, 10, W - 90, 80, 420);
  sun.addColorStop(0, "rgba(255,244,190,0.8)");
  sun.addColorStop(0.35, "rgba(255,190,90,0.25)");
  sun.addColorStop(1, "rgba(255,150,60,0)");
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);
  // 빛줄기
  for (let k = 0; k < 5; k++) {
    g.fillStyle = `rgba(255,240,200,${rand(0.06, 0.14)})`;
    g.beginPath();
    g.moveTo(W - 120, 110);
    const a0 = 1.9 + k * 0.32;
    g.lineTo(W - 120 + Math.cos(a0) * 1500, 110 + Math.sin(a0) * 1500);
    g.lineTo(W - 120 + Math.cos(a0 + 0.08) * 1500, 110 + Math.sin(a0 + 0.08) * 1500);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** AI가 시선의 화풍으로 다시 그린 이미지. 시선마다 다른 틀에 담는다 */
function drawArt(g, im, artist) {
  const w = artist === "LIA" ? W * 0.62 : W * 0.86;
  const h = Math.min(H * 0.86, w * (im.height / im.width));
  const cx = artist === "LIA" ? W * 0.58 : W / 2;
  const cy = H / 2;
  g.save();
  g.translate(cx, cy);
  if (artist === "OL") {
    g.fillStyle = "#f4f2ec";
    tornPath(g, w + 22, h + 22, 16);
    g.fill();
    tornPath(g, w, h, 12);
    g.clip();
  } else if (artist === "LET") {
    g.fillStyle = "#00c2e0";
    g.fillRect(-w / 2 + 20, -h / 2 + 20, w, h);
  } else {
    g.fillStyle = "#ffffff";
    g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
  }
  const k = Math.max(w / im.width, h / im.height);
  g.beginPath();
  g.rect(-w / 2, -h / 2, w, h);
  g.clip();
  g.drawImage(im, (-im.width * k) / 2, (-im.height * k) / 2, im.width * k, im.height * k);
  g.restore();
}

export async function renderCollage({ photos, artist, art, title = "", line = "", tags = [], entryKey = "------", emotion = "", date, sign = "" }) {
  const fonts = fontsReady();
  // 1) 시선의 그림을 900x1200 캔버스에 그대로 그린다(시선별 구도는 이 크기를 기준으로 짜여 있다)
  const art0 = document.createElement("canvas");
  art0.width = W;
  art0.height = H;
  const a = art0.getContext("2d");
  a.fillStyle = BG[artist] || BG.LIA;
  a.fillRect(0, 0, W, H);
  const [imgs, T, Sall] = await Promise.all([art ? Promise.all([loadImage(art)]) : Promise.all(photos.map(loadImage)), loadTextures(artist), loadSources(artist)]);
  // 이번 작품의 비율과 관객 사진의 색. 같은 사진·같은 시선이어도 엮을 때마다 다른 한 장이 된다
  const M = mixFor(artist);
  // 재료 사진은 시선 폴더에서 매번 무작위로 1~3장. 어떤 사진이 얼마나 섞일지도 작품마다 다르다
  const picked = [...Sall].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  // 섞는 방식이 붙은 소스는 마지막에 그대로 얹고, 나머지는 시선마다 보정해 조각으로 쓴다
  const S = picked.filter((im) => !im.blend);
  const blended = picked.filter((im) => im.blend);
  const P = photoPalette(imgs);
  // 시선마다 그린 바탕색을 돌려받아, 아래 2) 에서 그림 둘레의 여백도 같은 색으로 잇는다
  let bg = BG[artist] || BG.LIA;
  if (art) drawArt(a, imgs[0], artist);
  else if (artist === "OL") bg = drawOL(a, imgs, T, S, M, P) || bg;
  else if (artist === "LET") bg = drawLET(a, imgs, T, S, M, P) || bg;
  else bg = drawLIA(a, imgs, T, S, M, P) || bg;
  if (!art && blended.length) applySources(a, blended);

  // 2) 작품: 위쪽(띠 위)에 그림을 담는다. 그림의 가운데 부분을 비율 그대로 줄여 넣고,
  //    좌우와 위 가장자리를 바탕에 스며들게 해 잘린 경계가 보이지 않게 한다
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const sy = 110;
  const sh = 980;
  const k = BAND_Y / sh;
  const dw = Math.round(W * k);
  const crop = document.createElement("canvas");
  crop.width = dw;
  crop.height = BAND_Y;
  const cg = crop.getContext("2d");
  cg.drawImage(art0, 0, sy, W, sh, 0, 0, dw, BAND_Y);
  cg.globalCompositeOperation = "destination-in";
  const fx = cg.createLinearGradient(0, 0, dw, 0);
  fx.addColorStop(0, "rgba(0,0,0,0)");
  fx.addColorStop(0.07, "rgba(0,0,0,1)");
  fx.addColorStop(0.93, "rgba(0,0,0,1)");
  fx.addColorStop(1, "rgba(0,0,0,0)");
  cg.fillStyle = fx;
  cg.fillRect(0, 0, dw, BAND_Y);
  const fy = cg.createLinearGradient(0, 0, 0, BAND_Y);
  fy.addColorStop(0, "rgba(0,0,0,0)");
  fy.addColorStop(0.05, "rgba(0,0,0,1)");
  fy.addColorStop(1, "rgba(0,0,0,1)");
  cg.fillStyle = fy;
  cg.fillRect(0, 0, dw, BAND_Y);
  g.drawImage(crop, (W - dw) / 2, 0);

  // 3) 글 띠: 제목 · 글귀 · 태그 · 서명 줄
  await fonts;
  const pal = BAND[artist] || BAND.LIA;
  g.fillStyle = pal.band;
  g.fillRect(0, BAND_Y, W, H - BAND_Y);
  g.strokeStyle = "rgba(80,60,35,0.18)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, BAND_Y);
  g.lineTo(W, BAND_Y);
  g.stroke();

  const L = 70;
  // 작품 제목 — 감정 낱말 대신 이 한 장에 붙인 이름. 감정은 아래 서명 줄에 작게 남긴다
  g.fillStyle = pal.ink;
  g.font = "700 50px 'Nanum Myeongjo', serif";
  g.fillText(wrap(g, title || emotion || "이름 없는 마음", W - L * 2, 1)[0], L, BAND_Y + 74);
  // 글귀: 관객의 글에서 마음이 머문 한 줄
  if (line) {
    g.font = "italic 29px 'Nanum Myeongjo', serif";
    g.fillStyle = pal.soft;
    wrap(g, line, W - L * 2, 2).forEach((ln, i) => g.fillText(ln, L, BAND_Y + 136 + i * 40));
  }
  g.font = "21px monospace";
  g.fillStyle = pal.soft;
  g.fillText(tags.join("  "), L, BAND_Y + 232);
  g.strokeStyle = "rgba(80,60,35,0.16)";
  g.beginPath();
  g.moveTo(L, BAND_Y + 262);
  g.lineTo(W - L, BAND_Y + 262);
  g.stroke();
  g.fillStyle = pal.ink;
  g.font = "700 27px 'Nanum Myeongjo', serif";
  g.fillText(`LIAOLLET × ${artist}`, L, BAND_Y + 308);
  g.font = "19px monospace";
  g.fillStyle = pal.soft;
  g.textAlign = "right";
  g.fillText(`${emotion ? emotion + "  ·  " : ""}TICKET ${entryKey}`, W - L, BAND_Y + 308);
  g.fillText(`감정의 다락방 · ${date || new Date().toLocaleDateString("ko-KR")}`, W - L, BAND_Y + 338);
  g.textAlign = "left";
  // 작품 안의 서명란: 손으로 적은 듯 펜 글씨로. 비어 있으면 적을 자리만 옅게 남긴다
  g.font = "38px 'Nanum Pen Script', cursive";
  g.fillStyle = sign ? pal.ink : "rgba(110,90,70,0.35)";
  g.fillText(sign ? `from. ${sign}` : "from. ________", L, BAND_Y + 352);

  return c.toDataURL("image/jpeg", 0.86);
}


/** LLM에 보낼 작은 썸네일. 긴 변 384px jpeg로 줄여 요청 크기와 비용을 낮춘다 */
export async function thumb(src, max = 384) {
  const img = await loadImage(src);
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

/**
 * 올린 사진을 긴 변 maxSide px jpeg로 줄인다. 폰 사진(수 MB)을 그대로 들고 다니면
 * 오래된 폰에서 콜라주를 그리다 멈출 수 있다. 1600px이면 작품(900x1200)에 충분하다
 */
export function shrinkPhoto(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * k);
      c.height = Math.round(im.naturalHeight * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("사진을 열 수 없어요"));
    };
    im.src = url;
  });
}
