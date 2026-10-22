# 감정의 다락방 — LIAOLLET

QR로 입장한 관객이 오늘의 마음을 한 장 기록하고, 세 예술가의 감각을 빌려 콜라주 작품으로
남기는 참여형 전시 웹앱. 전시장에서 폰으로 쓴다.

---

## 지켜야 할 규칙

- **TypeScript를 쓰지 않는다.** 코드는 `.js` / `.jsx`, 설정은 `jsconfig.json`. `tsconfig`나 `.ts` 파일을 만들지 않는다.
- **Tailwind를 쓰지 않는다.** 모든 스타일은 `app/globals.css` 한 파일의 순수 CSS.
- **이모지를 쓰지 않는다.** 화면 문구, 코드 주석, 커밋 메시지 어디에도.
- 폰트는 외부 요청 없이 `@fontsource`로 프로젝트에 포함한다. 전시장 와이파이가 느려도 글꼴이 깨지지 않아야 한다.
- 주석은 한국어로, "무엇을"이 아니라 "왜"를 적는다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

---

## 지금 상태 (V3)

8장 흐름이 끝까지 동작하고, 기록은 서버에 모인다(다른 폰에서도 같은 서가, 공유 링크가 열린다).
LLM 흐름은 **LangGraph** 그래프, 프롬프트와 출력 검사는 **LangChain**(PromptTemplate + zod)으로 짠다.
키가 없거나 LLM이 실패하면 그래프의 대체 노드가 키워드 방식으로 결과를 채운다. 전시는 멈추지 않는다.

| 장 | 이름 | 내용 (화면 파일) |
| --- | --- | --- |
| 1 | 입장 | 다이어리 → 서버가 매긴 티켓 → ADMITTED 도장. 오늘 이미 남겼으면 "오늘의 한 장"과 링크 보내기. 번호로 작품 찾기 (`components/Entrance.jsx`) |
| 2 | 입장 동의서 | AI 서비스로 전송되는 것까지 적은 3개 동의 (`attic/Consent.jsx`) |
| 3 | 오늘의 마음 | 감정 12개(잉크 번짐) 또는 직접 쓰기 (`attic/Emotions.jsx`) |
| 4·5 | 시선 고르기·상세 | LIA / OL / LET (`attic/Artists.jsx`) |
| 6 | 답하기 | 마음 + 마음별 사진 질문 → 사진(최대 3장, 1600px로 줄임) → "다 올렸어요" 꼬리표를 누르면 `/api/analyze` → 오늘의 이야기 한 칸 → 태그 고르기 (`attic/Answer.jsx`) |
| 7 | 결과 | `/api/compose` → 시선별 콜라주(또는 AI 이미지), 다락방이 보내는 편지 한 장(To. → 제목 → 오늘의 이야기 → 본문 한 문장 → 낱말·마음·시선·날짜), 링크 보내기 (`attic/Result.jsx`) |
| 8 | 취향의 서가 | 서버 서가, 공감(표의 `likes`), 작품 상세, 티켓 건네기(입장 티켓 이미지 + 링크 복사) (`attic/Shelf.jsx`, `attic/WorkModal.jsx`) |

### LLM — LangGraph + LangChain (`lib/server/`)

```
readGraph     START → llm ─┬→ tidy ─────→ END
                           └→ fallback ─→ END
composeGraph  START → llm ─┬→ tidy ─────┐
                           └→ fallback ─┴→ proof → moderate → imagePrompt ─┬→ render → END
                                                                         └──────────→ END
```
- `models.js` 모델 호출. Gemini만 쓴다. LangChain `ChatGoogleGenerativeAI.withStructuredOutput(zod)`
- `prompts.js` LangChain `PromptTemplate` + zod 스키마(`ReadSchema`, `ComposeSchema`). 말투·지시는 여기서 고친다
- `graphs.js` 노드: `proof`는 맞춤법 교정이 원문과 85% 미만으로 같으면 원문을 쓴다, `moderate`는 낱말 검사 + LLM 판정으로 서가 공개 여부
- `imagegen.js` `IMAGE_PROVIDER=gemini`면 시선의 화풍으로 이미지를 새로 그린다(기본 off, 실패하면 캔버스 콜라주)
- 비용 장치: 티켓당 이야기 4회·엮기 4회·저장 1장, IP 10분 600회(전시장 와이파이는 모두 같은 IP), 타임아웃, 사진은 512px 썸네일 두 장까지

