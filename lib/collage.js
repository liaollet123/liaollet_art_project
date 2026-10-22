"use client";

import { TEXTURES } from "./textures.js";

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
//   LIA — 새하얀 종이, 세피아, 넓은 여백, 반투명 종이(벨럼), 부드러움
//   OL  — 모노톤, 그레인, 연필 선, 콘테 스트로크, 찢어진 종이 질감
//   LET — 비비드한 색, 겹쳐진 사진, 생동감, 쨍하고 밝은 빛
// ---------------------------------------------------------------------------

const W = 900;
const H = 1200;

const BG = { LIA: "#fbfaf6", OL: "#dedbd4", LET: "#fffaf0" };

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
  const want = ["700 50px 'Nanum Myeongjo'", "italic 29px 'Nanum Myeongjo'", "700 27px 'Nanum Myeongjo'"];
  await Promise.race([Promise.all(want.map((f) => document.fonts.load(f, "가나다 LIAOLLET"))), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
}

const rand = (a, b) => a + Math.random() * (b - a);

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
 * 너무 밝거나 어두운 사진도 시선의 색이 살도록, 먼저 밝기 범위를 넓혀 둔다(자동 레벨)
 */
function graded(im, w, h, grade, { zoom = 1, ox = 0.5, oy = 0.5 } = {}) {
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
    p[i] = clamp(r);
    p[i + 1] = clamp(gg);
    p[i + 2] = clamp(b);
  }
  x.putImageData(d, 0, 0);
  return c;
}

// LIA: 부드러운 세피아. 대비를 낮추고 그림자를 들어 올려 빛이 번진 듯하게
const gradeLIA = (r, g, b) => {
  const v = 34 + luma(r, g, b) * 0.8;
  return [v * 1.07 + 8, v * 0.97 + 2, v * 0.82 - 4];
};

// OL: 모노톤. 대비를 세우고 필름 같은 거친 입자를 픽셀마다 섞는다
const gradeOL = (r, g, b) => {
  const l = luma(r, g, b) / 255;
  const s = 1 / (1 + Math.exp(-8 * (l - 0.5)));
  const v = s * 236 + 10 + (Math.random() - 0.5) * 38;
  return [v, v * 0.99, v * 0.97];
};

// LET: 쨍하고 밝게. 채도를 크게 올리고 노출을 들어, 밝은 곳은 따뜻하게 그림자는 시원하게
const gradeLET = (r, g, b) => {
  const l = luma(r, g, b);
  const sat = 1.85;
  let R = l + (r - l) * sat;
  let G = l + (g - l) * sat;
  let B = l + (b - l) * sat;
  const t = l / 255;
  R += 26 + t * 20;
  G += 16;
  B += (0.5 - t) * 50;
  return [(R - 128) * 1.12 + 140, (G - 128) * 1.12 + 136, (B - 128) * 1.12 + 132];
};

function grain(g, n, color, size = 1.6) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = color(Math.random());
    g.fillRect(Math.random() * W, Math.random() * H, size, size);
  }
}

/** 사진 가장자리를 종이색으로 부드럽게 녹인다(LIA의 번지는 빛) */
function softEdge(g, w, h, color) {
  const rg = g.createRadialGradient(0, 0, Math.min(w, h) * 0.32, 0, 0, Math.max(w, h) * 0.66);
  rg.addColorStop(0, "rgba(0,0,0,0)");
  rg.addColorStop(1, color);
  g.fillStyle = rg;
  g.fillRect(-w / 2, -h / 2, w, h);
}

// ---------------------------------------------------------------------------
// LIA
// ---------------------------------------------------------------------------

/**
 * 새하얀 종이 위의 넓은 여백. 사진은 작게 세피아로, 한쪽으로 비켜 둔다.
 * 반투명한 벨럼 몇 장이 사진과 종이 위에 겹쳐 빛을 부드럽게 흩트린다
 */
