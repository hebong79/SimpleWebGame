# G-005 독립 QA 보고서 — 숫자 정원 · 2048

## 최종 PM 수용 — 2026-10-22 01:13 KST

**개발용 MVP 납품 수용**입니다. G-008 독립 검토가 추가로 발견한 G008-001을 PM이 세 브라우저에서 재현하고, G-009의 전역 포인터 관찰 enabled-guard 제거 한 줄을 직접 검토했습니다. 새 제스처 허용 검사는 유지되며 전역 이벤트 기본동작 차단은 추가하지 않았습니다.

최종 `npm run typecheck`, `npm test`(실제 빌드 및 **44/44 단위·서버**), `npm run test:e2e`(**57/57**, 각 프로젝트19개), 아트15개 검사가 모두 종료0입니다. 기존54개를 변경하여 실패를 숨긴 것이 아니라 `hybrid-input.spec.ts` 회귀3개를 추가하여 수정 전3실패→수정 후3통과와 전체57통과를 확인했습니다. 최종 skipped/flaky/실패0입니다.

- 증거: `artifacts/pm/{command-results,final-verification}.json`, `unit-final.log`, `e2e-final.log`, `hybrid-before.log`, `hybrid-before-results.json`.
- 해결 결함: QA-001(보드밖 다중터치), QA-002(모달초점), G008-001(입력잠금중 추가터치 누락).
- 아래32 PASS/0 FAIL/6 UNVERIFIED의 실기기·환경 한계는 그대로 남습니다. MVP 납품 수용이 실물 모바일·음향/저장권한·모든뷰포트/상태 조합·Firefox·공개서비스 품질보증을 뜻하지 않습니다.
- PM은 해당 미검증 항목을 숨기지 않는 개발용 산출물 전달로만 수용합니다. 운영/공개배포·실기기 최종승인은 별도입니다.
- 최종 보안증거54개에서 외부요청0/앱오류0. 별도 혼합입력3개는 입력회귀이며 기존파일의 보안집계와 섞지 않습니다. 스크린샷도구오류11개는 분리 보존합니다.

## 이전 PM 회귀 기록 — 2026-10-22 01:06 KST

아래 G-005 본문은 **수정 전 1차 QA의 역사적 기록**입니다. 실패를 숨기지 않기 위해 보존하며, 수정 전 전체 증거는 `artifacts/qa-baseline-needs-fix.zip`에 있습니다.

G-007이 QA-001/QA-002를 수정한 후 PM이 테스트 소스를 변경하지 않고 타입검사, 빌드 포함 단위/서버 **44/44**, 독립 QA 브라우저 **54/54(각 프로젝트18개)**, 아트15개 검사를 재실행해 전부 통과했습니다. 종료코드 모두0, skipped0/flaky0/실패0입니다.

- 실제 로그: `artifacts/pm/{typecheck-final,unit-final,e2e-final,assets-final}.log`.
- 실행결과/집계: `artifacts/pm/command-results.json`, `artifacts/pm/final-verification.json`, `artifacts/qa/playwright-results.json`.
- 기존 AC-I04, AC-V03의 자동검증 실패는 해소되어 **자동증거 기준32 PASS / 0 FAIL / 6 UNVERIFIED**입니다. 아래 미검증 실기기·환경 항목을 통과로 바꾸지 않았습니다.
- 최종54개 보안증거에서 외부요청0/앱 console·page error0. WebKit 스크린샷도구 CSP오류11개는 별도 보존하며 원시로그 전체0을 주장하지 않습니다.
- 최종 수정코드 독립검토는 `docs/QA_FIX_REVIEW.md`로 별도 기록합니다. 실제 휴대폰·음향청취·물리 저장권한/용량과 전체상태×전체해상도 조합은 여전히 미검증입니다.

---

# 1차 QA 기록 (수정 전)

## 판정

**수정 필요(수용 보류)**입니다. 제작자가 아닌 별도 QA로 소스·설계·저장·서버 경계를 읽고 독립 Playwright 회귀 검증을 작성·실행했습니다. 최종 브라우저 실행은 **54건 중 48 통과 / 6 실패 / 건너뜀 0**입니다. 실패는 **서로 다른 제품 결함 2종이 세 프로젝트에서 각각 재현**된 것입니다. 실패 테스트를 expected-failure로 숨기거나 제품 코드를 수정하지 않았습니다.

