"use client";

import { useState } from "react";

/**
 * 운영자 화면. 서가에 걸린 작품을 보고, 이상한 사진이나 글이 있는 작품은 완전히 지운다(되돌릴 수 없다).
 * .env.local 의 ADMIN_TOKEN 을 입력해야 열린다. 전시 중 부적절한 내용이 보이면 여기서 바로 내린다.
 */
export default function Admin() {
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");

  const call = async (method, body) => {
    const r = await fetch("/api/admin", {
      method,
      headers: { "x-admin-token": token, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.ok ? r.json() : null;
  };

  const load = async () => {
    const d = await call("GET");
    if (!d) return setMsg("토큰이 맞지 않거나 ADMIN_TOKEN 이 설정되지 않았어요.");
    setMsg("");
    setData(d);
  };

  // 완전히 지우기. 되돌릴 수 없으니 한 번 더 묻는다
  const remove = async (w) => {
    if (!window.confirm(`작품 No. ${w.key}(콜라주와 올린 사진 포함)을 완전히 지울까요? 되돌릴 수 없어요.`)) return;
    if (await call("POST", { id: w.id, action: "delete" })) {
      setMsg("지웠어요.");
      load();
    } else setMsg("지우지 못했어요. 다시 시도해 주세요.");
  };

  return (
    <main className="adm">
      <h1>다락방 운영</h1>
      <div className="adm-login">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" aria-label="운영자 토큰" />
        <button onClick={load}>불러오기</button>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
      {data && (
        <>
          <h2>작품 {data.works.length}</h2>
          <ul className="adm-list">
            {data.works.map((w) => (
              <li key={w.id}>
                <img src={w.image} alt="" />
                <div>
                  <b>
                    No. {w.key} · {w.artist} · {w.sign || "서명 없음"} · 공감 {w.likes}
                  </b>
                  <p>{w.answer}</p>
                  <small>{(w.tags || []).join(" ")}</small>
                </div>
                <div className="adm-acts">
                  <button className="is-danger" onClick={() => remove(w)}>
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
