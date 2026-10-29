// 서버 전용 저장소. 브라우저마다 따로 쌓이던 기록을 한곳에 모아, 어느 폰에서든 같은 서가가 보이게 한다.
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면 Supabase (전시 배포용)
//   없으면 프로젝트 안의 .data/attic.json 파일 (내 컴퓨터에서 개발할 때)
// 화면 코드는 어느 쪽인지 몰라도 된다. 아래 함수 이름만 맞으면 된다.
import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { EMOTIONS } from "@/lib/attic";
import { SEED_WORKS } from "@/lib/seed";

// 작품 번호 = 엮은 날짜(YYMMDD, 한국 시간) + 전시 전체 누적 순번. 순번은 날이 바뀌어도 이어진다.
// 뒷자리만 보면 그 작품이 전시 전체에서 몇 번째인지, 곧 그때까지 엮인 작품 수가 바로 읽힌다.
//   첫날 첫 작품 2610231, 첫날 마지막(35번째) 26102335, 다음 날 첫 작품 26102436
// 번호는 입장할 때가 아니라 6장에서 엮을 때 매긴다. 입장만 하고 돌아간 사람 때문에 번호가 비지 않게
const ticketNo = (yymmdd, seq) => `${yymmdd}${seq}`;
const SEQ_KEY = "all";

/**
 * 서명 = 아이디. 한글·영문·숫자 2~10자, 띄어쓰기 없이.
 * 영문 대소문자는 같은 아이디로 본다(검색할 때 "Mono"와 "mono"가 갈리지 않게).
 * 이 글자들만 받기 때문에 Supabase ilike 를 와일드카드 걱정 없이 "대소문자 무시 같음"으로 쓸 수 있다
 */
export const SIGN_RE = /^[가-힣a-zA-Z0-9]{2,10}$/;
export const normSign = (s) => String(s || "").replace(/\s+/g, "").trim();
const sameSign = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
// 시드 작품의 서명은 다락방이 미리 쓴 이름이라 관객이 아이디로 가져갈 수 없다
const SEED_SIGNS = SEED_WORKS.map((w) => w.signature);

/** 전시는 서울에서 열린다. 서버가 어느 나라에 있든 날짜는 한국 시간으로 센다 */
export function seoulDay(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { mmdd: p.month + p.day, yymmdd: p.year.slice(2) + p.month + p.day, date: `${p.year}.${p.month}.${p.day}` };
}

/**
 * 저장되는 칸은 liaollet 표의 열 개뿐이다(id, ticket, artist, source, collage, story, tags, signature, likes, created_at).
 * 화면이 쓰는 나머지는 여기서 그 칸들로 만든다.
 *   key     — 티켓 번호. 티켓 하나에 작품 한 장이라 공유 링크의 열쇠가 된다
 *   emotion — 활성화된 태그 중 감정 이름과 같은 것
 *   title   — 이야기의 첫 마디
 */
const EMOTION_KEYS = new Set(EMOTIONS.map((e) => e.key));

