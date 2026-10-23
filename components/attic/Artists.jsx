import { ARTISTS } from "@/lib/attic";
import { ARTIST_PHOTOS } from "@/lib/artist-photos";
import { Actions, ORDER, Paper } from "./ui";

/** 내가 넣은 사진이 있으면 그것을 대표로, 없으면 기본 사진 */
const cover = (k) => ARTIST_PHOTOS[k][0] || ARTISTS[k].img;

/**
 * 4장 — 누구의 시선으로. 카드마다 그 사람을 상징하는 이미지, 질문이 주인공.
 * 카드를 누르면 그 자리에서 바로 그 시선의 상세(5장)로 넘어간다. 아래까지 내려가 버튼을 찾지 않아도 되게
 */
export function Artists({ chosen, setArtist, onBack, onNext }) {
  const open = (k) => {
    setArtist(k);
    onNext(k);
  };
  return (
    <Paper no={4} className="lv-rise">
      <p className="lv-hint">{chosen}, 그 마음에 대해 세 사람이 다르게 묻습니다</p>
      <h2 className="lv-ttl">누구의 시선으로 볼까요</h2>
      <div className="lv-cards">
        {ORDER.map((k) => (
          <button key={k} className="lv-card" style={{ "--c": `var(--lv-${k.toLowerCase()})` }} onClick={() => open(k)}>
            <img src={cover(k)} alt={ARTISTS[k].alt} />
            <span className="lv-card-q pen">“{ARTISTS[k].question}”</span>
            <b className="lv-card-name">{k}</b>
            <span className="lv-card-p">{ARTISTS[k].person}</span>
            <span className="lv-card-go">{k}의 시선으로 보기 →</span>
          </button>
        ))}
      </div>
      <Actions>
        <button className="lv-btn is-ghost" onClick={onBack}>
          ← 이전
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
      {/* 대표 사진 아래, 이 시선의 느낌을 보여 주는 소스 사진 세 칸 */}
      {ARTIST_PHOTOS[artist].length > 1 && (
        <div className="lv-det-gallery">
          {ARTIST_PHOTOS[artist].slice(1, 4).map((u) => (
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
