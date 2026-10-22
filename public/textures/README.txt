콜라주 재료 텍스처 폴더

시선별 폴더(lia, ol, let)에 재료 이미지를 넣으면 콜라주가 그 재료를 씁니다.
없는 재료는 코드가 직접 그린 모양으로 대신합니다. 넣은 뒤에는 npm run dev 또는 npm run build 를 다시 실행하세요.

파일 이름의 앞부분이 역할입니다. 같은 역할을 여러 장 넣으면(conte-1.png, conte-2.png ...) 작품마다 골라 씁니다.
바탕 종이는 JPG(세로 3:4, 900x1200 이상), 위에 얹는 재료는 배경이 투명한 PNG로 넣으세요.

lia/
  paper     새하얀 종이 스캔(바탕)
  sheet     사진 아래 깔리는 흰 종이·크림색 종이 조각 (투명 PNG)
  vellum    반투명 종이(벨럼) (투명 PNG, 반투명)
  tape      마스킹 테이프 (투명 PNG)
  light     빛 번짐·커튼 그림자 (투명 PNG, 밝게 겹침)

ol/
  paper     회색·미색 드로잉 종이(바탕)
  torn      찢긴 종이 조각. 사진 뒤에 깔려 가장자리 섬유가 보인다 (투명 PNG)
  conte     콘테·목탄 획 (투명 PNG, 가로로 긴 획)
  pencil    연필 선·빗금 (투명 PNG)
  smudge    흑연 얼룩 (투명 PNG)
  grain     그레인(타일처럼 이어 붙여 화면 전체에 겹친다)

let/
  paper     밝은 종이(바탕)
  block     색면 조각 (투명 PNG, 곱하기로 겹친다)
  halftone  망점 (투명 PNG)
  tape      색 테이프 (투명 PNG)
  flare     햇빛 번짐·라이트 릭 (밝게 겹침)
