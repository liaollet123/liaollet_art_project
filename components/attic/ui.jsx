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

/**
 * 빈티지 고무도장. 바깥 굵은 테 + 안쪽 가는 테, 위아래로 둥글게 도는 글씨, 가운데 띠에 한 단어.
 * 잉크가 종이에 고르게 묻지 않은 것처럼 점점이 비고 가장자리가 살짝 번지게 SVG 필터를 건다.
 * id 는 한 화면에 도장이 둘 이상일 때 필터와 글씨 길이 겹치지 않게 하는 이름
 */
export function Stamp({ id, word, date }) {
  return (
    <svg className="lv-stamp-svg" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id={`${id}-top`} d="M 21 60 A 39 39 0 0 1 99 60" />
        <path id={`${id}-bot`} d="M 17 60 A 43 43 0 0 0 103 60" />
        <filter id={`${id}-worn`} x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.78" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="s" />
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="9" result="w" />
          <feDisplacementMap in="s" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${id}-worn)`}>
        <g fill="none" stroke="currentColor">
          <circle cx="60" cy="60" r="56" strokeWidth="3.4" />
          <circle cx="60" cy="60" r="50.5" strokeWidth="1" />
          <path d="M 14 49 H 106 M 14 71 H 106" strokeWidth="1.1" />
        </g>
        <g fill="currentColor" fontFamily="'Special Elite', 'Courier New', monospace">
          <text fontSize="10.5" letterSpacing="2.6">
            <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
              LIAOLLET
            </textPath>
          </text>
          <text x="60" y="64.5" fontSize="13" letterSpacing="1.4" textAnchor="middle">
            {word}
          </text>
          <text fontSize="7.6" letterSpacing="1.2">
            <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">
              {date}
            </textPath>
          </text>
          <circle cx="24" cy="60" r="1.6" />
          <circle cx="96" cy="60" r="1.6" />
        </g>
      </g>
    </svg>
  );
}
