/**
 * LIA · OL · LET 세 시선의 시각 언어. 이미지 생성 프롬프트와 캔버스 콜라주가 같은 정의를 쓴다.
 *
 * 원칙: 관객이 고른 마음과, LLM이 사진과 글에서 읽은 장면(scene)은 "무엇을 그릴지"만 정한다.
 * "어떻게 그릴지"(색, 질감, 구도, 빛)는 시선마다 고정해서, 같은 사진과 같은 마음이라도
 * 세 사람의 결과물이 한눈에 다르게 보이게 한다. 다른 두 사람의 특징은 negative로 막는다.
 */

/** 감정 낱말을 영어 이미지 언어로. 이미지 모델은 영어 프롬프트를 가장 잘 따른다 */
export const EMOTION_EN = {
  그리움: "longing for someone out of reach",
  설렘: "fluttering anticipation",
  고요함: "deep stillness",
  서운함: "quiet hurt left unspoken",
  벅참: "overflowing, almost too big to hold",
  쓸쓸함: "loneliness in an emptied space",
  후련함: "release after letting go",
  막막함: "being lost at a crossroads",
  아련함: "a faded, distant memory",
  다정함: "tender warmth toward someone",
  지침: "deep weariness",
  홀가분함: "lightness after setting a weight down",
};

/** LLM이 없을 때 장면의 재료. 6장 대체 이야기(lib/fallback.js)의 낱말과 같은 이미지 */
export const EMOTION_MOTIFS = {
  그리움: ["an unsent letter", "a window seat", "afternoon light"],
  설렘: ["a folded train ticket", "an unopened envelope", "a new notebook"],
  고요함: ["an empty teacup", "a curtain in afternoon light", "a stopped clock"],
  서운함: ["a phone with an unanswered message", "a cold dinner table", "a half-closed door"],
  벅참: ["flowers in full bloom", "an overflowing photo album", "a steep staircase"],
  쓸쓸함: ["a single empty chair", "a late-night bus stop", "a darkened window"],
  후련함: ["an emptied drawer", "a wide open window", "a torn-out page"],
  막막함: ["a map at a fork in the road", "an endless corridor", "fogged glasses"],
  아련함: ["a faded photograph", "an old alley", "fragments of song lyrics"],
  다정함: ["an offered umbrella", "a handwritten note", "shared tangerines"],
  지침: ["shoes taken off by the door", "a lamp late at night", "a crumpled sleeve"],
  홀가분함: ["a light bag", "a finished letter", "a shirt filled with wind"],
};

// 작품에는 글씨가 없어야 한다. 제목과 글귀는 화면의 편지에 따로 적힌다
const NO_TEXT =
  "text, letters, words, typography, font, caption, subtitle, handwriting, calligraphy, signature, watermark, logo, numbers, sign, label, Korean characters, English characters";

// 세 시선 모두 "필름으로 찍은 파인아트 스튜디오 사진" 수준을 기준으로 한다. 싸 보이는 디지털 효과를 막는다
const STUDIO =
  "Fine-art studio photograph shot on medium-format film, editorial magazine quality, museum-grade print, subtle real film grain, " +
  "physical materials photographed under controlled studio light, refined restrained composition, no digital clip-art look.";