### 한 사람 하루 한 장 (`lib/server/device.js`)

- 처음 들어온 폰에 서명된 쿠키(기기 ID, `DEVICE_SECRET`)를 심는다. 로그인 없는 익명 전시라 시크릿 창·쿠키 삭제로는 피할 수 있다
- 티켓은 기기 하나에 하루 한 장(`tickets` 의 `(device_id, day)` 고유). 같은 폰이 다시 받으면 같은 티켓을 돌려준다
- 티켓 한 장에 작품 한 장(표의 `ticket` 칸이 고유라 동시 저장도 DB가 막는다). 티켓은 받은 폰에서만 쓸 수 있다
- 오늘 이미 남겼으면 1장에서 "오늘의 한 장"과 "내 작품 링크 보내기"(폰 공유 창, 없으면 복사)를 띄운다

### 세 시선의 화풍 (`lib/styles.js`)

"무엇을 그릴지"(관객의 마음, LLM이 읽은 장면 `scene`·`motifs`, 관계 문장)와
"어떻게 그릴지"(시선마다 고정된 색·질감·구도·빛)를 프롬프트에서 칸을 나눠 적는다. 다른 두 시선의 특징은 negative로 막는다.

| 시선 | 핵심 | 캔버스 콜라주(`lib/collage.js`) |
| --- | --- | --- |
| LIA | sepia, white negative space, translucent vellum, soft, clean white paper | 새하얀 종이, 세피아 사진을 작게 한쪽으로, 가장자리를 녹이는 부드러움, 흰 종이 두 장, 벨럼 두 장, 마스킹 테이프 |
| OL | monotone, grain, pencil lines, conte strokes, torn paper | 회색 드로잉 종이, 흑백 사진을 찢어 붙임(흰 섬유 가장자리, 뜯긴 모서리), 연필 구성선과 빗금, 콘테 획, 흑연 얼룩, 거친 그레인 |
| LET | vivid color, overlapping photos, lively, bright and punchy | 밝은 바탕, 쨍한 색면 다섯 장(곱하기 합성), 같은 사진도 다른 부분을 확대해 네 겹으로 겹침, 색 그림자, 망점, 햇빛 번짐, 색 테이프 |

### 저장소 (`lib/server/db.js`) — 표 하나 `liaollet`

| 칸 | 내용 |
| --- | --- |
| `id` | 추가된 순서 (고유키) |
| `ticket` | p.01 창작 에디션 티켓 번호 (고유. 티켓 하나에 작품 한 장) |
| `artist` | p.04 LIA / OL / LET |
| `source` | p.06 올린 사진들의 Cloudinary 주소 |
| `collage` | p.07 콜라주의 Cloudinary 주소 |
| `story` | p.06 오늘의 이야기 |
| `tags` | p.06 활성화된 태그 |
| `signature` | p.07 서명 |
| `likes` | p.08 공감 수 (`set_like` 함수로 올리고 내린다. 누가 눌렀는지는 `work_likes` 표에 (작품, 기기) 한 줄씩. 한 기기에 한 작품 공감 하나) |
| `created_at` | 만든 시간 |

