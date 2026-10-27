# G022-NATIVE-INTEGRATION 구현 인수

cody-01이 `tests/e2e/runner-jumper.spec.ts`에 실제 사막 우체부 07 수용 논리 20개를 추가했습니다. 기존 08 논리 26개 테스트 본문은 원본과 동일합니다. 상단 provenance는 08 수용 `18afb7533ca515224056774523b126834114bda7`, 07 후보 `56ad2e6fb12f7be4c7182a470658726ffd9c30b7`를 명시합니다. 본인 수정에 대한 자체 검증이며 독립 QA/운영 수용이 아닙니다.

## 변경과 경계

- 변경: `tests/e2e/runner-jumper.spec.ts`, 본 문서, `artifacts/g022-native-integration/20261027-cody01-01/**`, 원본 launcher가 새 UUID로 만든 candidate 실행 증거만입니다.
- 게임 제품 07/08, 공통 홈/다른 시험/config/launcher/build/서버/Git index/브랜치/운영 3116은 수정하지 않았습니다. 브랜치 `feature/g022-eight-game-release`, HEAD `e0f37454220560b3bf8340e53a9b3c177adb1d14`를 읽기 전용으로 확인했습니다. 현재 모델/provider 선택을 유지했습니다.
- 기존 공통 13파일 사전 정적 검토와 PM 인수의 22동결/77기존소스/132증거 보존 근거는 지정 review.json/receipt.json을 재사용합니다. 역사 전체를 재실행하지 않았습니다.
- 이번 직접 관측 읽기 전용 28파일 해시 보존, 07/08 런타임 12파일의 지정 commit Git blob SHA256 일치는 새 JSON에 별도로 기록했습니다.

## 실제 시험 내용

07 공개 `main.mjs#getSnapshot()` 복사본만 읽고 trusted 키보드/80ms click/마우스 hold로 정상 플레이를 조작합니다. live setter, RNG 교체, 가짜 route, 저장키 삭제, 시계 가상화/게임 물리 마진 확대가 없습니다. snapshot에 따라 첫 선인장을 정상 점프로 넘긴 뒤 이후 장애물에 자연 충돌해 실제 결과/기록을 검사합니다.

- 비동결 실제 HTTP/CSP/nosniff, 준비 무진행/자동쓰기0, 시작·점프·숙임·정지/재개·음소거·옷장, MutationObserver 동일문구 버튼 childList/문자열 갱신0.
- 점프 hold/OS repeat/다중 키 자동 재점프 방지, 숙임 해제/초점/수정키, blur/실제 300ms UI 지연/pointercancel, 보드 밖 두 번째 손가락 보호 정지. 모바일 Chromium은 실제 CDP touch, 다른 프로젝트의 다중 접촉은 synthetic PointerEvent로 구분해 첨부합니다.
- 메뉴/도움말/옷장/확인의 native dialog Tab/ShiftTab/Escape 후 실제 opener 초점: 즉시/RAF/250ms. 중첩 menu 전환도 외부 opener 유지, 닫은 뒤 paused 유지.
- restart/home 취소 집계0, 확인 quit1회, 자연 collision 결과1회, reload 완료 기록 유지·진행판 복원 제외, 07/08 및 기존 게임 전용키 분리.
- 저장 getter/get/set 각각 분리, 손상JSON/구버전/불가능 최소110px·최대30px 집계 복구, 정상null 무경고, 상한 통계 전체 보존/반복판 재시도 합산0/설정 저장 유지.
- 해금 fixture는 최초 격리 방문에만, 실제 07 `settleRecord`와 `validateRecord`로 생성·검증한 실현 가능한 이력을 사용합니다. 4999→5000px 최고500점, 누적2999→3000점 경계·혼합3부위/8포즈·미리보기 취소0쓰기/적용1쓰기/중간판 집계0.
- 320px 자연 결과의 44px/넘침0, 실제 컴파일된 홈 37/8/29·12→24→36→37·카드 진입/quit 복귀. 기존 선정6게임·08 전체 카탈로그 단언은 원본 full 구성 그대로입니다.
- 무필터 console 기록에서 warning/error 0, pageerror/CSP/실패HTTP/실패요청/외부요청0을 각 테스트의 자동 audit에서 검사합니다. WebKit은 screenshot 없이 DOM/layout JSON을 사용합니다.

## 검증 증거

실제 Node는 `C:/Program Files/nodejs/node.exe` v24.16.0입니다. 부모 shell의 TMP/TEMP는 자기 새 artifact 경로로 지정했고 GAME_LIVE_ORIGIN이 있으면 중지하도록 확인했습니다. 보고 출력/빌드 경로는 원본 launcher가 자식 시작 전에 직접 설정했습니다.

