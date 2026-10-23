/**
 * LLM이 없거나 실패했을 때의 대체 결과. 서버(그래프의 fallback 노드)와 브라우저(네트워크가 끊겼을 때)
 * 양쪽에서 같은 결과를 내도록 이 파일 하나를 함께 쓴다. 서버 전용 모듈을 import 하지 않는다.
 */
import { ARTISTS, suggestTags, withParticle } from "./attic.js";
import { EMOTION_MOTIFS } from "./styles.js";

/** 해시태그 표기를 하나로 맞춘다. 공백 제거, # 하나, 10자 이내 */
export function cleanTag(t) {
  const s = String(t || "").replace(/[#\s]/g, "").slice(0, 10);
  return s ? "#" + s : "";
}

export function cleanText(s, max) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * 뜻을 건드리지 않는 띄어쓰기만 고친다: 겹친 빈칸, 문장 부호 앞의 빈칸,
 * 문장 부호 뒤 빠진 빈칸, 같은 부호 반복
 */
export function tidySpacing(text) {
  return String(text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([,.?!])/g, "$1")
    .replace(/([,.?!])(?=[가-힣A-Za-z])/g, "$1 ")
    .replace(/([.?!])\1{2,}/g, "$1$1$1")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** 작품 아래 띠에 들어갈 한 줄. 첫 문장을 30자 안에서 */
export function firstLine(text, max = 30) {
  const s = cleanText(text, 200);
  const one = (s.match(/^[^.?!。]*[.?!。]?/) || [s])[0].trim();
  return one.length > max ? one.slice(0, max - 1).trim() + "…" : one;
}

// 오늘의 마음별 구체적인 이미지. LLM이 없을 때 이야기와 키워드의 재료가 된다
const STARTS = {
  그리움: ["부치지 못한 편지", "부르지 않은 이름", "창가에 남은 온기"],
  설렘: ["접어 둔 기차표", "아직 뜯지 않은 봉투", "새로 산 공책"],
  고요함: ["빈 찻잔", "오후의 커튼", "멈춘 시계"],
  서운함: ["읽고 답 없는 메시지", "식어 버린 저녁", "반쯤 닫힌 문"],
  벅참: ["한꺼번에 핀 꽃", "꽉 찬 사진첩", "숨이 찬 계단"],
  쓸쓸함: ["빈 의자 하나", "늦은 버스 정류장", "꺼진 창"],
  후련함: ["비운 서랍", "열어 둔 창문", "찢어 낸 페이지"],
  막막함: ["갈림길의 지도", "끝이 안 보이는 복도", "흐린 안경"],
  아련함: ["바랜 사진", "옛 골목의 냄새", "희미한 노랫말"],
  다정함: ["건네받은 우산", "따뜻한 손글씨", "나눠 먹은 귤"],
  지침: ["벗어 둔 신발", "늦은 밤의 불빛", "구겨진 소매"],
  홀가분함: ["가벼운 가방", "끝낸 편지", "바람 든 셔츠"],
};

/**
 * 시선별 이야기 틀. LLM이 없을 때도 세 시선의 쓰는 결(서버 prompts.js의 WRITERS)이 갈리게 한다.
 * 리아는 덜어내고 남겨 두며 닫고, 올은 어긋난 자리를 그대로 두고, 렛은 장면을 겹쳐 쓴다.
 */
const STORIES = {
  LIA: {
    photo: (w, e) => [
      `사진 속 빛이 머문 자리만 남기고 나머지는 지운다. 오늘의 ${withParticle(e, "은", "는")} ${withParticle(w[0], "을", "를")} 닮았다.`,
      `${w[1]}, 그 뒷모습만 사진에 남았다. 하지 못한 말은 여백에 접어 둔다.`,
      `${w[2]}의 윤곽을 오래 본다. 사진 한 장에 그 온도만 남겨 둔다.`,
    ],
    plain: (w, e) => [
      `오늘의 ${withParticle(e, "은", "는")} ${withParticle(w[0], "을", "를")} 닮았다. 다 적지 않고 한 줄만 남겨 둔다.`,
      `${w[1]}, 그 자리에 아직 머물러 있다. 나머지는 말하지 않기로 한다.`,
      `${w[2]}의 그림자만 오래 남는다. 다 말하지 못한 채로 한 장을 넘긴다.`,
    ],
  },
  OL: {
    photo: (w, e) => [
      `찍으려던 것과 다른 것이 사진에 남았다. 어긋난 그 자리에서 ${w[0]}의 결이 보인다.`,
      `${w[1]}, 생각대로 되지 않은 장면이다. 그런데 그 틈으로 오늘의 ${withParticle(e, "이", "가")} 번져 나왔다.`,
      `사진 가장자리가 조금 흔들렸다. ${w[2]}의 자국을 지우지 않고 그대로 둔다.`,
    ],
    plain: (w, e) => [
      `계획과 다르게 흘러간 하루, ${w[1]}에 손자국이 남았다. 지우지 않고 그대로 둔다.`,
      `${w[0]}처럼 어딘가 찢긴 채로 오늘이 지나간다. 그 틈으로 ${e}의 결이 보인다.`,
      `${w[2]}, 생각과 어긋난 자리다. 번진 그대로가 오늘의 흔적이 된다.`,
    ],
  },
  LET: {
    photo: (w, e) => [
      `사진 속 빛 위로 ${withParticle(w[0], "이", "가")} 겹친다. 어제와 오늘이 한 장에 포개지고, 처음 보는 장면이 된다.`,
      `${w[1]}, ${w[2]}, 그리고 사진 속 오늘. 한꺼번에 겹쳐 놓으니 ${e}의 색이 선명해진다.`,
      `사진 한 장 위에 다른 날의 ${withParticle(w[1], "이", "가")} 포개진다. 겹친 자리마다 새로운 빛이 생긴다.`,
    ],
    plain: (w, e) => [
      `${w[0]}, ${w[1]}, ${w[2]}. 한꺼번에 떠오른 장면들이 포개져 오늘의 색이 된다.`,
      `${w[0]} 위로 ${withParticle(w[2], "이", "가")} 겹친다. 서로 다른 날이 한 장면 안에서 밝아진다.`,
      `오늘의 ${withParticle(e, "은", "는")} 여러 장면이 겹친 색이다. ${w[1]}의 빛이 그 위에 한 겹 더 얹힌다.`,
    ],
  },
};

/** 6장 — 다락방이 먼저 적어 주는 이야기. 사진이 없으면 사진 이야기를 하지 않는다 */
export function fallbackRead({ emotion, artist, count = 0 }) {
  const w = STARTS[emotion] || ["오늘 본 장면", "손에 쥔 물건", "떠오른 얼굴"];
  const set = STORIES[artist] || STORIES.LIA;
  const pool = (count ? set.photo : set.plain)(w, emotion);
  const own = cleanTag(emotion);
  const photoTags = count ? suggestTags("", artist, emotion).filter((t) => t !== own && t !== "#감정의다락방").slice(-2) : [];
  return { story: pool[Math.floor(Math.random() * pool.length)], photoTags };
}

// 편지 본문도 시선의 결을 따른다. 리아는 남긴 것, 올은 흔적, 렛은 겹침으로 닫는다
const RELATIONS = {
  LIA: (kw) => `${kw}만 남기고 나머지는 ${ARTISTS.LIA.short}으로 두었습니다.`,
  OL: (kw) => `어긋난 자리의 ${withParticle(kw, "이", "가")} ${ARTISTS.OL.short} 속 흔적으로 남았습니다.`,
  LET: (kw) => `${kw} 위로 여러 순간이 겹쳐 ${ARTISTS.LET.short} 한 장이 되었습니다.`,
};

/** 7장 — 작품 라벨. 제목, 작품에 새길 한 줄, 종합 낱말, 관계 문장, 노트 */
export function fallbackCompose({ emotion, artist, answer = "", hints = [] }) {
  const first = cleanText(answer, 80).split(/[,.?!，。]/)[0].trim();
  const title = first ? (first.length > 14 ? first.slice(0, 14).trim() + "…" : first) : `${emotion}의 한 장`;
  // 글에서 찾은 낱말을 앞에, 사진에서 읽은 낱말을 뒤에 두고 넷을 고른다
  const own = cleanTag(emotion);
  const base = suggestTags("", artist, emotion);
  const fromAnswer = suggestTags(answer, artist, emotion).filter((t) => !base.includes(t));
  const keywords = Array.from(new Set([...fromAnswer, ...hints.map(cleanTag), ...base.filter((t) => t !== "#감정의다락방")]))
    .filter((t) => t && t !== own)
    .slice(0, 4);
  const kw = keywords.map((t) => t.replace(/^#/, ""))[0];
  // 편지에는 글과 마음, 시선이 따로 적히므로 본문은 그것을 되풀이하지 않고 이미지 하나만 짚는다
  const relation = (RELATIONS[artist] || RELATIONS.LIA)(kw || "오늘의 장면");
  const fixed = tidySpacing(answer);
  // LLM 없이 장면을 지어낼 수는 없으니, 오늘의 마음에 어울리는 사물로 장면을 세운다
  const motifs = EMOTION_MOTIFS[emotion] || ["a window", "a letter", "afternoon light"];
  const scene = `A quiet personal scene with ${motifs.join(", ")}.`;
  return { title, line: firstLine(fixed), keywords, relation, fixed, scene, motifs, publishable: true };
}
