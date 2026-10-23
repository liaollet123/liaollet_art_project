import { useState } from "react";
import { EMOTIONS, emotionLine } from "@/lib/attic";
import { Actions, Paper } from "./ui";

/** 3장 — 오늘의 마음. 칸을 누르면 그 자리에서 잉크가 번진다 */
export default function Emotions({ emotion, setEmotion, mine, setMine, chosen, onBack, onNext }) {
  const [inkAt, setInkAt] = useState({ x: "50%", y: "50%" });

  // 누른 자리에서 잉크가 번지기 시작한다. 키보드로 고르면 가운데서
  const pick = (key, ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setInkAt({
      x: ev.clientX ? `${ev.clientX - r.left}px` : "50%",
      y: ev.clientY ? `${ev.clientY - r.top}px` : "50%",
    });
    setEmotion(key);
    // 직접 쓰기 칸은 없앴다. 예전에 적어 둔 말이 남아 고른 마음을 덮지 않게 비운다
    setMine("");
  };

  return (
    <Paper no={3} className="lv-rise">
      <h2 className="lv-ttl">오늘의 마음</h2>
      <p className="lv-pensub pen">지금, 어떤 마음인가요?</p>
      <p className="lv-body">가장 가까운 마음 하나를 골라 주세요.</p>
      <div className="lv-emos" role="radiogroup" aria-label="오늘의 마음">
        {EMOTIONS.map((e) => (
          <button
            key={e.key}
            role="radio"
            aria-checked={emotion === e.key}
            className={`lv-emo${emotion === e.key ? " is-on" : ""}`}
            style={emotion === e.key ? { "--x": inkAt.x, "--y": inkAt.y } : undefined}
            onClick={(ev) => pick(e.key, ev)}
          >
            {e.key}
            <span className="lv-ink" aria-hidden="true" />
          </button>
        ))}
      </div>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="lv-ink-bleed" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* 고른 마음에 어울리는 한 줄이 손으로 적어 내려가듯 나타난다. 마음을 바꾸면 새로 적힌다 */}
      <p className="lv-handline pen" aria-live="polite">
        {emotion ? (
          <span key={emotion} className="lv-handline-ink">
            {emotionLine(emotion)}
          </span>
        ) : (
          <span className="lv-handline-hint">마음을 고르면 여기에 한 줄이 적혀요</span>
        )}
      </p>
      <Actions>
        <button className="lv-btn is-ghost" onClick={onBack}>
          ← 이전
        </button>
        <button className="lv-btn" disabled={!chosen} onClick={onNext}>
          다음 장 →
        </button>
      </Actions>
    </Paper>
  );
}
