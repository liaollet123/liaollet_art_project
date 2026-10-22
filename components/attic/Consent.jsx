import { Actions, Check, Paper, today } from "./ui";

// 동의서는 실제로 일어나는 일과 같아야 한다. 글과 사진 썸네일이 AI 서비스로 전송된다는 것까지 적는다
const AGREEMENTS = [
  {
    b: "업로드한 사진과 글은 이 작품을 만드는 데에만 쓰입니다.",
    s: "이야기와 작품 라벨을 쓰기 위해 글과 작게 줄인 사진이 AI 서비스(Google)로 전송되며, AI 학습에는 쓰이지 않습니다.",
  },
  { b: "사진 속 인물이 작품에 반영될 수 있습니다.", s: "타인의 동의 없는 사진은 올리지 말아 주세요." },
  {
    b: "완성된 작품이 익명으로 '취향의 서가'에 전시되고 SNS에 활용되는 것에 동의합니다.",
    s: "다른 관람객에게 상처가 될 수 있는 내용은 공개되지 않을 수 있습니다.",
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
          <b>LIAOLLET</b>
          <span>AGREED</span>
          <i>{today()}</i>
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
