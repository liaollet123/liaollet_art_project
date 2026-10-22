# LIAOLLET — 감정의 다락방 (Next.js / JavaScript)

> 작업을 이어받는다면 **[CLAUDE.md](./CLAUDE.md)를 먼저 읽으세요.** 지금 상태, 디자인 결정,
> 다음 할 일이 모두 거기 있습니다. Claude Code는 이 파일을 자동으로 읽습니다.

Next.js(App Router) + JavaScript + 순수 CSS로 만든 버전입니다. TypeScript와 Tailwind는 사용하지 않습니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # 배포용
```

## 페이지

| 경로 | 내용 |
| --- | --- |
| `/` | 감정의 다락방 — 6장 다이어리 흐름 (표지 → 동의서 → 아티스트 선택 → 소스 수집 → 콜라주 → 취향의 서가) |
| `/portfolio` | 패럴랙스 히어로 + 작품 그리드 (원본 Index) |
| `/artwork/[slug]` | 작품 상세 + 문의 폼 (25개 작품 정적 생성) |
| `/about` | 작가 소개 |

## 폴더 구조

```
app/
  layout.js            HTML 뼈대, 폰트, 메타데이터
  globals.css          모든 스타일 (디자인 토큰 + 페이지별 CSS)
  page.js              /  → components/Attic.jsx
  portfolio/page.js
  about/page.js
  artwork/[slug]/page.js
  not-found.js
components/
  Attic.jsx            다락방 6단계 상태 머신 + 캔버스 콜라주 생성
  HeroSection.jsx      마우스/스크롤 패럴랙스 히어로
  PhotoGrid.jsx        3열 작품 그리드
  ArtworkDetail.jsx    작품 상세
  SiteHeader.jsx, NavOverlay.jsx, ContactOverlay.jsx, FadeIn.jsx, Icons.jsx
lib/
  attic.js             아티스트(LIA/OL/LET) 정보, 해시태그 추천
  artworks.js          작품 데이터
public/attic/          무드보드 사진 m1–m8
```

## 참고

- 서가에 올린 작품은 방문자 브라우저의 localStorage(`attic-shelves-v1`)에 최대 30개까지 저장됩니다.
- 애니메이션은 framer-motion을 사용합니다.