38개 AC의 보수적 최종 매핑은 아래에 있습니다. PASS는 해당 행의 자동 검증 증거가 충족된 경우이며, 필요한 추가 수동·환경 검증이 남은 행은 UNVERIFIED로 남겼습니다. 브라우저 테스트 통과 수와 AC 통과 수는 서로 다른 집계입니다.

## 환경 및 실행

- 검증 일시: **2026-10-22 00:55~00:56 KST** 최종 실행/집계입니다. 전체 작업의 모든 실행을 이 시각에 했다는 뜻은 아닙니다.
- Windows 호스트의 Python platform 출력: `Windows-10-10.0.26200-SP0` (제공 환경은 Windows 11입니다. Python의 NT 호환 표기를 Windows 10 실기기 판정으로 해석하지 않습니다.)
- Node **v24.16.0**, TypeScript **7.0.2**, Playwright **1.64.1** — `artifacts/qa/typecheck.log`.
- 실제 headless Chromium **156.0.8078.4**, Playwright WebKit **27.2**.
- `desktop-chromium`: 1366×900, Desktop Chrome 설정.
- `mobile-chromium`: 375×667, Pixel 7 에뮬레이션.
- `mobile-webkit`: 390×844, iPhone 13 에뮬레이션. **실제 iPhone/Safari가 아닙니다.**
- 추가 CSS viewport: 320×568, 375×667, 768×1024, 1366×768, 667×375. 세 프로젝트 각각에서 플레이 레이아웃을 검사했습니다.
- 테스트 서버: `http://127.0.0.1:3102`, Playwright 자동 시작/종료, `reuseExistingServer:false`. 진단/추가 HTTP 검사는 PM의 기존 loopback **3101** 서버를 이용했습니다. LAN 바인딩·공개 배포를 실행하지 않았습니다.

```sh
npm run typecheck
npm test
python assets/generate_assets.py --check
HOST=127.0.0.1 PLAYWRIGHT_HTML_OUTPUT_DIR=artifacts/qa/html npm run test:e2e -- --output artifacts/qa/test-results
node tests/e2e/diagnostic.mjs
node tests/e2e/security-audit.mjs
```

| 실행 | 실제 결과 | 근거 |
|---|---|---|
| `npm run typecheck` | 종료 0, 최종 재검사도 0 | `typecheck.log`, `typecheck-final.log` |
| `npm test` (실제 build 포함) | 종료 0, **44/44 통과** | `unit-tests.log` |
| 자산 `--check` | 종료 0, 런타임 SVG 15개 일치 | `assets-check.log` |
| 최초 브라우저 실행 | 종료 1, 45건 중 31 통과/14 실패 | `e2e-first.log`, `playwright-first-results.json` |
| 최종 브라우저 실행 | 종료 1, **54건 중 48 통과/6 실패** | `e2e-final.log`, `playwright-results.json`, `run-summary.json` |
| 추가 raw HTTP/정적 보안 검사 | 종료 0, 원문 요청 16건/위험 sink 0개 | `security-audit.log`, `security-http-static.json` |
| Git 상태 | `.git`이 없어 확인 불가 | 별도 Git 변경 이력/깨끗한 diff를 주장하지 않습니다. |

최초 실행의 중복 버튼 selector와 위 방향 no-op을 유효 이동으로 센 테스트 오류는 **QA 테스트만 수정**했습니다. WebKit의 AudioContext 미지원과 스크린샷 도구의 CSP 오류도 제품 결함과 구분했습니다. 최종 제품 실패 두 종류는 반복해서 고치려 하지 않고 보고하며, 프로덕션 파일·설계·PM 문서는 수정하지 않았습니다.

## 제품 결함

### QA-001 — 다중 포인터의 두 번째 손가락이 보드 밖이면 이동이 실행됩니다