- 사진과 콜라주는 서버가 Cloudinary에 올리고(`lib/server/cloud.js`, 서명 업로드) 표에는 주소만 남긴다
- 화면이 쓰는 `key`(=티켓 번호), `emotion`(태그 중 감정 이름), `title`(이야기의 첫 마디), `date`는 `toWork()`가 표의 칸에서 만든다
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`가 있으면 Supabase. `supabase/schema.sql`을 SQL Editor에서 한 번 실행
- 없으면 `.data/attic.json` 파일(내 컴퓨터 개발용). Cloudinary 키가 없으면 이미지도 그 파일에 data URL로 들어간다
- 티켓 번호: 서버가 매긴다. `MMDD`(한국 시간) + 그날 전시 전체의 순번(예: `102201`). 공유 링크는 `/?work=102201`
- 거르기에 걸린 작품은 저장하지 않는다(본인 화면에만 보인다). 한마디와 숨기기는 없앴다
- 운영자 화면 `/admin` (`ADMIN_TOKEN`) — 작품 보기와 삭제(되돌릴 수 없다. 표의 줄과 Cloudinary 이미지가 함께 지워진다)

### 다락방 아이콘

`public/attic/liaollet-icon.svg`(정지), `liaollet-icon-anim.svg`(로딩), `app/icon.svg`(파비콘). 로딩은 `components/Loader.jsx`.

### 확인

```bash
npm run dev            # 한 터미널
npm run test:e2e       # 다른 터미널. 1~8장 + 티켓 건네기 + 다른 폰에서 공유 링크·공감. 스크린숏은 .data/e2e/
```

---

## 시선별 사진 (`public/artists/`)

`public/artists/lia`, `ol`, `let` 폴더에 사진을 넣으면 시선 고르기·상세 화면이 그 사진을 쓴다.
`cover.jpg`(또는 png, webp)가 있으면 그것이 대표, 없으면 이름순 첫 장. 나머지는 상세 화면의 갤러리.
폴더가 비어 있으면 기본 사진(`public/attic/p-*.jpg`). 목록은 `npm run dev`/`build` 직전에
`scripts/assets.mjs`가 `lib/artist-photos.js`로 만든다. 사진을 넣은 뒤에는 서버를 다시 켠다.

## 콜라주 재료 텍스처 (`public/textures/`)

`public/textures/lia`, `ol`, `let`에 실제 재료 스캔을 넣으면 캔버스 콜라주가 그것을 쓴다. 없는 재료는 코드가 도형으로 대신 그린다.
파일 이름 앞부분이 역할이고(`conte-2.png`는 conte의 두 번째 변형), 같은 역할이 여러 장이면 작품마다 골라 쓴다.
목록은 `scripts/assets.mjs`가 `lib/textures.js`로 만든다. 역할 목록과 형식은 `public/textures/README.txt`.

| 시선 | 역할 |
| --- | --- |
| LIA | `paper`(바탕), `sheet`(흰 종이 조각), `vellum`(반투명 종이), `tape`, `light`(빛 번짐) |
| OL | `paper`(드로잉 종이), `torn`(찢긴 종이 조각, 사진 뒤), `conte`(획), `pencil`(선·빗금), `smudge`(흑연 얼룩), `grain`(타일) |
| LET | `paper`(밝은 종이), `block`(색면), `halftone`(망점), `tape`(색 테이프), `flare`(햇빛 번짐) |

---

## 파일 지도

```
app/
  api/analyze|compose     LangGraph 그래프를 부른다
  api/tickets|works|works/[key]|admin   저장소
  admin/page.js           운영자 화면
  globals.css             전체 스타일
