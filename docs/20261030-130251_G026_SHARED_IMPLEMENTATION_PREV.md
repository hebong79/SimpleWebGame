# G026 공통 통합 구현 인계 — 어댑터 완성 / 초기 HTTP smoke PASS

## 최신 G026-INTEGRATE-FINISH 결과
- status: **implemented_initial_http_smoke_passed_not_qa_acceptance**.
- root/branch/HEAD는 아래 준비 인계와 동일합니다. 두 실제 구현 인계와 각 `main.mjs`를 읽고 14 어댑터를 완성한 뒤에만 `G026_ADAPTERS_READY = true`로 변경했습니다.
- 이번 변경: `tests/e2e/g026-new-games.spec.ts`, `scripts/g026-verify.mjs`, 이 문서, 새 `artifacts/g026-integration/runs/**` 및 처음 생성한 `artifacts/g026-build/**`입니다. 착수 baseline과 제품/시험/실행기 비교에서 변경은 정확히 spec/runner **2파일**이며, 게임 source·전용 unit과 Git index/HEAD 바이트는 동일합니다.
- 새 통합 후보 build **exit0**, 실제 HTTP smoke **18/18 PASS, fail/skip/pending/flaky0, exit0**. 단위 실행0, full 실행0이며 PM의 앞선 단위76/76은 본 실행 수에 합산하지 않았습니다. **독립 QA13/QA14 수용·최종 full·운영 수용은 완료가 아닙니다.**
- 게임 source/전용 unit/PM 문서/QA 출력/QA 보호 빌드/기존 게임·build script·compiler·서버/ecosystem/Git index·commit/main/PM2/3116/보드는 수정하지 않았습니다. 이번 build/smoke는 원본 FAIL이나 재시도 없이 첫 실행이 통과했습니다.

### 실제 어댑터와 초기 smoke 범위
- 13은 기존 실제 인계 기반 `memoryLifecycle()`을 실행 검증했습니다: 숫자 `round`, `cards`, `timing`, `dialog.kind`, `#primary/#dialog-cancel/#dialog-apply/[data-choice]`입니다.
- 14는 `threeLifecycle()`을 추가했습니다: 객체 `round.{id,starter,current,board,moves,winner,winningLines}`, `modal`, `timing:null`, `stats.{session,lifetime}`, `record.lifetime`, `#start/#pause/#resume/#cell-0/#cell-4/#theme-paper/#theme-night/#modal-close/#modal-apply`를 사용합니다. 13의 snapshot/selector를 추측 재사용하지 않았습니다.
- 공개 홈 카드→시작→정상 입력→정지 동결→음소거 전환/복원→테마 preview/취소/적용→홈 취소 보존→명시 재개→홈 확인 복귀를 두 게임 모두 실제 실행했습니다. 14는 재시작 취소 보존과 재개 뒤 O 착수/차례도 검사했습니다.
- desktop Chromium1366×900, mobile Chromium320×667, mobile WebKit320×667에서 실행했습니다. 두 게임의320×480 테마창도 각 프로젝트별 기하 첨부로 최소44px target/가로 overflow 없음 단언을 유지했습니다.
- `locator.click({delay:80})`에 더해 실제 `performance.now()` pointerdown/up 간격과 `isTrusted`를 관측/단언했습니다. 신규게임 lifecycle6개 첨부의 모든 누름 >=80ms/trusted이며, raw 누름 수는13각15회/14각18회입니다. 가상시계·게임 setter·자동해답 분기·CSP 완화 없음.

### 실행기 변경과 보호
- `Local\\SimpleGamesG026BrowserGate`는 올바른 HANDLE/DWORD/BOOL 서명의 `WaitForSingleObject(h, 0xFFFFFFFF)`로 **정상 blocking acquire**합니다. 전체 browser child를 감싸고 finally에서 Release/Close합니다. 외부 polling·강제 종료·비차단 exit2 재시도가 아닙니다.
- PM의 명시 보호 입력 `artifacts/g026-qa-build/**`는 동시 생성되는 **새 경로 추가만** 허용합니다. 모든 기존 경로의 SHA/size/mtime·삭제 검사는 그대로 유지하며 QA빌드 전체를 보호집합에서 제외하지 않습니다.
- 실제 mutex owner→대기 contender→정상 해제 뒤 child 실행→재획득 자체시험 모두 exit0입니다. Win32 event/pipe 동기화이며 브라우저/제품 시험 수에는 합산하지 않았습니다.

