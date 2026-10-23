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
//   OL  — 거칠게 찢긴 종이, 모노톤, 두꺼운 초크 낙서, 빛번짐
//   LET — 비비드한 색감, 생동감, 에너지, 겹침·레이어
// 관객이 올린 첫 사진이 늘 화면 대부분을 차지하고, 시선의 효과는 그 위에 화풍으로 입힌다.
// 같은 시선이라도 작품마다 달라지게, 네 가지를 매번 섞는다.
//   1) 여섯 스타일(pickVariant): 바탕색·보정·사진의 형태·재료가 스타일마다 다르다. 한 바퀴에 여섯이 모두 나온다
//   2) 스타일마다 정해 둔 소스 사진(public/artists, public/collage)이 사진 둘레와 결로 스민다
//   3) 네 가지 특성의 비율(mixFor): 같은 스타일 안에서도 세기가 매번 다르다
//   4) 관객 사진에서 뽑은 색(photoPalette)이 종이 톤·색면에 섞이고, 자리와 좌우가 매번 흔들린다
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

/**
 * 시선마다 콜라주 스타일이 여섯 가지(LIA_LOOKS, OL_LOOKS, LET_LOOKS). 모두를 섞은 한 바퀴에서 차례로 꺼내,
 * 모든 스타일이 한 번씩 나오기 전에는 같은 스타일이 다시 나오지 않게 한다(바퀴가 바뀔 때도 바로 이어서 같은 스타일은 피한다).
 * window.__lvVariant 에 번호를 넣으면 그 스타일로 고정된다(여섯 스타일을 한 번에 확인하는 리뷰 촬영용)
 */
