# G019-FIX06-STABLE-LABELS 최소 수정 (동일 두 번째 사이클)

## 허용 경계와 변경

- 최초 허용: 06 wardrobeRender의 부위 버튼 12개에 지역 label을 두고 현재 textContent와 다를 때만 갱신했습니다. 기존 블록에 label 중복 선언은 없었습니다.
- 추가 사용자 지시: 쓰기 경계를 05 main으로 확장하고 두 main의 #primary/#mute/#pause 및 06의 4개 프리셋 버튼 내부 small(progress-*) 반복 문구만 조건부 갱신했습니다.
- 두 파일에 작은 지역 setText(id,value) 헬퍼를 추가했습니다. 문구가 바뀔 때만 textContent에 대입하며 문구 값과 기존 분기는 유지합니다.
- 클릭/저장/선택/옷장 미리보기/ARIA/CSP/타이밍/엔진/save/이벤트와 다른 핸들러는 변경하지 않았습니다.
- 쓰기는 두 main, 이 문서, artifacts/g019-label-fix/로 한정했습니다. 원래 테스트/기존 artifacts/HTML/CSS/Git/index/빌드/서버/PM2/외부망/설치/재위임은 수정하거나 실행하지 않았습니다.

## 전후 증거

- PM 제공 이전 재현: 비동결 실제 HTTP 모바일 WebKit의 80ms 클릭에서 06 부위 선택 12/12 실패, 버튼 childList 64~304회, pointerdown/up는 같은 버튼이나 click 0건이었습니다.
- 추가 PM 재현: 05/06 #primary 80ms 클릭은 각각 4/4 준비 상태 유지였습니다. 기존 FAIL과 해당 원본 증거는 보존했습니다.
- 작업 전 원본: artifacts/g019-label-fix/before-05.mjs 및 before.mjs(06).
- 두 소스 변경만 모은 단일 diff: artifacts/g019-label-fix/main.diff.
- SHA-256 전후 및 허용 치환 외 바이트 불변 검증: artifacts/g019-label-fix/hashes.json.
- 자동 검사별 stdout/stderr/exit와 results.json을 같은 폴더에 저장했습니다.

## 실제 자동 검증

- `node --check public/games/05-falling-blocks/main.mjs`: exit 0.
- `node --check public/games/06-flappy/main.mjs`: exit 0.
- `node --test tests/games/05-falling-blocks.test.mjs`: exit 0.
- `node --test tests/games/06-flappy.test.mjs`: exit 0.

### 05 SHA-256
- before: `4db48a96235e6655c3782d080e57b80e00c0aa7bf35a75fca6a2d99116d978da`
- after: `87f34b3b10e67a9667c186690c02e9b832e6c8444712730261a88a2daa3378cb`

### 06 SHA-256
- before: `3a1d9dcbac14cd23e091838fbd465ce467702e83996d53d34b3e948f0a0ca043`
- after: `ff31b6cebe95e9544deac596297c9397c71ca4709f12979c15a1160fd65b7a2a`

## 한계 / PM 수용 게이트

실제 HTTP 비동결 모바일 WebKit의 80ms trusted click 수정 후 재검사는 수행하지 않았습니다. PM이 빌드/실제 HTTP 80ms 및 전체 63 최종 검증과 새 fresh2 게이트를 수행해야 합니다. 그 전에는 수용 PASS를 주장하지 않으며 기존 리뷰 FAIL을 유지합니다.

## 작업 중 문제

증거 생성용 Python 래퍼의 따옴표/개행 구문 오류를 수정했습니다. 해당 오류에서는 테스트가 실행되지 않았으며 위 기록된 명령은 수정 후 실제 실행 결과입니다. 게임 소스의 허용 외 변경이나 Git 조작은 발생하지 않았습니다.