function drawLIA(g, imgs, T) {
  const paper = pick(T, "paper");
  if (paper) cover(g, paper);
  // 종이 결: 아주 옅은 섬유와 따뜻한 입자
  else grain(g, 2600, (a) => `rgba(150,120,90,${a * 0.05})`);
  g.strokeStyle = "rgba(160,130,100,0.05)";
  for (let i = 0; i < (paper ? 0 : 70); i++) {
    const x = rand(0, W);
    const y = rand(0, H);
    g.lineWidth = rand(0.4, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rand(-20, 20), y + rand(-10, 10), x + rand(-40, 40), y + rand(-14, 14));
    g.stroke();
  }
  // 왼쪽 위에서 커튼 너머로 드는 따뜻한 빛
  const light = pick(T, "light");
  if (light) place(g, light, W / 2, H / 2, W, H, 0, { op: "screen", alpha: 0.8 });
  else {
    const glow = g.createRadialGradient(140, 120, 20, 140, 120, 760);
    glow.addColorStop(0, "rgba(255,240,214,0.55)");
    glow.addColorStop(1, "rgba(255,240,214,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
  }

  // 사진 아래 깔리는 하얀 종이 두 장(살짝 다른 흰색)
  const sheets = [
    { x: 560, y: 640, w: 420, h: 540, r: 0.035, c: "#ffffff" },
    { x: 430, y: 760, w: 330, h: 300, r: -0.05, c: "#f7f3ea" },
  ];
  sheets.forEach((p) => {
    const sh = pick(T, "sheet");
    if (sh) return place(g, sh, p.x, p.y, p.w, p.h, p.r, { shadow: "rgba(90,70,40,0.12)" });
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.r);
    g.shadowColor = "rgba(90,70,40,0.10)";
    g.shadowBlur = 26;
    g.shadowOffsetY = 8;
    g.fillStyle = p.c;
    tornPath(g, p.w, p.h, 5);
    g.fill();
    g.restore();
  });

  // 사진이 몇 장이든 화면의 3분의 1 남짓만 차지하게
  const n = Math.min(imgs.length, 3);
  const spots = [
    [{ x: 580, y: 600, w: 360, r: -0.02 }],
    [{ x: 610, y: 540, w: 320, r: -0.025 }, { x: 360, y: 820, w: 220, r: 0.03 }],
    [{ x: 620, y: 500, w: 290, r: -0.025 }, { x: 360, y: 770, w: 210, r: 0.03 }, { x: 690, y: 880, w: 170, r: 0.015 }],
  ][Math.max(0, n - 1)];
  imgs.slice(0, 3).forEach((im, i) => {
    const s = spots[i];
    const w = s.w;
    const h = w * 1.28;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.r);
    g.shadowColor = "rgba(80,60,30,0.14)";
    g.shadowBlur = 14;
    g.shadowOffsetY = 4;
    g.fillStyle = "#ffffff";
    g.fillRect(-w / 2 - 9, -h / 2 - 9, w + 18, h + 18);
    g.shadowColor = "transparent";
    g.drawImage(graded(im, w, h, gradeLIA), -w / 2, -h / 2, w, h);
    softEdge(g, w, h, "rgba(255,250,240,0.38)");
    g.restore();
  });

  // 벨럼(반투명 트레이싱지): 사진 일부를 덮어 흐릿하게 만든다. 가장자리에 옅은 빛선
  const vellum = [
    { x: 600, y: 760, w: 460, h: 190, r: -0.06 },
    { x: 280, y: 400, w: 260, h: 340, r: 0.08 },
  ];
  vellum.forEach((v) => {
    const vt = pick(T, "vellum");
    if (vt) return place(g, vt, v.x, v.y, v.w, v.h, v.r);
    g.save();
    g.translate(v.x, v.y);
    g.rotate(v.r);
    g.fillStyle = "rgba(250,245,234,0.5)";
    g.fillRect(-v.w / 2, -v.h / 2, v.w, v.h);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 1.2;
    g.strokeRect(-v.w / 2, -v.h / 2, v.w, v.h);
    g.strokeStyle = "rgba(150,120,90,0.16)";
    g.strokeRect(-v.w / 2 + 1.5, -v.h / 2 + 1.5, v.w - 3, v.h - 3);
    g.restore();
  });

  // 반투명 마스킹 테이프 한 조각
  const tape = pick(T, "tape");
  if (tape) place(g, tape, 640, 300, 150, null, -0.12);
  else {
    g.save();
    g.translate(640, 300);
    g.rotate(-0.12);
    g.fillStyle = "rgba(236,222,196,0.6)";
    g.fillRect(-60, -16, 120, 32);
    g.restore();
  }
}

// ---------------------------------------------------------------------------
// OL
// ---------------------------------------------------------------------------

