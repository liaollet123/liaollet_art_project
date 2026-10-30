"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { suggestTags } from "@/lib/attic";
import { fallbackCompose, fallbackRead, firstLine, lineAfterTitle, tidySpacing } from "@/lib/fallback";
import { loadImage, renderCollage, shrinkPhoto, thumb, titleFrom } from "@/lib/collage";
import { analyze, claimSign, compose, findBySign, findByTicket, findWork, issueTicket, loadLiked, loadShelf, loadSign, rememberSign, saveWork, toggleLike } from "@/lib/store";
import { copyText } from "@/lib/share";
import Entrance from "./Entrance";
import Answer from "./attic/Answer";
import { ArtistDetail, Artists } from "./attic/Artists";
import Consent from "./attic/Consent";
import Emotions from "./attic/Emotions";
import Result from "./attic/Result";
import Shelf from "./attic/Shelf";
import WorkModal from "./attic/WorkModal";

// 사진을 올리지 않았을 때 대신 엮는 다락방의 종이
const DEFAULT_PHOTO = "/attic/default.jpg";

// 한 장에 엮는 사진은 세 장까지. 콜라주가 붐비지 않고, 관객도 고르는 데 오래 머물지 않는다
const MAX_PHOTOS = 3;

/**
 * 내 작품 링크를 보낸다. 폰에서는 공유 창(카카오톡, 메시지 등)이 열리고,
 * 공유 창이 없는 기기에서는 링크를 복사한다. 돌려주는 값은 화면에 띄울 안내 문구
 */
async function sendLink(url) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "LIAOLLET 감정의 다락방", text: "오늘 다락방에 남긴 한 장이에요.", url });
      return "링크를 보냈어요.";
    } catch (e) {
      if (e?.name === "AbortError") return "";
    }
  }
  return (await copyText(url)) ? "링크를 복사했어요. 나에게 보내 두면 언제든 다시 펼칠 수 있어요." : `링크: ${url}`;
}

/**
 * 8장짜리 다이어리의 상태 머신.
 *   1 입장(티켓 + 오늘의 창작자 이름) · 2 동의 · 3 마음 · 4 시선 고르기 · 5 시선 상세 · 6 답하기 · 7 결과 · 8 서가
 * 각 장의 화면은 components/attic/ 에 있고, 여기서는 장을 넘기고 서버와 이야기하는 일만 한다.
 */