### 실제 명령 / 원시 근거
```bash
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode build --build artifacts/g026-build
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode smoke --build artifacts/g026-build --origin http://127.0.0.1:3160
```
- 사전 `node --check`, 선택9spec+config strict TS7 CLI, `git diff --check`: 실제 exit0.
- 착수 baseline 및 mutex 자체시험: `artifacts/g026-integration/runs/9036f13d/finish-baseline.json`, `blocking-gate-report.json`.
- build: `artifacts/g026-integration/runs/f651e222/report.json` — **BUILD_CREATED_NOT_PLAYTESTED / exit0**.
- smoke: `artifacts/g026-integration/runs/93605244/report.json` — **EXECUTION_PASSED / exit0**, discovered18/browserExecuted18/passed18/failed0/skipped0/pending0/flaky0/unitExecuted0.
- 실제 실행 JSON: 위 smoke run의 `execution/playwright-results.json`. 별도 discovery JSON은 `discovery/discovery.json`입니다.
- HTTP runtime119응답 전부200, 빌드 원본 바이트/SHA256·엄격 CSP·nosniff 일치: 위 run의 `http-bytes.json`.
- 새 spec12개 실제 testcase의 무필터 console/pageerror/CSP/external/failedHTTP/failedRequests/unsafeMethods 목록 모두0. 원시 진단·실측 누름·짧은창 기하 첨부를 코드로 재집계했습니다.
- smoke 전후 역사 보호512파일 SHA/size/mtime 동일, 그중 QA 보호 빌드155파일도 동일. 이번 smoke 중 동시 QA빌드 신규 파일0. 자기 서버3160만 종료하고 `ECONNREFUSED` 확인.
- 최종 재집계/현재 source177·output155 재대조/실제 child19개 exit0·signal null: `artifacts/g026-integration/runs/2dc9e6ab/finish-verification.json`.

### 동결 후보 해시
- Build ID: `d3bed4e1-c76c-4d89-8536-24fda9c71a71`.
- Manifest: `artifacts/g026-build/g026-build-manifest.json`.
- Manifest SHA256: `2c4238142c63cc507f3efa5f8e6445f4cd092d335818eda43025aee7898ea648`.
- Source aggregate SHA256: `cca44e17c063619703ea52478e5f49ab228f02eb2e700c8e8c72808102398b5e`.
- Output aggregate SHA256: `599df5a0ec6f3381e3152ccd550442cd83b2d63bc325d37e0802359b7984a8a7`.
- aggregate는 경로를 JavaScript `localeCompare`로 정렬한 object의 compact `JSON.stringify` 바이트 SHA256입니다. 개별파일 SHA는 manifest에 있습니다.

### PM 최신 full 명령 / 남은 게이트
본 후속에서는 full을 실행하지 않았습니다. 독립 QA13/QA14 결과 인수와 PM 최종 회귀 게이트를 유지합니다. 현재 입력/후보가 그대로일 때 아래 명령을 실행하십시오.
```bash
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode full --build artifacts/g026-build --origin http://127.0.0.1:3160
```
source/시험/runner가 바뀌면 구후보를 보존하고 새 `--build artifacts/g026-build-r2`로 build→smoke→full을 맞춥니다. manifest 수정 재사용 금지. foreground 제한 예상 시 처음부터 동일 명령을 tracked background+완료 알림으로 실행하고 외부 wrapper 로그는 `artifacts/g026-pm/**`에 둡니다.

실물 손가락/실음향청취/사람 플레이시간/OS-native 숨김/WebKit PNG 시각 수용은 미검증입니다. Chromium PNG는 홈 렌더 증거이며 새 게임 전체 시각 수용으로 확대하지 않습니다. 배포·3116 직접검증·게시/작업일지는 PM의 별도 승인/완료 경로입니다.

---
## 이하: 앞선 준비 단계의 당시 인계 (역사 보존)
아래 `prepared_blocked`, ready=false, 비차단 mutex 및 다음 작업 표현은 **후속 전의 상태**이며 위 최신 실행 결과로 갱신되었습니다. 기존 정적 PASS/관측 FAIL/전제 BLOCKED 원본은 그대로 보존했습니다.

