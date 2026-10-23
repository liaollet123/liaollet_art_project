import { ARTISTS } from "@/lib/attic";
import { Paper, today } from "./ui";

/** 7장 — 당신의 LIAOLLET. 작품이 주인공, 티켓은 반쪽만, 서명으로 내 작품이 된다 */
export default function Result({ artist, chosen, ticket, result, label, reading, answer, sign, setSign, saved, saving, toast, onShelve, onShare, onReweave }) {
  const signName = sign.trim() || "오늘의 창작자";
  return (
    <Paper no={7} className="lv-rise">
      <h2 className="lv-ttl">당신의 LIAOLLET</h2>
      <p className="lv-pensub pen">{artist}의 시선으로 엮은 한 장</p>
      <img className="lv-result" src={result} alt={`${label?.title || chosen}, ${artist}의 시선으로 엮은 콜라주`} />
      <div className="lv-stub-row">
        <div className="lv-stub">
          <img src="/attic/ticket-blank.png" alt="" />
          <span>{ticket?.no}</span>
        </div>
        <p>오늘의 한 장이에요. 서가에 꽂고 링크를 보내 두면, 이 번호로 언제든 다시 펼칠 수 있어요.</p>
      </div>
      <div className="lv-plate">
        <p className="lv-plate-top">FROM THE DIARY OF</p>
        <label className="lv-plate-lab" htmlFor="lv-sign">
          오늘의 한 장을 남긴 사람
        </label>
        <input
          id="lv-sign"
          className="pen"
          maxLength={10}
          value={sign}
          disabled={!!saved}
          onChange={(e) => setSign(e.target.value)}
          placeholder="별명이나 이니셜"
          autoComplete="off"
        />
        <p className="lv-plate-foot">{today().replace(/\./g, ". ")} · LIAOLLET</p>
        <p className="lv-plate-hint">실명 대신 별명이나 이니셜로 서명해 주세요</p>
      </div>
      {/* 고른 시선의 아티스트가 보내는 편지 한 장. 본문은 아티스트가 1인칭으로 쓴다 */}
      <div className="lv-letter" aria-label={`${ARTISTS[artist]?.name || artist}이 보내는 편지`}>
        <p className="lv-to pen">To. {signName} 님께</p>
        <h3>{label?.title}</h3>
        {answer.trim() && <blockquote className="lv-lt-quote pen">{answer.trim()}</blockquote>}
        {label?.relation && <p className="lv-lt-body">{label.relation}</p>}
        <div className="lv-lt-foot">
          {label?.keywords?.length > 0 && (
            <div className="lv-labels">
              {label.keywords.slice(0, 3).map((t) => (
                <span key={t} className="lv-label is-on">
                  {t}
                </span>
              ))}
            </div>
          )}
          <p className="lv-lt-sign">
            {chosen} · {artist}의 시선 · {today().replace(/\./g, ". ")}
            <br />
            <span className="pen">from. {ARTISTS[artist]?.name || artist}</span>
          </p>
        </div>
      </div>
      <div className="lv-res-actions">
        <button className="lv-btn lv-btn-full" onClick={onShelve} disabled={saving}>
          {saving ? "서가에 꽂는 중…" : "취향의 서가에 꽂기"}
        </button>
        <div className="lv-res-links">
          <button onClick={onShare} disabled={saving}>
            링크 보내기
          </button>
          <a href={result} download={`liaollet-${saved?.key || ticket?.no || "work"}.jpg`}>
            이미지 저장
          </a>
          {/* 하루 한 장이라, 서가에 꽂은 뒤에는 다시 엮지 않는다 */}
          {!saved && <button onClick={onReweave}>다시 엮기</button>}
        </div>
        <p className="lv-toast" aria-live="polite">
          {toast}
        </p>
      </div>
    </Paper>
  );
}
