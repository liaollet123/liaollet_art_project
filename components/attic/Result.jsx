import { useState } from "react";
import { Ticket } from "../Entrance";
import Scrapbook from "./Scrapbook";
import { Paper, Stamp, today } from "./ui";

/**
 * 7장 — 당신의 LIAOLLET. 작품이 주인공이다.
 *   작품(콜라주 + 제목·글귀·태그·서명이 새겨진 띠) → 고른 시선의 아티스트가 보내는 편지
 *   → 서가에 꽂기·링크·저장 → 맨 끝에 티켓 안내
 * 태그와 제목은 작품 띠에 이미 있으니 편지에서는 되풀이하지 않는다
 */
export default function Result({ artist, chosen, ticket, result, label, sign, saved, saving, toast, shareMsg, onShelve, onShare, onReweave }) {
  const to = sign.trim() || "오늘의 창작자";
  const letter = label?.letter?.length ? label.letter : label?.relation ? [label.relation] : [];
  const limit = ticket?.limit || 3;
  const left = Math.max(0, limit - (ticket?.used || 1));
  // 다시 엮기도 기회 한 번이라, 누르면 바로 넘어가지 않고 남은 기회를 먼저 알려 준다
  const [askReweave, setAskReweave] = useState(false);
  return (
    <Paper no={7} className="lv-rise">
      <h2 className="lv-ttl">당신의 LIAOLLET</h2>
      <p className="lv-pensub pen">{artist}의 시선으로 엮은 한 장</p>
      <Scrapbook
        artist={artist}
        image={result}
        title={label?.title || chosen}
        emotion={chosen}
        to={to}
        letter={letter}
        stampId="stamp-letter"
        stampDate={ticket?.date || today()}
      />
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
