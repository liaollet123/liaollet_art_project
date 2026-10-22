// 시선마다 다른 이미지를 새로 그리는 일. 비용이 드는 일이라 기본은 꺼 둔다.
//   IMAGE_PROVIDER=gemini  → Gemini 이미지 모델이 관객의 사진을 참고해 그 시선의 화풍으로 다시 그린다
//   IMAGE_PROVIDER=off     → (기본) 캔버스 콜라주가 시선마다 다른 색, 질감, 구도로 사진을 엮는다(lib/collage.js)
// 어느 쪽이든 실패하면 캔버스 콜라주로 돌아간다. 전시가 멈추면 안 된다.
import "server-only";

export const imageProvider = () =>
  (process.env.IMAGE_PROVIDER || "off").toLowerCase() === "gemini" && process.env.GEMINI_API_KEY ? "gemini" : "off";

const TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS || 40000);

/**
 * prompt/negative 와 참고 사진(작은 jpeg data URL)을 보내 3:4 이미지 한 장을 받는다.
 * 돌려주는 값은 data URL. 실패하면 예외를 던진다.
 */
export async function generateImage({ prompt, negative, images = [] }) {
  const model = process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const refs = images
    .map((u) => /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(u || "")))
    .filter(Boolean)
    .map((m) => ({ inlineData: { mimeType: m[1], data: m[2] } }));
  const text =
    `${prompt}\n\nAVOID: ${negative}.` +
    (refs.length
      ? "\n\nThe attached photos are the visitor's own. Use them only as reference for subject, objects and composition; repaint everything in the STYLE above. Do not keep the original colors or look."
      : "");
  const r = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }, ...refs] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
    }),
  });
  if (!r.ok) throw new Error(`Gemini image ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error("이미지가 오지 않았습니다");
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}