## 준비 당시 상태와 경계
- task_id: `G026-INTEGRATE`
- status: **prepared_blocked_builder_handoffs**. 홈 등록·실행기·카탈로그/저장 시험 준비와 정적 검증은 마쳤으나, 새 게임 라이프사이클 어댑터 및 실제 후보 실행은 완료가 아닙니다.
- root: `E:/Work2/Project/SimpleGames/worktrees/g026-fourteen-game-release`
- branch/base: `feature/g026-fourteen-game-release` / `5e7eb28e87fb14f3c0725aad1f420370c76736bf`
- 마지막 준비 검증에서 두 게임 소스·전용 단위시험은 발견됐지만 `docs/G026_13_IMPLEMENTATION.md`, `docs/G026_14_IMPLEMENTATION.md`가 없었습니다. 기다리거나 폴링하지 않았습니다.
- 마지막 Git 상태 확인 때 13 인계가 도착하여 실제 `G026_13_IMPLEMENTATION.md`를 읽고 13의 snapshot/selector에 맞는 `memoryLifecycle()`을 추가했습니다. 이 어댑터의 브라우저 실행은 아직 하지 않았습니다. 14 인계는 마지막 확인에서 없었으며 폴링하지 않습니다.
- `G026_ADAPTERS_READY = false`이며 14의 `lifecycle()`은 명시적 BLOCKED 오류를 냅니다. 구현에 없는 snapshot 필드/버튼 ID를 추측해 넣지 않았습니다. **PM의 두 인수 후 통합 워커 후속 배정이 필요**합니다. 준비 초안을 전체 통합 PASS로 취급하지 마세요.
- 빌드·실제 HTTP·Playwright discovery·브라우저·게임 단위 실행은 모두 **미실행**입니다. Win32 gate 자체 자식 실행과 reporter 음성 대조는 제품 시험 수에 넣지 않았습니다.
- main/index/commit/push/PM2/ecosystem/3116/기존 서버·빌드·게임 소스는 수정하거나 실행하지 않았습니다. 운영 승인 무응답은 그대로 미승인입니다. 작업일지·보드 게시·독립 QA 배정은 PM 소유입니다.

## 변경 내용과 소스 소유권
| 경로 | 변경 / 소유자 |
|---|---|
| `src/client/library.ts` | INTEGRATE: 기존 41개 레코드의 모든 값과 상대 순서를 보존하고 `snack-pairs`, `star-moon` 두 available 레코드 추가. 기존 12개 다음에 위치하므로 새 카드는 첫 12개에 없습니다. |
| `src/client/library.ts`의 `artwork()` | INTEGRATE: 직접 작성한 96×96 간식 카드 한 쌍/별달 3목 SVG primitives. 기존 `mini-g022` CSS 재사용, 외부 이미지·참조·폰트·새 파일 없음. 아트 원본은 이 함수 자체이며 프로젝트 제작 원본입니다. |
| `package.json` | INTEGRATE: description만 변경, scripts/dependencies/lock 불변. |
| `scripts/g026-verify.mjs` | INTEGRATE: G026 전용 실행기. 기존 G025 실행기/빌드·서버 스크립트는 불변. |
| `tests/g026-playwright.config.ts` | INTEGRATE: candidate3160 전용, PC Chromium/320px mobile Chromium/320px mobile WebKit 3프로필. |
| `tests/e2e/g026-new-games.spec.ts` | INTEGRATE: 검색/더보기43·14·29, 독자 카드 아트, 기존 upcoming 별도 보존, 신규+기존 즐겨찾기, 12개 product-valid 저장 fixture와 sentinel byte 보존, 320/짧은 화면/reducedmotion 기하 및 무필터 console/CSP/network 기록. 13 어댑터는 실제 인계 기반 작성/실행 미검증, 14 어댑터는 인수 의존 미작성. |
| 아래 기존 spec 7개 | INTEGRATE: 정확한 카탈로그 수/링크/페이지 노출 갱신만. 기존 게임 규칙·단언·시험 skip/timeout/CSP는 완화하지 않았습니다. |
| `docs/G026_SHARED_IMPLEMENTATION.md` | INTEGRATE 인계 문서. |
| `artifacts/g026-integration/runs/**` | INTEGRATE 실행별 새 증거. 실패도 보존하며 재사용 경로 덮어쓰기 금지. |

기존 spec 갱신:
- `tests/e2e/library-integration.spec.ts`:43개,12→24→36→43,29 upcoming 유지.
- `tests/e2e/multi-game-integration.spec.ts`:43/14/29, available 필터 후 공개 더보기로14개 노출, 정확한14 ID.
- `tests/e2e/live-server.spec.ts`:43/14/29, 정확한14 URL, available14도12개씩 pagination함을 보존.
- `tests/e2e/breakout-integration.spec.ts`:43/14/29 표시만.
- `tests/e2e/runner-jumper.spec.ts`:43/14/29 및 전체 링크14·pagination43.
- `tests/e2e/g024-new-games.spec.ts`:43/14/29 표시만. 기존 `memory-pieces` 즐겨찾기는 이미 공개 더보기 loop로 노출하므로 계속 유지했습니다.
- `tests/e2e/g025-new-games.spec.ts`:43/14/29 표시. 기존 두 게임이 포함된 기존 첫12 DOM 검사는 그대로 유효합니다.