- **심각도: 중간 / 규칙·입력 계약 위반**, AC-I04.
- 위치: `src/client/input.ts:30-38`, `39-44`. 활성 포인터 집합이 **보드의 pointerdown만** 관찰합니다. 첫 포인터가 보드 안에 있고 두 번째 포인터가 페이지 다른 곳에 있으면 다중 포인터로 인지하지 못합니다.
- 재현: 새 판 시작 → 첫 손가락을 보드 중앙에 유지 → 두 번째 손가락을 보드 밖 상단 `(20,20)`에 유지 → 첫 손가락만 오른쪽 50 CSS px 이동 후 놓습니다.
- 기대: 다중 터치이므로 제스처 전부 무효, 보드/점수/생성/이동 수 불변.
- 실제: `[2,2,0,0]` 첫 행이 `[2,0,0,4]`로 변하고 유효 합치기 1회가 실행됩니다.
- **Chromium 두 프로젝트는 CDP `Input.dispatchTouchEvent`로 실제 브라우저 터치 경로에서 재현**했습니다. WebKit은 실제 브라우저 안의 PointerEvent + 캡처 shim 어댑터로 재현했으며 실물 터치를 주장하지 않습니다.
- 증거: 테스트 **14**, `multitouch-{desktop-chromium,mobile-chromium,mobile-webkit}.json`, 최종 결과의 해당 trace/screenshot.
- 제안: 활성 제스처 중 document/window 수준 두 번째 포인터도 감시해 취소하고, reset/destroy에서 해제하는 방향을 제작자가 검토하십시오. QA는 수정하지 않았습니다.

### QA-002 — 모달 내부 Tab/Shift+Tab 순환 요구가 충족되지 않습니다

- **심각도: 중간 / 키보드 접근성·상태 UX 위반**, AC-V03.
- 위치: `src/client/main.ts:161-164`, `194-196`. native `dialog.showModal()` 및 최초 초점만 있고, 명시적인 내부 순환 처리는 없습니다.
- 재현: 시작 → 도움말 → “도움말 닫기”에 초점 → Tab(또는 마지막/첫 버튼에서 경계 Tab).
- 기대: 설계의 내부 Tab 순환에 따라 모달 안의 버튼/초점 대상에 머무릅니다.
- 실제: `document.activeElement`가 **BODY**, `document.hasFocus()`가 **false**가 되어 브라우저 UI 쪽으로 초점이 나갑니다. 다음 Tab으로 돌아올 수는 있습니다. 이때 blur 보호가 작동해, 도움말을 닫으면 불필요하게 일시정지창으로 돌아갑니다.
- native dialog가 **배경 앱 버튼을 활성화시키는 보안 탈출은 아닙니다**. 브라우저 자체 UI로 나가는 동작과 프로젝트가 명시한 “내부 Tab 순환”의 차이를 보고합니다. PM이 native 동작을 의도한 것이라면 설계 변경/위험 수용 판단이 필요합니다.
- 증거: 테스트 **02** 세 프로젝트 실패, `diagnostic.json`의 Chromium/WebKit 초점 배열, 최종 실패 trace/screenshot.
- 같은 실패를 더 반복하거나 제품을 고치지 않았습니다.

## 검증 방식과 도구 한계

### 독립 규칙/상태

- 독립 reference 압축·합치기 알고리즘으로 625개 길이4 행을 네 방향으로 검사하여 **프로젝트당 2,500개 벡터**를 대조했습니다. 원본 불변과 점수도 비교했습니다 (`rules-*.json`). 임의 4×4 전체 상태 공간의 완전 탐색은 아닙니다.
- 정상 흐름은 프로덕션 모듈 그대로 사용합니다. 승리/막힘/4096/no-op/해금 경계만 Playwright route에서 **컴파일된 `state.js`의 startGame 반환값을 테스트 전용 wrapper로 교체**합니다. 프로덕션 디버그 API나 소스 수정은 없습니다. 난수 고정은 테스트 컨텍스트 안에만 적용합니다.
- 승리+막힘 우선순위, 계속하기 비활성/결과 보기, 종료·성공 각각 1회 집계, 재도전 추가 확인 없음, 재시작 취소/확정, no-op RNG 0회/유효 이동 RNG 2회, 즉시 저장, 잠금/해금/선택/재진입을 검증했습니다.
- 순수 엔진은 DOM·시간·저장에 의존하지 않고, state가 판정 후 한 번에 반환하며, 저장은 필드 허용 목록으로 새 객체를 만듭니다. `innerHTML`/eval/Function/문서 쓰기/전체 저장소 삭제 sink는 이번 소스 검사에서 발견되지 않았습니다.

