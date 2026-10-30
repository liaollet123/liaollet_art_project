"use client";

import { useState } from "react";

/**
 * 운영자 화면. 서가에 걸린 작품을 보고, 이상한 사진이나 글이 있는 작품은 완전히 지운다(되돌릴 수 없다).
 * .env.local 의 ADMIN_TOKEN 을 입력해야 열린다. 전시 중 부적절한 내용이 보이면 여기서 바로 내린다.
 * 지울 작품을 체크해 두고 오른쪽 위 "선택 삭제"로 한 번에 지운다. 전시 중 여러 장을 내려야 할 때 하나씩 누르면 느리다
 */
export default function Admin() {
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  // 기간 검색(한국 날짜, 종료일 포함). 비워 두면 최근 작품 전체
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const call = async (method, body, query = "") => {
    const r = await fetch(`/api/admin${query}`, {
      method,
      headers: { "x-admin-token": token, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.ok ? r.json() : null;
  };

  // 지운 뒤 다시 불러올 때도 보고 있던 기간을 그대로 쓴다
  const load = async (range = { from, to }) => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    const d = await call("GET", null, p.toString() ? `?${p}` : "");
    if (!d) return setMsg("토큰이 맞지 않거나 ADMIN_TOKEN 이 설정되지 않았어요.");
    setData(d);
    // 다시 불러온 목록에 없는 작품은 선택에서 뺀다
    setSel((s) => new Set([...s].filter((id) => d.works.some((w) => w.id === id))));
    return d;
  };

  const search = async (e) => {
    e.preventDefault();
    if (from && to && from > to) return setMsg("시작일이 종료일보다 늦어요.");
    if (await load()) setMsg("");
  };
  const showAll = async () => {
    setFrom("");
    setTo("");
    if (await load({ from: "", to: "" })) setMsg("");
  };

  const toggle = (id) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const all = data?.works.length > 0 && sel.size === data.works.length;
  const toggleAll = () => setSel(all ? new Set() : new Set(data.works.map((w) => w.id)));

  // 완전히 지우기. 되돌릴 수 없으니 한 번 더 묻는다. 무엇이 지워지고 무엇이 남았는지 그대로 알린다
  const removeSelected = async () => {
    const ids = [...sel];
    if (!ids.length || busy) return;
    const keys = data.works.filter((w) => sel.has(w.id)).map((w) => w.key);
    const preview = keys.slice(0, 5).join(", ") + (keys.length > 5 ? ` 외 ${keys.length - 5}개` : "");
    if (!window.confirm(`선택한 작품 ${ids.length}개(No. ${preview})를 완전히 지울까요?\n콜라주와 올린 사진도 함께 지워지고, 되돌릴 수 없어요.`)) return;
    setBusy(true);
    setMsg("지우는 중…");
    const r = await call("POST", { ids, action: "delete" });
    setBusy(false);
    if (!r) return setMsg("지우지 못했어요. 토큰과 네트워크를 확인하고 다시 시도해 주세요.");
    const fails = r.failed.map((f) => `No. ${data.works.find((w) => w.id === f.id)?.key || f.id}: ${f.error}`);
    setMsg(`${r.deleted.length}개를 지웠어요.${fails.length ? ` 지우지 못한 ${fails.length}개 — ${fails.join(" / ")}` : ""}`);
    setSel(new Set(r.failed.map((f) => f.id)));
    load();
  };

  return (
    <main className="adm">
      <h1>다락방 운영</h1>
      <div className="adm-login">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" aria-label="운영자 토큰" />
        <button onClick={() => load().then((d) => d && setMsg(""))}>불러오기</button>
      </div>
      {msg && (
        <p className="adm-msg" aria-live="polite">
          {msg}
        </p>
      )}
      {data && (
        <>
          {data.stats && (
            <dl className="adm-stats">
              <div>
                <dt>누적 작품 번호</dt>
                <dd>{data.stats.total}번</dd>
              </div>
              <div>
                <dt>오늘 서명</dt>
                <dd>{data.stats.today}장</dd>
              </div>
              <div>
                <dt>서가에 꽂힌 작품</dt>
                <dd>{data.stats.works}장</dd>
              </div>
            </dl>
          )}
          <form className="adm-search" onSubmit={search}>
            <label>
              시작일
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <span aria-hidden="true">~</span>
            <label>
              종료일
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="submit">검색</button>
            {(data.range?.from || data.range?.to) && (
              <button type="button" onClick={showAll}>
                전체 보기
              </button>
            )}
          </form>
          {/* 목록 위 한 줄: 왼쪽에 개수, 오른쪽에 전체 선택과 선택 삭제 */}
          <div className="adm-bar">
            <h2>
              작품 {data.works.length}
              {(data.range?.from || data.range?.to) && (
                <small className="adm-range">
                  {" "}
                  ({data.range.from || "처음"} ~ {data.range.to || "오늘"})
                </small>
              )}
            </h2>
            <label className="adm-all">
              <input type="checkbox" checked={all} onChange={toggleAll} disabled={!data.works.length} />
              전체 선택
            </label>
            <button className="is-danger adm-del" onClick={removeSelected} disabled={!sel.size || busy}>
              {busy ? "지우는 중…" : `선택 삭제${sel.size ? ` (${sel.size})` : ""}`}
            </button>
          </div>
          <ul className="adm-list">
            {data.works.map((w, i) => (
              // 줄 어디를 눌러도 선택된다. 체크박스 자체를 누를 때는 줄의 클릭과 겹쳐 두 번 바뀌지 않게 막는다
              <li key={w.id} className={sel.has(w.id) ? "is-picked" : ""} onClick={() => toggle(w.id)}>
                {/* 지금 보이는 목록 안의 순번(최근 것부터 1). 여러 장을 같이 볼 때 "몇 번째"로 부르기 쉽게 */}
                <span className="adm-no">{i + 1}</span>
                <img src={w.image} alt="" />
                <div>
                  <b>
                    No. {w.key} · {w.date} · {w.artist} · {w.sign || "서명 없음"} · 공감 {w.likes}
                    {w.seed && <span className="adm-seed"> · 시드</span>}
                  </b>
                  <p>{w.answer}</p>
                  <small>{(w.tags || []).join(" ")}</small>
                </div>
                {/* 체크는 맨 오른쪽. 오른쪽 위 "선택 삭제" 버튼과 같은 세로줄에 있어야 고르고 지우는 손이 한쪽에 머문다 */}
                <input
                  type="checkbox"
                  checked={sel.has(w.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggle(w.id)}
                  aria-label={`No. ${w.key} 선택`}
                />
              </li>
            ))}
          </ul>
          <p className="adm-note">시드 작품은 supabase/schema.sql 을 다시 실행하면 서가에 되살아나요.</p>
        </>
      )}
    </main>
  );
}
