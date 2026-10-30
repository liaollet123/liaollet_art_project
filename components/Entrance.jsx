"use client";

import { useEffect, useRef, useState } from "react";
import Loader from "./Loader";
import Scrapbook from "./attic/Scrapbook";
import { Stamp } from "./attic/ui";

// 다이어리 오른쪽 장에 끼워 둔 서가 작품들. 앞면과 뒷면에 각각 한 장씩, 여섯 장 모두 다른 작품(중복 없음)
const LEAVES = [
  ["/attic/seed/lia1.jpg", "/attic/seed/let2.jpg"],
  ["/attic/seed/ol1.jpg", "/attic/seed/lia2.jpg"],
  ["/attic/seed/let1.jpg", "/attic/seed/ol2.jpg"],
];

/** 티켓 종이 위에 글자를 얹는다. 위치는 원본 티켓 비율에 맞춰 고정 (디자인 결정 3번). 서가의 티켓 건네기도 같은 티켓을 쓴다 */
export function Ticket({ children, side, stamp }) {
  return (
    <div className="lv-ticket">
      <img src="/attic/ticket-blank.png" alt="" />
      <div className="lv-tk-ink">
        <div className="lv-tk-body">{children}</div>
        <div className="lv-tk-cell">
          <span className="lv-tk-no" style={{ "--n": Math.max(6, String(side).length) }}>
            {side}
          </span>
        </div>
      </div>
      {stamp}
    </div>
  );
}

/**
 * 1장 — 입장
 *   idle   : 다락방 배경, 고리를 축으로 장이 넘어가는 다이어리
 *   ticket : 창작 에디션 서명 티켓(번호 칸에는 오늘 날짜) + "오늘 다락방을 찾아준 당신을 뭐라고 부르면 좋을까요?" 서명란
 *            이름(= 아이디, 작품의 서명)을 적고 들어가기를 누르면 서버가 확인 → 도장 → 동의서로
 *   find   : 서명(아이디)으로 그동안 남긴 작품 다시 펼치기
 */
