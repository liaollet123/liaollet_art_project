// 라우트들이 함께 쓰는 작은 도구: 요청 읽기, 응답, 그리고 비용이 새지 않게 막는 계수기
import "server-only";
import { NextResponse } from "next/server";
import { hit, ticketInfo } from "./db";
import { readDevice } from "./device";

export const json = (data, status = 200) => NextResponse.json(data, { status });

export async function body(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function clientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

const DAY = 24 * 60 * 60;
const TEN_MIN = 10 * 60;

/**
 * 한도는 기기(서명된 쿠키) 기준으로 하루 단위로 센다. 전시장 와이파이에서는 모든 관객이 같은 IP로 보이므로
 * IP 한도는 누군가 API를 두드리는 것만 막을 만큼 넉넉하게 둔다.
 *   WORKS_PER_DAY       한 사람이 하루에 남길 수 있는 작품 (기본 3). 아이디(서명)와 기기 양쪽으로 센다
 *   ANALYZE_PER_TICKET  작품 한 장당 이야기 받기 (기본 4). 하루 한도는 이 수 x WORKS_PER_DAY
 *   COMPOSE_PER_TICKET  작품 한 장당 감각 엮기   (기본 4, 저장 전 다시 엮기 포함)
 *   IP_PER_10MIN        한 IP 전체               (기본 600)
 */
const PER_DAY = Number(process.env.WORKS_PER_DAY || process.env.TICKETS_PER_DEVICE || 3);
export const LIMITS = {
  analyze: Number(process.env.ANALYZE_PER_TICKET || 4) * PER_DAY,
  compose: Number(process.env.COMPOSE_PER_TICKET || 4) * PER_DAY,
  ip: Number(process.env.IP_PER_10MIN || 600),
  // 한 사람에게 하루 기회 세 번. 기회 하나 = 서명 하나 = 작품 번호 하나 = 작품 한 장
  worksPerDay: PER_DAY,
  worksPerTicket: 1, // 표의 ticket 칸이 고유라서 한 장으로 고정이다
};

/** 1장에서 쿠키를 받은 폰인지, 한도 안인지 확인한다(이야기 받기·엮기). 문제가 없으면 null, 있으면 돌려줄 응답 */
export async function guard(req, kind) {
  const dev = readDevice(req);
  if (!dev) return json({ error: "처음 화면에서 다시 들어와 주세요" }, 401);
  if (!(await hit(`ip:${clientIp(req)}`, LIMITS.ip, TEN_MIN))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  if (kind && !(await hit(`${kind}:${dev}`, LIMITS[kind], DAY))) return json({ error: "limit", limited: true }, 429);
  return null;
}

/** 서가에 꽂을 때: 서명해서 받은 작품 번호인지, 이 폰의 번호인지. 통과하면 { info }, 아니면 { res } */
export async function guardTicket(req, ticket) {
  const no = String(ticket || "");
  const info = /^\d{6,12}$/.test(no) ? await ticketInfo(no) : null;
  if (!info) return { res: json({ error: "서명을 다시 해 주세요" }, 401) };
  // 번호는 받은 폰에서만 쓸 수 있다. 남의 번호를 넣어 한 장을 더 만드는 것을 막는다
  if (info.device && info.device !== readDevice(req)) return { res: json({ error: "이 폰에서 받은 번호가 아니에요" }, 403) };
  if (!(await hit(`ip:${clientIp(req)}`, LIMITS.ip, TEN_MIN))) return { res: json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429) };
  return { info };
}

export const ipLimit = (req, kind, limit) => hit(`${kind}:${clientIp(req)}`, limit, TEN_MIN);