/** 콘테 한 획: 굵은 획을 작은 입자로 찍어 종이 결에 걸린 듯 거칠게 */
function conte(g, pts, width, alpha) {
  const [x0, y0, cx, cy, x1, y1] = pts;
  // 손가락으로 문지른 듯한 옅은 바탕: 어긋난 얇은 획을 여러 번 겹친다
  for (let p = 0; p < 10; p++) {
    const j = () => rand(-width * 0.7, width * 0.7);
    g.strokeStyle = `rgba(40,36,32,${alpha * rand(0.03, 0.07)})`;
    g.lineWidth = rand(width * 0.3, width * 0.8);
    g.beginPath();
    g.moveTo(x0 + j(), y0 + j());
    g.quadraticCurveTo(cx + j(), cy + j(), x1 + j(), y1 + j());
    g.stroke();
  }
  for (let t = 0; t <= 1; t += 0.0016) {
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    for (let k = 0; k < 14; k++) {
      g.fillStyle = `rgba(28,24,22,${alpha * Math.random()})`;
      g.fillRect(x + rand(-width / 2, width / 2), y + rand(-width / 2, width / 2), rand(1, 3.4), rand(1, 3.4));
    }
  }
}

/** 연필 선: 가는 흑연 선을 여러 번 겹쳐 그은 스케치 */
function pencil(g, x0, y0, x1, y1, passes = 3) {
  for (let p = 0; p < passes; p++) {
    g.strokeStyle = `rgba(40,38,36,${rand(0.12, 0.38)})`;
    g.lineWidth = rand(0.5, 1.2);
    g.beginPath();
    g.moveTo(x0 + rand(-3, 3), y0 + rand(-3, 3));
    g.quadraticCurveTo((x0 + x1) / 2 + rand(-14, 14), (y0 + y1) / 2 + rand(-14, 14), x1 + rand(-3, 3), y1 + rand(-3, 3));
    g.stroke();
  }
}

/** 빗금(해칭) 한 묶음 */
function hatch(g, x, y, w, h, angle, gap) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  for (let i = -w / 2; i < w / 2; i += gap) pencil(g, i, -h / 2, i + rand(-6, 6), h / 2, 1);
  g.restore();
}

/**
 * 모노톤의 드로잉 종이 위. 흑백 사진을 손으로 찢어 붙이고, 그 위로 연필 선과 빗금,
 * 콘테의 굵은 획이 지나간다. 화면 전체에 거친 그레인
 */
