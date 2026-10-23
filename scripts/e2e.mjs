// 1장부터 8장까지 폰 크기 화면으로 끝까지 지나 보고, 다른 "폰"(새 브라우저)에서 공유 링크가 열리는지 본다.
//   npm run dev   (다른 터미널)
//   npm run test:e2e
// 스크린숏은 .data/e2e/ 에 남는다.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = ".data/e2e";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const errors = [];
const watch = (p) => {
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
};
// 서명은 아이디라 처음 쓴 폰의 것이 된다. 돌릴 때마다 새 아이디를 쓴다(시드 서명 "새벽" 같은 이름은 가져갈 수 없다)
const ID = `새벽${String(Date.now()).slice(-5)}`;
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

const a = await browser.newContext(phone);
const p = await a.newPage();
watch(p);
await p.goto(BASE);
await p.getByText("창작 에디션 서명 티켓 받기").click();
// 티켓 번호 칸에는 오늘 날짜(YYMMDD)
await p.locator(".lv-tk-no").filter({ hasText: /^\d{6}$/ }).waitFor({ timeout: 8000 });
// 오늘의 창작자 이름 = 아이디. 시드 서명은 가져갈 수 없다
await p.locator("#lv-sign").fill("새벽");
await p.getByText("다락방으로 들어가기").click();
await p.locator(".lv-who-hint.is-err").filter({ hasText: /다른 분이 쓰고/ }).waitFor({ timeout: 8000 });
await p.locator("#lv-sign").fill(ID);
await shot(p, "1-ticket-name");
await p.getByText("다락방으로 들어가기").click();
await p.getByText("모두 동의").waitFor({ timeout: 8000 });
await shot(p, "2-consent");
await p.getByText("모두 동의").click();
await p.getByText("다음 장 →").click();
await p.locator(".lv-emo").first().click();
await p.getByText("다음 장 →").click();
await p.locator(".lv-card").first().click();
await p.getByText("이 시선으로 계속하기").click();
await p.setInputFiles("input[type=file]", "public/artists/lia/cover.jpg");
await p.locator(".lv-pola img").first().waitFor();
await p.locator(".lv-notetag").click();
await p.waitForFunction(() => document.querySelector("textarea.lv-ans")?.value.length > 10, null, { timeout: 20000 });
const story = await p.locator("textarea.lv-ans").inputValue();
await p.locator("textarea.lv-ans").press("Control+End");
await p.keyboard.type("  그날  끝내 이름을 부르지 못했다 .");
await shot(p, "6-answer");
await p.getByText("감각 엮기 →").click();
// 엮으면 작품 번호가 매겨지고 바로 결과 장. 편지는 1장에서 적은 이름 앞으로 온다
await p.locator(".lv-result").waitFor({ timeout: 30000 });
await p.locator(".lv-dp-to").filter({ hasText: ID }).waitFor({ timeout: 5000 });
await p.locator(".lv-res-more").filter({ hasText: /오늘 2장 더/ }).waitFor({ timeout: 5000 });
await shot(p, "7-result");
await p.getByText("취향의 서가에 꽂기").click();
await p.locator(".lv-mine-no").waitFor({ timeout: 15000 });
const key = (await p.locator(".lv-mine-no").innerText()).replace("No. ", "").trim();
await shot(p, "8-shelf");

// 티켓 건네기: 링크 칸이 펼쳐지고 복사 안내가 뜬다
await p.locator(".lv-mine .lv-like").filter({ hasText: "작품 펼치기" }).click();
await p.locator(".lv-modal-body .lv-inv .lv-ticket").waitFor({ timeout: 5000 });
await p.locator(".lv-modal-body .lv-inv-btn").click();
await p.locator(".lv-modal-body .lv-inv .lv-toast").filter({ hasText: /복사/ }).waitFor({ timeout: 5000 });
await p.keyboard.press("Escape");
await shot(p, "8-invite");

// 같은 폰으로 다시 들어오면: 전에 쓴 이름이 미리 적혀 있다(하루 기회 안내는 결과 장 끝에서만)
await p.goto(BASE);
await p.getByText("창작 에디션 서명 티켓 받기").click();
await p.waitForFunction((id) => document.querySelector("#lv-sign")?.value === id, ID, { timeout: 8000 });
await shot(p, "1-today-done");

// 다른 폰에서 공유 링크를 연다
const b = await browser.newContext(phone);
const q = await b.newPage();
watch(q);
await q.goto(`${BASE}/?work=${key}`);
await q.locator(".lv-modal-body").waitFor({ timeout: 15000 });
// 공감을 누르면 수가 하나 오르고, 서버(표의 likes 칸)에도 남는다
const like = q.locator(".lv-modal-body .lv-like").first();
const before = Number((await like.innerText()).replace(/\D/g, "") || 0);
await like.click();
await q.waitForTimeout(800);
const saved = (await (await q.request.get(`${BASE}/api/works/${key}`)).json()).work;
if (saved.likes !== before + 1) errors.push(`공감이 저장되지 않음: ${before} → ${saved.likes}`);
await q.keyboard.press("Escape");
await shot(q, "share-other-phone");

// 다른 폰은 같은 아이디로 서명할 수 없다
await q.request.post(`${BASE}/api/tickets`);
const taken = await q.request.post(`${BASE}/api/sign`, { data: { signature: ID } });
if (taken.status() !== 409) errors.push(`다른 폰의 같은 아이디가 막히지 않음: ${taken.status()}`);

// 첫 화면 "이미 남긴 기록이 있나요?"에서 서명으로 작품을 찾는다(다른 폰에서도)
await q.goto(BASE);
await q.getByText("이미 남긴 기록이 있나요?").click();
await q.getByLabel("서명").fill(ID.toLowerCase());
await q.keyboard.press("Enter");
await q.locator(".lv-reveal .lv-meta").filter({ hasText: key }).waitFor({ timeout: 8000 });
await shot(q, "1-find-by-sign");

console.log(JSON.stringify({ story: story.slice(0, 40), key, likes: saved.likes, source: saved.source.length, errors }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
