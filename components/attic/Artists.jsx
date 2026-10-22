import { ARTISTS } from "@/lib/attic";
import { ARTIST_PHOTOS } from "@/lib/artist-photos";
import { Actions, ORDER, Paper } from "./ui";

/** 내가 넣은 사진이 있으면 그것을 대표로, 없으면 기본 사진 */
const cover = (k) => ARTIST_PHOTOS[k][0] || ARTISTS[k].img;

/** 4장 — 누구의 시선으로. 카드마다 그 사람을 상징하는 이미지, 질문이 주인공 */
export function Artists({ chosen, artist, setArtist, onBack, onNext }) {
  return (
    <Paper no={4} className="lv-rise">
      <p className="lv-hint">{chosen}, 그 마음에 대해 세 사람이 다르게 묻습니다</p>
      <h2 className="lv-ttl">누구의 시선으로 볼까요</h2>
      <div className="lv-cards">
        {ORDER.map((k) => (
          <button
            key={k}
            className={`lv-card${artist === k ? " is-on" : ""}`}
            style={{ "--c": `var(--lv-${k.toLowerCase()})` }}
            onClick={() => setArtist(k)}
            aria-pressed={artist === k}
          >
            <img src={cover(k)} alt={ARTISTS[k].alt} />
            <span className="lv-card-q pen">“{ARTISTS[k].question}”</span>
            <b className="lv-card-name">{k}</b>
            <span className="lv-card-p">{ARTISTS[k].person}</span>
          </button>
        ))}
      </div>
      <Actions>
        <button className="lv-btn is-ghost" onClick={onBack}>
          ← 이전
        </button>
        <button className="lv-btn" onClick={onNext}>
          이 시선으로 보기 →
        </button>
      </Actions>
    </Paper>
  );
}

/** 5장 — 시선 상세. 고른 사람의 색으로 화면이 바뀐다 */
export function ArtistDetail({ artist, onBack, onNext }) {
  const a = ARTISTS[artist];
  return (
    <div className={`lv-det is-${artist.toLowerCase()} lv-rise`}>
      <div className="lv-det-top">
        <button onClick={onBack}>← 다른 시선 보기</button>
        <b>{artist}의 시선</b>
      </div>
      <img className="lv-det-img" src={cover(artist)} alt={a.alt} />
      {ARTIST_PHOTOS[artist].length > 1 && (
        <div className="lv-det-gallery">
          {ARTIST_PHOTOS[artist].slice(1).map((u) => (
            <img key={u} src={u} alt="" loading="lazy" />
          ))}
        </div>
      )}
      <h2 className="lv-det-title">{a.headline}</h2>
      <p className="lv-det-d">{a.sense}</p>
      <p className="lv-det-apply">{a.applies}</p>
      <button className="lv-btn lv-btn-full lv-det-go" onClick={onNext}>
        이 시선으로 계속하기
      </button>
    </div>
  );
}
