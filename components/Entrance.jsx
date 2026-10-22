"use client";

import { useEffect, useRef, useState } from "react";
import Loader from "./Loader";

// 다이어리 오른쪽 장에 끼워 둔 서가 작품들. 앞면과 뒷면에 각각 한 장씩
const LEAVES = [
  ["/attic/seed/lia.jpg", "/attic/seed/let2.jpg"],
  ["/attic/seed/ol.jpg", "/attic/seed/lia2.jpg"],
  ["/attic/seed/let.jpg", "/attic/seed/ol2.jpg"],
];

/** 티켓 종이 위에 글자를 얹는다. 위치는 원본 티켓 비율에 맞춰 고정 (디자인 결정 3번). 서가의 티켓 건네기도 같은 티켓을 쓴다 */
export function Ticket({ children, side, stamp }) {
  return (
    <div className="lv-ticket">
      <img src="/attic/ticket-blank.png" alt="" />
      <div className="lv-tk-ink">
        <div className="lv-tk-body">{children}</div>
        <div className="lv-tk-cell">
          <span className="lv-tk-no">{side}</span>
        </div>
      </div>
      {stamp}
    </div>
  );
}

/**
 * 1장 — 입장
 *   idle   : 다락방 배경, 고리를 축으로 장이 넘어가는 다이어리
 *   ticket : 창작 에디션 티켓 발급 → 들어가기를 누르면 도장 → 동의서로
 *   find   : 받았던 티켓 번호로 작품 다시 펼치기
 */