export function toWork(r) {
  const tags = r.tags || [];
  const emotion = tags.map((t) => String(t).replace(/^#/, "")).find((t) => EMOTION_KEYS.has(t)) || "";
  const first = String(r.story || "").replace(/\s+/g, " ").trim().split(/[,.?!，。]/)[0].trim();
  const title = first ? (first.length > 14 ? first.slice(0, 14).trim() + "…" : first) : emotion ? `${emotion}의 한 장` : "오늘의 한 장";
  return {
    id: String(r.id),
    key: String(r.ticket),
    ticket: String(r.ticket),
    artist: r.artist,
    emotion,
    title,
    answer: r.story || "",
    sign: r.signature || "",
    image: r.collage,
    source: r.source || [],
    tags,
    likes: r.likes || 0,
    // 편지 칸이 생기기 전에 꽂힌 작품과 시드 작품은 편지가 없다
    letter: Array.isArray(r.letter) ? r.letter : [],
    date: seoulDay(r.created_at ? new Date(r.created_at) : new Date()).date,
    created_at: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

let sb;
function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  sb ??= createClient(url, key, { auth: { persistSession: false } });
  return sb;
}

export const backend = () => (supabase() ? "supabase" : "file");

const TABLE = "liaollet";
const COLS = "id,ticket,artist,source,collage,story,tags,signature,likes,created_at";

/**
 * 편지(letter) 칸은 schema.sql 의 alter 로 나중에 더한다. 그 SQL 을 실행하기 전 DB에서 letter 를 넣어 읽거나 쓰면
 * 요청이 통째로 실패해 서가와 저장이 500 이 났다(v12 배포 때 실제로 겪었다).
 * 그래서 편지 칸을 넣어 먼저 해 보고, "그런 칸이 없다"는 오류일 때만 편지 없이 다시 한다. SQL 을 실행하면 다음 요청부터 편지가 붙는다
 */
// "그런 칸이 없다" 오류. 읽을 때는 42703, 쓸 때는 PGRST204 로 온다(실제 Supabase 로 확인). 오늘의 쿠키 칸도 같은 방식으로 지킨다
const missingCol = (e, col) => !!e && (e.code === "42703" || e.code === "PGRST204") && (e.message || "").includes(col);
async function withLetter(run) {
  const r = await run(true);
  return missingCol(r.error, "letter") ? run(false) : r;
}
const cols = (letter) => (letter ? `${COLS},letter` : COLS);

const supa = {
  // 같은 TodayCookies(오늘 날짜 + 기기 쿠키)로 받은 작품 번호들(오래된 것부터). 하루 기회 수를 세는 데 쓴다
  async devToday(device) {
    const day = seoulDay().yymmdd;
    // 쿠키 값을 남기지 않던 코드로 생긴 줄(today_cookies 가 빈 줄)도 같은 폰·같은 날이면 함께 센다.
    // 실제 DB에 그런 줄이 있었고, 빼고 세면 오늘 이미 엮은 사람이 몇 번 더 만들 수 있었다
    const r = await supabase()
      .from("tickets")
      .select("no,seq,signature")
      .or(`today_cookies.eq."${todayCookies(device)}",and(today_cookies.is.null,device_id.eq."${device}",day.eq."${day}")`)
      .order("created_at");
    if (!missingCol(r.error, "today_cookies")) {
      if (r.error) throw r.error;
      return r.data || [];
    }
    // today_cookies 칸이 아직 없는 DB에서는 같은 뜻인 (기기, 오늘 날짜)로 센다. 칸이 없다고 하루 제한이 풀리면 안 된다
    const { data } = await supabase().from("tickets").select("no,seq,signature").eq("device_id", device).eq("day", seoulDay().yymmdd).order("created_at");
    return data || [];
  },
  // 그 아이디를 처음 쓴 기기. 아무도 안 썼으면 null
  async signOwner(sign) {
    const { data } = await supabase().from("tickets").select("device_id").ilike("signature", sign).order("created_at").limit(1);
    return data?.[0]?.device_id || null;
  },
  async issueTicket(device, signature) {
    const { yymmdd, date } = seoulDay();
    const { data: seq, error } = await supabase().rpc("next_ticket", { p_day: SEQ_KEY });
    if (error) throw error;
    const no = ticketNo(yymmdd, seq);
    const row = { no, day: yymmdd, seq, device_id: device, signature };
    let { error: e2 } = await supabase().from("tickets").insert({ ...row, today_cookies: todayCookies(device) });
    // 칸이 없는 DB에서는 쿠키 값 없이 남긴다. 그래도 devToday 가 (기기, 날짜)로 세니 하루 세 번은 지켜진다
    if (missingCol(e2, "today_cookies")) ({ error: e2 } = await supabase().from("tickets").insert(row));
    if (e2) throw e2;
    return { no, seq, date };
  },
  async setTicketSign(no, signature) {
    const { error } = await supabase().from("tickets").update({ signature }).eq("no", no);
    if (error) throw error;
  },
  async stats() {
    const { yymmdd } = seoulDay();
    const [{ data: seq }, { count: today }, { count: works }] = await Promise.all([
      supabase().from("day_seq").select("seq").eq("day", SEQ_KEY).maybeSingle(),
      supabase().from("tickets").select("no", { count: "exact", head: true }).eq("day", yymmdd).not("device_id", "is", null),
      supabase().from(TABLE).select("id", { count: "exact", head: true }),
    ]);
    return { total: seq?.seq || 0, today: today || 0, works: Math.max(0, (works || 0) - SEED_WORKS.length) };
  },
  async ticketInfo(no) {
    const { data } = await supabase().from("tickets").select("no,device_id,signature").eq("no", no).maybeSingle();
    return data ? { no: data.no, device: data.device_id || null, signature: data.signature || "" } : null;
  },
  async hit(key, limit, windowSec) {
    const { data, error } = await supabase().rpc("hit_usage", { p_key: key, p_limit: limit, p_window: windowSec });
    if (error) throw error;
    return !!data;
  },
  async listWorks({ limit = 60 } = {}) {
    const { data, error } = await withLetter((l) =>
      supabase().from(TABLE).select(cols(l)).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit)
    );
    if (error) throw error;
    return data.map(toWork);
  },
  async worksByTicket(no) {
    const { data, error } = await withLetter((l) => supabase().from(TABLE).select(cols(l)).eq("ticket", Number(no)));
    if (error) throw error;
    return data.map(toWork);
  },
  async worksBySign(sign) {
    const { data, error } = await withLetter((l) =>
      supabase().from(TABLE).select(cols(l)).ilike("signature", sign).order("created_at", { ascending: false }).limit(30)
    );
    if (error) throw error;
    return data.map(toWork);
  },
  async getWork(key) {
    const { data } = await withLetter((l) => supabase().from(TABLE).select(cols(l)).eq("ticket", Number(key)).maybeSingle());
    return data ? toWork(data) : null;
  },
  async countWorks(ticket) {
    const { count } = await supabase().from(TABLE).select("id", { count: "exact", head: true }).eq("ticket", Number(ticket));
    return count || 0;
  },
  // ticket 은 표에서 고유하다. 동시에 두 번 눌러도 두 번째는 23505 로 막혀 { duplicate } 가 된다
  async insertWork({ letter, ...row }) {
    const { data, error } = await withLetter((l) =>
      supabase()
        .from(TABLE)
        .insert({ ...row, ...(l ? { letter } : {}), ticket: Number(row.ticket) })
        .select(cols(l))
        .single()
    );
    if (error) {
      if (error.code === "23505") return { duplicate: true };
      throw error;
    }
    return toWork(data);
  },
  async like(id, device, on) {
    const { data, error } = await supabase().rpc("set_like", { p_id: Number(id), p_device: device, p_on: on });
    if (error) throw error;
    return data;
  },
  // 완전히 지운다. 되돌릴 수 없다
  async remove(id) {
    const { data, error } = await supabase().from(TABLE).delete().eq("id", Number(id)).select("source,collage");
    if (error) throw error;
    return data?.[0] || null;
  },
};

// ---------------------------------------------------------------------------
// 파일 (개발용). 한 서버 프로세스 안에서만 안전하다. 전시 배포에는 Supabase를 쓴다
// ---------------------------------------------------------------------------

const FILE = path.join(process.env.ATTIC_DATA_DIR || path.join(process.cwd(), ".data"), "attic.json");
let cache = null;
let chain = Promise.resolve();

const seeds = () => SEED_WORKS.map((w, i) => ({ ...w, id: i + 1 }));

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8"));
    // 예전 형식(칸이 많던 작품)이 남아 있으면 새 형식의 시드로 되돌린다
    if (cache.works.some((w) => !("collage" in w))) cache.works = seeds();
    delete cache.notes;
    // 시드가 늘었으면(예: 6장 → 12장) 없는 것만 더한다. 관객이 남긴 작품은 건드리지 않는다
    for (const w of SEED_WORKS) {
      if (cache.works.some((x) => Number(x.ticket) === Number(w.ticket))) continue;
      cache.works.push({ ...w, id: Math.max(0, ...cache.works.map((x) => x.id)) + 1 });
      if (!cache.tickets.includes(String(w.ticket))) cache.tickets.push(String(w.ticket));
    }
  } catch {
    cache = {
      days: {},
      tickets: SEED_WORKS.map((w) => String(w.ticket)),
      works: seeds(),
      usage: {},
    };
  }
  return cache;
}