function drawOL(g, imgs, T) {
  const paper = pick(T, "paper");
  if (paper) cover(g, paper);
  else grain(g, 9000, (a) => (a > 0.5 ? `rgba(255,255,255,${(a - 0.5) * 0.35})` : `rgba(30,28,26,${a * 0.18})`));
  // 손으로 문지른 흑연 얼룩
  for (let i = 0; i < 4; i++) {
    const x = rand(80, W - 80);
    const y = rand(80, H - 80);
    const smt = pick(T, "smudge");
    if (smt) {
      place(g, smt, x, y, rand(260, 480), null, rand(-0.6, 0.6), { alpha: rand(0.5, 0.85), op: "multiply" });
      continue;
    }
    const sm = g.createRadialGradient(x, y, 10, x, y, rand(140, 260));
    sm.addColorStop(0, "rgba(60,56,52,0.16)");
    sm.addColorStop(1, "rgba(60,56,52,0)");
    g.fillStyle = sm;
    g.fillRect(0, 0, W, H);
  }
  // 바탕의 구성선(밑그림)
  for (let i = 0; i < 9; i++) pencil(g, rand(0, W), rand(0, H), rand(0, W), rand(0, H), 2);

  const n = Math.min(imgs.length, 3);
  const spots = [
    [{ x: 450, y: 560, w: 520, r: -0.04 }],
    [{ x: 340, y: 470, w: 420, r: -0.06 }, { x: 590, y: 780, w: 380, r: 0.05 }],
    [{ x: 300, y: 400, w: 340, r: -0.06 }, { x: 640, y: 470, w: 300, r: 0.07 }, { x: 470, y: 840, w: 360, r: -0.02 }],
  ][Math.max(0, n - 1)];
  imgs.slice(0, 3).forEach((im, i) => {
    const s = spots[i];
    const w = s.w;
    const h = w * 1.18;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.r);
    // 찢긴 종이의 하얀 섬유 가장자리: 사진보다 조금 큰 흰 종이를 먼저 찢어 깐다
    const torn = pick(T, "torn");
    if (torn) place(g, torn, 0, 0, w + 46, h + 46, 0, { shadow: "rgba(0,0,0,0.2)" });
    else {
      g.shadowColor = "rgba(0,0,0,0.18)";
      g.shadowBlur = 10;
      g.shadowOffsetY = 3;
      g.fillStyle = "#f4f2ec";
      tornPath(g, w + 22, h + 22, 16);
      g.fill();
      g.shadowColor = "transparent";
    }
    g.save();
    tornPath(g, w, h, 12);
    g.clip();
    g.drawImage(graded(im, w, h, gradeOL), -w / 2, -h / 2, w, h);
    g.restore();
    // 찢어 낸 한쪽 모서리: 사진이 뜯겨 나가 종이가 드러난다(재료 종이를 쓰면 같은 종이로 메운다)
    g.fillStyle = paper ? g.createPattern(paper, "repeat") : BG.OL;
    g.beginPath();
    g.moveTo(w / 2 + 14, -h / 2 - 14);
    for (let k = 0; k <= 12; k++) g.lineTo(w / 2 - (w * 0.32 * k) / 12 + rand(-5, 5), -h / 2 + (h * 0.22 * k) / 12 + rand(-7, 7) - 14);
    g.lineTo(w / 2 + 14, -h / 2 + h * 0.22);
    g.closePath();
    g.fill();
    g.restore();
  });

  // 사진 위로 지나가는 빗금과 연필 윤곽
  for (const [w, h, a0, a1, gap] of [[260, 200, -0.9, -0.5, 9], [200, 160, 0.4, 0.8, 8]]) {
    const pt = pick(T, "pencil");
    if (pt) place(g, pt, rand(200, 700), rand(250, 950), w * 1.3, null, rand(a0, a1) + 0.6, { alpha: 0.85, op: "multiply" });
    else hatch(g, rand(200, 700), rand(250, 950), w, h, rand(a0, a1), gap);
  }
  for (let i = 0; i < 6; i++) pencil(g, rand(60, W - 60), rand(60, H - 60), rand(60, W - 60), rand(60, H - 60), 4);
  // 콘테 획: 대각선으로 크게 한 번, 짧게 두 번
  const big = [rand(-40, 100), rand(820, 1000), W * 0.45, rand(600, 760), W + 30, rand(300, 460)];
  const ct = pick(T, "conte");
  if (ct) stroke(g, ct, big[0], big[1], big[4], big[5], 0.92);
  else conte(g, big, 34, 0.8);
  // 짧은 콘테 자국 두 개: 거의 곧게, 비스듬히 툭 그은 손짓
  for (const [x, y] of [[rand(90, 260), rand(110, 260)], [rand(560, 760), rand(980, 1110)]]) {
    const ang = rand(-0.5, 0.3);
    const len = rand(150, 240);
    const x1 = x + Math.cos(ang) * len;
    const y1 = y + Math.sin(ang) * len;
    const cs = pick(T, "conte");
    if (cs) stroke(g, cs, x, y, x1, y1, 0.8);
    else conte(g, [x, y, (x + x1) / 2 + rand(-12, 12), (y + y1) / 2 + rand(-12, 12), x1, y1], rand(12, 18), 0.6);
  }
  const gt = pick(T, "grain");
  if (gt) grainTex(g, gt, 0.45);
  else grain(g, 4000, (a) => `rgba(20,18,16,${a * 0.12})`, 1.2);
}

// ---------------------------------------------------------------------------
// LET
// ---------------------------------------------------------------------------

/** 망점(하프톤) 무늬 한 조각 */
function halftone(g, x, y, w, h, color, step = 14) {
  g.fillStyle = color;
  for (let yy = 0; yy < h; yy += step)
    for (let xx = (yy / step) % 2 ? step / 2 : 0; xx < w; xx += step) {
      g.beginPath();
      g.arc(x + xx, y + yy, step * 0.28, 0, Math.PI * 2);
      g.fill();
    }
}

/**
 * 밝은 바탕 위로 쨍한 색면과 사진이 겹겹이 쌓인다. 같은 사진도 크기와 각도를 달리해
 * 여러 순간처럼 겹치고(곱하기·스크린 합성), 햇빛 번짐과 망점이 생동감을 더한다
 */
