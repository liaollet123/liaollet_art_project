/**
 * 다락방 아이콘 로더. 집 안의 점(사람들의 감각)이 하나씩 빛나는 동안 기다린다.
 * SVG 안에 애니메이션이 들어 있어 img 하나로 끝난다. 동작 줄이기 설정에서는 멈춘다.
 */
export default function Loader({ text, size = 56, dark = false, inline = false }) {
  return (
    <div className={`lv-loader${dark ? " is-dark" : ""}${inline ? " is-inline" : ""}`} role="status">
      <img src="/attic/liaollet-icon-anim.svg" alt="" width={size} height={size} />
      {text && <span>{text}</span>}
    </div>
  );
}
