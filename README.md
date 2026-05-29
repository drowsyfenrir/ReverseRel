# Reverse Relationship

GitHub Pages에서 바로 열 수 있는 정적 인물 관계도 프로젝트입니다.

## 파일 구성

- `index.html`: 외부 사용자가 보는 관계도 페이지
- `editor.html`: 인물, 그룹, 관계, 배치를 수정하는 GUI 편집기
- `data.json`: 인물/그룹/관계 데이터
- `graph.js`: 관계도 렌더러
- `editor.js`: 편집기 동작
- `styles.css`: 비비드 오렌지 + 짙은 네이비 테마와 체크무늬 배경

## 사용 흐름

1. `editor.html`을 열어 인물과 그룹을 드래그해 배치합니다.
2. 오른쪽 패널에서 이름, 이미지 경로, 특징, 관계 설명을 수정합니다.
3. `data.json 다운로드`로 수정된 JSON을 저장합니다.
4. 기존 `data.json`을 새 파일로 교체한 뒤 GitHub에 올립니다.

이미지는 저장소 안에 `assets/characters/파일명.png`처럼 넣고, 편집기의 이미지 경로에 같은 상대 경로를 입력하면 됩니다.
