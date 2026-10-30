# G026-HOME-RACE-FIX — G024-STORE 홈 로드 경합 최소 보완

## 범위와 현재 상태
- 작성자 역할: 공유 통합 구현자. 독립 QA13/14 또는 독립 shared-delta 수용을 대체하지 않습니다.
- root: `E:/Work2/Project/SimpleGames/worktrees/g026-fourteen-game-release`
- branch / HEAD: `feature/g026-fourteen-game-release` / `5e7eb28e87fb14f3c0725aad1f420370c76736bf`.
- 허용 소스 변경은 `tests/e2e/g024-new-games.spec.ts` G024-STORE의 **9줄 추가 / 삭제0줄**뿐입니다. 별도100ms helper, 제품13/14, 단위시험, runner/config는 수정하지 않았습니다.
- r3 빌드·초기 smoke·전체회귀를 실제 완료했습니다. **build exit0 / smoke18/18 / full browser246/246 + unit626/626 PASS**, full 실행은 한 번뿐입니다. 새9줄 delta에 대한 독립 수용과 별도 QA13 수용은 미대체 상태입니다.

## 원본 실패와 검출력 검토
- 원본 full `da9025b4` 및 r2 full `22903154`는 각각246개 실행 /245 PASS /1 FAIL 상태 그대로 보존합니다. 새 결과로 과거 FAILED를 PASS로 재명명하지 않습니다.
- r2 원본 G024-STORE mobile-webkit raw audit는 console/pageerror/CSP/external/failedHTTP0, `failedRequests`3입니다. 세 요청은 `06-flappy`, `07-dino`, `08-doodle`의 native `kit.svg`이며 `Load request cancelled`입니다.
- 원본 trace에서 `#result-home` click 이후 바로 `/games/02-snake/index.html` goto(`trsg@1290`, monotonic357885.056ms)가 시작되고, home native image 요청이 다음 이동에 의해 취소된 경합임을 확인했습니다.
- 이전 독립 read-only 제어군은 native asset3개를 보류한 interactive 문서에서 다음 이동 시 취소3개가 발생하며, 기존 `failedRequests == []` 단언에 기각됩니다. 응답 완료 후에는 complete 문서/pending0/SVG use6개 양수 경계/HTTP200과 원본 body SHA3개 일치를 확인했습니다.
- 해당 독립 진단의 부가 WebKit screenshot이 만든 late inline style-src-elem CSP/console 오류는 그대로 유지합니다. 네트워크 원인 분류와 전체 감사 PASS를 혼동하지 않습니다. 이번 구현자는 WebKit screenshot을 호출하지 않았습니다.
- 읽은 원문: `docs/G026_SHARED_DELTA_REVIEW.json.g024_network_diagnosis`, `artifacts/g026-pm/shared-delta-review/targeted-diagnostic.mjs`, `followup2`의 원본 음성/양성 JSON, 원본 full trace와 Playwright 첨부 audit.
- 재사용 원문/trace 해시와 선택 원시 레코드: `artifacts/g026-integration/runs/5b3412e5/original-evidence-review.json`.

## 최소 수정
1. 공개 `#result-home` 클릭 **이전**에 해당 home의 native SVG3개 `waitForResponse`를 등록합니다.
2. 기존 클릭 후 home URL의 native `load`와 기존 `home()` catalog43/14/29 단언을 기다립니다.
3. 응답3개의 status200과 `response.finished() === null`을 확인합니다.
4. 기존6개 SVG use의 실제 양수 `getBBox()`와 image completion을 확인한 다음, **원래 있던** 다음 goto만 진행합니다.
- 추가 이동, fetch, screenshot, 무조건 sleep/networkidle, request/CSP 필터, 예외, threshold/timeout/retry/skip 변경은 없습니다. 저장·즐겨찾기·입력·CSP 및 전체 무필터 감사 단언은 그대로입니다.
- 정확한 before/after delta: `artifacts/g026-integration/runs/5b3412e5/home-race-spec.patch`.
- 수정 spec SHA256: `f7d787c5e8c8a97323aa6920eae58376e083411b755c4ff4df2e12e89dc1b4cd`.

## 새 후보 동결
- build: `artifacts/g026-build-r3`.
- manifest SHA256: `58dc6131942d85eb88a62b95538019375afec41926bd14b0ef643d448f844b17`.
- 수정13 main SHA256: `3c143220f2b4a343856cb6b69f653470830d5757bb486e63ab2efb746f08633b`.
- 수정13 단위35개 시험 파일 SHA256: `8da6e5df0c3ea0516e52130624d15c2479cd0d91df09dd25976d8ba12741ceda`.
- r2 대비 manifest source delta는13 main,13 단위시험,이 G024 spec 세 파일뿐입니다. 이 담당자가13 source/test를 수정한 것은 아닙니다.
- r2 대비 출력155개 중 실제 byte 변경은 **`public/games/13-memory/main.mjs` 한 파일**뿐입니다. 나머지154개와 기존 게임1..12/14 출력은 동일합니다. QA14 입력12개도 기존 독립 PASS 해시와 전부 일치합니다.
- source/build 동결 이후 본인 소스·후보 수정은 없습니다. 세부 목록: `artifacts/g026-integration/runs/5b3412e5/candidate-binding.json`, `frozen-source.json`.

