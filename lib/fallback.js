/**
 * LLM이 없거나 실패했을 때의 대체 결과. 서버(그래프의 fallback 노드)와 브라우저(네트워크가 끊겼을 때)
 * 양쪽에서 같은 결과를 내도록 이 파일 하나를 함께 쓴다. 서버 전용 모듈을 import 하지 않는다.
 */
import { ARTISTS, suggestTags, withParticle } from "./attic.js";
import { EMOTION_MOTIFS } from "./styles.js";
import { WRITERS } from "./writers.js";

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

/** 6장 — 다락방이 먼저 적어 주는 이야기. 사진이 없으면 사진 이야기를 하지 않는다 */
export function fallbackRead({ emotion, artist, count = 0 }) {
  const w = STARTS[emotion] || ["오늘 본 장면", "손에 쥔 물건", "떠오른 얼굴"];
  const em = withParticle(emotion, "은", "는");
  const withPhoto = [
    `사진 속 빛이 머문 자리를 오래 들여다봤다. 오늘의 ${em} ${withParticle(w[0], "을", "를")} 닮았다.`,
    `${w[1]}, 그 자리에 아직 머물러 있다. 말하지 않아도 사진이 대신 기억해 준다.`,
    `${w[2]}처럼 오늘의 마음이 조용히 남아 있다. 사진 한 장에 그 온도를 접어 둔다.`,
  ];
  const noPhoto = [
    `오늘의 ${em} ${withParticle(w[0], "을", "를")} 닮았다. 아무 말 없이 오래 곁에 두고 싶다.`,
    `${w[1]}, 그 자리에 아직 머물러 있다. 오늘은 그 마음을 여기에 적어 둔다.`,
    `${w[2]}처럼 오늘의 마음이 조용히 남아 있다. 다 말하지 못한 채로 한 장을 넘긴다.`,
  ];
  const pool = count ? withPhoto : noPhoto;
  const own = cleanTag(emotion);
  const photoTags = count ? suggestTags("", artist, emotion).filter((t) => t !== own && t !== "#감정의다락방").slice(-2) : [];
  // 끝에 고른 시선의 작가가 그 마음을 어떻게 보는지 한 줄(LLM 이 있으면 같은 자리를 작가의 목소리로 새로 쓴다)
  const view = (WRITERS[artist] || WRITERS.LIA).view(emotion);
  return { story: `${pool[Math.floor(Math.random() * pool.length)]} ${view}`, photoTags };
}

/** 7장 — 작품 라벨. 제목, 작품에 새길 한 줄, 종합 낱말, 관계 문장, 노트 */
export function fallbackCompose({ emotion, artist, answer = "", hints = [], photos = 0 }) {
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
  const relation = kw ? `${withParticle(kw, "이", "가")} ${ARTISTS[artist].short} 속에 한 장으로 남았습니다.` : `오늘의 장면이 ${ARTISTS[artist].short} 속에 한 장으로 남았습니다.`;
  const fixed = tidySpacing(answer);
  // LLM 없이 장면을 지어낼 수는 없으니, 오늘의 마음에 어울리는 사물로 장면을 세운다
  const motifs = EMOTION_MOTIFS[emotion] || ["a window", "a letter", "afternoon light"];
  const scene = `A quiet personal scene with ${motifs.join(", ")}.`;
  const line = lineAfterTitle(fixed, title);
  return { title, line, keywords, relation, fixed, scene, motifs, publishable: true, letter: fallbackLetter({ artist, emotion, keywords, fixed, photos }) };
}

/**
 * 작품 띠에서 제목 아래 새길 한 줄. 제목이 글의 첫 마디에서 왔으면 같은 말이 두 번 보이니,
 * 제목 다음부터 이어지는 말(또는 다음 문장)을 고른다
 */
export function lineAfterTitle(text, title) {
  const s = cleanText(text, 200);
  const stem = String(title || "").replace(/…$/, "").trim();
  const sentences = s.split(/(?<=[.?!。])\s*/).map((x) => x.trim()).filter(Boolean);
  let rest = stem && s.startsWith(stem) ? s.slice(stem.length).replace(/^[\s,.·…]+/, "") : s;
  // 제목이 첫 문장에서 왔고 남은 말이 짧은 꼬리뿐이면(예: "오래 들여다봤다.") 다음 문장을 새긴다
  const first = sentences[0] || "";
  if (sentences.length > 1 && stem && first.startsWith(stem) && first.length - stem.length < 16) rest = sentences.slice(1).join(" ");
  if (!rest) return "";
  return firstLine(rest, 30);
}

// 고른 시선의 아티스트가 보내는 편지(LLM이 없을 때). 그 사람의 눈으로 마음과 낱말, 콜라주의 결을 이어 3~4문장
// 키가 없을 때의 아티스트의 편지. 프롬프트와 같은 구성(감정에 공감하는 인사 → 사진과 글이 콜라주가 된 과정 → 따뜻한 맺음),
// 딱 3문장, 작가마다 lib/writers.js 의 말투를 따른다. 관람객의 일상을 단정하거나 낮춰 말하지 않는다
const LETTER = {
  LIA: (o) => [
    `${withParticle(o.emotion, "을", "를")} 품고 다락방에 와 주셔서 고마워요.`,
    `${o.kw ? `건네주신 ${withParticle(o.kw, "을", "를")} ` : "건네주신 사진과 글을 "}공기처럼 옅게 들어 올려, 물방울 맺힌 유리 한 겹 뒤에 살며시 두었어요.`,
    "지우지 않고 남겨 둔 자리가 이 한 장의 가장 따뜻한 부분이에요.",
  ],
  OL: (o) => [
    `${withParticle(o.emotion, "을", "를")} 숨기지 않고 가져와 주셨네요.`,
    `${o.kw ? `${o.kw}, ` : ""}그 결을 찢고 낙서로 감싸자 틈 사이로 빛이 번져 들었습니다.`,
    "어긋난 자리도 당신의 일부입니다. 두려워하지 마세요.",
  ],
  LET: (o) => [
    `${withParticle(o.emotion, "을", "를")} 안고 이 장면에 들어와 주셨군요, 반가워요.`,
    `${o.kw ? `${withParticle(o.kw, "을", "를")} ` : "사진과 글을 "}쨍한 필름으로 겹치고 색 젤과 프리즘 빛을 올려 한 장면으로 엮었어요.`,
    "다음 장면도 마음껏 겹쳐 보세요.",
  ],
};

export function fallbackLetter({ artist, emotion, keywords = [], fixed = "" }) {
  const kw = (keywords[0] || "").replace(/^#/, "") || cleanText(fixed, 40).split(/[\s,.]/).find((w) => w.length >= 2) || "";
  return (LETTER[artist] || LETTER.LIA)({ kw, emotion: emotion || "마음" });
}

/** 작품 상세에서 제목 아래 보일 이야기. 제목이 이야기의 첫 마디에서 왔으면 그 말을 빼고 이어지는 말부터 */
export function storyAfterTitle(story, title) {
  const s = String(story || "").trim();
  const stem = String(title || "").replace(/…$/, "").trim();
  if (!stem || !s.startsWith(stem)) return s;
  const rest = s.slice(stem.length).replace(/^[\s,.·…]+/, "");
  return rest || "";
}
