# G032 · 공통 셸 독립 QA와 기존 카탈로그 회귀 갱신

## PM 최종 중앙 실행 (20261107-235703 KST)
- fresh빌드에서 전체 자동검사1134/1134(공유fixture7포함), 기존e2e27/27, 후보/운영 각각60/60 PASS. artifacts/g032-validation/2026-11-07T14-31-04-667Z/results.json · artifacts/g032-smoke/2026-11-07T14-50-48-857Z/results.json.
- 아래 이전 실행결과 미수신 항목은 당시 상태이며 PM 중앙 재실행으로 대체됩니다. 과거g013 증거 출력 사고의 미복구 상태는 그대로입니다.


담당 G032-A. PM이 구현한 `public/games/vol2/shared.mjs`, `shared.css`를 독립적으로 검토했습니다. 본인이 구현한21~27의 자체 QA와 구분한 공통 셸 전용 fixture입니다.

## 실제 결과

- 실행: `node --test tests/games/vol2-shared-qa.test.mjs` → **7/7 PASS**, 실패·skip0, 약12.5초.
- 후보: `artifacts/g032-build`의 shared.mjs/shared.css와 현재 소스 바이트 일치 확인1건. 2026-11-07 22:59 KST 후보 기준이며 이후 제품 동결을 PM에게 요청했습니다.
- 실제HTTP loopback 랜덤포트에서 독립 fixture만 추가로 라우팅했고 실제 공유 모듈/CSS와 엄격 CSP를 사용했습니다. 운영 서버·기존 게임 규칙·다른 앱을 변경하지 않았습니다.
- PC Chromium1200px, 모바일 Chromium320px, 모바일 WebKit320px에서 각각 다음 두 그룹이 통과했습니다.
  - 준비 중 입력 차단, 실제80ms trusted 누름, 보드 포커스 범위, Enter repeat 차단, 도움말 보호정지, 모달 Tab/Escape·초점, 정지 시 시간/입력 불변, 재시작 취소/확정, RAF 중 공통 버튼 DOM 중복변경0, blur정지, 가로넘침0·공통 조작44px.
  - 결과 정산1회, 테마2/5회 조건과 선택·음소거 저장, 진행판 reload초기화, JSON손상 경고/정상쓰기 복구, 잘못된 wins/best/theme/muted 정규화, prototype 키 방어, 무관 저장키 보존, localStorage getter 차단에서도 플레이/결과 유지.
- 런타임/콘솔/CSP 제품 오류0. 해당 검사에서 공통 셸 결함은 발견하지 않았습니다.

## 기존 회귀 파일 갱신

- `tests/e2e/vol2-catalog.ts`: 기존49 + 명시된 신규20에서 전체69·플레이40·준비29를 계산합니다. 신규20 ID/href를 제품 카탈로그와 독립적으로 기대값으로 열거했습니다.
- 허용된9개 spec: breakout-integration, g024-new-games, g025-new-games, g026-new-games, g028-new-games, library-integration, live-server, multi-game-integration, runner-jumper.
- 변경은 카탈로그 합계/요약/플레이 수, 12→24→36→48→60→69 더보기, live ALL_GAMES 신규20, 숫자 장르7→8 기대치입니다. 게임 점수·20ms·경기규칙 상수는 바꾸지 않았습니다.
- library-integration의 시간 정렬 기대 계산은 정수만 읽던 정규식을 소수까지 읽도록 고쳤습니다. 새0.2/0.3분을 0으로 읽어 오판하는 시험 결함을 방지합니다.
- `git diff --check -- tests/e2e` 종료0. Playwright 수집은 **13파일372건** 성공했습니다. 아래 사고 때문에 과거 기본 결과경로로 쓴 수집 명령을 다시 사용하면 안 됩니다.
- library-integration 전체 + LIVE01/G026-CATALOG/G028-CATALOG의3환경 **27건 실제 실행은 아직 결과 미수신**입니다. 고유 `GAME_TEST_ARTIFACT_DIR`, `GAME_TEST_BUILD_DIR=artifacts/g032-build`, `--reporter=list`, 새 `--output`을 지정한 명령이 시작 출력·session ID를 반환하지 않은 채 중단됐습니다. 프로세스 실제 시작 여부는 모릅니다. PM이 중복 실행 전에3103 LISTEN·프로세스 명령행·`artifacts/g032-qa-shared-e2e` 새 하위폴더를 확인하고 중앙에서 실행합니다.

## 과거 증거 출력 경로 사고 — 미복구

- 원인: QA가 `node node_modules/@playwright/test/cli.js test --list`를 실행하면서 child 시작 전에 고유 `GAME_TEST_ARTIFACT_DIR`와 `--reporter=list`를 지정하지 않았습니다. 단순 수집에도 기존 config의 기본 JSON/HTML reporter가 실행됐습니다. 제 실행경로 설정 실수이며 제품 결함과 분리합니다.
- 읽기 전용 확인으로 아래 두 파일이 실제 **2026-11-07 23:04:44 KST**에 쓰였음을 확인했습니다.
  - `artifacts/g013-qa/playwright-results.json`:249,194바이트.
  - `artifacts/g013-qa/html-report/index.html`:557,652바이트.
- `artifacts/g013-qa` 하위에서 위 시각 이후 쓰인 파일 검색은 위2개를 반환했습니다. HTML reporter가 정리했을 수 있는 과거 부속 파일은 실행 전 목록이 없어 삭제 여부/범위를 확정할 수 없습니다. 쓰기 전 원본 바이트·해시도 채취하지 않았으므로 정확 원복을 보장할 수 없습니다.
- `git ls-files artifacts/g013-qa`는 빈 결과이고 artifacts는 gitignore 대상입니다. 이전 바이트가 동일하다고 입증된 백업을 발견하지 못했습니다. 임의 복원·삭제·재생성하지 않았으며 과거 검증을 새로 했다고 주장하지 않습니다.
- PM에게 즉시 보고했고 PM은 복원 금지와 영향 범위 기록을 지시했습니다. PM이 root Playwright 기본 reportDir를 고유 runId 경로로 바꾸었고, 이후 `--list`를 포함한 모든 호출에서도 실행 전에 고유 결과경로와 reporter를 명시합니다. 이번 사고는 미복구로 유지합니다.

## PM이 찾은23 전원 위치 결함 수정

- PM 검토에서4×4의 `Math.floor(n*n/2)`가 중앙이 아닌 index8임을 발견했습니다. PM의 명시 허용으로23 engine/main만 수정하여 공통 `sourceIndex(n)=floor(n/2)*n+floor(n/2)`를 사용합니다. 4×4=10,5×5=12이며 ⚡표시와 전원 연결 탐색이 일치합니다.
- `tests/games/vol2-logic.test.mjs`에 중앙·실제 탐색 시작점 회귀1건 추가, **73/73 PASS**, `node --check public/games/23-net/main.mjs` 종료0을 실제 확인했습니다.
- 해당23 델타의 fresh빌드/브라우저는 PM 중앙 실행 후속입니다. 기존 첫 후보의21~27 자체153개 확인 결과와 혼동하지 않습니다.

## 제한

공통 셸 fixture와 자동 브라우저 검사이며 실기기 손가락·실청취·사용자 수동 플레이가 아닙니다. 최종 모든 게임 수용, 원안 대비 누락, 운영15010 반영·실제LAN 확인은 PM 단계입니다. 과거 g013 증거 사고가 있어 전체 증거 보존 수용을 PASS로 표시하지 않습니다.