### 외부망 차단·보안

- 각 테스트는 새로운 브라우저 context로 시작합니다. HTTP route에서 **127.0.0.1 / localhost / ::1만 통과**시키고 나머지 원격 호스트는 기록 후 중단합니다. localhost 서버까지 끄는 DevTools 전체 offline이 아닙니다.
- 최종 **54개 네트워크 증거 파일에서 외부 요청 0건**입니다. 시작/플레이/정원/음소거/승리·결과/저장·reload 경로를 검사했습니다.
- 별도 raw Node HTTP 요청은 URL 정규화를 거치지 않습니다. `../`, 단/이중 인코딩, malformed %, NUL, 역슬래시, 드라이브, UNC, ADS, .env/.git, TS·문서/디렉터리 요청은 안전한 4xx였습니다. HEAD 본문 없음, POST405를 확인했습니다. 기존 서버 단위테스트의 **실제 외부 junction 403**도 이번 `npm test`에서 재실행되었습니다.
- CSP, MIME, nosniff, 고정 테마 ID, 악성 테마 문자열/원격 URL 주입 후 숫자 보존·기본 테마 복구를 확인했습니다. 외부 연결·데이터 유출·주입 취약점은 이번 검사에서 발견하지 않았습니다. 범용 보안 감사나 모든 TOCTOU/운영 배포 위협의 부재 보장은 아닙니다.

### 콘솔/CSP는 도구가 만든 오류를 숨기지 않고 분리합니다

- Chromium은 앱/자동화 경로 콘솔·페이지 오류 0개입니다.
- Windows WebKit에서 **Playwright 스크린샷이 inline `body {}` 스타일을 삽입**하여 엄격한 CSP가 이를 차단하는 오류가 있습니다. 설치된 `node_modules/playwright-core/lib/coreBundle.js:22719-22725`의 screenshot sync 코드에서 확인했습니다.
- `diagnostic.json`은 **스크린샷 전 오류 0개 / 스크린샷 직후 CSP 오류 1개**를 기록합니다. CSP를 완화하지 않았습니다.
- 명시적 스크린샷 중 같은 오류는 `screenshotToolErrors`로 별도 보존합니다(최종 **11개**). 실패 시 Playwright 자동 스크린샷은 QA wrapper 밖에서 실행되어 실패한 WebKit 두 테스트의 `consoleErrors`에 **2개** 남았습니다. 따라서 **전체 원시 콘솔 로그가 0이라고 주장하지 않습니다**. 원시 값과 분류를 `security-*.json`/`run-summary.json`에 보존했습니다.
- 이 도구 오류가 제품 CSP 취약점이라는 증거는 없습니다. 제품의 일반 상호작용에서 같은 오류는 관찰하지 못했습니다.

### 음향·저장·실기기

- Chromium에서 실제 AudioContext/oscillator 호출을 감싸 기본 무음, 사용자 클릭 뒤 활성화, 합치기 1회당 oscillator start1회, no-op·단순 이동 추가 start0회, 설정 reload, 활성화 실패 후 게임 진행을 검사했습니다. **스피커 청취는 하지 않았습니다.**
- Windows Playwright WebKit **27.2에는 `AudioContext`가 없었습니다** (`diagnostic.json`). 미지원 시 무음 fallback 및 게임 진행은 통과했지만 WebKit 실제 합성음 재생은 미검증입니다. 이 결과를 실제 iPhone 오디오 결함으로 단정하지 않습니다.
- 저장 접근 getter/읽기/쓰기에서 SecurityError/QuotaExceededError를 주입하고 경고 지속·메모리 플레이를 확인했습니다. **브라우저 설정에서 실제 권한을 차단하거나 물리적 용량을 소진한 재현은 아닙니다.**
- blur/hidden은 브라우저 이벤트로 검사했습니다. hidden은 document getter 어댑터이며 실제 OS 탭 숨김 시험은 아닙니다. 별도 Tab 경계 진단은 실제 브라우저 초점 이탈을 관찰했습니다.
- 실제 Android/iOS, 물리 손가락 다중 터치·회전·노치/안전 여백, Firefox, 실제 음향 청취는 미검증입니다.

## 화면 확인

