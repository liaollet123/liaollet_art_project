import { useEffect, useRef, useState } from "react";
import { storyAfterTitle } from "@/lib/fallback";
import { copyText } from "@/lib/share";
import { Ticket } from "../Entrance";
import { Like } from "./ui";

/**
 * 작품 상세. 서가 카드를 누르면 열린다. 작품을 누군가에게 보내는 일과 티켓 건네기를 하나로 묶었다:
 * 작품 링크를 건네면 받는 사람은 그 작품을 보고, 그 자리에서 자기 티켓을 받아 들어올 수 있다.
 * Esc로 닫히고, 열린 동안 뒤 페이지가 스크롤되지 않으며, 키보드 초점이 창 안에 머문다.
 */
export default function WorkModal({ work, liked, onLike, onClose }) {
  const [sent, setSent] = useState(null);
  const body = useRef(null);
  const closeBtn = useRef(null);

  useEffect(() => {
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      // Tab이 창 밖으로 빠져나가지 않게 처음과 끝을 잇는다
      if (e.key === "Tab" && body.current) {
        const f = body.current.querySelectorAll("button, input, a[href]");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="lv-modal" onClick={onClose} role="dialog" aria-modal="true" aria-label="작품 자세히 보기">
      <div className="lv-modal-body" ref={body} onClick={(ev) => ev.stopPropagation()}>
        <button className="lv-modal-close" ref={closeBtn} onClick={onClose}>
          닫기
        </button>
        <img src={work.image} alt={work.title || work.emotion} />
        <p className="lv-meta">
          {work.date} · {work.artist}의 시선{work.key ? ` · No. ${work.key}` : ""}
        </p>
        {storyAfterTitle(work.answer, work.title) && <p className="lv-reveal-q pen">{storyAfterTitle(work.answer, work.title)}</p>}
        <Like on={!!liked[work.id]} count={work.likes || 0} onClick={() => onLike(work)} />
        {/^\d+$/.test(String(work.id)) && (
          <div className="lv-inv">
            <p className="lv-inv-kick">INVITATION</p>
            <p className="lv-inv-line">이 작품과 함께, 생각나는 사람에게 티켓 한 장을 건네 보세요</p>
            <Ticket side={work.key}>
              <p className="lv-tk-admit">ADMIT ONE</p>
              <p className="lv-tk-head">
                TICKET TO
                <br />
                YOUR FEELING
              </p>
              <p className="lv-tk-iss">LIAOLLET CREATIVE EDITION</p>
            </Ticket>
            <button
              className="lv-btn lv-btn-full lv-inv-btn"
              onClick={async () => {
                const url = `${window.location.origin}/?work=${encodeURIComponent(work.key)}`;
                const ok = await copyText(url);
                setSent({ url, ok });
              }}
            >
              링크 복사
            </button>
            {sent && !sent.ok && <input className="lv-inv-url" value={sent.url} readOnly onFocus={(e) => e.target.select()} aria-label="작품 링크" />}
            <p className="lv-toast" aria-live="polite">
              {sent ? (sent.ok ? "링크를 복사했어요. 받는 사람은 이 작품을 보고 자기 티켓도 받을 수 있어요." : "링크를 길게 눌러 복사해 주세요.") : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
