"use client";

/**
 * 브라우저 쪽 저장 창구. 티켓과 서가는 모두 서버(app/api)에 둔다.
 * 그래야 다른 폰에서도 같은 서가가 보이고, 공유 링크가 받는 사람 폰에서 열린다.
 * 이 기기에만 남기는 것은 "내가 공감을 누른 작품" 목록(같은 사람이 여러 번 누르지 않게)과,
 * 1장에 미리 적어 둘 "전에 쓴 이름" 하나다. 이름의 주인 확인은 서버가 한다.
 */

const LIKED = "attic-liked-v3";
const SIGN = "attic-sign-v1";

function readJSON(k, fallback) {
  try {
    return JSON.parse(localStorage.getItem(k) || "") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* 저장 공간이 없어도 공감 수는 서버에 남는다 */
  }
}

/**
 * 서버를 부른다. 실패하면 { error, status } 를 돌려준다(예외를 던지지 않는다).
 * 화면은 error가 있으면 자기 대체 문구를 쓴다
 */
async function call(url, { method = "GET", body, signal } = {}) {
  try {
    const r = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    const data = await r.json().catch(() => ({}));
    return r.ok ? data : { ...data, error: data.error || "요청에 실패했어요", status: r.status };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "abort" : "네트워크에 연결할 수 없어요", status: 0 };
  }
}

export const issueTicket = () => call("/api/tickets", { method: "POST" });
export const analyze = (input, signal) => call("/api/analyze", { method: "POST", body: input, signal });
export const compose = (input) => call("/api/compose", { method: "POST", body: input });

export async function loadShelf() {
  const r = await call("/api/works");
  return r.works || [];
}

/**
 * 오늘의 창작자 이름(= 아이디). check 면 1장에서 확인만 하고, 아니면 6장에서 엮을 때 작품 번호를 받는다
 *   → { no, seq, date, signature, used, limit } (check 면 { ok, signature, used, limit }) 또는 { error, code }
 */
export const claimSign = (signature, check = false) => call("/api/sign", { method: "POST", body: { signature, check } });

/** 1장 "이미 남긴 기록이 있나요?": 아이디(서명)로 남긴 작품들 */
export async function findBySign(sign) {
  const r = await call(`/api/works?sign=${encodeURIComponent(sign)}`);
  return r.works || [];
}

export async function findByTicket(no) {
  const r = await call(`/api/works?ticket=${encodeURIComponent(no)}`);
  return r.works || [];
}

export async function findWork(key) {
  const r = await call(`/api/works/${encodeURIComponent(key)}`);
  return r.work || null;
}

export const saveWork = (entry) => call("/api/works", { method: "POST", body: entry });

export const loadLiked = () => readJSON(LIKED, {});
export const loadSign = () => String(readJSON(SIGN, "") || "");
export const rememberSign = (name) => writeJSON(SIGN, name);

/** 공감 누르기/빼기. 서버의 새 수를 돌려준다 */
export async function toggleLike(id, on) {
  const liked = loadLiked();
  if (on) liked[id] = true;
  else delete liked[id];
  writeJSON(LIKED, liked);
  const r = await call("/api/likes", { method: "POST", body: { id, on } });
  return { liked, likes: r.likes };
}