직접 이미지로 연 증거: `desktop-chromium-layout-1366x768.png`, `mobile-webkit-layout-320x568.png`, `mobile-webkit-victory-blocked.png`, `mobile-webkit-4096.png`입니다. PC의 좌 보드/우 정원, 320px 세로 배치, 승리+막힘 설명과 비활성 계속하기, 4096 실제 숫자와 최상위 아트는 가독성이 유지되었습니다. 플레이 레이아웃 다섯 viewport 모두 가로 overflow 없음/보드 정사각형/표시 중 기본 버튼 44px 이상 측정은 통과했습니다 (`layout-*.json`). 모든 viewport의 모든 모달·성공·결과 상태 조합을 완전 검사했다고 주장하지 않습니다.

비차단 제안: `public/style.css:5`의 모바일 정원 그림은 `object-fit:cover`와 1.8 비율로 원본 3:2 장면을 일부 자릅니다. 현재 숫자나 조작을 가리지는 않지만, ASSETS의 비율 보존 권장에 맞춰 제작자가 contain/원본 비율을 검토할 수 있습니다. 작은 보조 문구는 8~10px여서 실물 기기 가독성 확인을 권장합니다.

## 38개 수용 기준 actual 매핑

증거 약어: **U**=`unit-tests.log`(이번 QA가 직접 44/44 재실행), **E##**=`independent-qa.spec.ts` 번호 및 `playwright-results.json` 해당 케이스, **L**=`layout-*.json`/화면, **H**=`security-http-static.json`, **N**=`security-<project>-*.json`, **A**=`assets-check.log`/`docs/ASSETS.md`. FAIL은 제품 결함, UNVERIFIED는 일부 자동 확인이 있어도 행 전체를 충족했다고 판단하지 않은 항목입니다.

