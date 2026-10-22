import { useEffect, useRef } from "react";
import { Like } from "./ui";

/**
 * 작품 상세. 서가 카드를 누르면 열린다.
 * Esc로 닫히고, 열린 동안 뒤 페이지가 스크롤되지 않으며, 키보드 초점이 창 안에 머문다.
 */
export default function WorkModal({ work, liked, onLike, onClose }) {
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
        <p className="lv-reveal-title">{work.title || work.emotion}</p>
        {work.answer && <p className="lv-reveal-q pen">{work.answer}</p>}
        <Like on={!!liked[work.id]} count={work.likes || 0} onClick={() => onLike(work)} />
      </div>
    </div>
  );
}