## 실제 실행
```bash
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode build --build artifacts/g026-build-r3
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode smoke --build artifacts/g026-build-r3 --origin http://127.0.0.1:3160
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode full --build artifacts/g026-build-r3 --origin http://127.0.0.1:3160
```
- Windows Node24.16.0 / TS7.0.2 / Playwright1.64.1, 기존 설치만 사용했습니다.
- build run `3435937f`: exit0, `BUILD_CREATED_NOT_PLAYTESTED`.
- smoke run `4a6c0fea`: exit0, 실제18/18 PASS, fail/skip/retry0. 자기3160 server 종료 및 ECONNREFUSED 확인.
- full run `ff404c79`: tracked process `proc_44534a5c2f23` 종료까지 기다려 **exit0 / EXECUTION_PASSED**를 확인했습니다. browser246개 모두 한 번 실행·PASS, fail/skip/pending0, desktop-chromium/mobile-chromium/mobile-webkit 각각82개입니다. 단위 common48 / games549 / launcher29, 합626개 전부 PASS, fail/skip/todo0입니다. 원래 전체 명령을 반복하지 않았습니다.
- smoke/full 각각 실제 HTTP119개 전부200, 원본 bytes/SHA 및 엄격 CSP 일치입니다. 이는 HTTP 자산 응답 수이며 browser testcase 수에 합산하지 않습니다.
- 원래 G024-STORE는 세 프로젝트 모두 PASS이며, 각 첨부의 console/pageErrors/CSP/external/failedHTTP/failedRequests **6개 배열 전부0**입니다. 전체회귀의 unfiltered 첨부195개를 다시 읽어 오류 배열0을 확인했습니다. 요청/정상응답 ledger는 실제 관측 배열이며 빈 배열로 바꾸지 않았습니다.
- 모든 브라우저 구간은 공통 `Local\SimpleGamesG026BrowserGate`의 blocking HANDLE/finally release+close 경로로 실행했습니다. raw stdout의 acquired/released 및 자기 loopback3160 종료를 확인했으며, 최종 별도 probe도 `ECONNREFUSED`입니다.

## 별도 artifact-only 진단의 한계와 원시 FAIL 보존
- `targeted-smoke.mjs`/`targeted-smoke.json`: Chromium13 정상 touchscreen start/첫 카드/pause/resume4회와 감사0은 PASS. Chromium14 기능 입력 이후, 비어 있는 셀의 src 없는 숨김 img까지 naturalWidth>0을 요구한 **부가 observer 오류**로 exit1. 제품14의 `main.mjs:17,38..41`에서 img의 생성/숨김/src 제거를 직접 확인했습니다. 해당 실패를 수정하여 재실행하지 않았습니다.
- `remaining-checks.mjs`/`remaining-checks.json`: 이전에 실행되지 않은 WebKit13 정상 touchscreen start/첫 카드/pause/resume를 실행했습니다. 첫 카드 reveal과 phase 단언, 실제 click4개 모두 isTrusted, 감사0입니다. 그러나 WebKit이 touchscreen에서 생긴 click에 `pointerType: mouse`를 보고하여, 부가 click-pointerType==touch 단언이 실패했습니다. API 자체는 `page.touchscreen.tap()`이며 mouse click으로 대체하지 않았습니다. 원시 FAIL을 유지하고 이 진단을 PASS로 재명명하지 않습니다.
- 이후 artifact 브라우저 진단을 더 수정/재실행하지 않았으며, 새 controlled pair는 실행되지 않았습니다. 기존 독립 raw pair의 검출력만 read-only 재검토했습니다. 보조 진단 FAIL은 실제 original full spec의 결과와 별도로 분류합니다.
- 위 진단의 실패 관측과 별개로, 별도100ms helper 변경·CSP 필터·오류 무시·제품 변경은 없습니다. 독립 QA13의 완료/수용 여부를 본인의 자체 진단 결과로 주장하지 않습니다.

## 최종 결과·보존·다음 게이트
- 최종 구조화 보고: `artifacts/g026-integration/runs/5b3412e5/final-verification.json`, SHA256 `e9434ab5ab747784d20a23ca9ada08862abb14c5c8cf4e1d7921acb5b4854f3a`.
- 원시 근거: build `3435937f/report.json`, smoke `4a6c0fea/report.json`, full `ff404c79/report.json` 및 하위 `execution/playwright-results.json`, 단위 stdout/stderr, `http-bytes.json`. 모든 경로 prefix는 `artifacts/g026-integration/runs/`입니다.
- 고정 source167개와 r3 출력155개 drift0, 최종 `assertReady` PASS입니다. 착수 보호입력1501개 중 허용한 G024 spec만 변경됐으며 나머지 기존 파일의 SHA/size/mtime 변경0입니다. 기존 build/r2는 manifest 포함156개씩, QA build/QA build-fix1은 각각155개 전부 불변입니다. full runner 자체도 이전 artifact1264개의 보존을 확인했습니다.
- 새9줄 spec delta는 후속 **독립 수용**이 필요합니다. 독립 QA13 fix1 결과 수용도 PM 담당입니다. 본인 수정/재회귀로 해당 독립 판정을 대신하지 않았습니다.
- 수집기 오류 두 건도 분리 기록했습니다. QA14 source_hashes의 실제 list schema 확인 후 집계기를 교정했고, 정상 request/response ledger의 비어 있지 않음을 제품 오류로 취급한 초기 집계 단언도 교정했습니다. 이 과정에서 원시 결과·browser spec·제품·명령을 수정/재실행하지 않았습니다.
- 실제 변경/생성은 G024 spec, 이 문서, `artifacts/g026-build-r3/**`, `artifacts/g026-integration/runs/{5b3412e5,3435937f,4a6c0fea,ff404c79}/**`뿐입니다. 기존 두 full FAILED와 원본 trace는 그대로입니다.
- 운영/게시/Git 변경, PM2/3116, 설치, 기존 build/QA/PM 문서 수정은 하지 않았습니다. 지정 경로 밖 문서·skill 저장과 게시도 계약상 수행하지 않습니다.
