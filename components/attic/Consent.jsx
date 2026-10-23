import { Actions, Check, Paper, Stamp, today } from "./ui";

// 동의서는 짧게. 작은 글씨는 안내 한 줄씩만 둔다(운영자 요청으로 AI 관련 안내는 넣지 않는다)
const AGREEMENTS = [
  {
    b: "업로드한 사진과 글은 이 작품을 만드는 데에만 쓰입니다.",
    s: "작품을 엮는 재료로만 쓰여요.",
  },
  { b: "사진 속 인물이 작품에 반영될 수 있습니다.", s: "다른 사람의 사진은 동의를 받고 올려 주세요." },
  {
    b: "완성된 작품이 익명으로 '취향의 서가'에 전시되고 SNS에 활용되는 것에 동의합니다.",
    s: "LIAOLLET 향후 전시와 SNS에 작품과 글이 소개될 수 있어요.",
  },
];

/** 2장 — 입장 동의서. 줄눈 없이, 동의는 영문 도장으로 마무리 */
export default function Consent({ agree, setAgree, onBack, onNext }) {
  const all = agree.every(Boolean);
  return (
    <Paper no={2} className="lv-rise">
      <h2 className="lv-ttl">입장 동의서</h2>
      <p className="lv-pensub pen">다락방에 들어서기 전, 작은 약속</p>
      <ul className="lv-agree">
        {AGREEMENTS.map((x, i) => (
          <li key={i}>
            <label>
              <input
                type="checkbox"
                checked={agree[i]}
                onChange={(e) => setAgree(agree.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <Check />
              <span>
                <b>{x.b}</b>
                {x.s && <small>{x.s}</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="lv-seal-row">
        <button className="lv-btn is-ghost" onClick={() => setAgree(AGREEMENTS.map(() => true))}>
          모두 동의
        </button>
        <span className={`lv-seal${all ? " is-on" : ""}`} aria-hidden="true">
          <Stamp id="seal-agree" word="AGREED" date={today()} />
        </span>
      </div>
      <Actions>
        <button className="lv-btn is-ghost" onClick={onBack}>
          ← 이전
        </button>
        <button className="lv-btn" disabled={!all} onClick={onNext}>
          다음 장 →
        </button>
      </Actions>
    </Paper>
  );
}