export default function Entrance({ ticket, onIssue, onEnter, onFind, onOpenShelf, onSendLink }) {
  const [stage, setStage] = useState("idle");
  const [stamped, setStamped] = useState(false);
  const [copied, setCopied] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState(null);
  const [error, setError] = useState("");
  const [finding, setFinding] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueErr, setIssueErr] = useState("");
  // 한 티켓으로 여러 장을 남겼을 수 있다. 찾은 작품들 중 지금 펼친 것
  const [hits, setHits] = useState([]);
  const [linkMsg, setLinkMsg] = useState("");
  const leafRef = useRef(null);
  const codeRef = useRef(null);

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
    const id = setInterval(() => {
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
        }, 2800)
      );
    }, 5200);
    return () => {
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.no);
      setCopied("고유번호를 복사했어요.");
    } catch {
      setCopied("복사할 수 없는 환경이에요. 번호를 적어 두세요.");
    }
  };

  // 서버에서 그 티켓으로 남긴 작품을 찾는다. 다른 폰에서 만든 작품도 열린다
  const find = async () => {
    if (code.length < 6) return setError("티켓 번호는 여섯 자리예요.");
    setFinding(true);
    const list = await onFind(code);
    setFinding(false);
    if (list.length) {
      setHits(list);
      setFound(list[0]);
    } else setError("그 번호로 열리는 기록이 없어요. 티켓의 숫자를 다시 확인해 주세요.");
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
            <img className="lv-diary-img" src="/attic/diary-cut.png" alt="손에 든 빈티지 다이어리" />
            <div className="lv-leaf" ref={leafRef} aria-hidden="true">
              {LEAVES.map(([front, back]) => (
                <div className="lv-pg" key={front}>
                  <div className="lv-pg-f">
                    <img src={front} alt="" />
                  </div>
                  <div className="lv-pg-b">
                    <img src={back} alt="" />
                  </div>
                </div>
              ))}
            </div>
            <img className="lv-diary-rings" src="/attic/diary-cut.png" alt="" aria-hidden="true" />
          </div>
          <p className="lv-invite">오늘의 마음을 한 장 적어 보세요</p>
          {issuing ? (
            <Loader text="티켓을 찍는 중" dark size={44} />
          ) : (
            <button className="lv-ent-cta" onClick={issue}>
              창작 에디션 티켓 받기
            </button>
          )}
          {issueErr && (
            <p className="lv-found" aria-live="polite">
              {issueErr}
            </p>
          )}
          <button className="lv-ent-link" onClick={() => setStage("find")}>
            이미 받은 번호가 있나요?
          </button>
        </div>
      )}

      {/* 한 사람(폰)에 하루 한 장. 오늘 이미 남겼으면 새로 만들지 않고 그 작품과 링크를 건넨다 */}
      {stage === "ticket" && ticket?.done && (
        <div className="lv-ent-inner lv-rise">
          <p className="lv-brand">LIAOLLET</p>
          <p className="lv-ent-title">오늘의 한 장</p>
          <p className="lv-slip">오늘은 이미 다락방에 한 장을 남겼어요. 내일 다시 들러 주세요.</p>
          {ticket.work && (
          <div className="lv-paper lv-today-work">
            <img className="lv-reveal-img" src={ticket.work.image} alt={`${ticket.work.title || ticket.work.emotion}, ${ticket.work.artist}의 시선으로 엮은 콜라주`} />
            <p className="lv-meta">
              {ticket.work.date} · {ticket.work.artist}의 시선 · No. {ticket.work.key}
            </p>
            <p className="lv-reveal-title">{ticket.work.title || ticket.work.emotion}</p>
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
          <Ticket
            side={ticket.no}
            stamp={
              <span className={`lv-stamp${stamped ? " is-on" : ""}`} aria-hidden="true">
                <b>LIAOLLET</b>
                <span>ADMITTED</span>
                <i>{ticket.date}</i>
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
          <p className="lv-slip">
            {ticket.date} · 오늘 {ticket.seq}번째 창작자
          </p>
          <div className="lv-code">
            <span className="lv-code-lab">고유번호</span>
            <span className="lv-code-no">{ticket.no}</span>
            <button onClick={copy}>COPY</button>
          </div>
          <p className="lv-slip-dim" aria-live="polite">
            {copied || "이 번호로 언제든 작품을 다시 펼칠 수 있어요."}
          </p>
          <button className="lv-ent-cta is-solid" onClick={() => setStamped(true)} disabled={stamped}>
            {stamped ? "확인되었습니다" : "다락방으로 들어가기"}
          </button>
        </div>
      )}

      {stage === "find" && !found && (
        <div className="lv-ent-inner lv-rise">
          <button className="lv-back" onClick={() => setStage("idle")}>
            ← 처음으로
          </button>
          <p className="lv-brand">LIAOLLET</p>
          <Ticket side={code || "· · · · · ·"}>
            <p className="lv-tk-admit">ADMIT AGAIN</p>
            <div className="lv-tk-field">
              <p className="lv-tk-lab">YOUR TICKET NO.</p>
              <p className="lv-tk-show">{(code + "______").slice(0, 6)}</p>
            </div>
            <p className="lv-tk-iss">LIAOLLET CREATIVE EDITION</p>
          </Ticket>
          <p className="lv-slip">받았던 티켓의 여섯 자리를 적어 주세요</p>
          <label className="lv-slots" onClick={() => codeRef.current?.focus()}>
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && find()}
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              aria-label="티켓 번호 여섯 자리"
              autoFocus
            />
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i === code.length ? "is-cur" : ""}>
                {code[i] || ""}
              </span>
            ))}
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
          <button className="lv-back" onClick={() => setFound(null)}>
            ← 다른 번호 찾기
          </button>
          <div className="lv-paper">
            <img className="lv-reveal-img" src={found.image} alt={`${found.title || found.emotion}, ${found.artist}의 시선으로 엮은 콜라주`} />
            <p className="lv-meta">
              {found.date} · {found.artist}의 시선 · No. {found.key}
            </p>
            <p className="lv-reveal-title">{found.title || found.emotion}</p>
            {hits.length > 1 && (
              <div className="lv-hits" role="tablist" aria-label="이 티켓으로 남긴 작품">
                {hits.map((h) => (
                  <button key={h.id} role="tab" aria-selected={h.id === found.id} className={h.id === found.id ? "is-on" : ""} onClick={() => setFound(h)}>
                    No. {h.key}
                  </button>
                ))}
              </div>
            )}
            <p className="lv-reveal-q pen">{found.answer}</p>
            <button className="lv-btn lv-btn-full" onClick={() => onOpenShelf(found)}>
              취향의 서가에서 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