/** 읽고 고치고 쓰는 일을 한 줄로 세운다. 두 사람이 동시에 티켓을 받아도 번호가 겹치지 않게 */
function tx(fn) {
  const run = chain.then(async () => {
    const db = await load();
    const out = await fn(db);
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db));
    return out;
  });
  chain = run.catch(() => {});
  return run;
}

const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id;

const file = {
  devToday: async (device) => {
    const key = todayCookies(device);
    return ((await load()).byDev?.[device] || []).filter((t) => (t.todayCookies ?? `${t.day}:${device}`) === key);
  },
  signOwner: async (sign) => {
    const hit = Object.entries((await load()).byDev || {}).find(([, list]) => list.some((t) => sameSign(t.signature, sign)));
    return hit ? hit[0] : null;
  },
  issueTicket: (device, signature) =>
    tx((db) => {
      const { yymmdd, date } = seoulDay();
      const seq = (db.days[SEQ_KEY] || 0) + 1;
      db.days[SEQ_KEY] = seq;
      const no = ticketNo(yymmdd, seq);
      db.tickets.push(no);
      db.byDev ??= {};
      db.byDev[device] = [...(db.byDev[device] || []), { no, seq, day: yymmdd, signature, todayCookies: todayCookies(device) }];
      return { no, seq, date };
    }),
  setTicketSign: (no, signature) =>
    tx((db) => {
      for (const list of Object.values(db.byDev || {})) for (const t of list) if (t.no === no) t.signature = signature;
    }),
  stats: async () => {
    const db = await load();
    const { yymmdd } = seoulDay();
    const all = Object.values(db.byDev || {}).flat();
    return {
      total: db.days[SEQ_KEY] || 0,
      today: all.filter((t) => t.day === yymmdd).length,
      works: db.works.length - SEED_WORKS.filter((s) => db.works.some((w) => Number(w.ticket) === s.ticket)).length,
    };
  },
  ticketInfo: async (no) => {
    const db = await load();
    for (const [device, list] of Object.entries(db.byDev || {})) {
      const t = list.find((x) => x.no === no);
      if (t) return { no, device, signature: t.signature || "" };
    }
    return db.tickets.includes(no) ? { no, device: null, signature: "" } : null;
  },
  hit: (key, limit, windowSec) =>
    tx((db) => {
      const now = Date.now();
      const u = db.usage[key];
      if (!u || u.reset < now) db.usage[key] = { n: 0, reset: now + windowSec * 1000 };
      if (db.usage[key].n >= limit) return false;
      db.usage[key].n += 1;
      return true;
    }),
  listWorks: async ({ limit = 60 } = {}) => [...(await load()).works].sort(byNewest).slice(0, limit).map(toWork),
  worksByTicket: async (no) => (await load()).works.filter((w) => Number(w.ticket) === Number(no)).map(toWork),
  worksBySign: async (sign) => [...(await load()).works].filter((w) => sameSign(w.signature, sign)).sort(byNewest).slice(0, 30).map(toWork),
  getWork: async (key) => {
    const w = (await load()).works.find((x) => Number(x.ticket) === Number(key));
    return w ? toWork(w) : null;
  },
  countWorks: async (ticket) => (await load()).works.filter((w) => Number(w.ticket) === Number(ticket)).length,
  insertWork: (row) =>
    tx((db) => {
      if (db.works.some((w) => Number(w.ticket) === Number(row.ticket))) return { duplicate: true };
      const w = { likes: 0, ...row, ticket: Number(row.ticket), id: Math.max(0, ...db.works.map((x) => x.id)) + 1, created_at: new Date().toISOString() };
      db.works.push(w);
      return toWork(w);
    }),
  like: (id, device, on) =>
    tx((db) => {
      const w = db.works.find((x) => String(x.id) === String(id));
      if (!w) return null;
      db.likedBy ??= {};
      const k = `${id}:${device}`;
      // Supabase 쪽 set_like 와 같다. 이미 공감한 기기가 또 누르면 수가 그대로다
      if (on === !!db.likedBy[k]) return w.likes || 0;
      if (on) db.likedBy[k] = true;
      else delete db.likedBy[k];
      w.likes = Math.max(0, (w.likes || 0) + (on ? 1 : -1));
      return w.likes;
    }),
  remove: (id) =>
    tx((db) => {
      const gone = db.works.find((w) => String(w.id) === String(id));
      db.works = db.works.filter((w) => w !== gone);
      return gone ? { source: gone.source, collage: gone.collage } : null;
    }),
};