components/
  Attic.jsx               장 넘기기와 서버 호출(상태 머신)
  attic/*.jsx             장별 화면
  Entrance.jsx, Loader.jsx
lib/
  attic.js     ARTISTS, EMOTIONS, 해시태그 사전, photoAsk, 조사 처리
  styles.js    세 시선의 화풍과 이미지 프롬프트
  fallback.js  LLM 없을 때의 결과(서버·브라우저 공용)
  collage.js   캔버스 콜라주(시선별 보정, 재료 텍스처), 사진 줄이기, 썸네일
  textures.js  재료 목록(자동 생성)
  share.js     링크 복사(보안 주소가 아니어도 되게)
  store.js     브라우저 → 서버 API 창구
  seed.js      시드 작품 열두 장(이전 화풍 6 + 지금 화풍 6)
  server/      db, cloud, models, prompts, graphs, imagegen, moderate, http (서버 전용)
supabase/schema.sql
scripts/assets.mjs   시선 사진·재료 목록 만들기
scripts/e2e.mjs
```

---

## 디자인 결정 (되돌리지 말 것)

작업하며 합의된 것들. 이유가 있어서 이렇게 되어 있다.

1. **1장에 문(door)을 두지 않는다.** 문 열리는 3D 모션은 촌스러워서 걷어냈다.
   다락방 배경 + 펼쳐진 다이어리만 둔다.
2. **모션은 느리고 잔잔하게.** 페이드와 10~25px 남짓 떠오르는 움직임만.
   되돌아오거나 튕기는(overshoot) 움직임을 쓰지 않는다.
   타이밍 함수는 `cubic-bezier(0.16, 1, 0.3, 1)`, 길이는 2.4~3초.
   예외는 입장 도장 하나 — 눌리는 힘이 있어야 해서 1.35초에 걸쳐 내려온다.
3. **티켓은 실제 빈티지 티켓 사진을 쓴다.** `ticket-blank.png`는 참고 이미지에서
   인쇄된 획만 지운 것. 뜯긴 가장자리·접힌 자국·종이 결이 진짜다.
   테두리와 글자는 그 위에 CSS로 얹는다 (`.ticket-ink`, 위치는 원본 티켓 비율에 맞춰 고정).
   글자 크기는 `cqw` 단위라 티켓 폭을 바꾸면 전부 따라온다.
4. **티켓 문구는 영문.** `ADMIT ONE / TICKET TO YOUR FEELING / LIAOLLET CREATIVE EDITION`.
   번호보다 "무엇을 위한 자리인지"가 먼저 읽혀야 한다.
5. **LIAOLLET을 제목 맨 위에.** 자간을 넓게 벌려 브랜드로 읽히게.
6. **감정을 먼저 묻고 그다음에 아티스트를 고른다.** 순서를 바꾸지 않는다.
   제목이 감정의 다락방인데 관객이 감정을 말하는 자리가 없던 것이 가장 큰 결함이었다.
7. **아티스트 선택은 질문 선택이다.** 리아 "무엇을 남겨두고 싶나요", 올 "어디가 찢어졌나요",
   렛 "어떤 순간들이 겹쳐 있나요". 고르기 전에 차이가 느껴져야 하고,
   빈 칸 앞에서 멈추는 문제도 이걸로 풀린다.
8. **말투(페르소나 보이스)는 설계하지 않는다.** 아티스트별로 달라지는 건 콜라주의 색과 질감.
9. **콜라주는 위아래로 나눈다.** 위는 시선의 그림(글씨 없음), 아래는 밝은 종이 띠(`BAND_Y`) 위에
   제목·글귀·태그·`LIAOLLET × 시선`·감정·티켓번호·날짜. 글이 그림에 겹치면 안 된다.
   그림 자체(캔버스 그림, AI 이미지)에는 글씨를 넣지 않는다. 글씨는 띠에만.
10. **한글 줄바꿈은 `word-break: keep-all`.** 단어 중간에서 끊기지 않게.
11. 조사는 `withParticle()`로 붙인다. 관객이 감정을 직접 써도 "과/와"가 맞아야 한다.

---

## 다음 할 일

1. API 키를 넣고 Gemini를 실제로 돌려 본다(지금까지는 대체 경로만 실제로 확인했다). 실제 관람객 글 10~20개로 모델(`GEMINI_MODEL`)을 고른다
2. Supabase 프로젝트를 만들고 `supabase/schema.sql` 실행 → 환경변수 → Vercel 배포 → 폰 여러 대로 동시 테스트
3. `IMAGE_PROVIDER=gemini`를 켤지 정한다(장당 비용과 대기 시간 확인). 끄면 캔버스 콜라주
4. 실제 재료 텍스처를 `public/textures/`에 넣고 세 시선의 배치와 강도를 다시 맞춘다
5. 전시 전날 Supabase 대시보드를 한 번 열어 둔다(무료 플랜은 7일 미사용 시 일시정지)

## 알려진 문제

- 운영자가 작품을 삭제하면 그 티켓의 "오늘의 한 장"도 비어서, 같은 폰에서 그날 다시 만들 수 있다
- 이미지 생성(`imagegen.js`)의 `imageConfig.aspectRatio` 등은 실제 키로 확인하지 않았다
- 낱말 검사(`moderate.js`)는 기본 목록뿐이다. 전시 중 `/admin`으로 보완한다
- `/portfolio`, `/artwork/[slug]`, `/about`의 사진이 Unsplash 링크다
