/**
 * 서가가 비어 있으면 첫 관객이 들어설 자리가 쓸쓸하다. 작품 열두 장을 처음부터 꽂아 둔다.
 * 이전 화풍의 여섯 장과 지금 화풍(새하얀 종이의 LIA, 드로잉 종이의 OL, 밝은 LET)의 여섯 장을 섞었다.
 * 파일 저장소는 처음 열릴 때 이 목록을 넣고, Supabase는 supabase/schema.sql 이 같은 내용을 넣는다.
 * 칸은 liaollet 표와 같다(id 는 저장소가 매긴다). tags 에 감정 이름이 들어 있어 서가가 "같은 마음"을 찾는다.
 */
export const SEED_WORKS = [
  { ticket: 100101, artist: "LIA", source: [], collage: "/attic/seed/lia2.jpg", story: "아무 일 없던 오후, 그 빛만 기억한다.", tags: ["#LIA", "#고요함", "#오후의빛"], signature: "윤", likes: 15, created_at: "2026-10-01T09:00:00+09:00" },
  { ticket: 100201, artist: "LIA", source: [], collage: "/attic/seed/lia3.jpg", story: "건네받은 우산이 아직 따뜻하다.", tags: ["#LIA", "#다정함", "#우산", "#온기"], signature: "우산", likes: 11, created_at: "2026-10-02T09:00:00+09:00" },
  { ticket: 100301, artist: "OL", source: [], collage: "/attic/seed/ol.jpg", story: "찢긴 틈으로 든 빛, 어긋난 자리에서 오히려 환해졌다.", tags: ["#OL", "#후련함", "#빛번짐"], signature: "소금", likes: 7, created_at: "2026-10-03T09:00:00+09:00" },
  { ticket: 100402, artist: "OL", source: [], collage: "/attic/seed/ol3.jpg", story: "읽고 답 없는 메시지를 오래 들여다봤다.", tags: ["#OL", "#서운함", "#새벽", "#틈"], signature: "밤", likes: 6, created_at: "2026-10-04T09:00:00+09:00" },
  { ticket: 100502, artist: "LET", source: [], collage: "/attic/seed/let.jpg", story: "겹쳐 피는 여름, 그해의 장면들이 한꺼번에 떠오른다.", tags: ["#LET", "#벅참", "#비비드필름"], signature: "여름밤", likes: 21, created_at: "2026-10-05T09:00:00+09:00" },
  { ticket: 100601, artist: "LET", source: [], collage: "/attic/seed/let3.jpg", story: "접어 둔 기차표 위로 여름이 겹친다.", tags: ["#LET", "#설렘", "#여름", "#기차"], signature: "기차", likes: 14, created_at: "2026-10-06T09:00:00+09:00" },
  { ticket: 100701, artist: "LIA", source: [], collage: "/attic/seed/lia.jpg", story: "창가에 두고 온 편지, 끝내 부치지 못한 말들이 아직 거기 있어.", tags: ["#LIA", "#그리움", "#창가에서"], signature: "새벽", likes: 12, created_at: "2026-10-07T09:00:00+09:00" },
  { ticket: 100803, artist: "OL", source: [], collage: "/attic/seed/ol2.jpg", story: "갈림길의 연필 선, 어디로 가야 할지 아직 모르겠다.", tags: ["#OL", "#막막함", "#찢긴종이"], signature: "J", likes: 9, created_at: "2026-10-08T09:00:00+09:00" },
  { ticket: 100902, artist: "LIA", source: [], collage: "/attic/seed/lia4.jpg", story: "빈 의자 하나가 오늘의 나를 닮았다.", tags: ["#LIA", "#쓸쓸함", "#의자", "#여백"], signature: "R", likes: 8, created_at: "2026-10-09T09:00:00+09:00" },
  { ticket: 101001, artist: "LET", source: [], collage: "/attic/seed/let2.jpg", story: "포개진 계절들, 모든 순간이 겹쳐 하나의 내가 된다.", tags: ["#LET", "#아련함", "#레이어"], signature: "달", likes: 18, created_at: "2026-10-10T09:00:00+09:00" },
  { ticket: 101101, artist: "OL", source: [], collage: "/attic/seed/ol4.jpg", story: "벗어 둔 신발 옆에 하루가 구겨져 있다.", tags: ["#OL", "#지침", "#신발", "#하루"], signature: "솔", likes: 5, created_at: "2026-10-11T09:00:00+09:00" },
  { ticket: 101202, artist: "LET", source: [], collage: "/attic/seed/let4.jpg", story: "가벼운 가방을 메고 바람 속으로 걸었다.", tags: ["#LET", "#홀가분함", "#바람", "#햇살"], signature: "하늘", likes: 10, created_at: "2026-10-12T09:00:00+09:00" },
];
