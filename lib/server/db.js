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

const pad = (n) => String(n).padStart(2, "0");

/** 전시는 서울에서 열린다. 서버가 어느 나라에 있든 날짜는 한국 시간으로 센다 */
export function seoulDay(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { mmdd: p.month + p.day, date: `${p.year}.${p.month}.${p.day}` };
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

const supa = {
  async ticketFor(device) {
    const { mmdd, date } = seoulDay();
    const { data: had } = await supabase().from("tickets").select("no,seq").eq("device_id", device).eq("day", mmdd).maybeSingle();
    if (had) return { no: had.no, seq: had.seq, date, existing: true };
    const { data: seq, error } = await supabase().rpc("next_ticket", { p_day: mmdd });
    if (error) throw error;
    const no = mmdd + pad(seq);
    const { error: e2 } = await supabase().from("tickets").insert({ no, day: mmdd, seq, device_id: device });
    // 같은 폰에서 동시에 두 번 눌렀다면 (device_id, day) 고유 제약에 걸린다. 먼저 받은 티켓을 돌려준다
    if (e2) {
      const { data: again } = await supabase().from("tickets").select("no,seq").eq("device_id", device).eq("day", mmdd).maybeSingle();
      if (again) return { no: again.no, seq: again.seq, date, existing: true };
      throw e2;
    }
    return { no, seq, date, existing: false };
  },
  async ticketExists(no) {
    const { data } = await supabase().from("tickets").select("no").eq("no", no).maybeSingle();
    return !!data;
  },
  async ticketDevice(no) {
    const { data } = await supabase().from("tickets").select("device_id").eq("no", no).maybeSingle();
    return data?.device_id || null;
  },
  async hit(key, limit, windowSec) {
    const { data, error } = await supabase().rpc("hit_usage", { p_key: key, p_limit: limit, p_window: windowSec });
    if (error) throw error;
    return !!data;
  },
  async listWorks({ limit = 60 } = {}) {
    const { data, error } = await supabase().from(TABLE).select(COLS).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
    if (error) throw error;
    return data.map(toWork);
  },
  async worksByTicket(no) {
    const { data, error } = await supabase().from(TABLE).select(COLS).eq("ticket", Number(no));
    if (error) throw error;
    return data.map(toWork);
  },
  async getWork(key) {
    const { data } = await supabase().from(TABLE).select(COLS).eq("ticket", Number(key)).maybeSingle();
    return data ? toWork(data) : null;
  },
  async countWorks(ticket) {
    const { count } = await supabase().from(TABLE).select("id", { count: "exact", head: true }).eq("ticket", Number(ticket));
    return count || 0;
  },
  // ticket 은 표에서 고유하다. 동시에 두 번 눌러도 두 번째는 23505 로 막혀 { duplicate } 가 된다
  async insertWork(row) {
    const { data, error } = await supabase().from(TABLE).insert({ ...row, ticket: Number(row.ticket) }).select(COLS).single();
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
      if (cache.works.some((x) => String(x.ticket) === String(w.ticket))) continue;
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
  ticketFor: (device) =>
    tx((db) => {
      const { mmdd, date } = seoulDay();
      db.byDevice ??= {};
      const had = db.byDevice[`${device}:${mmdd}`];
      if (had) return { ...had, date, existing: true };
      const seq = (db.days[mmdd] || 0) + 1;
      db.days[mmdd] = seq;
      const no = mmdd + pad(seq);
      db.tickets.push(no);
      db.byDevice[`${device}:${mmdd}`] = { no, seq };
      return { no, seq, date, existing: false };
    }),
  ticketExists: async (no) => (await load()).tickets.includes(no),
  ticketDevice: async (no) => {
    const hit = Object.entries((await load()).byDevice || {}).find(([, t]) => t.no === no);
    return hit ? hit[0].split(":")[0] : null;
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
  worksByTicket: async (no) => (await load()).works.filter((w) => String(w.ticket) === String(no)).map(toWork),
  getWork: async (key) => {
    const w = (await load()).works.find((x) => String(x.ticket) === String(key));
    return w ? toWork(w) : null;
  },
  countWorks: async (ticket) => (await load()).works.filter((w) => String(w.ticket) === String(ticket)).length,
  insertWork: (row) =>
    tx((db) => {
      if (db.works.some((w) => String(w.ticket) === String(row.ticket))) return { duplicate: true };
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

/** 한 사람(기기)에게 하루 한 장의 티켓. 이미 받았으면 그 티켓을 다시 돌려준다 */
export const ticketFor = (device) => impl().ticketFor(device);
export const ticketExists = (no) => impl().ticketExists(no);
export const ticketDevice = (no) => impl().ticketDevice(no);
export const hit = (key, limit, windowSec) => impl().hit(key, limit, windowSec);
export const listWorks = (o) => impl().listWorks(o);
export const worksByTicket = (no) => impl().worksByTicket(no);
export const getWork = (key) => impl().getWork(key);
export const countWorks = (ticket) => impl().countWorks(ticket);
export const insertWork = (row) => impl().insertWork(row);
/** 한 기기는 한 작품에 공감 하나. on 이 지금 상태와 같으면 아무것도 바뀌지 않는다 */
export const likeWork = (id, device, on) => impl().like(id, device, on);
export const removeItem = (id) => impl().remove(id);