export default function Attic() {
  const [step, setStep] = useState(1);
  const [ticket, setTicket] = useState(null);
  const [agree, setAgree] = useState([false, false, false]);
  const [emotion, setEmotion] = useState("");
  const [mine, setMine] = useState("");
  const [artist, setArtist] = useState("LIA");

  const [photos, setPhotos] = useState([]);
  const [liked, setLiked] = useState({});
  const [photoError, setPhotoError] = useState("");
  const [answer, setAnswer] = useState("");
  const [reading, setReading] = useState(null);
  const [readBusy, setReadBusy] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [result, setResult] = useState("");
  const [label, setLabel] = useState(null);
  const [sign, setSign] = useState("");
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [shelf, setShelf] = useState([]);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const [invite, setInvite] = useState(null);
  const [shareMsg, setShareMsg] = useState("");

  const readAbort = useRef(null);
  // 다락방이 마지막으로 적어 준 이야기. 사진을 바꾸고 다시 받으면 이 글을 새 글로 바꿔 끼운다(두 번 붙지 않게)
  const lastStory = useRef("");

  const chosen = mine.trim() || emotion;

  const refreshShelf = useCallback(async () => {
    setShelfLoading(true);
    setShelf(await loadShelf());
    setShelfLoading(false);
  }, []);

  // 이 폰에서 공감을 누른 작품 목록. 같은 사람이 같은 작품을 여러 번 올리지 않게
  useEffect(() => {
    setLiked(loadLiked());
    // 이 폰에서 전에 쓴 이름을 1장에 미리 적어 둔다(아이디라 같은 이름을 다시 쓰게)
    setSign(loadSign());
  }, []);

  // 공유 링크(?work=102201)로 들어왔으면 서가를 펼치고 그 작품을 연다
  useEffect(() => {
    window.history.replaceState({ step: 1 }, "");
    const q = new URLSearchParams(window.location.search);
    const key = q.get("work") || q.get("ticket");
    if (!key) return;
    (async () => {
      const w = q.get("work") ? await findWork(key) : (await findByTicket(key))[0];
      if (!w) return;
      setStep(8);
      setOpen(w);
      refreshShelf();
    })();
  }, [refreshShelf]);

  // 폰의 뒤로가기로 이전 장으로
  useEffect(() => {
    const onPop = (e) => e.state?.step && setStep(e.state.step);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((n) => {
    setStep(n);
    window.history.pushState({ step: n }, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 사진이나 마음, 시선이 바뀌면 이전에 읽은 이야기는 맞지 않으니 꼬리표를 다시 띄운다
  useEffect(() => {
    readAbort.current?.abort();
    setReading(null);
    setReadBusy(false);
  }, [photos, chosen, artist]);

  // 다락방이 적어 준 이야기 끝에는 "LIA에게 쓸쓸함은 …"처럼 시선과 마음의 이름이 들어간다.
  // 시선이나 마음이 바뀌면 그 이야기는 맞지 않으니 지운다(관객이 덧붙인 말은 지킨다).
  // 그러지 않으면 다시 엮을 때 고르지 않은 시선의 이름이 글에 남아 결과물에 새겨진다. 시선이 바뀌면 그 시선에서 고른 태그도 맞지 않는다
  useEffect(() => {
    setPicked([]);
    const prev = lastStory.current;
    if (!prev) return;
    lastStory.current = "";
    setAnswer((v) => (v.startsWith(prev) ? v.slice(prev.length).trim() : v));
  }, [chosen, artist]);

  // ---------------------------------------------------------------------------
  // 1장 — 티켓
  // ---------------------------------------------------------------------------

  // 입장 티켓의 번호 칸에는 오늘 날짜만 적힌다(작품 번호는 엮을 때 그 뒤에 순번을 붙인다). 서버는 오늘 쓴 기회 수를 알려 주고(화면에는 결과 장 끝에서만 보인다),
  // 하루 세 번을 다 썼으면 마지막 작품을 함께 돌려준다
  const onIssue = async () => {
    const t = await issueTicket();
    if (t.error) return t.error;
    setTicket(t);
    if (t.work) setSaved(t.work);
    return null;
  };

  // 티켓을 받으면 "오늘의 창작자님은 누구신가요?"에 이름(= 아이디)을 적는다. 들어가기 전에 서버가 확인한다
  // (다른 폰이 쓰는 이름인지, 이 이름으로 오늘 세 번을 다 썼는지). 문제가 있으면 그 문구를, 없으면 null
  const onCheckSign = async (name) => {
    const c = await claimSign(name, true);
    if (c.error) return c.status === 0 ? "와이파이를 확인하고 다시 눌러 주세요." : c.error;
    setSign(c.signature);
    rememberSign(c.signature);
    return null;
  };

  // ---------------------------------------------------------------------------
  // 6장 — 사진과 이야기
  // ---------------------------------------------------------------------------

  const onFiles = async (fl) => {
    if (!fl?.length) return;
    setPhotoError("");
    const files = Array.from(fl).slice(0, MAX_PHOTOS - photos.length);
    const shrunk = await Promise.all(files.map((f) => shrinkPhoto(f).catch(() => null)));
    const ok = shrunk.filter(Boolean);
    if (ok.length < files.length) setPhotoError("열 수 없는 사진이 있었어요. 다른 사진으로 골라 주세요.");
    setPhotos((p) => [...p, ...ok].slice(0, MAX_PHOTOS));
  };

  /**
   * "다 올렸어요" 꼬리표: 누를 때만 LLM을 부른다(자동 호출 없음).
   * 받은 2~3문장은 같은 칸에 들어가고, 관객이 그대로 이어 쓰거나 고칠 수 있다.
   */
  const readStory = async () => {
    readAbort.current?.abort();
    const ctrl = new AbortController();
    readAbort.current = ctrl;
    setReadBusy(true);
    const thumbs = await Promise.all(photos.slice(0, 3).map((p) => thumb(p).catch(() => null)));
    const r = await analyze({ emotion: chosen, artist, photos: thumbs.filter(Boolean) }, ctrl.signal);
    if (ctrl.signal.aborted) return;
    const next = r.story ? r : fallbackRead({ emotion: chosen, artist, count: photos.length });
    setReading(next);
    setAnswer((v) => {
      // 지난번에 받은 이야기가 앞에 그대로 있으면 그 자리만 새 이야기로 바꾼다. 관객이 덧붙인 말은 지키고
      const prev = lastStory.current;
      const rest = (prev && v.startsWith(prev) ? v.slice(prev.length) : v).trim();
      return (rest ? `${next.story}\n${rest}` : next.story).slice(0, 400);
    });
    lastStory.current = next.story;
    setReadBusy(false);
  };

  // 맨 아래 태그 줄은 순서가 정해져 있다: 시선 → 오늘의 마음 → 사진 태그 → 글 내용 태그.
  // 글 내용 태그는 쓰는 대로 키워드 사전에서 찾는다. 서버를 부르지 않는다
  const ownTag = "#" + (chosen || "").replace(/\s/g, "");
  const baseTags = suggestTags("", artist, chosen);
  const contentTags = suggestTags(answer, artist, chosen).filter((t) => !baseTags.includes(t));
  const tags = Array.from(new Set(["#" + artist, ownTag, ...(reading?.photoTags || []), ...contentTags.slice(0, 3)])).filter(
    (t) => t !== "#감정의다락방"
  );

  /** 감각 엮기: 작품 라벨을 받아 온 뒤 그 제목과 한 줄로 콜라주를 그린다 */
  const weave = async () => {
    setNotice("");
    setBusy(true);
    try {
      // 장면을 읽고(그리고 이미지 모델이 켜져 있으면 시선의 화풍으로 다시 그리게) 작은 썸네일 세 장(올린 사진 모두)을 함께 보낸다
      const images = (await Promise.all(photos.slice(0, 3).map((p) => thumb(p, 512).catch(() => null)))).filter(Boolean);
      const input = {
        emotion: chosen,
        artist,
        answer,
        // 다락방이 적어 준 이야기 원문. 서버가 answer 와 견주어 관객이 스스로 쓴 말(audienceText)을 가려 편지의 비중을 정한다
        story: reading?.story || "",
        hints: [...picked, ...(reading?.photoTags || [])],
        photos: photos.length,
        images,
      };
      const r = await compose(input);
      if (r.limited) {
        setNotice("오늘 엮을 수 있는 횟수를 모두 썼어요. 내일 다시 다락방에 들러 주세요.");
        return;
      }
      const lab = r.title ? r : { ...fallbackCompose(input), title: titleFrom(answer, chosen) };
      // 맞춤법만 바로잡은 글을 칸에도 돌려놓아, 무엇이 새겨지는지 관객이 보게 한다
      const fixed = (lab.fixed || "").trim() || tidySpacing(answer);
      if (fixed && fixed !== answer.trim()) setAnswer(fixed);
      // 제목 아래 글귀가 제목과 같은 말로 시작하면 두 번 읽히니, 제목 다음 말을 새긴다
      const stem = (s) => String(s || "").replace(/[\s….,]/g, "");
      let line = lab.line || firstLine(fixed);
      if (!line || stem(line).startsWith(stem(lab.title)) || stem(lab.title).startsWith(stem(line).slice(0, 6))) line = lineAfterTitle(fixed, lab.title);
      const args = {
        photos: photos.length ? photos : [DEFAULT_PHOTO],
        artist,
        emotion: chosen,
        title: lab.title,
        // 띠에는 두 줄까지만 들어간다. 글 전체 대신 마음이 머문 한 줄을 새긴다
        line,
        // 관객이 고른 태그가 있으면 그것을, 없으면 모든 것을 종합한 주요 낱말을 새긴다. 감정은 서명 줄에 이미 적히니 뺀다
        tags: (picked.length ? picked : lab.keywords || []).filter((t) => t !== ownTag).slice(0, 3),
        // IMAGE_PROVIDER 가 켜져 있으면 시선의 화풍으로 새로 그린 이미지가 온다. 없으면 사진을 시선대로 엮는다
        art: lab.image?.url,
      };
      renderArgs.current = args;
      // 작품 번호는 여기서 매긴다: 오늘 날짜 + 누적 순번. 엮기 직전이라 입장만 하고 돌아간 사람 때문에 번호가 비지 않는다.
      // 서가에 꽂지 않고 다시 엮으면 서버가 같은 번호를 다시 준다
      const c = await claimSign(sign);
      if (c.error) {
        setNotice(c.status === 0 ? "와이파이를 확인하고 다시 눌러 주세요." : c.error);
        return;
      }
      setTicket((t) => ({ ...t, no: c.no, seq: c.seq, date: c.date, used: c.used, limit: c.limit }));
      const img = await renderCollage({ ...args, entryKey: c.no, sign: c.signature });
      setLabel(lab);
      setResult(img);
      setSaved(null);
      setToast("");
      setShareMsg("");
      go(7);
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7장 — 서가에 꽂기와 공유
  // ---------------------------------------------------------------------------

  const renderArgs = useRef(null);

  /** 서버에 한 번만 저장한다. 버튼을 여러 번 눌러도 같은 작품이 두 장 꽂히지 않게 */
  const savingRef = useRef(null);
  const ensureSaved = async () => {
    if (saved) return saved;
    if (savingRef.current) return savingRef.current;
    savingRef.current = (async () => {
      setSaving(true);
      // 서버가 Cloudinary에 올린다. 콜라주는 675x900, 올린 사진은 긴 변 1024px jpeg 로 줄여 보낸다
      const im = await loadImage(result);
      const art = document.createElement("canvas");
      art.width = 675;
      art.height = 900;
      art.getContext("2d").drawImage(im, 0, 0, 675, 900);
      const source = (await Promise.all(photos.map((p) => thumb(p, 1024).catch(() => null)))).filter(Boolean);
      const r = await saveWork({
        ticket: ticket?.no,
        artist,
        source,
        collage: art.toDataURL("image/jpeg", 0.8),
        story: answer.trim(),
        // 시선과 오늘의 마음 태그는 화면에서 늘 켜져 있으니 저장에도 넣는다. 서가의 감정 이름도 이 태그에서 읽는다
        tags: Array.from(new Set([...tags.slice(0, 2), ...picked])),
        // 결과 장에서 보인 아티스트의 편지. 1장 "내 작품 펼치기"에서 결과 장과 같은 모습으로 다시 펼치려고 함께 남긴다
        letter: label?.letter?.length ? label.letter : label?.relation ? [label.relation] : [],
        publishable: label?.publishable,
      });
      setSaving(false);
      savingRef.current = null;
      if (r.work) {
        // 거르기에 걸린 작품은 저장되지 않고 이 화면에서만 보인다(r.hidden)
        setSaved(r.hidden ? { ...r.work, hidden: true } : r.work);
        return r.work;
      }
      setToast(
        r.limited
          ? "오늘의 한 장은 이미 서가에 꽂았어요. 이 이미지는 저장해 가실 수 있어요."
          : "서가에 꽂지 못했어요. 와이파이를 확인하고 다시 눌러 주세요. 그동안 이미지 저장을 해 두셔도 좋아요."
      );
      return null;
    })();
    return savingRef.current;
  };

  const toShelf = async () => {
    const w = await ensureSaved();
    if (!w) return;
    go(8);
    refreshShelf();
  };

  const shareUrl = (w) => `${window.location.origin}/?work=${encodeURIComponent(w.key)}`;

  // 링크를 보내려면 먼저 서가에 꽂혀 있어야 한다(받는 사람 폰에서 열리려면 서버에 있어야 하므로)
  const shareLink = async () => {
    const w = await ensureSaved();
    if (!w) return;
    setShareMsg(await sendLink(shareUrl(w)));
  };

  const shareMine = async (w = saved) => {
    if (!w) return;
    setShareMsg(await sendLink(shareUrl(w)));
  };

  // ---------------------------------------------------------------------------
  // 8장 — 서가
  // ---------------------------------------------------------------------------

  // 응답을 기다리는 동안의 연타는 받지 않는다. 서버가 한 기기에 하나만 세지만, 숫자가 깜빡이지 않게 화면에서도 막는다
  const likingRef = useRef(new Set());
  const onLike = async (w) => {
    // 저장되지 않은 작품(거르기에 걸린 것)에는 공감이 없다
    if (!/^\d+$/.test(String(w.id))) return;
    if (likingRef.current.has(w.id)) return;
    likingRef.current.add(w.id);
    const on = !liked[w.id];
    const bump = (x) => (x.id === w.id ? { ...x, likes: Math.max(0, (x.likes || 0) + (on ? 1 : -1)) } : x);
    // 누르는 즉시 숫자를 바꾸고, 서버가 돌려준 수로 맞춘다
    setShelf((s) => s.map(bump));
    setOpen((o) => (o ? bump(o) : o));
    setSaved((s) => (s ? bump(s) : s));
    const r = await toggleLike(w.id, on);
    likingRef.current.delete(w.id);
    setLiked({ ...r.liked });
    if (typeof r.likes === "number") {
      const fix = (x) => (x.id === w.id ? { ...x, likes: r.likes } : x);
      setShelf((s) => s.map(fix));
      setOpen((o) => (o ? fix(o) : o));
      setSaved((s) => (s ? fix(s) : s));
    }
  };

  // 티켓 건네기: 초대 링크를 복사한다. 복사가 막힌 폰이면 링크 칸을 펼쳐 길게 눌러 가져가게 한다
  const sendInvite = async () => {
    const url = window.location.origin + "/";
    const ok = await copyText(url);
    setInvite({ url, failed: !ok, msg: ok ? "링크를 복사했어요. 생각나는 사람에게 붙여 넣어 건네주세요." : "링크를 길게 눌러 복사해 주세요." });
  };

  const restart = () => {
    setAgree([false, false, false]);
    setEmotion("");
    setMine("");
    setPhotos([]);
    setAnswer("");
    setReading(null);
    setPicked([]);
    setResult("");
    setLabel(null);
    // 이름은 지우지 않는다. 같은 사람이 다시 들어오면 1장에 이미 적혀 있다
    setSaved(null);
    setNotice("");
    setToast("");
    setShareMsg("");
    setTicket(null);
    lastStory.current = "";
    go(1);
  };

  const closeModal = useCallback(() => setOpen(null), []);

  return (
    <main className="lv">
      {step === 1 && (
        <Entrance
          ticket={ticket}
          onIssue={onIssue}
          sign={sign}
          setSign={setSign}
          onCheckSign={onCheckSign}
          onEnter={() => go(2)}
          onFind={findBySign}
          onSendLink={(w) => sendLink(shareUrl(w))}
          onOpenShelf={(hit) => {
            setOpen(hit);
            go(8);
            refreshShelf();
          }}
        />
      )}

      {step === 2 && <Consent agree={agree} setAgree={setAgree} onBack={() => go(1)} onNext={() => go(3)} />}

      {step === 3 && (
        <Emotions emotion={emotion} setEmotion={setEmotion} mine={mine} setMine={setMine} chosen={chosen} onBack={() => go(2)} onNext={() => go(4)} />
      )}

      {step === 4 && <Artists chosen={chosen} artist={artist} setArtist={setArtist} onBack={() => go(3)} onNext={() => go(5)} />}

      {step === 5 && <ArtistDetail artist={artist} onBack={() => go(4)} onNext={() => go(6)} />}

      {step === 6 && (
        <Answer
          artist={artist}
          chosen={chosen}
          photos={photos}
          maxPhotos={MAX_PHOTOS}
          onFiles={onFiles}
          onRemovePhoto={(i) => setPhotos(photos.filter((_, j) => j !== i))}
          photoError={photoError}
          answer={answer}
          setAnswer={setAnswer}
          reading={reading}
          readBusy={readBusy}
          onRead={readStory}
          tags={tags}
          picked={picked}
          onPick={(t) => setPicked((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]))}
          notice={notice}
          busy={busy}
          onBack={() => go(5)}
          onWeave={weave}
        />
      )}

      {step === 7 && result && (
        <Result
          artist={artist}
          chosen={chosen}
          ticket={ticket}
          result={result}
          label={label}
          reading={reading}
          answer={answer}
          sign={sign}
          saved={saved}
          saving={saving}
          toast={toast}
          onShelve={toShelf}
          shareMsg={shareMsg}
          onShare={shareLink}
          // 다시 엮기는 시선부터 다시 고른다. 같은 시선을 고르면 이야기와 사진은 그대로 이어진다
          onReweave={() => go(4)}
        />
      )}

      {step === 8 && (
        <Shelf
          liked={liked}
          onLike={onLike}
          shelf={shelf}
          loading={shelfLoading}
          justShelved={saved}
          onOpen={setOpen}
          onRestart={restart}
        />
      )}

      {open && <WorkModal work={open} liked={liked} onLike={onLike} onClose={closeModal} />}
    </main>
  );
}
