import { Stamp } from "./ui";

// 편지 머리의 날짜 칸. 전시장이 서울이라 관객 기기의 시간대와 상관없이 서울 날짜를 적는다
function diaryDate(when) {
  const d = when ? new Date(when) : new Date();
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(
    Number.isNaN(d.getTime()) ? new Date() : d
  );
  const get = (t) => parts.find((x) => x.type === t)?.value || "";
  return { y: get("year"), m: get("month"), d: get("day"), w: get("weekday") };
}

/**
 * 스크랩북 한 장: 콜라주와 아티스트의 편지(참고: 크라프트 대지 위 수채 종이).
 * 흰 여백 안의 크라프트지, 위에는 손으로 찢은 크림 띠. 가장자리가 들쭉날쭉한 종이에 콜라주를 담아 반투명 마스킹 테이프로 붙이고,
 * 편지도 같은 결의 크림지에 테이프로 붙인다. 종이·테이프 질감은 public/attic/kraft.jpg, cream.jpg, strip.jpg, tape.png.
 * 7장 결과와 1장 "내 작품 펼치기"가 같은 모습이어야 해서 한곳에 둔다.
 *   when   — 편지 머리의 날짜(결과 장은 지금, 다시 펼칠 때는 만든 날)
 *   letter — 한 문장이 한 항목. 비어 있으면(편지를 남기기 전의 작품) 편지 종이를 그리지 않는다
 */
export default function Scrapbook({ artist, image, title, emotion, to, letter = [], when, stampId, stampDate }) {
  const day = diaryDate(when);
  return (
    <div className={`lv-scrap is-${String(artist).toLowerCase()}`}>
      <div className="lv-board">
        <img className="lv-strip" src="/attic/strip.jpg" alt="" aria-hidden="true" />
        <figure className="lv-art">
          <img className="lv-tape is-art" src="/attic/tape.png" alt="" aria-hidden="true" />
          <div className="lv-art-paper">
            <img className="lv-result" src={image} alt={`${title}, ${artist}의 시선으로 엮은 콜라주`} />
          </div>
        </figure>
        {letter.length > 0 && (
          <div className="lv-sheet" aria-label={`${artist}가 보내는 편지`}>
            <img className="lv-tape is-sheet" src="/attic/tape.png" alt="" aria-hidden="true" />
            <div className="lv-sheet-paper">
              <p className="lv-dp-date">
                {day.m}월 {day.d}일 {day.w}요일{emotion ? ` · ${emotion}` : ""}
              </p>
              <p className="lv-dp-to">To. {to}</p>
              <div className="lv-dp-body">
                {letter.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
              <p className="lv-dp-from">from. {artist}</p>
              <span className="lv-dp-stamp" aria-hidden="true">
                <Stamp id={stampId} word={artist} date={stampDate} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