const variantBag = {};
const lastVariant = {};
function pickVariant(artist) {
  const forced = typeof window !== "undefined" ? window.__lvVariant : undefined;
  const n = LOOKS[artist]?.length || 6;
  if (Number.isInteger(forced)) return ((forced % n) + n) % n;
  if (!variantBag[artist]?.length) {
    const bag = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
    if (bag[bag.length - 1] === lastVariant[artist]) bag.unshift(bag.pop());
    variantBag[artist] = bag;
  }
  return (lastVariant[artist] = variantBag[artist].pop());
}

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
  // 운영자 소스(public/collage)와 시선 폴더 사진(public/artists)을 모두 재료로 쓴다. 스타일마다 정해 둔 소스를 이름으로 찾는다
  const list = [...(COLLAGE_SOURCES[artist] || []), ...(ARTIST_PHOTOS[artist] || []).map((src) => ({ src, blend: "" }))];
  srcCache[artist] ??= Promise.all(
    list.map((s) =>
      loadImage(s.src)
        .then((im) => Object.assign(im, { blend: s.blend, name: decodeURIComponent(s.src.split("/").pop()).replace(/\.[a-z]+$/i, "").replace(/^(screen|multiply|overlay|soft-light|normal)-/, "") }))
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

// LIA: 물가의 햇빛, 젖은 유리 너머 꽃, 볼이 붉은 옆모습처럼 밝고 공기 같은 톤.
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
// OL: 깨진 유리와 빛, 어둠 속 실루엣. 검은 곳을 더 깊게 누르고 밝은 곳만 남기는 강한 흑백, 살짝 차가운 빛
const gradeOL = (r, g, b) => {
  const l = luma(r, g, b) / 255;
  const s = 1 / (1 + Math.exp(-11 * (l - 0.56)));
  const v = Math.pow(s, 1.15) * 250 + (Math.random() - 0.5) * 30;
  return [v, v, v];
};

// LET: 광택 있는 재료 사진처럼 쨍하게
const gradeLET = (r, g, b) => {
  // 채도를 크게 올리고 S 곡선으로 대비를 준다. 색을 계단처럼 끊지 않아(포스터화 없이) 광택 있는 사진처럼 매끈하다
  const l = luma(r, g, b);
  const sat = 1.75;
  const s = (v) => 255 / (1 + Math.exp(-(v - 128) / 40));
  return [s(l + (r - l) * sat + 10), s(l + (g - l) * sat + 2), s(l + (b - l) * sat - 4)];
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
  g.drawImage(softBlur(c, 3.6), 0, 0, W, H);
  g.restore();
}

// LIA 보정들. 같은 "밝고 공기 같은" 정서 안에서 색의 온도와 재료가 확연히 다르게 갈린다
/**
 * LIA 여섯 스타일. 색만 바꾸지 않고 구성 자체를 달리한다(운영자가 고른 여섯 장).
 *  0 dapple  나무 그림자 얼룩. 회갈색 흑백 사진 위와 둘레로 잎 그늘이 크게 덩어리져 번진다
 *  1 lake    잔잔한 호수. 위쪽에 물결이 일렁이고 아래는 하얗고 깨끗한 바닥, 사진 위로 옅은 푸른 나뭇잎 그림자
 *  2 print   결 있는 새하얀 종이 위에 흰 테를 두른 인화 두 장. 또렷하고 맑게, 종이 그늘만
 *  3 window  따뜻한 창문 그림자. 라일락빛 회색 벽에 창살 모양 햇빛이 비스듬히 비치고, 사진이 그 앞에 실루엣처럼 선다
 *  4 haze    뿌연 크림빛 여백. 녹아든 사진 몇 장과 소스 사진이 안개처럼 흩어지고, 잎 그림자와 햇살이 번진다
 *  5 amber   오래된 호박빛 인화가 화면 가득. 가장자리 어둠, 먼지와 잔 긁힘, 살구빛 빛샘
 */
const gradeAmber = (r, g, b) => {
  // 오래된 인화지: 어둡고 따뜻한 호박빛
  const v = 40 + luma(r, g, b) * 0.8;
  return [v * 1.12 + 10, v * 0.95 + 2, v * 0.7 - 4];
};
const gradeCool = (r, g, b) => {
  // 흰 종이 위 인화: 색을 절반쯤 빼고 그림자에 은회색 푸른 기를 얹는다
  const a = gradeLIA(r, g, b);
  const l = luma(a[0], a[1], a[2]);
  return [l + (a[0] - l) * 0.45 - 8, l + (a[1] - l) * 0.45 + 2, l + (a[2] - l) * 0.45 + 16];
};
const gradeDapple = (r, g, b) => {
  // 나무 그림자 얼룩: 색을 거의 빼고 따뜻한 회갈색 흑백으로
  const v = 34 + luma(r, g, b) * 0.82;
  return [v * 1.03 + 2, v, v * 0.94];
};
const gradeClean = (r, g, b) => {
  // 호수의 하얗고 깨끗한 빛: 밝게 들고 색은 절반만, 그림자에 푸른 회색
  const a = gradeLIA(r, g, b);
  const l = luma(a[0], a[1], a[2]);
  return [l + (a[0] - l) * 0.6 + 4, l + (a[1] - l) * 0.6 + 6, l + (a[2] - l) * 0.6 + 12];
};

const LIA_LOOKS = [
  { src: ["lia-5", "lia-11"], layout: "dapple", bg: "#ece8e2", paper: true, grade: gradeDapple, leaf: 0, sun: null, tint: "rgba(236,228,216,0.18)", leak: null, vig: 0, grain: 0.06 },
  { src: ["lia-2", "lia-6"], layout: "lake", bg: "#fbfbfa", paper: true, grade: gradeClean, leaf: 0, sun: null, tint: null, leak: null, vig: 0, grain: 0.03 },
  { src: ["lia-10", "lia-9"], layout: "print", bg: "#fdfcf9", paper: true, grade: gradeCool, leaf: 0, sun: null, tint: null, leak: null, vig: 0, grain: 0.03 },
  { src: ["lia-11", "lia-7"], layout: "window", bg: "#c9c6d0", paper: false, grade: gradeLIA, leaf: 0, sun: null, tint: null, leak: null, vig: 0.12, grain: 0.06 },
  { src: ["lia-5", "lia-6"], layout: "haze", bg: "#f2eee5", paper: false, grade: gradeLIA, leaf: 0.22, sun: "rgba(255,226,190,0.45)", tint: "rgba(246,236,220,0.16)", leak: null, vig: 0, grain: 0.05 },
  { src: ["lia-10", "lia-9"], layout: "amber", bg: "#e4d3b6", paper: false, grade: gradeAmber, leaf: 0, sun: null, tint: "rgba(226,170,96,0.3)", leak: "rgba(255,150,110,0.4)", vig: 0.55, grain: 0.14 },
];

/**
 * 나무 그림자 얼룩: 잎 덩어리가 모인 큰 그늘 속에 햇빛 구멍이 숭숭 뚫리고, 전체가 크게 흐려져 벽에 번진다.
 * 그늘은 화면의 한쪽 절반을 비스듬히 덮는다
 */
function dappledShadow(g, alpha, mirror, col = "rgb(70,62,56)") {
  const c = canvasOf(W / 5, H / 5);
  const x = c.getContext("2d");
  x.fillStyle = col;
  // 가지 몇 줄기를 따라 작은 잎을 촘촘히 모은다(떨어진 점이 아니라 덩어리진 그늘이 되게)
  for (let b = 0; b < 5; b++) {
    let px = mirror ? rand(-10, 30) : rand(W / 5 - 30, W / 5 + 10);
    let py = rand(-10, H / 5);
    const a = (mirror ? 0 : Math.PI) + rand(-0.7, 0.7);
    for (let k = 0; k < 70; k++) {
      px += Math.cos(a) * rand(0.4, 1.4);
      py += Math.sin(a) * rand(0.4, 1.4) + rand(-1, 1);
      for (let j = 0; j < 3; j++) {
        x.beginPath();
        x.ellipse(px + rand(-9, 9), py + rand(-9, 9), rand(1.5, 4.5), rand(1, 3), rand(0, Math.PI), 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  // 잎 사이로 드는 햇빛 구멍
  x.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 140; k++) {
    x.beginPath();
    x.arc(rand(0, W / 5), rand(0, H / 5), rand(1, 3.5), 0, Math.PI * 2);
    x.fill();
  }
  g.save();
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = alpha;
  g.drawImage(softBlur(c, 2.6), 0, 0, W, H);
  g.globalAlpha = alpha * 0.45;
  g.drawImage(softBlur(c, 6), 0, 0, W, H);
  g.restore();
}

/** 흰 테를 두른 인화 한 장을 종이 위에 놓는다(가장자리는 또렷하고, 아래로 옅은 그늘) */
function placePrint(g, c, x, y, r, border) {
  const w = c.width + border * 2;
  const h = c.height + border * 2;
  g.save();
  g.translate(x, y);
  g.rotate(r);
  g.save();
  g.shadowColor = "rgba(80,70,60,0.22)";
  g.shadowBlur = 24;
  g.shadowOffsetX = 4;
  g.shadowOffsetY = 12;
  g.fillStyle = "#fffefb";
  g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
  g.drawImage(c, -c.width / 2, -c.height / 2);
  g.restore();
}

/** 오래된 인화지의 먼지와 잔 긁힘 */
function dustAndScratches(g) {
  g.save();
  for (let k = 0; k < 140; k++) {
    g.fillStyle = Math.random() < 0.6 ? "rgba(60,36,20,0.5)" : "rgba(255,246,226,0.7)";
    g.beginPath();
    g.arc(rand(0, W), rand(0, H), rand(0.6, 2.2), 0, Math.PI * 2);
    g.fill();
  }
  for (let k = 0; k < 22; k++) {
    g.strokeStyle = "rgba(255,244,222,0.45)";
    g.lineWidth = rand(0.5, 1.2);
    const px = rand(0, W);
    g.beginPath();
    g.moveTo(px, rand(0, H));
    g.lineTo(px + rand(-6, 6), rand(0, H));
    g.stroke();
  }
  g.restore();
}

/** 창살 모양 햇빛: 네 칸 남짓 창의 빛 자리가 벽에 비스듬히 비치고, 창살 사이가 그늘로 남는다 */
function windowGrid(g, mirror) {
  const c = canvasOf(W / 4, H / 4);
  const x = c.getContext("2d");
  x.translate(mirror ? W / 4 - 40 : 40, H / 8);
  x.transform(1, (mirror ? 1 : -1) * rand(0.35, 0.5), 0, 1, 0, 0);
  x.fillStyle = "rgba(255,240,212,1)";
  const pw = rand(26, 34);
  const ph = rand(36, 46);
  for (let i = 0; i < 2; i++) for (let j = -1; j < 3; j++) x.fillRect((mirror ? -1 : 0) * pw * 2 + i * (pw + 5), j * (ph + 5), pw, ph);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.8;
  g.drawImage(softBlur(c, 2.4), 0, 0, W, H);
  g.restore();
}

/** 잔잔한 호수: 푸른 회색 물 위로 가는 물결 빛이 가로로 일렁인다. 아래 경계는 비스듬한 흰 바닥 */
function lakeWater(g, mirror) {
  const c = canvasOf(W, H * 0.42);
  const x = c.getContext("2d");
  const lg = x.createLinearGradient(0, 0, 0, c.height);
  lg.addColorStop(0, "#7d8a92");
  lg.addColorStop(1, "#a4b0b4");
  x.fillStyle = lg;
  x.fillRect(0, 0, W, c.height);
  for (let k = 0; k < 900; k++) {
    const y = rand(0, c.height);
    const px = rand(-40, W);
    const l = rand(20, 90);
    x.strokeStyle = Math.random() < 0.6 ? `rgba(235,240,240,${rand(0.15, 0.5)})` : `rgba(60,72,80,${rand(0.1, 0.35)})`;
    x.lineWidth = rand(0.8, 2.4);
    x.beginPath();
    x.moveTo(px, y);
    x.quadraticCurveTo(px + l / 2, y + rand(-3, 3), px + l, y + rand(-1.5, 1.5));
    x.stroke();
  }
  g.save();
  g.beginPath();
  const y0 = rand(H * 0.3, H * 0.36);
  const y1 = y0 + (mirror ? -1 : 1) * rand(60, 120);
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, mirror ? y0 : y1);
  g.lineTo(0, mirror ? y1 : y0);
  g.closePath();
  g.clip();
  g.drawImage(softBlur(c, 1.2), 0, 0, W, c.height);
  g.restore();
}

function drawLIA(g, imgs, T, S, M, P, V = 0) {
  const L = LIA_LOOKS[V % LIA_LOOKS.length];
  const bg = L.bg;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 새하얀 종이: 결만 아주 옅게(흰 종이 스타일은 색을 얹지 않는다)
  if (L.paper) {
    g.save();
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = 0.35;
    g.drawImage(embossPaper(W, H, 250), 0, 0);
    g.restore();
  }
  const mirror = Math.random() < 0.5;
  const fx = (x) => (mirror ? W - x : x);
  const tone = L.grade;
  const amt = 1;
  const im0 = imgs[0];

  const photo = (w, soft) => feather(photoCanvas(im0, w, tone, { amt }), soft);
  if (L.layout === "print") {
    // 새하얀 종이 위 흰 테 인화 두 장. 하나는 크고 하나는 작게 비껴 겹친다
    const w = rand(470, 540);
    const c = photoCanvas(im0, w, tone, { amt });
    const x = fx(rand(400, 450));
    const y = rand(470, 540);
    if (imgs[1]) placePrint(g, photoCanvas(imgs[1], rand(230, 280), tone, { amt, zoom: rand(1, 1.4), ox: Math.random(), oy: Math.random() }), fx(rand(650, 700)), y + rand(260, 330), rand(-0.06, 0.06), 12);
    placePrint(g, c, x, y, rand(-0.025, 0.025), 18);
  } else if (L.layout === "haze") {
    // 뿌연 크림빛 여백: 소스 사진과 녹아든 사진 몇 장이 안개처럼 흩어진다
    if (S[0]) {
      const w = rand(380, 480);
      const c = feather(srcPiece(S[0], w, w * rand(1.1, 1.3), tone, 1), 0.8);
      g.save();
      g.globalAlpha = 0.35;
      g.drawImage(c, fx(rand(170, 280)) - w / 2, rand(320, 520) - c.height / 2);
      g.restore();
    }
    const c = photo(rand(440, 520), 0.5);
    const x = fx(rand(560, 630));
    const y = rand(360, 450);
    g.drawImage(c, x - c.width / 2, y - c.height / 2);
    imgs.slice(1, 3).forEach((im, k) => {
      const ci = feather(photoCanvas(im, rand(150, 210), tone, { amt, zoom: rand(1, 1.5), ox: Math.random(), oy: Math.random() }), 0.4);
      g.save();
      g.globalAlpha = 0.8;
      g.drawImage(ci, fx(k ? rand(160, 280) : rand(600, 700)) - ci.width / 2, rand(800, 940) - ci.height / 2);
      g.restore();
    });
    leafShadow(g, L.leaf);
    const fog = g.createRadialGradient(W - x, H - y, 40, W - x, H - y, 700);
    fog.addColorStop(0, "rgba(255,255,255,0.45)");
    fog.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fog;
    g.fillRect(0, 0, W, H);
  } else if (L.layout === "amber") {
    // 오래된 호박빛 인화가 화면 가득
    g.drawImage(graded(im0, W, H, tone, { zoom: rand(1, 1.15), ox: rand(0.3, 0.7), oy: rand(0.3, 0.6), amt }), 0, 0);
  } else if (L.layout === "dapple") {
    // 나무 그림자 얼룩: 회갈색 흑백 사진 위와 둘레로 잎 그늘이 크게 덩어리진다
    const c = photo(rand(520, 600), 0.22);
    const x = fx(rand(480, 540));
    const y = rand(520, 620);
    g.drawImage(c, x - c.width / 2, y - c.height / 2);
    dappledShadow(g, 0.7, mirror);
  } else if (L.layout === "window") {
    // 따뜻한 창문 그림자: 라일락빛 회색 벽에 창살 모양 햇빛, 사진은 그 앞에 실루엣처럼
    windowGrid(g, mirror);
    const c = photo(rand(500, 560), 0.3);
    const x = fx(rand(520, 580));
    const y = rand(600, 680);
    g.drawImage(c, x - c.width / 2, y - c.height / 2);
    g.save();
    g.globalAlpha = 0.4;
    windowGrid(g, mirror);
    g.restore();
  } else if (L.layout === "lake") {
    // 잔잔한 호수: 위쪽에 물결, 아래는 하얀 바닥. 사진은 하얀 바닥 위에, 옅은 푸른 나뭇잎 그림자가 지나간다
    lakeWater(g, mirror);
    const c = photo(rand(440, 500), 0.2);
    const x = fx(rand(420, 500));
    const y = rand(680, 760);
    g.drawImage(c, x - c.width / 2, y - c.height / 2);
    dappledShadow(g, 0.32, !mirror, "rgb(120,138,168)");

  }

  // 이 스타일의 소스 사진은 흰 종이 스타일에서는 쓰지 않는다(여백과 흰 종이를 지키려고). 나머지에서는 옅게 결로만
  if (!L.paper && S[0]) {
    g.save();
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = 0.35;
    g.drawImage(srcPiece(S[0], W, H, tone, 1), 0, 0);
    g.restore();
  }
  if (L.sun) {
    const lx = Math.random() < 0.5 ? 0 : W;
    const ly = rand(0, H * 0.4);
    const sun = g.createRadialGradient(lx, ly, 10, lx, ly, rand(620, 900));
    sun.addColorStop(0, L.sun);
    sun.addColorStop(1, "rgba(255,226,200,0)");
    g.save();
    g.globalCompositeOperation = "screen";
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    g.restore();
  }
  // 그림자와 빛이 부드럽게 번지게: 흰 종이 인화는 맑게 두고, 나머지는 흐린 사본을 밝게 한 겹
  if (L.layout !== "lake" && L.layout !== "print") {
    const shot = snapshot(g, 0, 0, W, H);
    g.save();
    g.globalCompositeOperation = "screen";
    g.globalAlpha = L.layout === "haze" ? 0.32 : 0.24;
    g.drawImage(softBlur(shot, 20), 0, 0);
    g.restore();
  }
  if (L.tint || L.leak) {
    g.save();
    if (L.tint) {
      g.globalCompositeOperation = "multiply";
      g.fillStyle = L.tint;
      g.fillRect(0, 0, W, H);
    }
    if (L.leak) {
      g.globalCompositeOperation = "screen";
      const ex = Math.random() < 0.5 ? W : 0;
      const leak = g.createLinearGradient(ex, 0, W - ex, 0);
      leak.addColorStop(0, L.leak);
      leak.addColorStop(0.3, "rgba(255,220,200,0)");
      g.fillStyle = leak;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }
  if (L.vig) {
    const vg = g.createRadialGradient(W / 2, H / 2, 280, W / 2, H / 2, 780);
    vg.addColorStop(0, "rgba(60,30,10,0)");
    vg.addColorStop(1, `rgba(70,40,18,${L.vig})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }
  if (L.layout === "amber") dustAndScratches(g);
  grain(g, Math.round(2600 + 90000 * L.grain), (a) => `rgba(120,100,110,${a * (0.05 + L.grain)})`, 1.3);
  return bg;
}

// ---------------------------------------------------------------------------
// OL — 찢겨진 질감, 모노톤, 빛번짐, 깨어짐
// ---------------------------------------------------------------------------

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

/**
 * 두꺼운 초크 낙서(예시: 화면 위쪽을 가로로 거칠게 왕복하며 지운 흰 초크). 굵은 획이 촘촘히 왕복하고,
 * 초크 가루처럼 획 안이 군데군데 비며, 가로로 끌린 자국이 남는다. 흰 초크와 검은 초크 둘 다 쓴다
 */
function chalkScrawl(g, x, y, w, h, col, alpha, scale = 1) {
  const c = canvasOf(W, H);
  const t = c.getContext("2d");
  t.lineCap = "round";
  t.lineJoin = "round";
  t.strokeStyle = col;
  const rows = Math.round(h / rand(11, 17));
  let px = x + rand(0, w * 0.2);
  let py = y;
  t.beginPath();
  t.moveTo(px, py);
  for (let k = 0; k < rows; k++) {
    // 한 줄을 오른쪽으로 긋고, 조금 내려와 다시 왼쪽으로(손이 왕복하며 덮어 지운다)
    const right = k % 2 === 0;
    const nx = right ? x + w * rand(0.75, 1.05) : x + w * rand(-0.05, 0.3);
    const ny = y + ((k + 1) / rows) * h + rand(-8, 8);
    t.lineWidth = rand(8, 22) * scale;
    // 한 번에 긋지 않고 마디마다 손이 흔들린다
    const seg = 5;
    for (let q = 1; q <= seg; q++) {
      const tq = q / seg;
      t.lineTo(px + (nx - px) * tq + rand(-24, 24), py + (ny - py) * tq + rand(-18, 18));
    }
    t.stroke();
    t.beginPath();
    t.moveTo(nx, ny);
    px = nx;
    py = ny;
  }
  // 몇 획은 밖으로 길게 삐져나간다
  for (let k = 0; k < 4; k++) {
    const sy = y + rand(0, h);
    t.lineWidth = rand(4, 10);
    t.beginPath();
    t.moveTo(x + rand(-60, w * 0.3), sy);
    t.lineTo(x + w + rand(-40, 80), sy + rand(-20, 20));
    t.stroke();
  }
  // 초크 결: 가로로 끌린 빈 자국과 가루처럼 빈 점
  t.globalCompositeOperation = "destination-out";
  for (let k = 0; k < 650; k++) {
    t.fillStyle = `rgba(0,0,0,${rand(0.3, 0.8)})`;
    t.fillRect(rand(x - 80, x + w + 80), rand(y - 30, y + h + 30), rand(6, 40), rand(0.8, 2.2));
  }
  for (let k = 0; k < 2000; k++) {
    t.fillStyle = "rgba(0,0,0,0.75)";
    t.fillRect(rand(x - 80, x + w + 80), rand(y - 30, y + h + 30), 1.6, 1.6);
  }
  g.save();
  g.globalAlpha = alpha;
  // 흔들림은 살짝만: 획의 굵기와 끝이 또렷이 남아야 초크로 보인다
  g.drawImage(c, 0, 0);
  g.globalAlpha = alpha * 0.5;
  g.drawImage(motionBlur(c, rand(14, 30), 0, 5), 0, 0);
  g.restore();
}

/**
 * 프리즘 무지개 빛(예시: 어둠을 크게 가르는 넓은 호, 주황·흰빛·파랑 띠가 번지고 둘레에 결 고운 빛이 흩어진다).
 * 띠가 넓고 부드러우며, 가끔 두 줄이 어긋나 겹친다
 */
function prismArc(g, alpha, wide = 1) {
  const c = canvasOf(W / 2, H / 2);
  const x = c.getContext("2d");
  const cx = rand(-0.3, 0.2) * W / 2;
  const cy = rand(-0.5, 0) * H / 2;
  const R = rand(0.8, 1.15) * W / 2;
  const a0 = rand(0.05, 0.5);
  const a1 = a0 + rand(1.1, 1.6);
  const bands = [["rgba(255,120,40,0.85)", -16, 10], ["rgba(255,200,140,0.8)", -7, 8], ["rgba(255,252,245,1)", 0, 11], ["rgba(150,200,255,0.85)", 9, 8], ["rgba(50,110,255,0.9)", 18, 10]];
  const twice = Math.random() < 0.4;
  for (const off of twice ? [0, rand(18, 34)] : [0]) {
    for (const [col, dr, lw] of bands) {
      x.strokeStyle = col;
      x.lineWidth = lw * wide;
      x.beginPath();
      x.arc(cx + off, cy + off * 0.4, R + dr * wide + off, a0, a1);
      x.stroke();
    }
  }
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = alpha;
  g.drawImage(softBlur(c, 9), 0, 0, W, H);
  g.globalAlpha = Math.min(1, alpha * 0.7 * wide);
  g.drawImage(softBlur(c, 30), 0, 0, W, H);
  g.restore();
}

/** 거칠게 찢긴 빈 종이 한 장(회백 인화지 뒷면). 결과 구김이 있고, 그 위에 다른 조각이 겹친다 */
function roughPaper(w, h) {
  const c = canvasOf(w, h);
  const t = c.getContext("2d");
  const v = Math.round(rand(150, 205));
  t.fillStyle = `rgb(${v},${v},${v})`;
  t.fillRect(0, 0, w, h);
  for (let k = 0; k < (w * h) / 40; k++) {
    t.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
    t.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 3));
  }
  return c;
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

/** 결 고운 금속 면: 한 점을 중심으로 휘어진 가는 줄이 오른쪽 아래로 흐른다(프리즘 빛이 걸치는 면) */
function brushedMetal(g, alpha) {
  const c = canvasOf(W, H);
  const x = c.getContext("2d");
  const cx = rand(-260, -80);
  const cy = rand(-420, -200);
  for (let k = 0; k < 420; k++) {
    const r = rand(900, 1650);
    const a0 = rand(0.45, 1.1);
    x.strokeStyle = `rgba(225,225,232,${rand(0.05, 0.26)})`;
    x.lineWidth = rand(0.5, 1.3);
    x.beginPath();
    x.arc(cx, cy, r, a0, a0 + rand(0.08, 0.4));
    x.stroke();
  }
  // 왼쪽 위는 비우고 오른쪽 아래로 갈수록 드러나게
  x.globalCompositeOperation = "destination-in";
  const m = x.createLinearGradient(W * 0.2, H * 0.35, W, H);
  m.addColorStop(0, "rgba(0,0,0,0)");
  m.addColorStop(0.7, "rgba(0,0,0,1)");
  x.fillStyle = m;
  x.fillRect(0, 0, W, H);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = alpha;
  g.drawImage(c, 0, 0);
  g.restore();
}

// OL 보정 다섯 가지. 모두 흑백이지만 검정의 깊이와 빛의 온도가 스타일마다 다르다
const gradeOLPrint = (r, g, b) => {
  // 회청 종이에 찍은 흑백 인화: 검정을 들어 올려 잉크 같은 회색으로
  const l = luma(r, g, b) / 255;
  const v = 38 + 205 * (1 / (1 + Math.exp(-7 * (l - 0.5))));
  return [v, v, v];
};
const gradeOLLow = (r, g, b) => {
  // 어둠 속 실루엣: 밝은 곳만 희미하게 떠오른다
  const l = luma(r, g, b) / 255;
  const v = Math.pow(l, 1.35) * 245;
  return [v, v, v];
};
const gradeOLHigh = (r, g, b) => {
  // 프리즘 스타일의 흑백: 밝은 곳을 하얗게 날려 빛이 번질 자리를 만든다
  const l = luma(r, g, b) / 255;
  const v = 255 * Math.pow(1 / (1 + Math.exp(-9 * (l - 0.48))), 1.25);
  return [v, v, v];
};
const gradeOLWarm = (r, g, b) => {
  // 따뜻한 회색 종이에 맞춘 흑백: 검정은 먹색, 밝은 곳은 미색
  const l = luma(r, g, b) / 255;
  const v = 18 + 230 * (1 / (1 + Math.exp(-8 * (l - 0.52))));
  return [v, v, v];
};

/** 결 있는 종이(엠보싱): 잔 섬유가 빛을 받아 위는 밝고 아래는 그늘진다 */
function embossPaper(w, h, v) {
  const n = canvasOf(w / 2, h / 2);
  const x = n.getContext("2d");
  x.fillStyle = `rgb(${v},${v},${v})`;
  x.fillRect(0, 0, n.width, n.height);
  for (let k = 0; k < (n.width * n.height) / 6; k++) {
    const d = rand(-38, 38);
    x.strokeStyle = `rgb(${clamp(v + d)},${clamp(v + d)},${clamp(v + d)})`;
    x.lineWidth = rand(0.6, 1.4);
    const px = rand(0, n.width);
    const py = rand(0, n.height);
    const a = rand(0, Math.PI * 2);
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * rand(2, 6), py + Math.sin(a) * rand(2, 6));
    x.stroke();
  }
  const c = canvasOf(w, h);
  const t = c.getContext("2d");
  t.drawImage(softBlur(n, 1.2), 0, 0, w, h);
  // 한 번 더: 밝은 사본을 위로, 어두운 사본을 아래로 비껴 얹어 결이 도드라지게
  t.globalCompositeOperation = "screen";
  t.globalAlpha = 0.35;
  t.drawImage(c, -1.5, -1.5);
  t.globalCompositeOperation = "multiply";
  t.drawImage(c, 1.5, 1.5);
  return c;
}

/** 굵은 필름 입자와 흰 먼지(그레인 빛번짐 스타일) */
function heavyGrain(g, light) {
  grain(g, 70000, (a) => (a > 0.5 ? `rgba(255,255,255,${(a - 0.5) * 0.3})` : `rgba(0,0,0,${a * 0.4})`), 2);
  if (!light) for (let k = 0; k < 160; k++) {
    g.fillStyle = `rgba(255,255,255,${rand(0.4, 0.9)})`;
    g.beginPath();
    g.arc(rand(0, W), rand(0, H), rand(0.6, 1.8), 0, Math.PI * 2);
    g.fill();
  }
}

/** 결 있는 흰 종이를 화면에 깔고 크게 찢어 구멍을 낸다. 구멍 안에는 사진이, 가장자리에는 섬유와 종이 그늘이 */
function tornHole(g, base, M, mirror) {
  const paper = embossPaper(W, H, 232);
  g.drawImage(paper, 0, 0);
  // 구멍: 화면의 3분의 2쯤. 거칠게 찢긴 가장자리는 점마다 크게 흔든다
  const cx = W * (mirror ? rand(0.42, 0.52) : rand(0.48, 0.58));
  const cy = H * rand(0.44, 0.52);
  const pts = blobPoints(W * rand(0.78, 0.9), H * rand(0.66, 0.76), 1 + M.torn).map(([x, y]) => [cx + x + rand(-9, 9), cy + y + rand(-9, 9)]);
  const hole = () => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  g.save();
  hole();
  g.clip();
  g.drawImage(base, 0, 0);
  // 종이가 구멍 안으로 드리우는 그늘
  g.shadowColor = "rgba(0,0,0,0.75)";
  g.shadowBlur = 40;
  g.shadowOffsetX = mirror ? -14 : 14;
  g.shadowOffsetY = 18;
  g.lineWidth = 30;
  g.strokeStyle = "rgba(0,0,0,0.6)";
  hole();
  g.stroke();
  g.restore();
  // 찢긴 가장자리: 흰 섬유가 일어나고, 테두리 한 줄이 빛을 받는다
  fiberEdge(g, [...pts, pts[0]], 4);
  g.save();
  g.strokeStyle = "rgba(255,255,255,0.75)";
  g.lineWidth = 2.5;
  hole();
  g.stroke();
  g.restore();
}

/**
 * 실제 낙서 재료(public/attic/marks). 운영자가 준 참고 이미지에서 뽑은 흰 획(투명 배경)이다.
 * loops 굵은 붓으로 휘감은 고리, zigzag 흰 초크로 거칠게 왕복한 낙서, chalk 가로로 겹쳐 문지른 초크 띠 열 가지
 */
const MARK_FILES = {
  loops: ["/attic/marks/loops-1.png"],
  zigzag: ["/attic/marks/zigzag-1.png"],
  chalk: Array.from({ length: 10 }, (_, k) => `/attic/marks/chalk-${k + 1}.png`),
};
let markCache = null;
function loadMarks() {
  markCache ??= Promise.all(
    Object.entries(MARK_FILES).map(([k, list]) => Promise.all(list.map((s) => loadImage(s).catch(() => null))).then((a) => [k, a.filter(Boolean)]))
  ).then(Object.fromEntries);
  return markCache;
}

/** 낙서 재료 한 장을 원하는 색으로 물들여 얹는다(흰 획 그대로, 혹은 먹색) */
function drawMark(g, im, x, y, w, rot, col, alpha, flip = false) {
  const h = (w * im.height) / im.width;
  const c = canvasOf(w, h);
  const t = c.getContext("2d");
  t.drawImage(im, 0, 0, c.width, c.height);
  t.globalCompositeOperation = "source-in";
  t.fillStyle = col;
  t.fillRect(0, 0, c.width, c.height);
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.globalAlpha = alpha;
  g.drawImage(c, -w / 2, -h / 2);
  g.restore();
}

/** 화면 위쪽을 가로로 지우는 초크 띠 두세 장. 조금씩 어긋나게 겹쳐 손으로 문지른 듯하게 */
function chalkBars(g, K, x, y, w, col, n) {
  for (let k = 0; k < n; k++) {
    drawMark(g, pickOne(K.chalk), x + rand(-40, 40), y + k * rand(30, 60) + rand(-10, 10), w * rand(0.75, 1.05), rand(-0.07, 0.07), col, rand(0.85, 1), Math.random() < 0.5);
  }
}

/** 관객 사진을 화면 전체에 깐다(사진이 작품의 대부분을 차지하게). 시선의 보정과 확대·자리는 매번 다르다 */
function fullPhoto(im, grade, amt) {
  return graded(im, W, H, grade, { zoom: rand(1, 1.18), ox: rand(0.35, 0.65), oy: rand(0.3, 0.6), amt });
}

/** 사진 한 장을 대각선으로 찢어 두 쪽을 벌린다. 틈에는 바탕이 보이고, 양쪽 가장자리는 흰 섬유로 일어난다 */
function tearApart(g, c, bg, jag) {
  const x0 = rand(W * 0.3, W * 0.7);
  // 크게 휘청이는 찢김 위에 잔 톱니를 한 번 더 얹어, 손으로 거칠게 찢은 가장자리처럼
  const coarse = tearLine(x0 + rand(-120, 120), -40, x0 + rand(-160, 160), H + 40, jag * 1.4);
  const line = coarse.flatMap((p, i) => {
    if (!i) return [p];
    const [px, py] = coarse[i - 1];
    return [0.25, 0.5, 0.75, 1].map((t) => [px + (p[0] - px) * t + (t < 1 ? rand(-3, 3) : 0), py + (p[1] - py) * t]);
  });
  const gap = rand(90, 160);
  const sides = [
    [-1, [[-50, -50], ...line, [-50, H + 50]]],
    [1, [[W + 50, -50], ...line, [W + 50, H + 50]]],
  ];
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (const [s, poly] of sides) {
    g.save();
    g.translate((s * gap) / 2, s * rand(-10, 10));
    g.rotate(s * rand(0.005, 0.02));
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    // 먼저 종이 속심(흰 종이)을 칠하고, 사진 막은 가장자리에서 들쭉날쭉 안쪽으로 벗겨진 선까지만 남긴다
    g.fillStyle = "#ecebe8";
    g.fill();
    // 사진 막이 벗겨진 폭은 천천히 넓어졌다 좁아진다(점마다 튀면 번개처럼 보인다)
    let o = rand(14, 30);
    const peel = line.map(([x, y]) => {
      o = Math.max(6, Math.min(52, o * 0.8 + rand(6, 52) * 0.2));
      return [x + s * o, y];
    });
    const inner = s < 0 ? [[-50, -50], ...peel, [-50, H + 50]] : [[W + 50, -50], ...peel, [W + 50, H + 50]];
    g.save();
    g.beginPath();
    inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    g.drawImage(c, 0, 0);
    g.restore();
    fiberEdge(g, peel, rand(2, 3.5));
    // 찢긴 결이 빛을 받아 하얗게 일어난다
    g.save();
    g.shadowColor = "rgba(255,255,255,0.9)";
    g.shadowBlur = 12;
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2.5;
    g.beginPath();
    line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.restore();
    fiberEdge(g, line, rand(4, 7));
    fiberEdge(g, line, rand(3, 5));
    g.restore();
  }
}

/** 사진을 서너 조각으로 찢어 조금씩 어긋나게 다시 붙인다(찢긴 종이 더미 스타일) */
function tornPieces(g, c, n, lineCol, M) {
  for (let k = 0; k < n; k++) {
    const w = rand(360, 620);
    const h = rand(320, 560);
    const sx = rand(w / 2, W - w / 2);
    const sy = rand(h / 2 + 80, H - h / 2 - 80);
    const pts = blobPoints(w, h, 0.6 + M.torn);
    g.save();
    g.translate(sx + rand(-50, 50), sy + rand(-40, 40));
    g.rotate(rand(-0.12, 0.12));
    g.save();
    g.shadowColor = "rgba(0,0,0,0.45)";
    g.shadowBlur = 18;
    g.shadowOffsetY = 8;
    tracePoints(g, pts);
    g.fillStyle = "#e9e6df";
    g.fill();
    g.restore();
    g.save();
    tracePoints(g, pts, 0.97);
    g.clip();
    g.drawImage(c, sx - w / 2, sy - h / 2, w, h, -w / 2, -h / 2, w, h);
    crumple(g, -w / 2, -h / 2, w, h, 3, 0.2);
    g.restore();
    const from = Math.floor(rand(0, pts.length));
    fiberEdge(g, Array.from({ length: Math.floor(pts.length * 0.5) }, (_, i) => pts[(from + i) % pts.length]), rand(2.5, 4));
    sketchOutline(g, pts, lineCol, 1);
    g.restore();
  }
}

/**
 * OL 여섯 스타일 — 모노톤, 거칠게 찢긴 종이, 두꺼운 초크 낙서, 빛번짐(프리즘). 모든 스타일에서 관객 사진이 화면 대부분을 차지하고,
 * 그 위에 OL 의 효과를 화풍으로 입힌다. 스타일마다 바탕색·보정·사진의 형태·낙서 재료가 다르다.
 *  낙서 둘
 *  0 chalk  검정. 사진이 화면 가득, 흔들린 흑백. 흰 초크 지그재그 낙서와 초크 띠가 사진 위를 지운다
 *  1 ink    밝은 회청 종이. 사진은 크게 찢어 낸 회색 인화. 검은 붓 고리 낙서와 잉크 손자국
 *  모노톤 그레인 빛번짐 하나
 *  2 bloom  숯빛. 사진이 액체처럼 흐르는 빛으로 번지고, 굵은 필름 입자와 흰 먼지
 *  거칠게 찢긴 종이 둘
 *  3 split  이끼빛. 사진이 대각선으로 찢겨 두 쪽으로 벌어지고, 엠보싱 종이 결과 빛나는 섬유 가장자리
 *  5 hole   흰 종이. 결 있는 흰 종이에 크게 찢긴 구멍이 나고, 그 안에 사진이 그림자를 받으며 보인다
 *  그리고
 *  4 prism  감청. 사진이 감청과 흰빛 두 색으로, 파란 테와 결 고운 금속 면, 넓은 프리즘 무지개
 */
const OL_LOOKS = [
  { src: ["ol-8"], bg: "#0b0b0c", light: false, grade: gradeOL, form: "full", blur: 0.85, marks: "zigzag", ink: "white", bars: 2, hand: 0, prism: 0 },
  { src: ["ol-6", "ol-5"], bg: "#d8d8d6", light: true, grade: gradeOLPrint, form: "print", blur: 0.2, marks: "loops", ink: "black", bars: 1, hand: 1, prism: 0 },
  { src: ["ol-7", "ol-6"], bg: "#151515", light: false, grade: gradeOLLow, form: "bloom", blur: 0.5, marks: "none", ink: "white", bars: 0, hand: 0, prism: 0 },
  { src: ["ol-2", "ol-3"], bg: "#0a0a0a", light: false, grade: gradeOL, form: "split", blur: 0.1, marks: "none", ink: "white", bars: 0, hand: 0, prism: 0 },
  { src: ["ol-11", "ol-9"], bg: "#050505", light: false, grade: gradeOLHigh, form: "full", blur: 0.6, marks: "none", ink: "white", bars: 0, hand: 0, prism: 1, metal: true },
  { src: ["ol-3", "cover"], bg: "#ebebeb", light: true, grade: gradeOLWarm, form: "hole", blur: 0.2, marks: "none", ink: "black", bars: 0, hand: 0, prism: 0 },
];

function drawOL(g, imgs, T, S, M, P, V = 0, K = {}) {
  const C = OL_LOOKS[V % OL_LOOKS.length];
  const bg = C.bg;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const mirror = Math.random() < 0.5;
  const fx = (x) => (mirror ? W - x : x);
  // 색을 남기지 않도록 보정을 끝까지 입힌다(OL 은 완전한 무채색)
  const amt = 1;
  const jag = 8 + 12 * M.torn;
  const inkCol = C.ink === "white" ? "rgb(242,240,236)" : "rgb(12,11,11)";
  const lineCol = C.light || C.ink === "black" ? "rgba(18,14,14,0.85)" : "rgba(240,238,233,0.8)";

  // 관객 사진(첫 장)을 화면 가득 보정해 둔다. 이것이 작품의 몸이다
  let base = fullPhoto(imgs[0], C.grade, amt);
  if (Math.random() < C.blur) base = motionBlur(base, rand(-60, 60), rand(-16, 16), 10);

  // 이 스타일의 소스 사진은 사진 뒤에서 옅은 결로만(사진의 비중을 빼앗지 않게)
  const under = () =>
    S.slice(0, 1).forEach((src) => {
      g.save();
      g.globalCompositeOperation = C.light ? "multiply" : "screen";
      g.globalAlpha = C.light ? 0.25 : 0.3;
      const c = srcPiece(src, W, H, C.grade, 0.9);
      g.drawImage(c, 0, 0);
      g.restore();
    });

  if (C.form === "full") {
    under();
    g.drawImage(base, 0, 0);
    // 금속 면(prism): 사진 위에 결 고운 줄이 빛을 받아 걸친다
    if (C.metal) brushedMetal(g, 0.6);
  } else if (C.form === "print") {
    // 회청 종이 위, 크게 찢어 낸 흑백 인화 한 장
    under();
    const w = rand(780, 880);
    const h = rand(900, 1040);
    const pts = blobPoints(w, h, 0.5 + M.torn);
    const cx = fx(rand(430, 470));
    const cy = rand(560, 620);
    g.save();
    g.translate(cx, cy);
    g.rotate(rand(-0.04, 0.04));
    g.save();
    g.shadowColor = "rgba(40,50,70,0.35)";
    g.shadowBlur = 22;
    g.shadowOffsetY = 10;
    tracePoints(g, pts);
    g.fillStyle = "#f2f1ed";
    g.fill();
    g.restore();
    g.save();
    tracePoints(g, pts, 0.97);
    g.clip();
    g.drawImage(base, cx - w / 2, cy - h / 2, w, h, -w / 2, -h / 2, w, h);
    crumple(g, -w / 2, -h / 2, w, h, 4, 0.16);
    g.restore();
    const from = Math.floor(rand(0, pts.length));
    fiberEdge(g, Array.from({ length: Math.floor(pts.length * 0.6) }, (_, i) => pts[(from + i) % pts.length]), 3.5);
    g.restore();
  } else if (C.form === "split") {
    tearApart(g, base, bg, jag);
    // 엠보싱 종이 결을 사진 위에 얹어 인화지가 찢긴 것처럼
    g.save();
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = 0.7;
    g.drawImage(embossPaper(W, H, 150), 0, 0);
    g.restore();
  } else if (C.form === "hole") {
    tornHole(g, base, M, mirror);
  } else if (C.form === "bloom") {
    // 빛번짐: 크게 흐린 사본을 밝게 겹쳐 밝은 곳이 액체처럼 흐르고, 덜 흐린 사본을 곱해 어둠의 형태는 남긴다
    under();
    g.drawImage(base, 0, 0);
    g.save();
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.9;
    g.drawImage(softBlur(base, 24), 0, 0);
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = 0.55;
    g.drawImage(softBlur(base, 7), 0, 0);
    g.restore();
    heavyGrain(g, false);
  } else {
    // 찢긴 종이 더미: 빈 회색 종이 몇 장 위에 사진 조각들
    for (let k = 0; k < 3; k++) {
      const w = rand(340, 560);
      const c = roughPaper(w, w * rand(0.6, 1.1));
      g.save();
      g.translate(fx(rand(150, 750)), rand(200, 1000));
      g.rotate(rand(-0.5, 0.5));
      tracePoints(g, blobPoints(w, c.height, 1));
      g.clip();
      g.drawImage(c, -w / 2, -c.height / 2);
      g.restore();
    }
    tornPieces(g, base, 4, lineCol, M);
  }


  // 나머지 관객 사진은 찢어 낸 작은 조각으로 아래쪽에
  imgs.slice(1, 3).forEach((im, k) => {
    const w = rand(240, 330);
    const c = photoCanvas(im, w, C.grade, { amt, zoom: rand(1, 1.4), ox: Math.random(), oy: Math.random() });
    const pts = blobPoints(c.width, c.height, 0.8);
    g.save();
    g.translate(fx(k ? rand(160, 320) : rand(600, 760)), rand(800, 1000));
    g.rotate(rand(-0.25, 0.25));
    g.save();
    tracePoints(g, pts);
    g.clip();
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
    fiberEdge(g, pts.slice(0, Math.floor(pts.length / 2)), 3);
    sketchOutline(g, pts, lineCol, 1);
    g.restore();
  });

  // 낙서: 실제 낙서 재료로. 화면 위쪽 3분의 1~가운데를 덮는다
  const faceY = rand(330, 520);
  if (K.zigzag?.length && C.marks === "zigzag") drawMark(g, pickOne(K.zigzag), fx(rand(380, 520)), faceY + rand(0, 120), rand(560, 780), rand(-0.5, 0.5) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : 0), inkCol, rand(0.88, 1), Math.random() < 0.5);
  if (K.loops?.length && C.marks === "loops") drawMark(g, pickOne(K.loops), fx(rand(380, 560)), rand(380, 640), rand(480, 700), rand(-0.6, 0.6), inkCol, rand(0.88, 1), Math.random() < 0.5);
  if (K.chalk?.length && C.bars) chalkBars(g, K, fx(rand(400, 500)), faceY - 40, rand(560, 760), inkCol, C.bars);
  if (!K.chalk?.length && C.bars) chalkScrawl(g, 140, faceY - 40, 620, 200, inkCol, 0.9);

  // 검은 잉크 손자국
  if (Math.random() < C.hand) {
    inkHand(g, fx(rand(150, 750)), rand(220, 860), C.light ? rand(150, 210) : rand(80, 130), rand(-0.6, 0.6));
    if (C.light) inkHand(g, fx(rand(150, 750)), rand(220, 860), rand(110, 160), rand(-0.9, 0.9));
  }

  // 프리즘 무지개(금속 면 스타일에서는 늘 크게 두 줄)
  if (C.metal) {
    // 강렬한 프리즘: 넓은 띠 두세 줄이 겹쳐 번지고, 가운데가 하얗게 탄다
    prismArc(g, 1, 2.4);
    prismArc(g, 0.9, 1.7);
    if (Math.random() < 0.6) prismArc(g, 0.7, 1.2);
    const shot = snapshot(g, 0, 0, W, H);
    g.save();
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.55;
    g.drawImage(softBlur(shot, 22), 0, 0);
    g.restore();
  } else if (Math.random() < C.prism) prismArc(g, 0.4 + 0.35 * M.bleed);

  // 빛번짐: 어두운 바탕에서만
  if (!C.light) {
    grainyLight(g, 0.12 + 0.2 * M.bleed);
    const shot = snapshot(g, 0, 0, W, H);
    g.save();
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.15 + 0.3 * M.bleed;
    g.drawImage(softBlur(shot, 14), 0, 0);
    g.restore();
  }

  grain(g, 11000, (a) => (a > 0.5 ? `rgba(255,255,255,${(a - 0.5) * (C.light ? 0.25 : 0.16)})` : `rgba(0,0,0,${a * (C.light ? 0.2 : 0.32)})`), 1.3);
  const vg = g.createRadialGradient(W / 2, H / 2, 320, W / 2, H / 2, 820);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, C.light ? "rgba(70,80,96,0.28)" : "rgba(0,0,0,0.5)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return bg;
}

// ---------------------------------------------------------------------------
// LET — 비비드한 색감, 생동감, 에너지, 겹침·레이어
// ---------------------------------------------------------------------------

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
function gelSheet(g, x, y, w, h, r, col, op = "multiply") {
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
  // 곱하기는 겹친 자리마다 새 색을 만들지만 여러 장이면 탁해진다. 띠·판처럼 장수가 많을 때는 반투명 그대로(source-over) 얹는다
  g.globalCompositeOperation = op;
  g.globalAlpha = op === "multiply" ? rand(0.72, 0.92) : rand(0.7, 0.84);
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
 * LET 의 재료 한 장을 도형 안(-w/2..w/2, -h/2..h/2)에 채운다. 큰 캔버스 한 장에서 매번 다른 부분을 다른 배율로 떠 와,
 * 같은 사진이 조각마다 다른 결로 보이게 한다(조각마다 사진을 다시 보정하면 느려서 미리 한 번만 보정해 둔다)
 */
function fillMat(g, c, w, h) {
  const z = rand(1, 2.6);
  const sw = Math.min(c.width, c.width / z);
  const sh = Math.min(c.height, (sw * h) / w);
  const sw2 = (sh * w) / h;
  g.drawImage(c, rand(0, c.width - sw2), rand(0, c.height - sh), sw2, sh, -w / 2, -h / 2, w, h);
}

/** 붓 한 획의 윤곽: 머리는 둥글고 꼬리는 마른 붓처럼 갈라진다 */
function strokePath(g, len, w) {
  g.beginPath();
  g.moveTo(w * 0.35, -w / 2);
  const n = 14;
  for (let k = 1; k <= n; k++) g.lineTo(w * 0.35 + ((len - w * 0.35) * k) / n, -w / 2 + rand(-1.5, 1.5) + (k === n ? rand(0, w * 0.25) : 0));
  // 꼬리: 털 끝이 고르지 않게
  for (let k = 0; k <= 12; k++) g.lineTo(len - rand(0, w * 0.28), -w / 2 + (w * k) / 12);
  for (let k = n; k >= 1; k--) g.lineTo(w * 0.35 + ((len - w * 0.35) * k) / n, w / 2 + rand(-1.5, 1.5));
  g.lineTo(w * 0.35, w / 2);
  g.bezierCurveTo(-w * 0.1, w / 2, -w * 0.1, -w / 2, w * 0.35, -w / 2);
  g.closePath();
}

/**
 * 조각 하나를 작은 캔버스에 그린 뒤 가장자리를 살짝 녹이고(칼로 자른 듯한 경계를 피해) 반투명하게 얹는다.
 * 겹친 자리에서 아래 획이 은근히 비쳐, 물감이 서로 스며든 것처럼 보인다
 */
function softPiece(g, cw, ch, x, y, ang, draw, { alpha = rand(0.74, 0.9), soft = 2.4 } = {}) {
  const c = canvasOf(cw, ch);
  const t = c.getContext("2d");
  t.translate(cw / 2, ch / 2);
  draw(t);
  // 가장자리 녹이기: 흐린 자기 사본을 마스크로 곱하면 안쪽은 그대로, 경계만 부드럽게 빠진다
  const m = softBlur(c, soft);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = "destination-in";
  t.drawImage(m, 0, 0);
  t.drawImage(m, 0, 0);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.globalAlpha = alpha;
  // 셋 중 하나는 곱하기로 겹쳐, 겹친 자리에 두 색이 섞인 새 색이 난다
  g.globalCompositeOperation = Math.random() < 0.3 ? "multiply" : "source-over";
  g.shadowColor = "rgba(20,10,20,0.16)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 4;
  g.drawImage(c, -cw / 2, -ch / 2);
  g.restore();
}

/**
 * 두껍게 바른 물감 한 획. 색이나 사진으로 채우고, 붓털 결과 한쪽 가장자리의 윤기를 얹는다.
 * 가장자리는 살짝 녹고 반투명해서 겹친 획이 은근히 비친다
 */
function paintStroke(g, x, y, len, w, ang, col, mat) {
  softPiece(g, len + w * 0.6, w * 1.4, x, y, ang, (t) => {
    t.translate(-len / 2, 0);
    strokePath(t, len, w);
    t.fillStyle = col;
    t.fill();
    t.save();
    t.clip();
    if (mat) {
      t.save();
      t.translate(len / 2, 0);
      fillMat(t, mat, len + w, w * 1.6);
      t.restore();
      t.globalCompositeOperation = "soft-light";
      t.fillStyle = col;
      t.fillRect(-w, -w, len + w * 2, w * 2);
      t.globalCompositeOperation = "source-over";
    }
    // 붓털 결: 길이 방향의 가는 줄이 밝고 어둡게
    for (let i = 0, n = Math.round(w / 2.2); i < n; i++) {
      const yy = -w / 2 + ((i + rand(0, 1)) / n) * w;
      t.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
      t.globalAlpha = rand(0.12, 0.4);
      t.lineWidth = rand(0.6, 1.8);
      t.beginPath();
      t.moveTo(rand(-w * 0.1, len * 0.3), yy);
      t.lineTo(rand(len * 0.6, len), yy + rand(-2, 2));
      t.stroke();
    }
    // 윤기: 위쪽 가장자리를 따라 빛이 길게 맺힌다
    t.globalAlpha = 1;
    t.globalCompositeOperation = "screen";
    const lg = t.createLinearGradient(0, -w / 2, 0, w / 2);
    lg.addColorStop(0, "rgba(255,255,255,0.5)");
    lg.addColorStop(0.22, "rgba(255,255,255,0.08)");
    lg.addColorStop(0.7, "rgba(255,255,255,0)");
    lg.addColorStop(1, "rgba(255,255,255,0.16)");
    t.fillStyle = lg;
    t.fillRect(-w, -w / 2, len + w * 2, w);
    t.restore();
  });
}

/** 팔레트 나이프로 떠 바른 물감 덩어리. 휘어진 긁힘 결과 윤기가 남고, 가장자리는 녹아 겹친 덩어리가 비친다 */
function knifeChunk(g, x, y, s, ang, col, mat) {
  const n = 4 + Math.floor(rand(0, 3));
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2 + rand(-0.35, 0.35);
    const r = s * rand(0.36, 0.62);
    return [Math.cos(a) * r * rand(1, 1.5), Math.sin(a) * r * rand(0.6, 1)];
  });
  softPiece(g, s * 2.2, s * 1.6, x, y, ang, (t) => {
    const trace = () => {
      t.beginPath();
      pts.forEach(([px, py], i) => (i ? t.lineTo(px, py) : t.moveTo(px, py)));
      t.closePath();
    };
    t.fillStyle = col;
    trace();
    t.fill();
    t.save();
    trace();
    t.clip();
    if (mat) {
      t.globalAlpha = rand(0.75, 1);
      fillMat(t, mat, s * 1.6, s * 1.2);
      t.globalAlpha = 1;
    }
    const cx = rand(-s, s);
    const cy = s * rand(1, 2);
    const white = Math.random() < 0.4;
    for (let i = 0; i < 26; i++) {
      const r = Math.hypot(cx, cy) + rand(-s * 0.7, s * 0.7);
      t.strokeStyle = white || Math.random() < 0.3 ? "rgba(255,255,255,0.75)" : shade(col, rand(-50, 40));
      t.globalAlpha = rand(0.15, 0.6);
      t.lineWidth = rand(1, 4);
      t.beginPath();
      t.arc(cx, cy, r, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6);
      t.stroke();
    }
    t.globalAlpha = 1;
    t.globalCompositeOperation = "screen";
    const lg = t.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    lg.addColorStop(0, "rgba(255,255,255,0.4)");
    lg.addColorStop(0.35, "rgba(255,255,255,0)");
    t.fillStyle = lg;
    t.fillRect(-s, -s, s * 2, s * 2);
    t.restore();
  }, { soft: 3 });
}

/**
 * 오려 낸 사진 한 조각(예시: 파란 하늘 위에 찢어 붙인 꽃잎과 천). 가장자리는 손으로 찢은 듯 고르지 않고,
 * 그 둘레를 쨍한 주황·빨강 띠가 감싼다. 가끔 조각 안에 구멍이 나 바탕이 비친다
 */
function cutPiece(g, x, y, w, h, ang, rim, mat, col, bg) {
  const pts = blobPoints(w, h, 1.4);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.save();
  g.shadowColor = "rgba(10,20,40,0.35)";
  g.shadowBlur = 14;
  g.shadowOffsetY = 6;
  g.fillStyle = rim;
  tracePoints(g, pts, 1.05, 5);
  g.fill();
  g.restore();
  // 띠 바깥 끝이 그을린 듯 진하게
  g.strokeStyle = shade(rim, -90);
  g.globalAlpha = 0.6;
  g.lineWidth = 2;
  tracePoints(g, pts, 1.05, 3);
  g.stroke();
  g.globalAlpha = 1;
  g.save();
  tracePoints(g, pts, 0.97, 4);
  g.clip();
  if (mat) fillMat(g, mat, w * 1.1, h * 1.1);
  else {
    g.fillStyle = col;
    g.fillRect(-w, -h, w * 2, h * 2);
  }
  g.restore();
  if (Math.random() < 0.45) {
    const hp = blobPoints(w * rand(0.12, 0.22), h * rand(0.06, 0.12), 1.6);
    g.translate(rand(-w * 0.25, w * 0.25), rand(-h * 0.25, h * 0.25));
    g.fillStyle = bg;
    tracePoints(g, hp, 1, 2);
    g.fill();
  }
  g.restore();
}

/**
 * LET 여섯 스타일 — 비비드한 색, 생동감, 에너지, 겹침, 레이어. 한 스타일마다 재료와 바탕색과 팔레트를 따로 두어
 * 여섯 장이 한눈에 다르게 보이게 한다. 관객 사진과 재료 사진(public/collage/let 무작위 1~3장)은 도형을 채우는 재료가 된다.
 * 빛번짐은 넣지 않는다(OL 의 것).
 *  0 film     쨍한 주황 바탕 위, 색이 갈라진 사진 필름이 이중 노출로 겹침(청록·노랑·분홍 젤 조각)
 *  1 stroke   노랑 바탕. 관객 사진 위를 굵직한 색 붓 획(빨강·코발트·분홍·먹색·초록)이 한 방향으로 가로지른다
 *  2 cutout   파란 하늘 위 찢어 오린 사진 조각이 주황·빨강 띠를 두르고 쌓임
 *  3 knife    나이프로 바른 주황·빨강·흰색·감청의 두꺼운 물감 덩어리 모자이크
 *  4 bands    회백 벽 앞 가로로 포개진 윤 나는 젤 띠(주황·코발트·빨강·분홍)와 긁힘, 반짝임
 *  5 acetate  큰 아세테이트 판(주황·분홍·청록·와인)이 접힌 가장자리로 맞물리고 파란 하늘이 틈으로 비침
 */
const LET_LOOKS = [
  { src: ["let-7", "cover"], mode: "film", bg: "#ea4a1d", pal: ["#00a6d6", "#ffd400", "#ff2d6f", "#2233d6", "#f4efe6", "#0f3d4a"] },
  { src: ["let-stroke", "let-2"], mode: "stroke", bg: "#f6c519", pal: ["#ff3b1f", "#1f4fe0", "#ff8fb1", "#0b0b0e", "#18a058", "#f4efe6", "#ff9a1c"] },
  { src: ["let-cutout", "let-4"], mode: "cutout", bg: "#2478c2", pal: ["#ff6a2b", "#e8121f", "#f08a9a", "#ff9a3c", "#7a1428"] },
  { src: ["let-knife", "let-6"], mode: "knife", bg: "#6d1430", pal: ["#ff6a2b", "#d8230f", "#f4efe6", "#18306e", "#ffc21a", "#2e7d3a", "#b0481e"] },
  { src: ["let-gel", "let-3"], mode: "bands", bg: "#12a150", pal: ["#ff6a2b", "#2233d6", "#e8121f", "#ec7f95", "#7a1428", "#ff9a3c"] },
  { src: ["let-acetate", "let-10"], mode: "acetate", bg: "#9bcf2e", pal: ["#f08a4b", "#ef6f8f", "#1aa0a0", "#ffb347", "#e4572e", "#c2185b"] },
];

/** 윤 나는 젤 띠의 반짝임: 한쪽 가장자리 둘레에 작은 흰 점과 긁힘이 모여 반짝인다 */
function sparkles(g, x, y, w, h, n) {
  g.save();
  g.globalCompositeOperation = "screen";
  for (let k = 0; k < n; k++) {
    const px = x + rand(0, w) * Math.pow(Math.random(), 1.6);
    const py = y + rand(0, h);
    g.fillStyle = `rgba(255,255,255,${rand(0.4, 1)})`;
    g.beginPath();
    g.arc(px, py, rand(0.5, 1.8), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(255,255,255,0.4)";
  g.lineWidth = 0.7;
  for (let k = 0; k < n / 4; k++) {
    const px = x + rand(0, w) * Math.pow(Math.random(), 1.4);
    const py = y + rand(0, h);
    const a = rand(-0.9, -0.3);
    const l = rand(10, 60);
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
}

function drawLET(g, imgs, T, S, M, P, V = 0) {
  const C = LET_LOOKS[V % LET_LOOKS.length];
  const bg = C.bg;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 스튜디오 조명: 한쪽이 조금 밝은 바탕
  const lg = g.createLinearGradient(rand(0, W), 0, rand(0, W), H);
  lg.addColorStop(0, "rgba(255,255,255,0.12)");
  lg.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);

  const mirror = Math.random() < 0.5;
  const fx = (x) => (mirror ? W - x : x);
  const color = () => (P.vivid.length && Math.random() < 0.25 ? pickOne(P.vivid) : pickOne(C.pal));
  const tone = (r, gg, b) => gradeLET(r, gg, b);
  const amt = 0.55 + 0.45 * M.vivid;
  const photos = imgs.map((im) => photoCanvas(im, 900, tone, { amt }));
  const srcs = S.map((s) => graded(s, 900, 1200, tone, { amt: 0.25 }));
  const mat = (pPhoto) => {
    const r = Math.random();
    if (r < pPhoto) return pickOne(photos);
    if (srcs.length && r < pPhoto + 0.4) return Math.random() < 0.7 ? srcs[0] : pickOne(srcs);
    return null;
  };


  // 이 스타일의 소스 사진을 바탕에 크게 한 장 깐다(필름·띠·판은 그 위에 겹쳐 새 색이 된다)
  if (srcs.length && ["film", "bands", "acetate", "cutout"].includes(C.mode)) {
    g.save();
    g.globalAlpha = 0.3;
    g.globalCompositeOperation = C.mode === "film" ? "multiply" : "soft-light";
    const k = rand(1.05, 1.3);
    g.translate(W / 2, H / 2);
    g.rotate(rand(-0.08, 0.08));
    g.drawImage(srcs[0], (-W * k) / 2, (-H * k) / 2, W * k, H * k);
    g.restore();
  }

  // 관객 사진을 화면 대부분에 크게 깐다(띠·판은 그 위에 색으로 겹친다)
  const basePhoto = () => {
    const c = graded(pickOne(imgs), W * rand(0.82, 0.92), H * rand(0.74, 0.84), tone, { zoom: rand(1, 1.15), ox: rand(0.3, 0.7), oy: rand(0.3, 0.6), amt });
    g.save();
    g.translate(W / 2 + rand(-20, 20), H / 2 + rand(-20, 20));
    g.rotate(rand(-0.03, 0.03));
    g.drawImage(c, -c.width / 2, -c.height / 2);
    g.restore();
  };

  const MODES = {
    film() {
      // 젤은 조각으로만 몇 장, 주인공은 사진 필름
      const gels = 2 + Math.round(M.layer * 3);
      const tilt = 0.15 + 0.35 * M.energy;
      for (let k = 0; k < gels; k++) gelSheet(g, fx(rand(120, 780)), rand(140, 1040), rand(240, 480), rand(200, 400), rand(-tilt, tilt), color());
      const layers = Math.max(imgs.length, 3 + Math.round(M.overlap * 2));
      const tints = ["#ff2d55", "#00b3ff", "#ffd400", "#7a3cff", "#00e0a0"];
      for (let k = 0; k < layers; k++) {
        const im = imgs[k % imgs.length];
        const w = k === 0 ? rand(480, 580) : rand(320, 460);
        let c = photoCanvas(im, w, tone, k === 0 ? { amt } : { amt, zoom: rand(1.1, 1.9), ox: Math.random(), oy: Math.random() });
        c = rgbSplit(c, rand(4, 8) + 6 * M.vivid);
        const h = k === 0 ? c.height : c.height * rand(0.6, 0.9);
        filmFrame(g, c, k === 0 ? fx(rand(400, 500)) : fx(rand(250, 650)), k === 0 ? rand(440, 560) : rand(300, 860), w, h, k === 0 ? rand(-0.06, 0.06) : rand(-0.22, 0.22), pickOne(tints), k === 0 ? "source-over" : k % 2 ? "multiply" : "screen", Math.random() < 0.5);
      }
    },
    stroke() {
      // 관객 사진을 크게 깔고, 그 위를 굵직한 색 붓 획이 한 방향으로 시원하게 가로지른다(획은 대부분 물감 색 그대로)
      basePhoto();
      const dir = (mirror ? 1 : -1) * rand(0.35, 0.75);
      const n = 9 + Math.round(6 * M.energy);
      for (let k = 0; k < n; k++) paintStroke(g, rand(-60, W + 60), rand(-40, H + 40), rand(420, 900), rand(140, 230), dir + rand(-0.12, 0.12), color(), mat(0.15));
    },
    cutout() {
      const n = Math.max(2, Math.round(2 + M.overlap * 2));
      const rims = C.pal.slice(0, 4);
      for (let k = 0; k < n; k++) {
        const t = n === 1 ? 0.5 : k / (n - 1);
        const w = rand(420, 700);
        cutPiece(g, fx(rand(330, 570)), 180 + t * 820 + rand(-60, 60), w, w * rand(0.6, 1.05), rand(-0.25, 0.25), pickOne(rims), mat(0.75) || pickOne(photos), color(), bg);
      }
    },
    knife() {
      // 칸으로 나눠 칸마다 덩어리를 얹어 빈틈이 조금만 남는 모자이크
      const step = 130;
      for (let yy = -40; yy < H + 40; yy += step)
        for (let xx = -40; xx < W + 40; xx += step) knifeChunk(g, xx + rand(0, step), yy + rand(0, step), rand(150, 290), rand(-0.6, 0.6), color(), mat(0.65));
    },
    bands() {
      // 가로로 포개진 띠: 한쪽이 둥글게 시작해 화면 끝까지. 겹친 자리에서 새 색이 된다
      const n = 5 + Math.round(M.layer * 2);
      const x0 = rand(110, 200);
      const w = W + 360;
      const cols = [...C.pal].sort(() => Math.random() - 0.5);
      basePhoto();
      let y = rand(-70, 10);
      for (let k = 0; k < n; k++) {
        const h = rand(180, 270);
        const cx = mirror ? W - x0 - w / 2 : x0 + w / 2;
        gelSheet(g, cx, y + h / 2, w, h, rand(-0.03, 0.03), cols[k % cols.length], k % 3 === 2 ? "source-over" : "multiply");
        sparkles(g, mirror ? W - x0 - 260 : x0, y, 260, h, 120);
        y += h * rand(0.58, 0.78);
      }
    },
    acetate() {
      // 큰 판이 격자로 맞물리고 가장자리는 접히며, 판 사이로 하늘이 비친다
      basePhoto();
      const cols = [...C.pal].sort(() => Math.random() - 0.5);
      let i = 0;
      for (let gy = 0; gy < 3; gy++)
        for (let gx = 0; gx < 2; gx++) {
          const w = rand(340, 420);
          const h = rand(300, 380);
          gelSheet(g, fx(gx * 440 + 230 + rand(-30, 30)), gy * 400 + 220 + rand(-30, 30), w, h, rand(-0.05, 0.05), cols[i++ % cols.length], Math.random() < 0.7 ? "multiply" : "source-over");
        }
      // 접혀 붉게 겹친 가장자리와 긁힘
      g.save();
      g.globalCompositeOperation = "multiply";
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = "rgba(160,30,50,0.35)";
        g.lineWidth = rand(4, 9);
        g.beginPath();
        const px = rand(60, W - 60);
        const py = rand(100, H - 100);
        g.moveTo(px, py);
        g.lineTo(px + rand(-260, 260), py + rand(-80, 80));
        g.stroke();
      }
      g.restore();
      g.save();
      g.globalCompositeOperation = "screen";
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 0.7;
      for (let k = 0; k < 160; k++) {
        const px = rand(0, W);
        const py = rand(0, H);
        const a = rand(-0.9, -0.3);
        const l = rand(10, 55);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
        g.stroke();
      }
      g.restore();

    },
  };
  MODES[C.mode]();

  // 작은 긁힘과 필름 입자
  g.save();
  g.globalCompositeOperation = "screen";
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 0.6;
  for (let k = 0; k < 90; k++) {
    const px = rand(0, W);
    const py = rand(0, H);
    const a = rand(-0.9, -0.4);
    const l = rand(8, 50);
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
  grain(g, 9000, (a) => `rgba(${a < 0.5 ? "255,255,255" : "30,20,30"},${0.05 + a * 0.05})`, 1.4);
  return bg;
}

const LOOKS = { LIA: LIA_LOOKS, OL: OL_LOOKS, LET: LET_LOOKS };

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
  const [imgs, T, Sall, K] = await Promise.all([art ? Promise.all([loadImage(art)]) : Promise.all(photos.map(loadImage)), loadTextures(artist), loadSources(artist), artist === "OL" ? loadMarks() : {}]);
  // 이번 작품의 비율과 관객 사진의 색. 같은 사진·같은 시선이어도 엮을 때마다 다른 한 장이 된다
  const M = mixFor(artist);
  const V = pickVariant(artist);
  // 재료 사진은 시선 폴더에서 매번 무작위로 1~3장. 어떤 사진이 얼마나 섞일지도 작품마다 다르다
  // 스타일마다 그 스타일을 대표하는 소스 사진이 정해져 있다(S[0], 크게 쓰인다). 여기에 다른 소스를 0~1장 옅게 더한다.
  // 그래서 여섯 스타일이 서로 다른 소스 사진의 색과 형태를 갖는다
  const look = (LOOKS[artist] || [])[V] || {};
  const sig = Sall.filter((im) => !im.blend && (look.src || []).includes(im.name));
  const rest = Sall.filter((im) => !im.blend && !sig.includes(im)).sort(() => Math.random() - 0.5);
  const S = [...sig.slice(0, 1).concat(sig.slice(1).sort(() => Math.random() - 0.5)).slice(0, 2), ...rest.slice(0, Math.floor(Math.random() * 2))];
  // 섞는 방식이 붙은 소스는 마지막에 그대로 얹는다
  const blended = Sall.filter((im) => im.blend).sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3));
  const P = photoPalette(imgs);
  // 시선마다 그린 바탕색을 돌려받아, 아래 2) 에서 그림 둘레의 여백도 같은 색으로 잇는다
  let bg = BG[artist] || BG.LIA;
  if (art) drawArt(a, imgs[0], artist);
  else if (artist === "OL") bg = drawOL(a, imgs, T, S, M, P, V, K) || bg;
  else if (artist === "LET") bg = drawLET(a, imgs, T, S, M, P, V) || bg;
  else bg = drawLIA(a, imgs, T, S, M, P, V) || bg;
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
