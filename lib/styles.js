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

export const STYLES = {
  LIA: {
    name: "LIA — 남겨진 문장들 사이의 고요함",
    keywords: {
      tone: ["soft warm sepia tone", "faded cream and umber"],
      texture: ["clean bright white paper", "layered with translucent vellum sheets"],
      composition: ["minimalist composition with generous white negative space", "small photographs placed off-center"],
      light: ["soft diffused light", "gentle and tender"],
    },
    base:
      "A soft, tender paper collage in LIA's perspective. Small sepia-toned photographs placed off-center on clean, bright white paper, " +
      "with generous white negative space. Sheets of translucent vellum laid over parts of the photographs soften and diffuse them. " +
      "Pieces of pure white paper with gentle deckled edges and faint shadows. Soft diffused window light, quiet and serene.",
    emotion: (en) =>
      `The feeling of ${en} is held gently in the empty white space around the photographs, never shown on a face, softened behind vellum.`,
    rules: [
      "Background is clean bright white paper; at least half of the image is empty white space.",
      "Photographs are small, sepia-toned, low contrast, with lifted shadows and softened edges.",
      "One or two translucent vellum sheets overlap the photographs, making them hazy and soft.",
      "Palette limited to white, cream, sepia and faded umber; no saturated color anywhere.",
      "Soft diffused light, faint shadows under the paper pieces; calm and airy.",
    ],
    negative:
      "dark background, black, high contrast, pure black and white, neon, vivid saturated colors, cyan, bright orange, red, " +
      "charcoal, pencil sketch lines, grain heavy, busy layered overlays, crowded composition, glossy, digital, HDR",
  },

  OL: {
    name: "OL — 찢어진 틈새로 스며드는 빛",
    keywords: {
      tone: ["monotone grayscale", "heavy film grain"],
      texture: ["torn paper edges with white fibers", "graphite pencil lines", "conte crayon strokes", "charcoal smudges"],
      composition: ["torn photographs pasted on drawing paper", "sketchy construction lines crossing the image"],
      light: ["raw, hand-made, expressive"],
    },
    base:
      "A raw mixed-media collage in OL's perspective, entirely monotone grayscale. Black and white photographs torn by hand, with rough white paper fibers " +
      "along the torn edges, pasted on grey drawing paper. Graphite pencil lines and hatching sketch over and around them, " +
      "bold conte crayon strokes and charcoal smudges cut across the composition. Heavy film grain over everything.",
    emotion: (en) =>
      `The feeling of ${en} shows as traces: a torn edge, a pencil line that goes over the photograph, a conte stroke pressed hard into the paper.`,
    rules: [
      "Monochrome only: grays, black and off-white; no color at all.",
      "Photographs have hand-torn edges with visible white paper fibers; at least one corner torn away.",
      "Thin graphite pencil lines and hatching overlap both the paper and the photographs.",
      "One or two thick, grainy conte crayon strokes cross the image diagonally.",
      "Strong, visible grain and paper texture throughout. Abstract marks only; no letters or writing.",
    ],
    negative:
      "color, sepia, warm tones, vivid, neon, cyan, orange, red, glossy, clean digital, smooth gradients, vellum, soft pastel, " +
      "cheerful, bright sunlight, geometric color blocks",
  },

  LET: {
    name: "LET — 겹겹이 쌓인 경험의 오버레이",
    keywords: {
      tone: ["vivid saturated colors", "bright cyan, orange, hot pink, yellow"],
      texture: ["overlapping photographs", "halftone dots", "colored tape"],
      composition: ["multi-layered overlay composition", "energetic diagonal layout"],
      light: ["bright sunlight flare", "lively, punchy, joyful"],
    },
    base:
      "A bright, lively editorial collage in LET's perspective. Several photographs overlap in layers on a bright white background, " +
      "the same scene repeated as different crops and moments, blending where they overlap. Vivid saturated color blocks in cyan, orange, hot pink, " +
      "yellow and violet, halftone dot patterns and strips of colored tape. Bright sunlight flare, crisp and punchy, full of energy.",
    emotion: (en) =>
      `The feeling of ${en} is shown as moments piling up: overlapping photographs, each a different crop and color, bursting with light.`,
    rules: [
      "At least three overlapping photographs with visible blending between them, plus bold flat color blocks.",
      "Bright, high-key image: white or light background, strong saturation, crisp edges; nothing gloomy.",
      "Colors are vivid cyan, orange, hot pink, yellow and violet; photos graded warm and bright.",
      "Halftone dots, colored tape or offset color shadows behind photographs for a printed, playful feel.",
      "Energetic diagonal composition; no large calm empty areas.",
    ],
    negative:
      "sepia, monochrome, black and white, dark background, gloomy, foggy, low saturation, muted earthy palette, pastel, vellum, " +
      "generous empty space, quiet minimalism, pencil sketch, charcoal, torn paper, grain heavy",
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
    "Portrait orientation 3:4. The image must contain absolutely no text of any kind: no letters, words, numbers, captions, signatures, logos or watermarks. Any paper, letter, book, sign or screen in the scene is blank. No real person's identifiable face.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { prompt, negative: `${NO_TEXT}, ${s.negative}` };
}