export const STYLES = {
  LIA: {
    name: "LIA — 남겨진 문장들 사이의 고요함",
    keywords: {
      tone: ["warm faded film tones", "cream, blush and pale umber with a cool blue-grey shadow"],
      texture: ["soft focus", "condensation and water droplets on frosted glass", "translucent layers"],
      composition: ["generous quiet negative space", "subject placed gently off-center"],
      light: ["late-afternoon window light", "soft leaf shadows on a plain wall", "gentle light leak"],
    },
    base:
      "A quiet, poetic fine-art image in LIA's perspective. The subject is softened: partly seen through frosted glass beaded with water droplets, " +
      "or blurred by a slow gentle motion, glowing in warm late-afternoon light. Soft shadows of leaves and flowers fall across a plain wall, a diagonal band of cool blue-grey shade crosses the frame. " +
      "Warm faded film colors of cream, blush and pale umber, a faint pink light leak at one edge, generous negative space, serene and tender.",
    emotion: (en) => `The feeling of ${en} lingers in the soft haze and the empty space, held gently rather than shown on a face.`,
    rules: [
      "Airy, high-key, low contrast; at least a third of the frame is calm empty wall or haze.",
      "Use one or two of: frosted glass with real water droplets, soft leaf shadows on the wall, gentle motion blur, a pink film light leak.",
      "Palette of cream, blush, pale umber and a cool blue-grey shadow; no saturated or neon color.",
      "Looks like a real analog film photograph with subtle grain.",
    ],
    negative:
      "dark background, harsh contrast, neon, vivid saturated colors, glitch, rainbow, scribbles, ink splatter, crowded composition, glossy CGI, HDR, plastic skin",
    noText: true,
  },

  OL: {
    name: "OL — 찢어진 틈새로 스며드는 빛",
    keywords: {
      tone: ["deep black and silver monochrome", "a faint cold blue fringe"],
      texture: ["hand-torn photographic paper with white fibers", "raw ink scribbles", "film grain"],
      composition: ["a figure emerging from darkness", "free irregular cut-out shapes, never neat rectangles"],
      light: ["light bleeding and blooming through tears", "a thin curved streak of light with a soft rainbow edge", "grainy luminous haze"],
    },
    base:
      "A raw, avant-garde fine-art collage in OL's perspective, photographed in a dark studio. A monochrome photograph printed on paper, torn by hand into a free irregular shape " +
      "with white paper fibers along the tear, floats on deep black. Fast, fearless illegible scribbles in white chalk or black ink sweep across the face height like crossed-out lines. " +
      "Light bleeds and blooms through the tears; a thin curved streak of light with a faint orange and blue edge cuts the darkness; grainy luminous haze drifts like smoke. Sometimes a smeared ink handprint.",
    emotion: (en) => `The feeling of ${en} is shown without hiding it: torn, scribbled over, and lit from within by light leaking through the tear.`,
    rules: [
      "Monochrome black, white and silver; only a faint cold blue or a thin rainbow edge on the light is allowed.",
      "Shapes are free and irregular, hand-torn; avoid neat rectangular photo frames.",
      "Scribbles are abstract gestural marks that never form readable letters.",
      "Light blooms and bleeds through tears; deep blacks, strong grain.",
    ],
    negative:
      "sepia, warm pastel, vivid color blocks, neat rectangular frames, clean digital, smooth gradients, cheerful, flat vector, readable words",
    noText: false,
  },

  LET: {
    name: "LET — 겹겹이 쌓인 경험의 오버레이",
    keywords: {
      tone: ["vivid saturated orange, red, cobalt, pink, teal and wine"],
      texture: ["overlapping translucent colored gel and acetate sheets", "glossy surfaces with fine scratches", "vivid film transparencies"],
      composition: ["layered overlapping planes", "bold, confident, slightly tilted geometry"],
      light: ["crisp studio light making the colored layers glow where they overlap"],
    },
    base:
      "A bold, vibrant fine-art still life in LET's perspective. Translucent colored gel and acetate sheets in orange, red, cobalt, pink, teal and wine overlap and tilt, " +
      "creating new colors where they stack, their glossy surfaces showing fine scratches and folded edges. Vivid photographic film transparencies of the scene are layered among them like a double exposure, " +
      "slightly color-shifted. Set against a plain pale grey wall or a clear blue sky, crisp and confident, full of life and energy.",
    emotion: (en) => `The feeling of ${en} is shown as layered moments: colors and scenes stacked on top of each other until they make a new one.`,
    rules: [
      "The overlapping translucent color layers are the main texture; overlaps must create new mixed colors.",
      "Vivid, saturated, crisp; no gloomy darkness.",
      "No rainbow light bleed, no lens flare, no prism beams.",
      "Real physical materials photographed in a studio, not digital gradients.",
    ],
    negative:
      "sepia, monochrome, dark gloomy background, light leaks, lens flare, rainbow prism light, foggy haze, muted palette, pastel, empty minimalism, torn paper, pencil, flat vector",
    noText: true,
  },
};

/**
 * 이미지 생성 프롬프트. scene(무엇)과 style(어떻게)을 섞지 않고 칸을 나눠 적어,
 * 모델이 장면 묘사에 끌려 시선의 스타일을 흐리지 않게 한다.
 *   scene   — LLM이 사진과 글에서 읽은 장면(영어 한두 문장, 스타일 낱말 없음)
 *   motifs  — 장면의 사물 낱말
 *   relation— 마음과 사진과 글이 이어진 방식(한국어 관계 문장). 이미지에는 분위기 단서로만 쓴다
 */
export function buildImagePrompt({ artist, emotion, scene, motifs = [], relation = "" }) {
  const s = STYLES[artist] || STYLES.LIA;
  const en = EMOTION_EN[emotion] || `the feeling called "${emotion}"`;
  const things = motifs.length ? motifs : EMOTION_MOTIFS[emotion] || [];
  const prompt = [
    `STYLE (must dominate the whole image): ${s.base}`,
    `SUBJECT: ${scene || `A quiet scene with ${things.join(", ")}.`}`,
    things.length ? `KEY MOTIFS to include: ${things.join(", ")}.` : "",
    `EMOTION: ${s.emotion(en)}`,
    relation ? `CONNECTION (mood reference only, do not render as text): ${relation}` : "",
    `STYLE RULES:\n- ${s.rules.join("\n- ")}`,
    `KEYWORDS: ${Object.values(s.keywords).flat().join(", ")}.`,
    `QUALITY: ${STUDIO}`,
    "Portrait orientation 3:4. The image must contain absolutely no text of any kind: no letters, words, numbers, captions, signatures, logos or watermarks. Any paper, letter, book, sign or screen in the scene is blank. No real person's identifiable face.",
  ]
    .filter(Boolean)
    .join("\n\n");
  // OL 은 낙서가 화풍의 일부라 "손글씨" 계열은 negative 에서 빼고, 읽히는 글자만 막는다
  const noText = s.noText ? NO_TEXT : NO_TEXT.replace("handwriting, calligraphy, ", "");
  return { prompt, negative: `${noText}, ${s.negative}, low quality, amateur, clip art, stock template` };
}
