// 라우트들이 함께 쓰는 작은 도구: 요청 읽기, 응답, 그리고 비용이 새지 않게 막는 계수기
import "server-only";
import { NextResponse } from "next/server";
import { hit, ticketDevice, ticketExists } from "./db";
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
 * 한도는 티켓 기준으로 센다. 전시장 와이파이에서는 모든 관객이 같은 IP로 보이므로
 * IP 한도는 누군가 API를 두드리는 것만 막을 만큼 넉넉하게 둔다.
 *   ANALYZE_PER_TICKET  이야기 받기     (기본 4)
 *   COMPOSE_PER_TICKET  감각 엮기       (기본 4, 저장 전 다시 엮기 포함)
 *   IP_PER_10MIN        한 IP 전체      (기본 600)
 */
export const LIMITS = {
  analyze: Number(process.env.ANALYZE_PER_TICKET || 4),
  compose: Number(process.env.COMPOSE_PER_TICKET || 4),
  ip: Number(process.env.IP_PER_10MIN || 600),
  // 한 사람(기기)은 하루 한 장의 티켓, 티켓 한 장에 작품 한 장
  worksPerTicket: 1, // 표의 ticket 칸이 고유라서 한 장으로 고정이다
};

/** 발급된 티켓인지, 한도 안인지 확인한다. 문제가 없으면 null, 있으면 돌려줄 응답 */
export async function guard(req, ticket, kind) {
  const no = String(ticket || "");
  if (!/^\d{6,8}$/.test(no) || !(await ticketExists(no))) return json({ error: "티켓을 다시 받아 주세요" }, 401);
  // 티켓은 받은 폰에서만 쓸 수 있다. 남의 티켓 번호를 넣어 한 장을 더 만드는 것을 막는다
  const owner = await ticketDevice(no);
  if (owner && owner !== readDevice(req)) return json({ error: "이 폰에서 받은 티켓이 아니에요" }, 403);
  if (!(await hit(`ip:${clientIp(req)}`, LIMITS.ip, TEN_MIN))) return json({ error: "잠시 뒤에 다시 시도해 주세요" }, 429);
  if (kind && !(await hit(`${kind}:${no}`, LIMITS[kind], DAY))) return json({ error: "limit", limited: true }, 429);
  return null;
}

export const ipLimit = (req, kind, limit) => hit(`${kind}:${clientIp(req)}`, limit, TEN_MIN);
