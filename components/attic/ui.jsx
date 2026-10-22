// 여러 장이 함께 쓰는 작은 조각들
export const ORDER = ["LIA", "OL", "LET"];

// 입장(1)부터 서가(8)까지. 5장(시선 상세)은 종이가 아니라 시선의 색으로 덮인 장이라 쪽수를 달지 않는다
export const TOTAL = 8;

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export function Paper({ no, children, className = "" }) {
  return (
    <div className={`lv-paper ${className}`}>
      {no && (
        <span className="lv-pno">
          p.{String(no).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
        </span>
      )}
      {children}
    </div>
  );
}

function Heart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

/** 체크박스 상자 대신 다이어리에 펜으로 긋는 표시 */
export function Check() {
  return (
    <span className="lv-chk" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 13l5 5L20 6" />
      </svg>
    </span>
  );
}

export function Like({ on, count, onClick }) {
  return (
    <button className={`lv-like${on ? " is-on" : ""}`} onClick={onClick} aria-pressed={on}>
      <Heart />
      공감 <span>{count}</span>
    </button>
  );
}

export function Actions({ children }) {
  return <div className="lv-actions">{children}</div>;
}