`public/library.css`는 원래 없었고, 실제 공유 CSS `public/home.css` 수정 없이 아트를 구현했습니다. `memory-pieces`/`leisure-line`을 바꾸거나 새 게임으로 재사용하지 않았습니다.

## 실행기 게이트
- 허용 origin은 `http://127.0.0.1:3160` 하나입니다. live profile/원격 origin/운영 실행 인자는 없습니다. 상속된 `GAME_*` 환경은 제거하고 각 child 시작 전에 `GAME_TEST_BUILD_DIR`, `GAME_TEST_ARTIFACT_DIR`, G026 모드·origin을 명시합니다.
- Windows/절대 Node `C:/Program Files/nodejs/node.exe` v24.16.0, TS7.0.2, PW1.64.1, Chromium/WebKit 실행파일, Python을 확인합니다. 설치·fallback/승인 우회는 하지 않습니다.
- 실제 소스/전용 단위/두 구현 인계/어댑터 준비가 없으면 compiler/build/server/browser 전 즉시 exit2 BLOCKED입니다. 재시도·기다림·skip 대체 없음.
- `build`는 새 `artifacts/g026-build` 또는 명시한 새 revision만 생성합니다. 이미 존재하면 거부합니다. source/output SHA256 및 물리 root의 manifest를 만들고 smoke/full/config가 다시 대조합니다. 소스나 시험 수정 후 이전 build manifest를 재사용할 수 없습니다.
- candidate 서버는 해당 프로세스가 직접 소유한 loopback3160만 생성합니다. 이미 점유됐다면 foreign 서버를 재사용/종료하지 않습니다. finally에서 자기 서버만 close하고 ECONNREFUSED를 다시 확인합니다.
- 실제 브라우저 child 전체는 `Local\SimpleGamesG026BrowserGate` named Win32 mutex가 감쌉니다. `CreateMutexW/WaitForSingleObject/ReleaseMutex/CloseHandle`의 HANDLE/DWORD/BOOL 시그니처와 중첩 finally가 있습니다. 경합은 비차단 exit2로 보고하고 기다리지 않습니다. 단위/정적 검사는 gate 밖입니다.
- full은 기존 공통 compiled unit+모든 게임 unit+원본 launcher unit을 TAP reporter로 실제 실행합니다. launcher의 원래 고정 g017 fixture 경로 때문에 원본 시험·대상 모듈·package를 동일 바이트/SHA로 짧은 현재 run `/l`에 복제합니다. 이때 stub/fixture 단위 결과를 HTTP 수용으로 부풀리지 않습니다. 실측 해당 최심 fixture 경로 예시는210자입니다.
- 선택 browser spec은 기존 G025 필수8개+G026입니다: live-server/library/multi-game/breakout-integration/runner-jumper/flappy-input/g024/g025/g026. full에서 기존12개 게임 범위를 유지하며 새2개를 추가합니다. smoke는 G026 `@smoke`와 기존 홈/HTTP 게이트입니다.
- discovery JSON과 execution JSON을 분리합니다. `discovered`, `browserExecuted`, `unitExecuted`, passed/failed/skipped/pending 및 각 child 실제 exit/signal/stdout/stderr를 보존합니다. 미실행/skip/interrupted는 실행 PASS로 합산하지 않으며 retries0입니다.
- 시험 전 모든 `tests/**/*.ts,mjs`의 출력경로 관련 줄을 감사합니다. selected browser spec의 고정 artifacts 출력은 차단하고 `TestInfo.outputPath/attach`와 child env를 사용합니다.
- 현재 run 및 승인된 동시 writer `g026-pm`, `g026-qa13`, `g026-qa14`, `g026-13-builder`, `g026-14-builder`는 역사 보호 탐색에서 제외합니다. 그 외 과거 artifacts는 실행 전후 SHA/size/mtime 및 집합이 같아야 합니다. 새 빌드 예외는 그 실행이 실제로 새로 만든 명시 build에만 적용합니다.
- 부가 Chromium PNG는 actual 실행 시 생성합니다. 엄격 CSP 아래 WebKit screenshotter는 사용하지 않고 DOM/SVG/기하 증거와 이미지 미검증을 명시합니다. 실물 휴대폰·실제 음향청취·인간 플레이 시간/OS-native hiding은 별도 미검증입니다.

