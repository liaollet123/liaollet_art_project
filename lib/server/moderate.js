// 서가에 공개되기 전 거르는 첫 단계. LLM 없이도 돌아가는 낱말 검사와 개인정보 지우기.
// LLM이 붙어 있으면 compose 그래프의 판정이 한 번 더 거른다(lib/server/graphs.js).
import "server-only";

// 전시장에서 흔히 들어올 만한 욕설과 혐오 표현의 줄기. 모자라면 여기에 더한다.
// 띄어쓰기나 기호를 섞어 피해 가는 경우를 잡으려고 공백과 기호를 지운 글에서 찾는다
const BLOCK = [
  "시발", "씨발", "씨빨", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "좆", "존나", "개새", "새끼", "닥쳐", "미친년", "미친놈",
  "꺼져", "죽어", "자살", "죽여", "섹스", "야동", "보지", "자지", "fuck", "shit", "bitch",
];

const squash = (s) => String(s || "").toLowerCase().replace(/[\s.,!?~\-_*·'"`()[\]{}]/g, "");

export function hasBlocked(text) {
  const t = squash(text);
  return BLOCK.some((w) => t.includes(w));
}

/** 전화번호, 이메일, 링크를 지운다. 익명 전시에 남아서는 안 되는 것들 */
export function scrubPII(text) {
  return String(text || "")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/(\+?82[-\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
