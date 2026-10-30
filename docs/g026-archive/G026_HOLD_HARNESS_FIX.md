# G026 실제 누름 하네스 한정 수정

> **한정 helper 수정 자체검증 완료 / 새 full FAILED / 독립 QA13 FAIL로 제품·릴리스 수용 차단.**
> 긴급 지시가 도착했을 때 r2 full이 이미 실행 중이어서 강제중단/소스변경 없이 종료만 확인했습니다. 추가 회귀 재실행·다른 runtime 수정·독립 수용 대기는 하지 않습니다.

## 상태와 소유권
- 작업: `G026-HOLD-HARNESS-FIX`, 공통 통합 한정 수정자 자체 재시험입니다. 독립 QA 또는 운영 수용이 아닙니다.
- root: `E:/Work2/Project/SimpleGames/worktrees/g026-fourteen-game-release`.
- branch/base: `feature/g026-fourteen-game-release` / `5e7eb28e87fb14f3c0725aad1f420370c76736bf`.
- 제품/실행 입력 변경은 `tests/e2e/g026-new-games.spec.ts`의 `press` helper 한 곳뿐입니다. `delay:80`을 `delay:100`으로 바꾸고 설명 주석 두 줄을 추가했습니다. 관측기와 모든 기존 단언은 그대로입니다.
- 허용 문서인 본 파일과 새 `artifacts/g026-integration/runs/**`, 새 후보 `artifacts/g026-build-r2/**`만 작성합니다. 게임 source/전용 unit/홈 source/runner/config/PM 문서/QA 출력/이전 build/원 FAIL/Git index·HEAD/3116/PM2/게시판을 수정하지 않습니다.

## 원인 판정 — 제품 결함으로 처리하지 않음
- 원본 full: `artifacts/g026-integration/runs/da9025b4/report.json`, **FAILED 그대로 보존**합니다. raw browser 실행246, PASS245/FAIL1/skip0/pending0/flaky0입니다. 새 실행과 합산하거나 PASS로 재명명하지 않습니다.
- 유일 실패는 mobile Chromium의 `G026-LAYOUT full native320/short dialogs + reducedmotion geometry/render evidence`, `#resume`의 실제 pointer hold `79.80000001192093ms <80ms`입니다.
- 원 trace `execution/test-results/g026-new-games-G026-LAYOUT-88ccd-on-geometry-render-evidence-mobile-chromium/trace.zip`과 `error-context.md`를 변경하지 않았습니다.
- 원 trace의 `rntl@5957`: `#resume`, `delay:80`, 정상 완료. 직전 snapshot `rntl@5954`는 paused/manual, 직후 `rntl@5959`는 playing/null이며 round/id/board가 동일합니다. 다음 `rntl@5968`에서 O가 cell4에 놓이고 moves2/currentX가 됩니다. 따라서 원래 재개 동작과 이후 착수는 성공했습니다.
- `rntl@5982`의 실제 관측값은 click trusted=true, pointerTrusted=true, holdMs=79.80000001192093입니다. 누름은 브라우저 capture listener 두 지점의 `performance.now()` 차이이며 드라이버 API 호출 전체 시간과 다릅니다. 모든 click timestamp는 증가했고 clock override 호출은 없었습니다. 정확한 0.2ms의 OS/브라우저 내부 기여분까지 분리 측정한 것은 아닙니다.
- 설치된 Playwright1.64.1 `node_modules/playwright-core/lib/coreBundle.js:22660..22669`는 native down → `progress.wait(delay)` → native up입니다. 이 드라이버 대기와 브라우저 capture-handler 실측 간격을 동일한 하한으로 가정한 경계 설정 문제입니다. 제품 입력/물리를 변경할 근거가 아닙니다.
- 원본에서 추출한 재개 전후 상태/실측: `artifacts/g026-integration/runs/a76e4c90/original-resume-diagnosis.json`. 원본 전체 SHA/size/mtime 및 source/game30 사전 목록은 같은 폴더의 `baseline.json`입니다.