const impl = () => (supabase() ? supa : file);

/**
 * TodayCookies = 오늘 날짜(YYMMDD, 한국 시간) + 기기 쿠키. 작품 번호를 매길 때 tickets.today_cookies 에 함께 적는다.
 * 같은 값이 WORKS_PER_DAY(3)개 이상이면 오늘은 더 만들 수 없다. 아이디(서명)를 바꿔 가며 같은 폰에서 더 만드는 것도 같은 값이라 막힌다
 */
export const todayCookies = (device) => `${seoulDay().yymmdd}:${device}`;
/** 같은 TodayCookies 로 오늘 받은 작품 번호들과 새 번호 발급. 하루 기회 수(WORKS_PER_DAY)는 /api/tickets, /api/sign 이 센다 */
export const devToday = (device) => impl().devToday(device);
export const issueTicket = (device, signature) => impl().issueTicket(device, signature);
export const setTicketSign = (no, signature) => impl().setTicketSign(no, signature);
/** 그 아이디의 주인 기기. 시드 서명이면 "seed" (관객이 가져갈 수 없다) */
export const signOwner = async (sign) => (SEED_SIGNS.some((x) => sameSign(x, sign)) ? "seed" : impl().signOwner(sign));
/** 운영자 화면용: 누적 작품 번호 · 오늘 매긴 번호 · 관객이 남긴 작품 수 */
export const stats = () => impl().stats();
/** 번호의 주인 기기와 아이디. 없는 번호면 null */
export const ticketInfo = (no) => impl().ticketInfo(no);
export const hit = (key, limit, windowSec) => impl().hit(key, limit, windowSec);
export const listWorks = (o) => impl().listWorks(o);
export const worksByTicket = (no) => impl().worksByTicket(no);
export const worksBySign = (sign) => impl().worksBySign(sign);
export const getWork = (key) => impl().getWork(key);
export const countWorks = (ticket) => impl().countWorks(ticket);
export const insertWork = (row) => impl().insertWork(row);
/** 한 기기는 한 작품에 공감 하나. on 이 지금 상태와 같으면 아무것도 바뀌지 않는다 */
export const likeWork = (id, device, on) => impl().like(id, device, on);
export const removeItem = (id) => impl().remove(id);