function drawLET(g, imgs, T) {
  const paper = pick(T, "paper");
  if (paper) cover(g, paper);
  // 쨍한 색면들. 곱하기로 겹치면 겹친 자리에 새 색이 생긴다
  const blocks = [
    ["#00c2e0", -0.2, 40, 90, 470, 300],
    ["#ff7a1a", 0.14, 430, 420, 500, 280],
    ["#ff2d55", -0.06, 90, 820, 420, 220],
    ["#ffd400", 0.22, 560, 120, 300, 200],
    ["#7a3cff", -0.12, 560, 900, 320, 180],
  ];
  g.save();
  g.globalCompositeOperation = "multiply";
  blocks.forEach(([c, r, x, y, w, h]) => {
    const bt = pick(T, "block");
    if (bt) return place(g, bt, x + w / 2, y + h / 2, w, h, r, { alpha: 0.92, op: "multiply" });
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(r);
    g.globalAlpha = 0.9;
    g.fillStyle = c;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  });
  g.restore();
  const ht = pick(T, "halftone");
  if (ht) {
    place(g, ht, 730, 660, 260, null, 0.1, { alpha: 0.8 });
    place(g, pick(T, "halftone"), 160, 510, 220, null, -0.2, { alpha: 0.75 });
  } else {
    halftone(g, 610, 560, 240, 200, "rgba(255,45,85,0.55)");
    halftone(g, 60, 420, 200, 180, "rgba(0,160,200,0.5)", 12);
  }

  // 같은 사진을 다른 순간처럼 겹친다. 사진이 한 장이어도 네 겹이 되게
  const layers = [0, 1, 2, 3].map((i) => imgs[i % imgs.length]);
  const spots = [
    { x: 330, y: 400, w: 400, r: -0.09, op: "source-over", a: 1, frame: "#ffffff", shadow: "#00c2e0", crop: {} },
    { x: 610, y: 610, w: 380, r: 0.08, op: "multiply", a: 0.92, frame: null, shadow: null, crop: { zoom: 1.7, ox: 0.3, oy: 0.4 } },
    { x: 390, y: 870, w: 330, r: -0.04, op: "source-over", a: 1, frame: "#ffffff", shadow: "#ff7a1a", crop: { zoom: 1.35, ox: 0.7, oy: 0.65 } },
    { x: 660, y: 290, w: 250, r: 0.12, op: "source-over", a: 1, frame: "#ffffff", shadow: "#ff2d55", crop: { zoom: 2.2, ox: 0.5, oy: 0.3 } },
  ];
  layers.forEach((im, i) => {
    const s = spots[i];
    const w = s.w;
    const h = w * 1.2;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.r);
    // 색으로 어긋난 그림자: 인쇄가 살짝 밀린 것처럼
    if (s.shadow) {
      g.fillStyle = s.shadow;
      g.fillRect(-w / 2 + 18, -h / 2 + 18, w, h);
    }
    if (s.frame) {
      g.fillStyle = s.frame;
      g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
    }
    g.globalCompositeOperation = s.op;
    g.globalAlpha = s.a;
    g.drawImage(graded(im, w, h, gradeLET, s.crop), -w / 2, -h / 2, w, h);
    g.restore();
  });

  // 햇빛 번짐: 오른쪽 위에서 쏟아지는 밝은 빛
  const flare = pick(T, "flare");
  if (flare) place(g, flare, W / 2, H / 2, W, H, 0, { op: "screen" });
  else drawSun(g);

  // 색 테이프 두 조각
  [
    ["rgba(255,212,0,0.85)", 300, 175, -0.3],
    ["rgba(0,194,224,0.8)", 700, 1010, 0.25],
  ].forEach(([c, x, y, r]) => {
    const tt = pick(T, "tape");
    if (tt) return place(g, tt, x, y, 170, null, r);
    g.save();
    g.translate(x, y);
    g.rotate(r);
    g.fillStyle = c;
    g.fillRect(-70, -18, 140, 36);
    g.restore();
  });
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

export async function renderCollage({ photos, artist, art, title = "", line = "", tags = [], entryKey = "------", emotion = "", date }) {
  const fonts = fontsReady();
  // 1) 시선의 그림을 900x1200 캔버스에 그대로 그린다(시선별 구도는 이 크기를 기준으로 짜여 있다)
  const art0 = document.createElement("canvas");
  art0.width = W;
  art0.height = H;
  const a = art0.getContext("2d");
  a.fillStyle = BG[artist] || BG.LIA;
  a.fillRect(0, 0, W, H);
  const [imgs, T] = await Promise.all([art ? Promise.all([loadImage(art)]) : Promise.all(photos.map(loadImage)), loadTextures(artist)]);
  if (art) drawArt(a, imgs[0], artist);
  else if (artist === "OL") drawOL(a, imgs, T);
  else if (artist === "LET") drawLET(a, imgs, T);
  else drawLIA(a, imgs, T);

  // 2) 작품: 위쪽(띠 위)에 그림을 담는다. 그림의 가운데 부분을 비율 그대로 줄여 넣고,
  //    좌우와 위 가장자리를 바탕에 스며들게 해 잘린 경계가 보이지 않게 한다
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = BG[artist] || BG.LIA;
  g.fillRect(0, 0, W, H);
  const paper = pick(T, "paper");
  if (paper) cover(g, paper);

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
