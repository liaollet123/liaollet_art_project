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
    // 같은 시선 안에서 작품마다 스타일을 하나 골라 배경색·톤·재료·형태가 확연히 달라지게 한다(캔버스 콜라주의 여섯 스타일과 같다)
    variants: [
      "THIS PIECE: warm grey-brown monochrome; large clustered dappled tree shadows fall across the photograph and the pale wall, like a silhouette of leaves.",
      "THIS PIECE: clean and white; calm lake water ripples along the top, a bright white ledge below with the photograph on it, and faint blue leaf shadows passing over.",
      "THIS PIECE: crisp textured white paper; two white-bordered photographic prints of the scene lie slightly overlapping, casting soft paper shadows, with lots of white space.",
      "THIS PIECE: a lilac-grey wall with a warm window-pane shaped patch of sunlight falling diagonally across it; the photograph stands in front of it like a soft silhouette.",
      "THIS PIECE: a hazy cream space; several softly dissolving fragments of the photograph drift in mist, with gentle leaf shadows and warm sunlight.",
      "THIS PIECE: an old amber sepia print filling the frame, darkened edges, dust and fine scratches, a faint apricot light leak.",
    ],
    negative:
      "dark background, harsh contrast, neon, vivid saturated colors, glitch, rainbow, scribbles, ink splatter, crowded composition, glossy CGI, HDR, plastic skin",
    noText: true,
  },

  OL: {
    name: "OL — 찢어진 틈새로 스며드는 빛",
    keywords: {
      tone: ["deep black and silver monochrome", "a faint cold blue fringe"],
      texture: ["roughly hand-torn photographic paper with ragged white fibers", "thick dry chalk scrawls in white or black", "raw black ink marks", "heavy film grain"],
      composition: ["a blurred figure emerging from darkness", "free irregular torn shapes, never neat rectangles"],
      light: ["prismatic rainbow light bleeding across the dark", "light blooming through tears", "grainy luminous haze"],
    },
    base:
      "A raw, avant-garde fine-art collage in OL's perspective, photographed in a dark studio. A grainy, motion-blurred monochrome photograph of the subject, printed on paper and roughly torn by hand " +
      "into a free ragged shape with white paper fibers along the tear, lies over deep black, layered with other rough torn scraps. Across the face height, fast fearless scribbles cover it: " +
      "thick dry chalk scrawled back and forth in white or black chalk, like something crossed out. Raw black ink, sometimes a smeared inky handprint with drips. " +
      "Light bleeds and blooms through the tears, and at times a wide soft prismatic arc of orange, white and blue light sweeps through the darkness.",
    emotion: (en) => `The feeling of ${en} is shown without hiding it: torn roughly, scrawled over in chalk and ink, and lit from within by light leaking through the tear.`,
    rules: [
      "Monochrome black, white and silver; only a cold blue tint or a prismatic orange-and-blue rainbow edge on the light is allowed.",
      "Paper is torn roughly by hand with visible white fibers; shapes are free and irregular, never neat rectangular frames.",
      "Scribbles are thick dry chalk scrawls (never thin pen lines) that never form readable letters.",
      "Deep blacks, strong grain, motion blur on the figure; light blooms and bleeds through the tears.",
    ],
    variants: [
      "THIS PIECE: pitch black; the motion-blurred photograph fills the frame, a big thick white chalk zigzag scribble and rubbed chalk bars cover the face.",
      "THIS PIECE: pale grey-blue paper; a large roughly torn grey print of the photograph, heavy black brush loops scribbled over it and a smeared black ink handprint.",
      "THIS PIECE: charcoal monochrome; the photograph dissolves into flowing liquid light, soft grainy blooms of white on black, heavy film grain and white dust, no color at all.",
      "THIS PIECE: the photograph printed on embossed paper and torn diagonally into two halves pulled apart over a dark moss-green gap, the torn fibrous edges catching light.",
      "THIS PIECE: deep navy blue; the photograph in navy-and-white duotone with a blue fringe, a finely brushed metal surface and a wide soft prismatic rainbow arc.",
      "THIS PIECE: a sheet of textured white paper with a large roughly torn hole; through the hole the monochrome photograph is seen, shadowed by the curling torn paper edge.",
    ],
    negative:
      "sepia, warm pastel, vivid color blocks, neat rectangular frames, clean digital, smooth gradients, cheerful, flat vector, readable words",
    noText: false,
  },

  LET: {
    name: "LET — 겹겹이 쌓인 경험의 오버레이",
    keywords: {
      tone: ["vivid saturated orange, red, cobalt, pink, teal and wine", "a clear blue sky or a pale grey studio wall"],
      texture: ["overlapping translucent colored gel and acetate film", "thick glossy oil-paint strokes", "palette-knife impasto", "hand-cut photo fragments with vivid edges"],
      composition: ["layered overlapping planes", "bold, confident, energetic"],
      light: ["crisp studio light making glossy surfaces and overlapping colors glow"],
    },
    base:
      "A bold, vibrant fine-art collage in LET's perspective, real physical materials photographed in a studio. Layers overlap until they make new colors: " +
      "translucent colored gel and acetate film, thick glossy paint strokes, and vivid photographic fragments of the scene. Saturated orange, red, cobalt, pink, teal and wine " +
      "against a clear blue sky or a pale grey wall, crisp, glossy and confident, full of life and energy.",
    emotion: (en) => `The feeling of ${en} is shown as layered moments: colors and scenes stacked on top of each other until they make a new one.`,
    rules: [
      "Overlapping layers are the main texture; overlaps must create new mixed colors.",
      "Vivid, saturated, crisp and glossy; no gloomy darkness.",
      "No rainbow light bleed, no lens flare, no prism beams.",
      "Real physical materials photographed in a studio, not digital gradients.",
      "The visitor's photograph stays the largest element of the image; the style is applied onto it.",
    ],
    // 같은 톤 안에서 작품마다 짜임을 하나 골라 결과물이 다양해지게 한다(캔버스 콜라주의 네 짜임과 같다)
    variants: [
      "THIS PIECE: on a vivid orange ground, color-shifted photographic film strips with sprocket holes overlap like a double exposure, with cyan and yellow gel pieces.",
      "THIS PIECE: on a vivid yellow ground, the visitor's photograph fills most of the frame and a few bold, thick glossy brush strokes of saturated red, cobalt, pink, black and green sweep across it in one direction.",
      "THIS PIECE: against a clear deep-blue sky, the scene's photograph and soft materials like satin or petals are cut out in free torn shapes with glowing orange-pink edges, stacked vertically.",
      "THIS PIECE: on a deep burgundy ground, chunks of palette-knife impasto pile up like a mosaic with curved scraped marks, most of them carrying glossy fragments of the visitor's photograph.",
      "THIS PIECE: on a vivid green ground, the visitor's photograph fills most of the frame and glossy translucent bands of orange, cobalt, red and pink stack horizontally over it with sparkles and fine scratches.",
      "THIS PIECE: on a lime-green ground, the visitor's photograph fills most of the frame and large translucent acetate panels in orange, pink, teal and amber interlock over it with folded edges.",
    ],
    negative:
      "sepia, monochrome, dark gloomy background, light leaks, lens flare, rainbow prism light, foggy haze, muted palette, pastel, empty minimalism, pencil, flat vector",
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
    s.variants ? s.variants[Math.floor(Math.random() * s.variants.length)] : "",
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
