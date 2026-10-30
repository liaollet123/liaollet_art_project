import { useRef } from "react";
import { ARTISTS, photoAsk } from "@/lib/attic";
import Loader from "../Loader";
import { Actions, Paper } from "./ui";

/**
 * 6장 — 질문에 답하기
 *   1 오늘의 마음 + 그 마음에 맞춘 사진 질문 → 사진(최대 3장)
 *   "다 올렸어요" 꼬리표 → 다락방이 마음과 사진을 읽고 2~3문장을 적는다(누를 때만 LLM)
 *   2 오늘의 이야기: 그 글을 그대로 두거나 이어 쓰고 고친다
 *   맨 아래 태그(시선 → 마음 → 사진 → 글 내용 순)에서 마음에 드는 것을 고른다
 */
export default function Answer({
  artist,
  chosen,
  photos,
  maxPhotos,
  onFiles,
  onRemovePhoto,
  photoError,
  answer,
  setAnswer,
  reading,
  readBusy,
  onRead,
  tags,
  picked,
  onPick,
  notice,
  busy,
  onBack,
  onWeave,
}) {
  const a = ARTISTS[artist];
  const fileRef = useRef(null);

  return (
    <Paper no={6} className={`lv-tint is-${artist.toLowerCase()} lv-rise`}>
      <div className="lv-ctx">
        <span>{artist}의 시선</span>
      </div>
      <p className="lv-asks pen">{a.asks}</p>
      <h2 className="lv-ttl">{a.question}</h2>

      <p className="lv-step-h">
        <b>1</b>오늘의 마음 <em>{chosen}</em>
      </p>
      <p className="lv-step-ask pen">{photoAsk(chosen)}</p>
      {/* 몇 장까지인지 미리 알려 둔다. 네 장째를 고르고 나서야 막히면 어느 사진이 빠졌는지 헷갈린다 */}
      <p className="lv-step-limit">사진은 최대 {maxPhotos}장까지 올릴 수 있어요. 올린 사진은 모두 다락방이 함께 읽어요.</p>
      <div className="lv-polas">
        {photos.map((p, i) => (
          <button key={i} className="lv-pola" onClick={() => onRemovePhoto(i)} title="사진 빼기" aria-label={`${i + 1}번째 사진 빼기`}>
            <img src={p} alt="" />
          </button>
        ))}
        {photos.length < maxPhotos && (
          <button className="lv-pola is-add" onClick={() => fileRef.current?.click()}>
            사진 더하기
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {photoError && <p className="lv-notice pen">{photoError}</p>}

      {/* 사진을 다 올렸다는 완료 꼬리표. 누를 때만 LLM이 마음과 사진을 읽고 이야기를 적는다 */}
      {readBusy ? (
        <Loader text={photos.length ? "다락방이 마음과 사진을 읽고 있어요" : "다락방이 오늘의 마음을 읽고 있어요"} size={44} inline />
      ) : (
        <button className={`lv-notetag${reading ? " is-gone" : ""}`} onClick={onRead} disabled={!!reading} aria-hidden={!!reading}>
          <span>
            <i>ATTIC NOTE</i>
            <br />
            <b>다 올렸어요, 이야기를 적어 주세요</b>
          </span>
        </button>
      )}

      <p className="lv-step-h">
        <b>2</b>오늘의 이야기
      </p>
      <textarea
        key={reading ? reading.story : "empty"}
        className={`lv-ans pen${reading ? " is-fill" : ""}`}
        rows={4}
        maxLength={400}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={reading ? "" : "직접 적어도, 다락방이 읽어 낸 이야기로 시작해도 좋아요"}
        aria-label="오늘의 이야기"
      />
      <p className="lv-step-sub">
        {reading
          ? "더 하고 싶은 말이 있으면 편하게 덧붙여 주세요."
          : "사진을 다 올렸다면 꼬리표를 눌러 보세요. 오늘의 첫 줄은 다락방이 열어 둘게요."}
      </p>

      {(reading || answer.trim()) && (
        <div className="lv-tags-end">
          <p>사진을 다 올리고 글도 적었다면, 마음에 드는 태그도 골라 보세요.</p>
          <div className="lv-labels">
            {tags.map((t, i) =>
              // 앞의 둘(시선, 오늘의 마음)은 이미 고른 것이라 늘 켜져 있다
              i < 2 ? (
                <span key={t} className="lv-label is-on">
                  {t}
                </span>
              ) : (
                <button key={t} className={`lv-label${picked.includes(t) ? " is-on" : ""}`} aria-pressed={picked.includes(t)} onClick={() => onPick(t)}>
                  {t}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {notice && <p className="lv-notice pen">{notice}</p>}
      {busy ? (
        <Loader text="감각을 엮는 중…" size={64} />
      ) : (
        <Actions>
          <button className="lv-btn is-ghost" onClick={onBack}>
            ← 이전
          </button>
          <button className="lv-btn is-tint" disabled={!answer.trim() && !photos.length} onClick={onWeave}>
            감각 엮기 →
          </button>
        </Actions>
      )}
    </Paper>
  );
}
