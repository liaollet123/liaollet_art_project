/**
 * 서가가 비어 있으면 첫 관객이 들어설 자리가 쓸쓸하다. 작품 열일곱 장을 처음부터 꽂아 둔다.
 * 시선마다 네 장씩(LIA 빛과 여백, OL 흐림과 틈, LET 선명한 색)은 liaollet source2 이미지로 꾸몄고,
 * 다섯 장(다락방 창, 웃음 폴라로이드, 찢어 붙인 섬, 비워 낸 실루엣, 편지 위 사진)은 스크랩북 결의 참고 작품을 더한 것이다.
 * 파일 저장소는 처음 열릴 때 이 목록을 넣고, Supabase는 supabase/schema.sql 이 같은 내용을 넣는다.
 * 칸은 liaollet 표와 같다(id 는 저장소가 매긴다). tags 에 감정 이름이 들어 있어 서가가 "같은 마음"을 찾는다.
 */
export const SEED_WORKS = [
  { ticket: 100101, artist: "LIA", source: [], collage: "/attic/seed/lia1.jpg", story: "아무 일 없던 오후, 창을 지나던 빛만 기억한다.", tags: ["#LIA", "#고요함", "#오후의빛"], signature: "윤", likes: 15, created_at: "2026-10-01T09:00:00+09:00" },
  { ticket: 100201, artist: "LIA", source: [], collage: "/attic/seed/lia2.jpg", story: "나란히 앉아 있던 물가, 말하지 않아도 따뜻했다.", tags: ["#LIA", "#다정함", "#물가", "#온기"], signature: "물가", likes: 11, created_at: "2026-10-02T09:00:00+09:00" },
  { ticket: 100301, artist: "OL", source: [], collage: "/attic/seed/ol1.jpg", story: "깨진 틈으로 든 빛, 어긋난 자리에서 오히려 환해졌다.", tags: ["#OL", "#후련함", "#빛번짐"], signature: "소금", likes: 7, created_at: "2026-10-03T09:00:00+09:00" },
  { ticket: 100402, artist: "OL", source: [], collage: "/attic/seed/ol2.jpg", story: "읽고도 답 없는 메시지를 새벽까지 들여다봤다.", tags: ["#OL", "#서운함", "#새벽", "#틈"], signature: "밤", likes: 6, created_at: "2026-10-04T09:00:00+09:00" },
  { ticket: 100502, artist: "LET", source: [], collage: "/attic/seed/let1.jpg", story: "겹쳐 피는 여름, 그해의 장면들이 한꺼번에 떠오른다.", tags: ["#LET", "#벅참", "#비비드필름"], signature: "여름밤", likes: 21, created_at: "2026-10-05T09:00:00+09:00" },
  { ticket: 100601, artist: "LET", source: [], collage: "/attic/seed/let2.jpg", story: "열린 문 너머로 바다가 보였다, 설레는 마음이 먼저 건너갔다.", tags: ["#LET", "#설렘", "#여름", "#바다"], signature: "바다", likes: 14, created_at: "2026-10-06T09:00:00+09:00" },
  { ticket: 100701, artist: "LIA", source: [], collage: "/attic/seed/lia3.jpg", story: "창가에 두고 온 책, 끝내 하지 못한 말이 접어 둔 페이지에 있다.", tags: ["#LIA", "#그리움", "#창가에서"], signature: "새벽", likes: 12, created_at: "2026-10-07T09:00:00+09:00" },
  { ticket: 100803, artist: "OL", source: [], collage: "/attic/seed/ol3.jpg", story: "신호가 바뀌어도 건너지 못했다, 어디로 가야 할지 아직 모르겠다.", tags: ["#OL", "#막막함", "#횡단보도"], signature: "J", likes: 9, created_at: "2026-10-08T09:00:00+09:00" },
  { ticket: 100902, artist: "LIA", source: [], collage: "/attic/seed/lia4.jpg", story: "의자에 앉은 그림자 하나가 오늘의 나를 닮았다.", tags: ["#LIA", "#쓸쓸함", "#의자", "#여백"], signature: "R", likes: 8, created_at: "2026-10-09T09:00:00+09:00" },
  { ticket: 101001, artist: "LET", source: [], collage: "/attic/seed/let3.jpg", story: "포개진 계절들, 모든 순간이 겹쳐 하나의 내가 된다.", tags: ["#LET", "#아련함", "#레이어"], signature: "달", likes: 18, created_at: "2026-10-10T09:00:00+09:00" },
  { ticket: 101101, artist: "OL", source: [], collage: "/attic/seed/ol4.jpg", story: "유리 너머로 손을 뻗어 봐도 닿지 않는 하루였다.", tags: ["#OL", "#지침", "#유리", "#하루"], signature: "솔", likes: 5, created_at: "2026-10-11T09:00:00+09:00" },
  { ticket: 101202, artist: "LET", source: [], collage: "/attic/seed/let4.jpg", story: "물 위에 띄운 오렌지처럼 가벼운 하루, 햇살이 먼저 알아봤다.", tags: ["#LET", "#홀가분함", "#햇살", "#여름"], signature: "하늘", likes: 10, created_at: "2026-10-12T09:00:00+09:00" },
  { ticket: 101301, artist: "LIA", source: [], collage: "/attic/seed/lia5.jpg", story: "겨울 가지 사이로 다락방 창이 보였다, 불 꺼진 방에도 누군가 살던 온기가 남아 있었다.", tags: ["#LIA", "#그리움", "#다락방창", "#겨울가지"], signature: "다락방", likes: 13, created_at: "2026-10-13T09:00:00+09:00" },
  { ticket: 101401, artist: "LET", source: [], collage: "/attic/seed/let5.jpg", story: "숨이 넘어가게 웃던 여름밤, 그 웃음소리가 아직 사진 밖으로 번진다.", tags: ["#LET", "#벅참", "#웃음", "#여름밤"], signature: "물감", likes: 19, created_at: "2026-10-14T09:00:00+09:00" },
  { ticket: 101501, artist: "OL", source: [], collage: "/attic/seed/ol5.jpg", story: "찢어 붙인 바다와 눈동자, 떠나온 섬이 아직 내 안에서 흔들린다.", tags: ["#OL", "#아련함", "#찢긴기억", "#야자수"], signature: "종이섬", likes: 9, created_at: "2026-10-15T09:00:00+09:00" },
  { ticket: 101601, artist: "OL", source: [], collage: "/attic/seed/ol6.jpg", story: "사진마다 내가 서 있던 자리만 하얗게 비어 있다, 어디에도 나는 없었다.", tags: ["#OL", "#쓸쓸함", "#빈자리", "#도시"], signature: "그림자", likes: 11, created_at: "2026-10-16T09:00:00+09:00" },
  { ticket: 101701, artist: "LIA", source: [], collage: "/attic/seed/lia6.jpg", story: "이마를 맞대고 웃던 오후, 부치지 못한 편지 위에 그 사진을 올려 둔다.", tags: ["#LIA", "#다정함", "#편지", "#오후"], signature: "편지지", likes: 16, created_at: "2026-10-17T09:00:00+09:00" },
];