## 최소 수정의 의미와 검출력
```diff
-const press = (control: Locator) => control.click({ delay: 80 });
+// Contract: actual native/unfrozen hold >=80ms, not an exact80ms driver delay.
+// Leave 20ms scheduling margin; trustedPresses still rejects any actual hold <80ms.
+const press = (control: Locator) => control.click({ delay: 100 });
```
위 diff는 공통 suffix 주석을 생략한 설명용입니다. 실제 변경은 보존한 before snapshot과 정확한 전체 문자열 대조로 확인했습니다.
- 계약은 정확히80ms 누름이 아니라 **약80ms 이상 실제 trusted 누름이 동작**하는 것입니다. 100ms는 20ms 드라이버 스케줄링 여유일 뿐이며, 새로운 실제 하한/epsilon/예외가 아닙니다. 부하 등으로 실제80ms가 미달하면 기존 단언은 여전히 실패합니다.
- `trustedPresses()`의 isTrusted, 동일 target/pointerId down/up 연결, non-null 실측 hold, **`toBeGreaterThanOrEqual(80)`** 모두 그대로입니다. 재개/정지/취소보존/착수/모달/저장/레이아웃/CSP 단언도 그대로입니다.
- 가상시계/frozen clock, synthetic 정상 클릭, 게임 setter, 재시도/skip/timeout 변경, assertion 완화가 없습니다.
- 원본 trace의 실제79.8ms를 **수정하지 않은 실제 observer 함수**에 공급하면 실패합니다. 실제 원본 중 qualifying17개는 통과합니다. missing down/up, untrusted click, null hold, 빈 click 배열의 명시적 진단 fixture도 거부했습니다. 원본 재개 전 paused 상태는 playing 기대에서 거부됩니다. `observer-controls.json`에 기록했으며, 이 진단은 브라우저 실행 또는 제품 PASS 개수에 넣지 않습니다.
- before spec SHA256: `08572166f85e44d5849aca0bf4be747055fa0ac7458cbd3f1ecb6e0c13215481`.
- 수정 spec SHA256: `3dcc9794dadc4ec45c73bcd0d5be266251305651351251feccbc6313b89c5fb5`.

## 실제 실행 — 새 후보만 사용
```bash
"C:/Program Files/nodejs/node.exe" --check scripts/g026-verify.mjs
"C:/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node tests/g026-playwright.config.ts tests/e2e/g026-new-games.spec.ts
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode build --build artifacts/g026-build-r2
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode smoke --build artifacts/g026-build-r2 --origin http://127.0.0.1:3160
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode full --build artifacts/g026-build-r2 --origin http://127.0.0.1:3160
```
- observer 음성/양성 대조, runner node --check, 선택 strict TS, git diff --check: exit0.
- build: `artifacts/g026-integration/runs/7652d99f/report.json`, **BUILD_CREATED_NOT_PLAYTESTED / exit0**.
- smoke: `artifacts/g026-integration/runs/d8e2dfe3/report.json`, **EXECUTION_PASSED / exit0**, 실행18/PASS18/FAIL0/skip0/pending0/flaky0, unit실행0.
- smoke 실제 누름: 세 프로젝트의 게임13/14 첨부6개, 각각15/18회. 모든 trusted/실측>=80ms 유지. 전체 최소100.5ms, resume 실측 PC109.09999999403954 / mobile Chromium115.30000001192093 / WebKit113ms. 무필터 진단 첨부12개의 모든 오류 목록0.
- full: `artifacts/g026-integration/runs/22903154/report.json`, **FAILED / exit1**. 단위621/621 PASS (common48 + games544 + launcher29), 브라우저 발견·실행246/PASS245/FAIL1/skip0/pending0/flaky0입니다. 새로운 결과를 이전 full과 합산하지 않았습니다.
- full의 유일 실패는 **mobile WebKit / `G024-STORE all eight existing profiles and old upcoming favorites survive two new games via public UI`**입니다. `g024-new-games.spec.ts:33`의 `failedRequests == []`에 실제 `Load request cancelled` 3건 (`/games/08-doodle/assets/kit.svg`, `/games/06-flappy/assets/kit.svg`, `/games/07-dino/assets/kit.svg`)이 남았습니다. 원인 귀속은 추가 조사하지 않았고 필터/단언완화/재시도하지 않았습니다. 이는 아래 QA13의 meadow CSP 실패와 다른 증거입니다.
- 새 full의 `G026-*` testcase는18/18 PASS입니다. 원래 mobile Chromium `G026-LAYOUT`도 통과했습니다. 실제누름 첨부24개/396회 전부 trusted/실측>=80ms, 최소100.09999999403954ms입니다. 모든 개별 실측은 `a76e4c90/full-measurements.json`에 보존했고 G026 무필터 진단 첨부18개의 목록은 모두0입니다. 이를 기존 G024 실패 또는 QA13 실패를 지우는 전역 console/CSP0 주장으로 확대하지 않습니다.
- 원/새 full의 실패 trace/error-context/raw JSON은 각 run에 그대로 있습니다. 새 실패 원본: `22903154/execution/test-results/g024-new-games-G024-STORE--e030f-two-new-games-via-public-UI-mobile-webkit/`.
- browser 전체는 기존 공식 blocking mutex `Local\\SimpleGamesG026BrowserGate`를 사용했습니다. smoke/full 모두 acquired/released와 자기3160서버 stoppedAndRefused=true를 확인했습니다. 각 HTTP runtime119개 응답200/바이트 SHA/CSP 일치, 역사 보호 파일은 build611/smoke801/full822개 보존했습니다.