export default function Entrance({ ticket, onIssue, sign, setSign, onCheckSign, onEnter, onFind, onRemove, onOpenShelf, onSendLink }) {
  const [stage, setStage] = useState("idle");
  const [stamped, setStamped] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null);
  const [error, setError] = useState("");
  const [finding, setFinding] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueErr, setIssueErr] = useState("");
  // 한 서명으로 여러 장을 남겼을 수 있다. 찾은 작품들 중 지금 펼친 것
  const [hits, setHits] = useState([]);
  // 내 작품 지우기: 확인 묻는 중인지, 지우는 중인지, 결과 한 줄
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeMsg, setRemoveMsg] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  const [signErr, setSignErr] = useState("");
  const [checking, setChecking] = useState(false);
  const leafRef = useRef(null);

  // 맨 위 장이 고리를 축으로 넘어가 왼쪽 장에 내려앉고, 다음 장이 덮으면 맨 아래로 돌아간다
  useEffect(() => {
    if (stage !== "idle" || !leafRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const order = Array.from(leafRef.current.querySelectorAll(".lv-pg"));
    const stack = () => order.forEach((pg, i) => (pg.style.zIndex = String(order.length - i)));
    stack();
    let last = null;
    let turn = 0;
    const timers = [];
    // 멈춰 있는 그림으로 보이지 않게, 화면이 뜨고 곧바로 첫 장을 넘긴다
    const flip = () => {
      const top = order.shift();
      top.style.zIndex = String(100 + turn++);
      top.classList.add("is-flip");
      timers.push(
        setTimeout(() => {
          if (last) {
            last.style.transition = "none";
            last.classList.remove("is-flip");
            order.push(last);
            stack();
            void last.offsetWidth;
            last.style.transition = "";
          }
          last = top;
        }, 1500)
      );
    };
    const first = setTimeout(flip, 1100);
    const id = setInterval(flip, 3200);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, [stage]);

  // 도장이 다 찍히고 잠깐 머문 뒤 들어간다
  useEffect(() => {
    if (!stamped) return;
    const t = setTimeout(onEnter, 2400);
    return () => clearTimeout(t);
  }, [stamped, onEnter]);

  // 티켓 번호는 서버가 매긴다. 와이파이가 느려도 버튼이 멈춘 것처럼 보이지 않게 로더를 띄운다
  const issue = async () => {
    setIssuing(true);
    setIssueErr("");
    const err = await onIssue();
    setIssuing(false);
    if (err) setIssueErr("티켓을 받지 못했어요. 와이파이를 확인하고 다시 눌러 주세요.");
    else setStage("ticket");
  };

  // 이름을 확인받고 나서야 도장을 찍는다. 다른 폰이 쓰는 이름이거나 오늘 세 번을 다 쓴 이름이면 여기서 알려 준다
  const enter = async (e) => {
    e.preventDefault();
    if (stamped || checking || sign.trim().length < 2) return;
    setChecking(true);
    const err = await onCheckSign(sign.trim());
    setChecking(false);
    if (err) setSignErr(err);
    else setStamped(true);
  };

  // 서버에서 그 서명(아이디)으로 남긴 작품을 찾는다. 다른 폰에서 열어도 보인다
  const find = async () => {
    if (!code.trim()) return setError("작품에 남긴 서명을 적어 주세요.");
    setFinding(true);
    const list = await onFind(code);
    setFinding(false);
    if (list.length) {
      setHits(list);
      setFound(list[0]);
    } else setError("그 서명으로 남긴 기록이 없어요. 작품 아래 from. 뒤의 이름을 다시 확인해 주세요.");
  };

  const pick = (h) => {
    setFound(h);
    setAsking(false);
    setRemoveMsg("");
  };

  const remove = async () => {
    setRemoving(true);
    const r = await onRemove(found.key);
    setRemoving(false);
    setAsking(false);
    if (r.error) return setRemoveMsg(r.error);
    const rest = hits.filter((h) => h.id !== found.id);
    setHits(rest);
    if (rest.length) {
      setFound(rest[0]);
      setRemoveMsg(`No. ${found.key} 작품을 지웠어요.`);
    } else {
      // 남은 작품이 없으면 서명 찾기 화면으로 돌아가 그 자리에서 알린다
      setFound(null);
      setRemoveMsg("");
      setError(`No. ${found.key} 작품을 지웠어요. 이 서명으로 남은 작품이 없어요.`);
    }
  };

  return (
    <div className="lv-ent">
      <div className="lv-ent-bg" aria-hidden="true" />

      {stage === "idle" && (
        <div className="lv-ent-inner lv-rise">
          <img className="lv-ent-mark" src="/attic/liaollet-icon.svg" alt="" width="44" height="44" />
          <p className="lv-brand">LIAOLLET</p>
          <h1 className="lv-ent-title">감정의 다락방</h1>
          <p className="lv-kick">THE ATTIC OF FEELINGS</p>
          <div className="lv-diary">
            <img className="lv-diary-img" src="/attic/diary.png" alt="손에 든 빈티지 다이어리" />
            <div className="lv-leaf" ref={leafRef} aria-hidden="true">
              {LEAVES.map(([front, back]) => (
                <div className="lv-pg" key={front}>
                  {/* 장마다 다이어리의 손글씨는 그대로 두고 사진 자리에만 서가 작품을 끼운다 */}
                  <div className="lv-pg-f">
                    <img src={front} alt="" />
                  </div>
                  <div className="lv-pg-b">
                    <img src={back} alt="" />
                  </div>
                </div>
              ))}
            </div>
            <img className="lv-diary-rings" src="/attic/diary.png" alt="" aria-hidden="true" />
          </div>
          <p className="lv-invite">오늘의 마음을 한 장 적어 보세요</p>
          {issuing ? (
            <Loader text="티켓을 찍는 중" dark size={44} />
          ) : (
            <button className="lv-ent-cta" onClick={issue}>
              창작 에디션 서명 티켓 받기
            </button>
          )}
          {issueErr && (
            <p className="lv-found" aria-live="polite">
              {issueErr}
            </p>
          )}
          <button className="lv-ent-link" onClick={() => setStage("find")}>
            이미 남긴 기록이 있나요?
          </button>
        </div>
      )}

      {/* 한 사람에 하루 기회 세 번. 다 썼으면 새로 만들지 않고 오늘 마지막 작품과 링크를 건넨다 */}
      {stage === "ticket" && ticket?.done && (
        <div className="lv-ent-inner lv-rise">
          <p className="lv-brand">LIAOLLET</p>
          <p className="lv-ent-title">오늘의 기회를 모두 썼어요</p>
          <p className="lv-slip">다락방에는 한 사람이 하루에 {ticket.limit}장까지 남길 수 있어요. 내일 다시 들러 주세요. 오늘 마지막으로 남긴 한 장이에요.</p>
          {ticket.work && (
          <div className="lv-paper lv-today-work">
            <img className="lv-reveal-img" src={ticket.work.image} alt={`${ticket.work.title || ticket.work.emotion}, ${ticket.work.artist}의 시선으로 엮은 콜라주`} />
            <p className="lv-meta">
              {ticket.work.date} · {ticket.work.artist}의 시선 · No. {ticket.work.key}
            </p>
            <button className="lv-btn lv-btn-full" onClick={async () => setLinkMsg(await onSendLink(ticket.work))}>
              내 작품 링크 보내기
            </button>
            <button className="lv-btn is-ghost lv-btn-full" onClick={() => onOpenShelf(ticket.work)}>
              취향의 서가 구경하기
            </button>
            <p className="lv-toast" aria-live="polite">
              {linkMsg}
            </p>
          </div>
          )}
        </div>
      )}

      {stage === "ticket" && ticket && !ticket.done && (
        <div className="lv-ent-inner lv-rise">
          <p className="lv-brand">LIAOLLET</p>
          {/* 번호 칸에는 오늘 날짜. 작품을 엮으면 그 뒤에 순번이 붙어 작품 번호가 된다 */}
          <Ticket
            side={ticket.day}
            stamp={
              <span className={`lv-stamp${stamped ? " is-on" : ""}`} aria-hidden="true">
                <Stamp id="stamp-admit" word="ADMITTED" date={ticket.date} />
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
          {/* 하루 세 장이라는 안내는 여기서 하지 않는다. 다 돌리지 않을 사람이 많아, 결과 장 맨 끝에서 한 번만 알려 준다.
              날짜는 티켓 번호 칸에 이미 있어 따로 적지 않는다 */}
          <form className="lv-who" onSubmit={enter}>
            {/* 친근한 질문 하나, 계약서 서명란 같은 줄 하나, 줄 밑 작은 글씨 한 줄. 이름이 아이디라는 설명은 길게 하지 않는다 */}
            <p className="lv-who-q">
              오늘 다락방을 찾아준 당신을
              <br />
              뭐라고 부르면 좋을까요?
            </p>
            {/* 계약서 서명란처럼 줄 위 왼쪽에 영문 Signature 를 작게 */}
            <span className="lv-signcap" aria-hidden="true">
              Signature
            </span>
            <label className="lv-signline">
              <input
                id="lv-sign"
                className="pen"
                value={sign}
                disabled={stamped}
                // 아이디라 띄어쓰기는 받지 않는다. 한글 조합 중에 글자를 지우면 입력이 깨지므로 다른 글자는 서버가 거른다
                onChange={(e) => {
                  setSign(e.target.value.replace(/\s/g, "").slice(0, 10));
                  setSignErr("");
                }}
                maxLength={10}
                placeholder="여기에 서명해 주세요"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="서명"
              />
            </label>
            <p className={`lv-who-hint${signErr ? " is-err" : ""}`} aria-live="polite">
              {signErr || (
                <>
                  실명 대신 당신을 나타내 줄 서명을 적어 주세요
                  <br />
                  (한글·영문·숫자 2~10자)
                </>
              )}
            </p>
            <button type="submit" className="lv-ent-cta is-solid" disabled={stamped || checking || sign.trim().length < 2}>
              {stamped ? "확인되었습니다" : checking ? "이름을 확인하는 중…" : "다락방으로 들어가기"}
            </button>
          </form>
        </div>
      )}

      {stage === "find" && !found && (
        <div className="lv-ent-inner lv-rise">
          <button className="lv-back" onClick={() => setStage("idle")}>
            ← 처음으로
          </button>
          <p className="lv-brand">LIAOLLET</p>
          <Ticket side="· · · · · ·">
            <p className="lv-tk-admit">ADMIT AGAIN</p>
            <div className="lv-tk-field">
              <p className="lv-tk-lab">YOUR SIGNATURE</p>
              <p className="lv-tk-sign pen">{code || "\u00a0"}</p>
            </div>
            <p className="lv-tk-iss">LIAOLLET CREATIVE EDITION</p>
          </Ticket>
          <p className="lv-slip">작품에 남긴 서명을 적어 주세요</p>
          <label className="lv-findsign">
            <span className="pen">from.</span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\s/g, "").slice(0, 10));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && find()}
              maxLength={10}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="서명"
              className="pen"
              autoFocus
            />
          </label>
          <p className="lv-found" aria-live="polite">
            {error}
          </p>
          {finding ? (
            <Loader text="다락방에서 찾는 중" dark size={48} />
          ) : (
            <button className="lv-ent-cta is-solid" onClick={find}>
              내 작품 펼치기
            </button>
          )}
        </div>
      )}

      {stage === "find" && found && (
        <div className="lv-reveal lv-rise">
          <button className="lv-back" onClick={() => pick(null)}>
            ← 다른 서명 찾기
          </button>
          <div className="lv-paper lv-found-work">
            {/* 결과 장(7장)과 같은 스크랩북 한 장: 콜라주와, 그때 받은 아티스트의 편지 */}
            <Scrapbook
              artist={found.artist}
              image={found.image}
              title={found.title || found.emotion}
              emotion={found.emotion}
              to={found.sign || "오늘의 창작자"}
              letter={found.letter || []}
              when={found.created_at}
              stampId="stamp-found"
              stampDate={found.date}
            />
            <p className="lv-meta">
              {found.date} · {found.artist}의 시선 · No. {found.key}
            </p>
            {/* 제목은 작품 이미지의 띠에 이미 적혀 있어, 아래에는 내용(남긴 글)만 둔다 */}
            {hits.length > 1 && (
              <>
                <p className="lv-hits-lab">from. {found.sign} · 남긴 기록 {hits.length}장</p>
                <div className="lv-hits" role="tablist" aria-label="이 서명으로 남긴 작품">
                  {hits.map((h) => (
                    <button key={h.id} role="tab" aria-selected={h.id === found.id} className={h.id === found.id ? "is-on" : ""} onClick={() => pick(h)}>
                      <img src={h.image} alt="" />
                      <span>No. {h.key}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {/* 편지를 남기기 전에 꽂힌 작품(시드 포함)은 편지가 없으니, 그때 쓴 이야기를 대신 보여 준다 */}
            {!found.letter?.length && <p className="lv-reveal-q pen">{found.answer}</p>}
            <button className="lv-btn lv-btn-full" onClick={() => onOpenShelf(found)}>
              취향의 서가에서 보기
            </button>
            {/* 이 폰에서 만든 작품만 지울 수 있다. 되돌릴 수 없어서 한 번 더 묻는다 */}
            {found.mine &&
              (asking ? (
                <div className="lv-remove-ask" role="alertdialog" aria-label="작품 지우기 확인">
                  <p>No. {found.key} 작품을 지우면 서가에서도 사라지고 되돌릴 수 없어요. 오늘 쓴 기회도 돌아오지 않아요.</p>
                  <div>
                    <button className="lv-btn is-ghost" onClick={() => setAsking(false)} disabled={removing}>
                      그대로 두기
                    </button>
                    <button className="lv-btn is-danger" onClick={remove} disabled={removing}>
                      {removing ? "지우는 중…" : "지우기"}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="lv-remove" onClick={() => setAsking(true)}>
                  이 작품 지우기
                </button>
              ))}
            <p className="lv-remove-msg" aria-live="polite">
              {removeMsg}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
