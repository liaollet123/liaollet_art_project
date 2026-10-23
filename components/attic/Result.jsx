import { useState } from "react";
import { Ticket } from "../Entrance";
import { Paper, Stamp, today } from "./ui";

// 편지 머리의 날짜 칸. 전시장이 서울이라 관객 기기의 시간대와 상관없이 서울 날짜를 적는다
function diaryDate() {
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date());
  const get = (t) => parts.find((x) => x.type === t)?.value || "";
  return { y: get("year"), m: get("month"), d: get("day"), w: get("weekday") };
}

/**
 * 7장 — 당신의 LIAOLLET. 작품이 주인공이다.
 *   작품(콜라주 + 제목·글귀·태그·서명이 새겨진 띠) → 고른 시선의 아티스트가 보내는 편지
 *   → 서가에 꽂기·링크·저장 → 맨 끝에 티켓 안내
 * 태그와 제목은 작품 띠에 이미 있으니 편지에서는 되풀이하지 않는다
 */
export default function Result({ artist, chosen, ticket, result, label, sign, saved, saving, toast, shareMsg, onShelve, onShare, onReweave }) {
  const to = sign.trim() || "오늘의 창작자";
  const letter = label?.letter?.length ? label.letter : label?.relation ? [label.relation] : [];
  const day = diaryDate();
  const limit = ticket?.limit || 3;
  const left = Math.max(0, limit - (ticket?.used || 1));
  // 다시 엮기도 기회 한 번이라, 누르면 바로 넘어가지 않고 남은 기회를 먼저 알려 준다
  const [askReweave, setAskReweave] = useState(false);
  return (
    <Paper no={7} className="lv-rise">
      <h2 className="lv-ttl">당신의 LIAOLLET</h2>
      <p className="lv-pensub pen">{artist}의 시선으로 엮은 한 장</p>
      {/*
        스크랩북 한 장(참고: 크라프트 대지 위 수채 종이): 흰 여백 안의 크라프트지, 위에는 손으로 찢은 크림 띠.
        가장자리가 들쭉날쭉한 종이에 콜라주를 담아 반투명 마스킹 테이프로 붙이고, 편지도 같은 결의 크림지에 테이프로 붙인다.
        종이·테이프 질감은 참고 이미지에서 떠 온 실제 결(public/attic/kraft.jpg, cream.jpg, strip.jpg, tape.png)
      */}
      <div className={`lv-scrap is-${artist.toLowerCase()}`}>
        <div className="lv-board">
          <img className="lv-strip" src="/attic/strip.jpg" alt="" aria-hidden="true" />
          <figure className="lv-art">
            <img className="lv-tape is-art" src="/attic/tape.png" alt="" aria-hidden="true" />
            <div className="lv-art-paper">
              <img className="lv-result" src={result} alt={`${label?.title || chosen}, ${artist}의 시선으로 엮은 콜라주`} />
            </div>
          </figure>
          <div className="lv-sheet" aria-label={`${artist}가 보내는 편지`}>
            <img className="lv-tape is-sheet" src="/attic/tape.png" alt="" aria-hidden="true" />
            <div className="lv-sheet-paper">
              <p className="lv-dp-date">
                {day.m}월 {day.d}일 {day.w}요일 · {chosen}
              </p>
              <p className="lv-dp-to">To. {to}</p>
              <div className="lv-dp-body">
                {letter.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
              <p className="lv-dp-from">from. {artist}</p>
              <span className="lv-dp-stamp" aria-hidden="true">
                <Stamp id="stamp-letter" word={artist} date={ticket?.date || today()} />
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="lv-res-actions">
        <button className="lv-btn lv-btn-full" onClick={onShelve} disabled={saving}>
          {saving ? "서가에 꽂는 중…" : "취향의 서가에 꽂기"}
        </button>
        <div className="lv-res-links">
          <a href={result} download={`liaollet-${saved?.key || ticket?.no || "work"}.jpg`}>
            이미지 저장
          </a>
          <button onClick={() => setAskReweave(true)}>다시 엮기</button>
        </div>
        {askReweave && (
          <div className="lv-reweave" role="alertdialog" aria-label="다시 엮기 안내">
            {left > 0 ? (
              <>
                <p>
                  다시 엮으면 새 작품이 되어 기회를 한 번 더 써요. 오늘 {left}번 남았어요.
                  <br />
                  {saved ? "지금 작품은 서가에 그대로 남아요." : "지금 작품은 서가에 꽂지 않으면 사라져요."}
                </p>
                <div className="lv-reweave-btns">
                  <button className="lv-btn is-ghost" onClick={() => setAskReweave(false)}>
                    그대로 두기
                  </button>
                  <button className="lv-btn" onClick={onReweave}>
                    다시 엮기
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>오늘의 기회 {limit}번을 모두 썼어요. 내일 다시 엮어 볼 수 있어요.</p>
                <div className="lv-reweave-btns">
                  <button className="lv-btn is-ghost" onClick={() => setAskReweave(false)}>
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <p className="lv-toast" aria-live="polite">
          {toast}
        </p>
      </div>
      {/* 티켓 안내는 맨 끝에. 입장 때 받은 그 티켓(도장이 찍힌 채로)에, 엮을 때 매긴 작품 번호가 새겨져 있다 */}
      <div className="lv-res-ticket">
        <Ticket
          side={ticket?.no}
          stamp={
            <span className="lv-stamp is-done" aria-hidden="true">
              <Stamp id="stamp-result" word="ADMITTED" date={ticket?.date || today()} />
            </span>
          }
        >
          <p className="lv-tk-admit">ADMIT ONE</p>
          <p className="lv-tk-head">
            TICKET TO
            <br />
            YOUR FEELING
          </p>
          <p className="lv-tk-iss">LIAOLLET CREATIVE EDITION</p>
        </Ticket>
        <p>
          작품 번호 No. {ticket?.no}. 서가에 꽂아 두면 첫 화면의 "이미 남긴 기록이 있나요?"에서 이름({sign})으로 언제든 다시 펼칠 수 있어요.
        </p>
        {/* 하루 기회 안내는 여기 한 곳에서만. 끝까지 만든 사람에게, 더 해 보고 싶을 때 알 수 있게 */}
        <p className="lv-res-more">
          {left > 0
            ? `다락방에는 하루 ${limit}장까지 남길 수 있어요. 오늘 ${left}장 더 엮어 볼 수 있어요.`
            : `다락방에는 하루 ${limit}장까지 남길 수 있어요. 오늘의 ${limit}장을 모두 엮었어요.`}
        </p>
      </div>
      {/* 맨 밑에서 결과물을 건넨다. 아직 서가에 꽂지 않았으면 꽂은 뒤 그 작품이 바로 열리는 링크를 만든다 */}
      <div className="lv-res-share">
        <button className="lv-btn lv-btn-full" onClick={onShare} disabled={saving}>
          결과물 링크 공유하기
        </button>
        <p className="lv-toast" aria-live="polite">
          {shareMsg}
        </p>
      </div>
    </Paper>
  );
}