## 후보 바이트와 남은 게이트
- r2 Build ID: `6d9703c4-242a-468a-9e4e-4592de0904b6`.
- r2 manifest SHA256: `8ff52a0645b90236df5f20d7f0e48b2d8a6e1c9e284b8c3408b244e7f7751aa6`.
- r2 source177과 원후보 source177의 차이는 위 spec 한 파일이며, 최종 현재 source177/output155의 SHA도 manifest와 전부 일치합니다. output155는 build prefix를 제거한 모든 상대경로/바이트 SHA가 원후보 output155와 같습니다. runtime 재구현/수정은 없습니다.
- Source aggregate SHA256: `137031bd928ac43cdb80622d0019f5743179e010a47d4b0a39057bf5aa85ef68`.
- r2 output aggregate SHA256: `c5c8d86dde05bb14638d9e3c883e00b19728db157316d06f417d9986c090aaad` (원후보와 build prefix가 다릅니다).
- 두 후보 공통 normalized output SHA256: `dfb752c593f529233492d4434dff738536f17716faa4dc827d319a113380fc3a`.
- 게임 runtime28+전용unit2=30파일 전후 SHA/size/mtime 모두 동일합니다. Game30 aggregate SHA256: `989db04f32f391f476d8996fe45cc71a02b0d736f63768f85cf2181c298ef47f`. 각 파일 사전/사후는 `a76e4c90/game30-before-after.json`에 있습니다.
- aggregate는 JavaScript `localeCompare` 경로 정렬 object의 compact `JSON.stringify` SHA256입니다. 실행원시/각실측/현재source177/output155/원FAIL/Git 보호237개를 재결합한 보고는 **`artifacts/g026-integration/runs/a76e4c90/final-verification.json`**입니다. 보호집합에서 변경은 spec 한 파일뿐이고 원 FAIL 전체 SHA/size/mtime 및 Git index/HEAD는 그대로입니다. 실제 최소 diff는 같은 폴더 `helper-delta.patch`입니다.

## 긴급 인수 변경 / PM에 넘기는 차단 사항
- full 실행 중 도착한 지시에 따라 게임13 소스 freeze를 유지했습니다. `docs/G026_QA13.json`의 독립 결과는 **FAIL**이며 수정자의 이번 mouse-driver PASS로 대체하지 않습니다. r2는 원후보 runtime과 동일하므로 결함도 그대로 포함합니다.
- `G026-QA13-001` **High / confirmed product functional defect**: 게임13 정상 trusted touchscreen의 pointerup 뒤 implicit lostpointercapture가 취소로 처리되어 Chromium/WebKit 모두 카드가 열리지 않습니다. 대상 `main.mjs:176,178-180`, 원 builder에 별도 수정 배정과 독립 재검증이 필요합니다. 본 작업은 해당 runtime을 수정하지 않았습니다.
- `G026-QA13-002` **Medium / unclassified strict-CSP diagnostic failure**: WebKit meadow 저장 후 reload에서 back-meadow.svg connect-src 위반. 제품/브라우저/하네스 원인 귀속은 미확정이며 별도 조사 게이트입니다. 이번 G024 cancelled requests와 혼동하지 않습니다.
- PM 긴급 지시상 게임14 QA는 PASS입니다. **새 helper delta 독립 검토는 본 인계 후 별도 범위로 연결**하며 여기서 기다리지 않습니다. source freeze 해제/제품13 수정 착수는 PM이 이 완료 인계를 인수한 뒤 담당합니다.
- 남은 게이트: QA13 두 finding 처리/독립 재검증, helper delta 독립 검토, 새 runtime이 생기면 새 후보와 필수 회귀, 이번 full의 G024 failedRequests 분류. 수정자의 자체 재시험을 독립 수용으로 부르지 않습니다.
- 실제3116/배포/Git 병합·commit·push/게시와 PM 완료판정은 이 작업 범위가 아닙니다. 실물 손가락/실음향/사람 플레이시간/OS-native 숨김/WebKit PNG 시각 수용은 미검증입니다.