- tool-proof.json: 지정 문서 읽기/새 파일 쓰기/Node assert 성공.
- checks.json: 엄격 TS 실행 명령/exit. 최초 TS5112 원본을 보존한 뒤 TS7 명시 입력용 `--ignoreConfig`로 해결했습니다. 최신 spec와 지정 E2E/config의 strict 검사 exit0입니다.
- source-provenance.json: 제품 12파일의 지정07/08 commit 정확 바이트 일치.
- verification-summary-final.json 및 handoff.json: 실제 브라우저 보고서의 수집/실행/PASS/FAIL/skip을 프로젝트·논리 게임별 재집계한 최종 결과를 참조하십시오.

## 제한과 후속

독립 QA는 PM이 cody-02에 별도로 배정합니다. 실제 3116/main/PM2 반영, 실물 Android/iPhone/OS 숨김, 실음향 청취, 사람 완주를 수행했다고 주장하지 않습니다. 순수 속도/30초 생성/장시간 경계는 기존 07 단위31개 및 cody-02 검토를 재사용하며 이번 실제 브라우저 조작과 구분합니다. 기존6게임 회귀 하네스의 결정적 입력 정책은 그대로 보존했고 신규07/08에는 RNG를 교체하지 않았습니다. Node 호스트의 NO_COLOR/FORCE_COLOR 경고도 원본 stdout/stderr에 보존하며 브라우저 진단과 구분합니다.

공통 HANDOFF/작업일지/게시판/최종 상태 변경은 이번 단독쓰기 허용 경로 밖이므로 PM에게 인계합니다.

## 최종 실제 실행 결과 — BLOCKED

Smoke: 12/12, exit0. Full: 204개 실제 실행, 200 PASS/4 FAIL/skip0/flaky0, exit1. 각 프로젝트 수집/실행68개: desktop-chromium66/68, mobile-chromium66/68, mobile-webkit68/68입니다. 신규07 20논리×3=60실행 중58 PASS, 기존08 26논리×3=78실행 중76 PASS, 기존선정22논리×3=66/66 PASS입니다. --list가 아닌 실제 실행입니다.

계약의 정확한 두 명령을 사용했습니다:

- `C:/Program Files/nodejs/node.exe artifacts/g022-integration/run-playwright.mjs --mode=candidate --phase=smoke`
- `C:/Program Files/nodejs/node.exe artifacts/g022-integration/run-playwright.mjs --mode=candidate --phase=full`

실패: spec:292(08), spec:653(07). desktop/mobile Chromium에서 실제300ms busy loop 후 pauseReason=longframe은 확인되나 time이1/60초 증가했습니다. 08:0.175→0.19166666666666665(두 Chromium). 07 desktop:0.016666666666666666→0.03333333333333333, mobile:0.025→0.041666666666666664. WebKit의 동일 단언은 PASS입니다.

재현: 정상시작→blur보호정지→명시재개→공개snapshot을 읽은 직후 동일 evaluate에서300ms실제UI스레드지연→longframe정지 관측→직전time과의정확동등비교 FAIL. 07 `main.mjs#pump/frame` 및08의 동등RAF pump와 관측타이밍을 PM이 조사해야 합니다. 원인을 제품 버그/하네스 오탐으로 확정하지 않았습니다. 동일 실패가 두 Chromium에서 나타나 추가시험/수정을 중단했습니다. 시간허용오차 확대/skip/제품수정/재실행은 없습니다.

실패 사례 뒤쪽의 restart/home 취소·확정 단언은 Chromium에서 미도달, WebKit에서는 실행됐습니다. 별도홈quit사례는 세프로젝트 PASS입니다. 이전 본문은 구현한 시험의 범위이며 전항목 PASS 선언이 아닙니다. 초기smoke 뒤 진단첨부/MutationObserver 관측을 보강했고 full에서 최종smoke 사례도 모두 PASS했습니다.

원시 FAIL/trace: `artifacts/g022-integration/runs/20261027T121305826Z-8832ed5d/candidate`. 07/08의138실행 무필터 진단 집계: `{"attachments":138,"consoleWarningsErrors":0,"pageErrors":0,"csp":0,"external":0,"failedHTTP":0,"failedRequests":0}`. 최초집계는 기존회귀의다른진단스키마에서 실패하여 final-summary.log를 보존하고 parser를07/08첨부로한정해 final-summary-02.log에 재집계했습니다. 브라우저는 재실행하지 않았습니다.

최종 PM 후속: 원인 분리 및 필요시 좁은 제품fix 재배정→원본단언 재실행→cody-02 독립delta 검토. 전체통합/운영수용은 BLOCKED입니다.
