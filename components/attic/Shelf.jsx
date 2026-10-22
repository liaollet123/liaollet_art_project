import { useState } from "react";
import { Ticket } from "../Entrance";
import { Like, ORDER, Paper } from "./ui";

function Card({ e, liked, onOpen, onLike, showName = true }) {
  return (
    <div className="lv-w">
      <button className="lv-w-open" onClick={() => onOpen(e)}>
        <img src={e.image} alt={e.title || e.emotion} />
        {showName && (
          <span className="lv-w-name" style={{ color: `var(--lv-${e.artist.toLowerCase()})` }}>
            {e.artist}
            <small>{[e.sign, e.key && `No. ${e.key}`].filter(Boolean).join(" · ")}</small>
          </span>
        )}
        <span className="lv-w-q pen">{e.answer || e.title}</span>
      </button>
      <div className="lv-w-acts">
        <Like on={!!liked[e.id]} count={e.likes || 0} onClick={() => onLike(e)} />
      </div>
    </div>
  );
}

/** 8장 — 취향의 서가. 방금 꽂은 기록이 맨 위, 같은 마음, 세 시선으로 거르는 모두의 기록 */
export default function Shelf({ shelf, loading, justShelved, liked, onOpen, onLike, onInvite, invite, onShareMine, shareMsg, onRestart }) {
  const [filter, setFilter] = useState("ALL");
  const mine = justShelved && shelf.find((x) => x.id === justShelved.id) ? shelf.find((x) => x.id === justShelved.id) : justShelved;
  const same = mine?.emotion ? shelf.filter((x) => x.id !== mine.id && x.emotion === mine.emotion).slice(0, 2) : [];
  const listed = shelf.filter((e) => e.id !== mine?.id && (filter === "ALL" || e.artist === filter));

  return (
    <Paper no={8} className="lv-rise">
      <p className="lv-shelf-brand">LIAOLLET</p>
      <h2 className="lv-ttl">취향의 서가</h2>

      {mine && (
        <div className="lv-mine">
          <img src={mine.image} alt="방금 꽂은 내 작품" />
          <div>
            <p className="lv-mine-k pen">{mine.hidden ? "나만 볼 수 있는 기록" : "방금 꽂은 기록"}</p>
            <p className="lv-mine-sig pen">{mine.sign || "오늘의 창작자"}</p>
            <p className="lv-mine-no">No. {mine.key}</p>
            <p className="lv-mine-q pen">{mine.title}</p>
            {mine.hidden ? (
              <p className="lv-mine-hidden">다른 관람객에게 상처가 될 수 있는 표현이 있어 서가에는 공개하지 않았어요. 이미지는 저장해 가실 수 있어요.</p>
            ) : (
              <div className="lv-w-acts">
                <Like on={!!liked[mine.id]} count={mine.likes || 0} onClick={() => onLike(mine)} />
                <button className="lv-like" onClick={() => onShareMine(mine)}>
                  링크 보내기
                </button>
              </div>
            )}
            <p className="lv-toast" aria-live="polite">
              {shareMsg}
            </p>
          </div>
        </div>
      )}

      {same.length > 0 && (
        <>
          <h3 className="lv-sec">{mine.emotion}을 남긴 사람들</h3>
          <div className="lv-grid">
            {same.map((e) => (
              <Card key={e.id} e={e} liked={liked} onOpen={onOpen} onLike={onLike} showName={false} />
            ))}
          </div>
        </>
      )}

      <h3 className="lv-sec">모두의 기록</h3>
      <div className="lv-filters">
        {["ALL", ...ORDER].map((f) => (
          <button
            key={f}
            className={`${filter === f ? "is-on" : ""}${f !== "ALL" ? " is-artist" : ""}`}
            style={f !== "ALL" ? { "--k": `var(--lv-${f.toLowerCase()})` } : undefined}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {f === "ALL" ? "전체" : f}
          </button>
        ))}
      </div>
      {loading && !shelf.length ? (
        <p className="lv-slips-empty">서가를 펼치는 중…</p>
      ) : (
        <div className="lv-grid">
          {listed.map((e) => (
            <Card key={e.id} e={e} liked={liked} onOpen={onOpen} onLike={onLike} />
          ))}
        </div>
      )}

      <div className="lv-inv">
        <p className="lv-inv-kick">INVITATION</p>
        <p className="lv-inv-line">생각나는 사람에게 티켓 한 장을 건네 보세요</p>
        <Ticket side="INVITE">
          <p className="lv-tk-admit">ADMIT ONE</p>
          <p className="lv-tk-head">
            TICKET TO
            <br />
            YOUR FEELING
          </p>
          <p className="lv-tk-iss">LIAOLLET CREATIVE EDITION</p>
        </Ticket>
        <button className="lv-btn lv-btn-full lv-inv-btn" onClick={onInvite}>
          링크 복사
        </button>
        {invite?.failed && <input className="lv-inv-url" value={invite.url} readOnly onFocus={(e) => e.target.select()} aria-label="초대 링크" />}
        <p className="lv-toast" aria-live="polite">
          {invite?.msg}
        </p>
      </div>
      <button className="lv-quiet" onClick={onRestart}>
        처음으로
      </button>
    </Paper>
  );
}