## 실제 준비 검증 근거
1. `artifacts/g026-integration/runs/0b63fb7a/static-report.json`
   - 절대 Node/TS/PW 실제 버전 확인, runner `--check`, 제품 `tsc --noEmit`, 새 config+선택9 spec strict TS CLI, `git diff --check` 모두 exit0.
   - 기존 catalog41 모든 필드/상대 순서, 첫12 보존; 실제 배열43/available14/upcoming29 확인.
   - 기준 Git 바이트와 기존 게임·server·빌드·launcher·G025 runner·ecosystem·lock **74파일** 대조 일치. package는 description 이외 동일.
   - 실제 Windows mutex 자식 획득→경합 child exit2→finally 해제→재획득 확인. 브라우저를 띄우지 않은 실행기 자체시험입니다.
   - TAP/Playwright parser의 skipped/pending/interrupted 음성 fixture 확인. 가짜 제품 출력/통과 수가 아닙니다.
2. `artifacts/g026-integration/runs/d7284991/report.json`
   - 실제 `--mode smoke --origin http://127.0.0.1:3160`는 두 builder 인계 누락으로 **exit2 BLOCKED**, discovered0/browserExecuted0/unitExecuted0. 서버/빌드/브라우저 미시작.
3. `artifacts/g026-integration/runs/4d1150b4/static-report.json`
   - 첫 정적 하네스가 설치 TS7의 `ts.ScriptTarget` 부재로 실패한 원본입니다. 제품 결함이나 게임 FAIL이 아닙니다. 기존 catalog literal을 읽는 정적 parser로 교정한 새 run0b63fb7a가 통과했으며 원본은 덮어쓰지 않았습니다.

## 인수 뒤 PM/통합 워커의 다음 작업
1. PM이 BUILD13/BUILD14 실제 산출물과 자체시험을 인수합니다. 두 게임별 독립 QA는 이 인계와 별도입니다.
2. 통합 워커에게 새 게임 spec의 14 `lifecycle()`을 실제 `G026_14_IMPLEMENTATION.md`와 일치하도록 완성하고, 실제 13 인계 기반 `memoryLifecycle()`도 초기 smoke에서 검증하도록 배정합니다. 실제 snapshot 경로·phase·round·저장·modal/controls를 읽어 구현하며, 시작/정상입력/정지 동결/취소보존/명시재개/음소거/테마취소·적용/홈복귀/짧은 modal 기하·trusted80ms를 단언합니다. 두 어댑터가 실제 구현됐을 때만 ready flag를 true로 변경합니다. **flag만 바꾸는 우회는 금지**입니다.
3. static CLI를 다시 통과시키고 아래 명령으로 PM이 새 build→초기 실제HTTP smoke를 실행합니다. 그 뒤 source/build 해시 동결과 정확히 두 독립 tester의 실제 수행, 필요 수정/재검증, full로 진행합니다.
4. 이후 소스/시험이 달라지면 기존 후보를 보존하고 새 `--build artifacts/g026-build-r2`를 세 명령 모두에 동일하게 명시합니다. build manifest 수정을 통한 재사용은 하지 않습니다.

## PM 실행 명령 (Git Bash / 해당 root)
아래 명령은 **두 인수+실제 어댑터 완성 후**에만 실행 가능합니다. 현 준비 상태에서는 의도적으로 BLOCKED입니다.

```bash
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode build --build artifacts/g026-build
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode smoke --build artifacts/g026-build --origin http://127.0.0.1:3160
"C:/Program Files/nodejs/node.exe" scripts/g026-verify.mjs --mode full --build artifacts/g026-build --origin http://127.0.0.1:3160
```

full이 foreground 제한을 넘으면 **같은 명령을 처음부터 tracked background+완료 알림**으로 실행하세요. 다른 경로에서 로그를 현재 runs 보호집합에 덧쓰지 마시고 PM 외부 wrapper 로그는 승인된 `artifacts/g026-pm/**`에 두세요.

발견 목록만 필요하면 `--mode full --build artifacts/g026-build --list`를 사용합니다. 이는 browserExecuted0의 discovery이며 PASS가 아닙니다. 직접 Playwright/config 호출은 build·report·gate 인자가 맞지 않으면 fail-closed입니다.

정적 검사만 실행하는 명령:
```bash
"C:/Program Files/nodejs/node.exe" --check scripts/g026-verify.mjs
"C:/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --noEmit
"C:/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node tests/g026-playwright.config.ts tests/e2e/g026-new-games.spec.ts tests/e2e/live-server.spec.ts tests/e2e/library-integration.spec.ts tests/e2e/multi-game-integration.spec.ts tests/e2e/breakout-integration.spec.ts tests/e2e/runner-jumper.spec.ts tests/e2e/flappy-input.spec.ts tests/e2e/g024-new-games.spec.ts tests/e2e/g025-new-games.spec.ts
```