| AC | Actual | 실제 결과·증거 |
|---|---|---|
| AC-R01 | PASS | 준비 빈 보드/자동 시작 없음/명시 시작2개·점수0·시작수1, U/E01 |
| AC-R02 | PASS | 필수 단일 합치기 벡터+4방향 대칭, U/E13 독립2,500벡터 |
| AC-R03 | PASS | 위치 처음/끝·0/0.899999/0.9/0.999999 값 경계, U engine spawn |
| AC-R04 | PASS | no-op 보드/저장/카운터/RNG 불변, 유효 이동1개 생성, E04/E12/U |
| AC-R05 | PASS | frozen 원본/행·합 보존·부정값/overflow 거부, U/E13 |
| AC-R06 | PASS | 12점 벡터 U, 4096 텍스트/아트/득점·성공 중복 없음 E06 |
| AC-R07 | PASS | 빈칸/인접/대각 막힘 판정 U, 결과 사유/점수/최고/재도전 E05 |
| AC-R08 | PASS | 계속하기 E06, B-02 성공우선/계속불가/결과/각 기록1회 E05 |
| AC-F01 | PASS | 첫 준비/도움말24px/명시 시작/미저장 안내, E01/public UI |
| AC-F02 | PASS | 취소보존/확정새판/기록유지·포기종료 미증가, E01/E05 |
| AC-F03 | PASS | 피드백 중 pause·시간경과 불변·명시재개, E03 |
| AC-F04 | UNVERIFIED | blur/모달 유지/hidden 어댑터 통과 E03, 실제 OS 탭 숨김·예약음 청취 미수행 |
| AC-F05 | PASS | reload 준비/시작수불변/기록·선택·음소거 유지, E01/E07/E12 |
| AC-F06 | PASS | 확인/도움말/정원/성공/결과에서 이동 차단·닫기 누수 없음, E01/E03/E05/E06/E07 |
| AC-I01 | PASS | 보드 초점방향키만 이동/버튼방향키 무효, E02 실패 지점 이전 assertion 통과; 물리 키보드 직접 플레이 아님 |
| AC-I02 | PASS | held/repeat 무시·keyup 후 이동·Esc정지/확인취소/승인안함, E02의 trap 이전 확인 |
| AC-I03 | PASS | real mouse 23/24/대각동률/우세축, 위24는 정상 no-op; U swipe 경계/E11, Chromium 실제 touch24 E16 |
| AC-I04 | FAIL | 보드내 cancel/lostcapture/multitouch·reset E11 통과, 보드밖 두번째 포인터는 QA-001/E14 실패 |
| AC-I05 | UNVERIFIED | 보드 touch-action none·Chromium 보드 touch시 스크롤불변/밖 programmatic scroll E11/E16; 실제 밖 터치스크롤·회전 미수행 |
| AC-P01 | PASS | 6단계 순수 목표 E13/U, 실제512→1024 목표·배지 E15, 2048달성 E05/E06 |
| AC-P02 | PASS | 시작2/이동1/점수4/no-op 불변, 성공/막힘 분리1회, E01/E04/E05/U |
| AC-P03 | PASS | 3카드·잠금조건/해금1024 즉시저장/자동선택없음/선택reload, E07/E15/U |
| AC-P04 | PASS | 정원3×음소거2의 동일 보드/점수/phase E13; 4096 실제숫자 E06 |
| AC-V01 | UNVERIFIED | 5 viewport 플레이 측정·일부 승리/결과 시각검사 통과 L; 모든 해상도×모든 상태 조합과 실물은 미수행 |
| AC-V02 | UNVERIFIED | 표시 중 기본 버튼44px 이상 L, 작은 모달 닫기 스크롤 E10; 모든 모달 버튼 실측/실물 안전여백 미완료 |
| AC-V03 | FAIL | 숫자텍스트/닫기초점복귀/reduced-motion 통과, 모달 내부 Tab 순환 QA-002/E02 실패 |
| AC-V04 | PASS | 직접제작 SVG15개 검사 A, 로컬 자산 요청 N, 실제화면 시각 확인 |
| AC-A01 | UNVERIFIED | Chromium oscillator 자동호출/무음fallback E12 통과, WebKit AudioContext없음, 실제청취·예약음 청취 미수행 |
| AC-D01 | PASS | 판중 기록저장·reload 준비/선택보존/새판기록유지 E01/E05/E07 |
| AC-D02 | PASS | 손상JSON 브라우저+잘못된버전/구조/숫자 U/E08/E13, 다른키보존 E08 |
| AC-D03 | PASS | 악성HTML/외부URL·중복해금·잘못된mute 정규화, 숫자유지/실행없음 E08/N/U |
| AC-D04 | UNVERIFIED | Storage getter/get/set 예외주입 및 경고/메모리플레이 E09 3종 통과, 실제 브라우저 권한차단/용량소진 미수행 |
| AC-D05 | PASS | 성공+막힘/결과재개방·재시작취소/reload 중복집계없음 E01/E05, 교차수치 U/E13 |
| AC-O01 | PASS | localhost만 허용 route로 원격0, cold context 시작/게임/결과/저장 N/E01~E16; 전체 offline 아님 |
| AC-O02 | PASS | 실제 npm test 빌드0/별도서버브라우저실행, 런타임 dependencies0, U/H |
| AC-S01 | PASS | raw공격/HEAD/POST/경로비노출 H, 외부junction403 포함 U |
| AC-S02 | PASS | 악성테마실행0/원격0/CSP·MIME·nosniff/위험sink0 E08/E13/H/A; 스크린샷도구 CSP오류는 위 분리참조 |
| AC-S03 | PASS | Node내장/자체SVG/런타임deps0/로컬요청만/loopback, H/N/A/src server |

## 인계 / 변경 범위

- 작성: `tests/e2e/independent-qa.spec.ts`, `tests/e2e/diagnostic.mjs`, `tests/e2e/security-audit.mjs`, 본 `docs/QA_REPORT.md`, `artifacts/qa/**` 증거입니다.
- 제품 소스·자산·package/config/scripts/README/BACKLOG/HANDOFF/설계는 수정하지 않았습니다. 지시받은 `npm test`가 생성한 `dist` 빌드 산출물은 실행 검증의 결과입니다.
- PM은 **QA-001/QA-002 수정 또는 명시적 설계변경 판단**, 실패 케이스 회귀 재실행, 미검증 수동/실기기 항목 위험 수용 여부를 결정해야 합니다. QA는 최종 수용/완료를 선언하지 않습니다.
- 프로젝트 범위를 넘어 전역 skill을 저장하거나 보드/PM 문서를 수정하지 않았습니다. 이번 fixture/외부망 필터/CSP 도구오류 분리 방식은 PM이 필요하면 재사용 워크플로로 보관하실 수 있습니다.
