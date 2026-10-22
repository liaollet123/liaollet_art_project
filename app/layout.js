// 폰트를 프로젝트에 직접 포함한다. 외부 요청이 없어 전시장 와이파이가 느려도 글꼴이 깨지지 않는다.
import "@fontsource-variable/host-grotesk";
import "@fontsource/nanum-myeongjo/korean-400.css";
import "@fontsource/nanum-myeongjo/korean-700.css";
import "@fontsource/nanum-myeongjo/korean-800.css";
import "@fontsource/nanum-myeongjo/latin-400.css";
import "@fontsource/nanum-myeongjo/latin-700.css";
import "@fontsource/nanum-myeongjo/latin-800.css";
import "@fontsource/nanum-pen-script/korean-400.css";
import "@fontsource/nanum-pen-script/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/nanum-gothic-coding/korean-400.css";
import "@fontsource/nanum-gothic-coding/korean-700.css";
import "@fontsource/nanum-gothic-coding/latin-400.css";
import "@fontsource/nanum-gothic-coding/latin-700.css";
import "./globals.css";

export const metadata = {
  title: "감정의 다락방 — LIAOLLET",
  description: "빈티지 다이어리를 넘기며 사진과 문장으로 나만의 콜라주를 만드는 참여형 전시",
  openGraph: {
    type: "website",
    title: "감정의 다락방 — LIAOLLET",
    description: "빈티지 다이어리를 넘기며 사진과 문장으로 나만의 콜라주를 만드는 참여형 전시",
    siteName: "LIAOLLET",
  },
  twitter: {
    card: "summary_large_image",
    title: "감정의 다락방 — LIAOLLET",
    description: "빈티지 다이어리를 넘기며 사진과 문장으로 나만의 콜라주를 만드는 참여형 전시",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
