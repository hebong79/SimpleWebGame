# G025 공통 구현 — 준비 이력 및 병합 후 초기 실행

## G025-SHARED-FINAL 후속 — 신규 어댑터 PASS / 기존 동결 E2E 차단

- 물리 root/branch는 아래와 같습니다. 시작 HEAD `388165537b493f5b8acd1c2a01d93bfb8b0ce816`에서 작업했고 두 builder 커밋의 **19파일 전부 원본 바이트/SHA를 보존**했습니다. 아래의 ‘게임 미통합’ 부분은 최초 준비 시점 이력이며 최신 상태가 아닙니다.
- `src/client/library.ts`의 신규 두 record **위치만** 기존 available10개 뒤/upcoming29개 앞으로 이동했습니다. 두 줄을 제외한 library 전체·기존39개 record 내용/상대순서·즐겨찾기 코드는 그대로입니다. **41/12/29**, 필터/검색/더보기 전 기본 첫12장 DOM의 마지막 두 카드가 실제 신규 게임임을 세 브라우저에서 단언했습니다.
- 실제 11 API는 `{game,record,mode,elapsedMs,settled,pauseReason,dialog,preview,storageBlocked}`, 12는 `{game,save,storageBlocked,recovered,settled,improved,modal}`입니다. 상태는 둘 다 `game.status`; 12 시간/goal은 `game.elapsedMs/preview`입니다. 읽기 clone 원문을 보관하고 board/flags/history/counters와 상태/시계 필드의 관측을 분리했습니다. 라이브 setter·RNG 주입·가상시계는 없습니다.
- 실제 locator에 맞췄습니다: 홈은 `#home` anchor, 11 시작/재개 `#start`, 지도 `#grid .cell`/`#map-window`/`#dialog-*`, 12 시작 `#start`·정지/재개 `#pause`·`#board .tile[data-index]`·`#modal-*`·`#goal`. 12 기본 배열은 builder의 `post-20-v1` 실제 fixture와 대조합니다.
- 11은 공개 깃발모드 버튼으로 안전 이웃1을 막은 후0을 열어 원자적 flood의 우발적 즉시승리를 차단합니다. flag-only armed=false/time0, 공개 후 playing을 단언합니다. 모달 취소 후 paused/board·확정시간 불변/명시재개, 두 mute 전환과 테마 미리보기 취소를 실제80ms trusted 입력으로 검사했습니다.
- 정상 goal hold/release는 이전 playing 복귀 예외이며 hold 중 시계/board 동결을 검사합니다. 별도 hold→합성 blur→release는 보호정지 우선/명시재개입니다. blur 합성 이벤트는 실제 OS/tab 비활성화나 실물 증거가 아닙니다.
- 320px에서44px 미만 허용오차 없이 실제 셀/버튼 기하, 문서 가로넘침0, 지도 내부 scroll과 양끝 도달을 검사했습니다. WebKit screenshotter는 부르지 않아 이미지 수용은 **미검증**입니다. CSP/console/pageerror/HTTP/외부요청 단언을 필터링하거나 완화하지 않았습니다.
- `G025-STORE full`은 기존10개 profile+임의 sentinel+기존 upcoming 즐겨찾기를 **한 번만 seed**하고 새 게임 왕복/reload 뒤 원문 바이트·키집합을 보존하도록 정합했습니다. 04~10은 실제 순수 정산/메모리 저장 API 결과를 쓰며 01/02는 제품 기본 factory, 별도 순수 정산 helper가 없는03은 정상 zero-match factory를 씁니다. 수동 통계 tuple이나 reload init-script 재seed는 없습니다. **해당 fixture 함수만 Node에서 실제 실행해 정상10키 생성을 확인했으며, 브라우저 보존 case는 이번 smoke에 포함하지 않았습니다.**

### 실제 실행과 차단

실측 종료 시각과 전체 경로/수치는 `artifacts/g025-integration/shared-final-20261029T130822/results.json` 및 `baseline-invariants.json`에 있습니다.

| 검증 | 실제 결과 |
|---|---|
| 프로젝트/선택8개 E2E+config strict 타입, runner/Python 구문, whitespace | 모두 exit0 |
| 새 candidate/build | **1회**, 기존 build 부재 확인 후 exit0; source149/output127 SHA 결합 |
| candidate/smoke discovery / 실제실행 | **36 수집 / 36 실행 / 33 PASS / 3 FAIL / skip0 / flaky0**, exit1 |
| 신규 G025 어댑터 smoke 부분집합 | **12 수집 / 12 실행 / 12 PASS**, 세 프로젝트 각4개 |
| 실제 공개 HTTP 바이트/CSP/nosniff | **93/93 일치** |
| 단위 suite / 전체 full | **0회** — 요청대로 중복 실행하지 않음 |
| mutex / 자기서버 | 정확 `Local\SimpleGamesG025BrowserGate` acquired/released/HANDLE closed;3155 close 후 connectEx10061 |

**남은 차단은 변경 금지된 기존 E2E의 페이지 전제입니다.** `tests/e2e/g024-new-games.spec.ts:92`가 첫 화면에서 `memory-pieces` 즐겨찾기를 바로 누릅니다. 신규 두 카드가 요구된 위치로 옮겨지면서 이 record는13번째가 되어 아직 DOM에 없으며, 같은45초 locator timeout이 세 프로젝트에서 발생했습니다. 기능/CSP 실패가 아니라 기존 시험의 초기 카드 가정 충돌입니다. 원본 FAIL JSON/trace/로그를 보존했고 **기존 spec/config를 수정하거나 필터/skip/재시도로 가리지 않았습니다.** 이 단일 smoke invocation 뒤 동일 실패를 다시 실행하지 않았습니다.

- build UUID: `162e7276-a341-4cbd-9596-2640feaca864`; manifest SHA256 `91b1238d897900e4899f85f73c34bac47d6fd44f7968f323e20a7d8935813c31`.
- build raw: `artifacts/g025-integration/runs/20261029T131016122Z-d6f5a1c4-ddae-4a8d-b36f-2cca541aec4f/invocation.json`.
- smoke raw root: `artifacts/g025-integration/runs/20261029T131027587Z-846f013b-f2bf-4ffd-acc4-9418298e0b85/`; exact Playwright JSON 경로는 집계 `results.json`의 `smoke.rawJSON`입니다.
- 변경 후 source/output manifest 재검산 일치,19게임파일 불변, 기존 artifact211개(build 전)/371개(smoke 전)의 SHA/size/mtime 보존을 확인했습니다. mutable 인계 문서는 빌드 입력에 추가하지 않았습니다.
- **runner/config/browser gate/core 변경0**입니다. 기존 독립 core 검토의 S01/S02 비차단 권고도 불변으로 남겼습니다. 신규 delta 자체는 제작자 확인이며 독립 delta 수용은 부모 후속입니다.
- 부모 후속: 기존 E2E의 최소 준비동작 보완에 대한 쓰기 승인/담당 결정 → source freeze 갱신 시 구빌드 보존 → 독립 delta 검토와 최종 full/필요 단위. 현재 결과를 smoke 전체 PASS·릴리스 수용·3116 반영으로 표시하지 마십시오. 이번 작업에는 main merge/PM2/3116/타서비스/설치/원격 작업이 없습니다. 작업일지·게시판·HANDOFF 최종화는 부모 소유이므로 자기 artifact 작업명 요약만 남깁니다.

---

## 최초 공통 준비 이력 — 당시 게임 미통합 / 실행 BLOCKED

## 범위와 결과

- 물리 root: `E:/Work2/Project/SimpleGames/worktrees/g025-twelve-game-release`
- branch: `feature/g025-twelve-game-release`; 시작 HEAD `7d72954896845e7cf2152e4a4857a6f00a6c14b7`.
- 확인 시각: 2026-10-29 21:30:58 KST. 이 문서는 **공통 준비 구현 인계**이며 게임 완성/독립 QA/후보 full/운영 반영 보고가 아닙니다.
- 기존 catalog **39 record의 모든 literal과 순서**, 즐겨찾기 키/필터/읽기·쓰기 코드를 보존했습니다. 기존 39개 뒤에 두 record를 추가했습니다. 초기 페이지의 기존 카드 위치도 보존하며, ‘준비 중 포함’ 해제 시 기존 10개와 신규 2개가 표시됩니다.
- `gem-survey` / **보석 탐사 지도** / 숫자 / `/games/11-mines/index.html`.
- `number-postbox` / **숫자 우체통** / 숫자 / `/games/12-fifteen/index.html`.
- 소스상 총 **41 / available 12 / upcoming 29**입니다. `memory-pieces`, `leisure-line`, `sliding-view` 등을 대체하지 않았습니다. 이 수치는 현재 LAN에서 실제 서비스 중인 게임 수를 뜻하지 않습니다.
- 새 카드 그림은 직접 작성한 고정 SVG rect/path/text입니다. 기존 miniature CSS만 재사용하며 외부 그림·폰트·CDN·런타임 의존성은 추가하지 않았습니다. `public/library.css`는 만들 필요가 없었습니다.

## 변경 소유권

- `src/client/library.ts`: 신규 record와 원본 벡터 miniature.
- `package.json`: description만 변경; scripts/dependencies/lockfile은 그대로입니다.
- `ecosystem.config.cjs`: 미래 승인 전환용 script 경로만 `artifacts/g025-build/src/server/index.js`로 변경. 실행/재시작하지 않았습니다.
- `scripts/g025-verify.mjs`: 명시적 후보 build/smoke/full 및 read-only LAN 검증 실행기.
- `tests/g025-playwright.config.ts`: 별도 출력/브라우저 profile/선행 가드.
- `tests/e2e/g025-new-games.spec.ts`: 신규 두 카드의 실제 입력 lifecycle, modal 취소 후 명시 재개, 지도 내부 scroll, goal hold/release 예외, 기존 10개 profile·예정 게임 즐겨찾기 보존.
- 기존 공통 spec의 catalog/card/link 단언만 갱신: `library-integration`, `multi-game-integration`, `breakout-integration`, `live-server`, `runner-jumper`, `g024-new-games`.
- `artifacts/g025-integration/browser-gate.py`, `prep-check.mjs`, `final-static-check.mjs`, UUID별 raw 로그/manifest/보존 근거.
- **PM 소유 `docs/G025_DESIGN_DECISIONS.md` v1.1은 읽기 입력이며 이 worker의 stage/commit 대상이 아닙니다.**

게임 11/12 소스·전용 시험, 서버, 기존 build/launcher/g024 실행기, lockfile, 과거 증거, HANDOFF/BACKLOG/PM 설계는 수정하지 않았습니다.

## 실행기 안전 계약

1. 절대 Node `C:/Program Files/nodejs/node.exe` v24.16.0, 설치 TS7.0.2 / Playwright1.64.1을 검사합니다. node_modules junction은 읽기 전용 입력이며 쓰기 경로 가드는 junction/symlink를 거부합니다.
2. `--target candidate|live`, `--mode build|smoke|full`은 필수입니다. 중복 target/mode/origin/list, 알 수 없는 인수, list/units 혼합을 거부합니다. candidate는 origin 인수나 inherited live origin도 거부합니다.
3. candidate는 자기 **127.0.0.1:3155**만 사용합니다. 점유한 프로세스를 재사용하거나 종료하지 않습니다. 이 실행기가 생성한 server만 finally에서 close하고 연결 거부를 확인합니다.
4. live는 명시한 **`http://192.168.0.195:3116`** 하나만 허용합니다. build/서버 생성/종료/PM2 lifecycle은 없습니다. HTTP GET와 격리 브라우저 context의 로컬 profile 조작만 합니다. 기존 사용자의 브라우저 저장소를 가져오지 않습니다.
5. 최소 필수 파일은 각 게임의 `index.html`, `styles.css`, `engine.mjs`, `save.mjs`, `main.mjs`, `tests/games/<game>.test.mjs`입니다. 누락·빈 파일·모듈/snapshot/실행 시험 계약 부재는 **브라우저·build 자식 시작 전에 exit2 BLOCKED**입니다. 이 최소 검사 자체가 완성 증명은 아니며 최종 실제 단위/브라우저와 독립 QA가 필요합니다.
6. build는 명시적 candidate/build로만 생성합니다. 기존 `artifacts/g025-build`를 덮어쓰거나 자동 rename하지 않습니다. PM이 이전 빌드를 별도로 보존한 뒤 새 빌드가 필요합니다. 실패/부분 빌드도 자동 삭제하지 않습니다.
7. `g025-build-manifest.json`은 물리 root/build UUID/toolchain, 소스·시험·실행기·설계 입력 SHA, 모든 출력 SHA를 묶습니다. smoke/full/list에서 실제 source/output 파일 집합과 SHA를 다시 검사합니다. source map도 output SHA에는 포함되며, 기존 서버가 공개하지 않는 확장자는 HTTP 검증에서 따로 나열합니다.
8. 모든 실행과 자식에 별도 UUID 경로를 부여하고 **자식을 spawn하기 전** `GAME_TEST_ARTIFACT_DIR`, `GAME_TEST_BUILD_DIR` 및 명시 target/mode/origin을 설정합니다. stdout/stderr를 새 파일과 상위 로그에 동시에 스트리밍합니다. discovery와 execution JSON은 별도 경로입니다.
9. 최초 준비에서 tests 아래 30개 TS/MJS의 고정 출력/스크린샷/attach 사용을 조사했습니다. 선택 spec의 무 override 고정 artifact 경로는 거부합니다. `diagnostic.mjs`, `security-audit.mjs`, `independent-qa.spec.ts` 등은 현재 G025 필수 공통 suite 선택 대상이 아니며 실행된 것으로 집계하지 않습니다. 기존 launcher의 고정 `g017-builder` fixture는 원본 시험·serve_local·package를 동일 SHA로 복제한 새 snapshot cwd 안에서만 실행하도록 구현했습니다. **launcher 단위 실행 자체는 이번에 수행하지 않았습니다.**
10. 선택 대상: 후보 full은 `live-server`, `library-integration`, `multi-game-integration`, `breakout-integration`, `runner-jumper`, `flappy-input`, `g024-new-games`, `g025-new-games`; live full은 LAN 대응 `live-server`, `runner-jumper`, `flappy-input`, `g024-new-games`, `g025-new-games`입니다. 두 full 모두 새 profile 보존 흐름을 포함합니다. smoke는 기존 @smoke/홈 검사 및 신규 흐름입니다. `--list`는 선행 조건을 통과해도 **발견만** 하며 실행 PASS가 아닙니다.
11. 실제 브라우저 discovery+execution 전체를 Python의 하나의 HANDLE 구간에서 **`Local\SimpleGamesG025BrowserGate`**로 직렬화합니다. CreateMutexW / WaitForSingleObject / ReleaseMutex / CloseHandle의 HANDLE/DWORD 인자·반환형을 명시했고 finally로 release/close합니다. 이번에는 구문/정적 검토만 했으며 실제 대기·경합·브라우저 실행은 미검증입니다.
12. 기존 artifact 전 파일의 SHA256/size/mtimeNs를 실행 전후 비교합니다. 현재 run과 이번에 처음 생성한 build 외에는 변경을 허용하지 않습니다. 기존 g025 run도 보호 대상입니다.
13. exit64=잘못된 호출, exit2=필수 전제 BLOCKED, exit1=실행/보존 실패입니다. BLOCKED를 게임 PASS에 합산하지 않습니다. 재시도/skip/flaky 허용은 없으며 같은 누락 상태를 두 번 관측한 뒤 중단했습니다.

## 실제 수행 근거

준비 raw 결과: `artifacts/g025-integration/prep-20261029T122724057Z-b3a46514-d9a6-4830-8434-4113e8b2a486/results.json`.

- Node/TS/Playwright 실제 버전 확인, Node/Python 구문, 프로젝트 타입, 신규 config와 선택 공통 E2E strict 타입 명령이 exit0이었습니다.
- 중복 target/mode/origin/list, 임의 origin/port, live build, inherited live origin, list/units 혼합 등 잘못된 호출 **12개가 exit64**였습니다.
- candidate smoke와 explicit LAN full `--list`는 각각 **exit2 BLOCKED**, 누락 12파일, 자식 명령 0, 발견 0, 브라우저 실행 0, 게임 단위 실행 0입니다. LAN full/list 호출에서도 네트워크·PM2·server 작업이 시작되지 않았습니다.
- 별도로 fresh manifest 부재, path traversal, 의존성 junction의 쓰기 경로 사용을 거부함을 확인했습니다.
- 기존 artifact **통합 worktree 53파일 / 원본 프로젝트 4567파일**의 SHA/size/mtimeNs가 그대로였습니다. 근거 `prep-historical-before.json`, 준비/최종 결과의 `historical-preservation.json`.
- 자체 검토에서 기존 multi-game 카드 ID 배열의 신규 두 항목을 보완했습니다. 신규 11 smoke는 index1을 공개 우클릭으로 표시한 뒤 index0을 엽니다. 첫 열기 제외 구역의 안전 칸 하나를 닫아 두어 랜덤 flood의 즉시 승리로 pause 검사가 불가능해지는 변동을 막습니다. RNG/state setter는 쓰지 않습니다.
- 최종 static delta는 `artifacts/g025-integration/final-*/results.json` 및 `source-sha256.json`에 별도로 기록합니다. 누락 상태를 반복 실행하지 않고, 핵심 runner/config/mutex 파일이 원래 guard 결과와 **동일 SHA**임을 확인해 근거를 재사용합니다.
- **build 0 / 게임 실행 PASS 0 / 브라우저 실행 0 / 실제 배포 0 / 독립 공통 review 미수행**입니다. 공유 준비 확인을 게임 수용으로 확대하지 않습니다.

## 병합 후 반드시 정합할 미확정 UI/snapshot 인터페이스

이 단계의 E2E는 다음 **명시적 인수 제안**을 사용합니다. 아직 존재하지 않는 builder API를 이미 확인한 것처럼 주장하지 않습니다. PM이 실제 동결 구현을 인수한 뒤 이 spec의 adapter만 정확히 조정하도록 후속 배정이 필요합니다. 맞지 않는 게임을 fake/skip으로 감추지 않습니다.

- 두 게임: 읽기 전용 clone `window.__g025Snapshot()` → `{ phase, elapsedMs, game, record }`; phase `ready/playing/paused/won/lost`.
- 11 `game.opened: boolean[81]`, gridcell 81개, 첫 입력 index0/안전 이웃1, `#map-viewport` 내부 가로 scroll. 셀은 44px를 유지하며 문서 가로 넘침은 없어야 합니다.
- 12 `game.board:number[16]`, `blank`, `size:4`, `moveCount`; 인접 숫자 버튼 이름 `숫자 N`; snapshot `goalPreview:boolean`; 목표 버튼 `목표 보기`.
- role=button 이름: 시작/탐사 시작/퍼즐 시작/게임 시작, 일시 정지/일시정지/게임 정지, 재개/탐사 재개/퍼즐 재개/게임 재개, 게임 서재/홈/홈으로, 음소거/소리(+켜기/끄기).
- 홈 확인은 role=dialog, 취소/돌아가기 및 나가기/탐사 종료/홈으로/확인 버튼입니다. **playing에서 모달을 열고 취소하면 paused 유지 후 명시 재개**를 검사합니다(D01/v1.1).
- **12 정상 goal hold release는 예외로 이전 playing 복귀**를 검사합니다. blur/cancel/보호 정지가 끼면 자동 복귀하지 않는 상세 경계는 게임별 독립 QA 소유입니다.
- 모든 클릭은 실제 시계의 native trusted80ms이며 게임 snapshot setter/RNG seed/자동 완주/가상 clock을 사용하지 않습니다. 모바일 emulation과 우클릭은 실물 손가락 검사와 다릅니다.
- CSP/console/pageerror/HTTP failure/외부 요청 단언은 필터 없이 유지합니다. WebKit screenshotter는 호출하지 않고 DOM/기하 진단을 보관하며 **이미지 수용 미검증**을 따로 기록합니다. CSP 완화/오류 필터/케이스 skip은 없습니다.
- 게임별 normal clear/저장 경계/전체 규칙, 실제 Win32 mutex 경합, HTTP 바이트/CSP, 브라우저 smoke/full, 실물 기기·실청취·인간 플레이 시간은 이 준비 단계에서 미검증입니다.

## 후속 실제 명령 — 지금 실행할 준비가 된 게임은 아닙니다

아래는 이 worktree에서 게임 11/12와 실제 UI adapter를 인수하고 소스를 동결한 **후**의 순서입니다. 이 worker가 PM2/운영 전환을 대신 수행하지 않습니다.

```bash
cd E:/Work2/Project/SimpleGames/worktrees/g025-twelve-game-release
"C:/Program Files/nodejs/node.exe" scripts/g025-verify.mjs --target candidate --mode build
"C:/Program Files/nodejs/node.exe" scripts/g025-verify.mjs --target candidate --mode smoke
"C:/Program Files/nodejs/node.exe" scripts/g025-verify.mjs --target candidate --mode full
```

긴 full은 Hermes `terminal`의 **background=true, notify=true, heartbeat=60**으로 시작하고 UUID child 로그를 스트리밍하십시오. foreground timeout 후 동일 경로로 재실행하거나 background shell `&`로 놓치지 않습니다. 발견만 필요하면 `--mode full --list`; 이는 실행 결과가 아닙니다. 게임 단위만 필요할 때의 `--target candidate --mode full --units-only` 역시 브라우저 수용과 구분합니다.

승인된 별도 운영 전환과 실제 공개 바이트 일치 확인이 완료된 뒤에만:

```bash
"C:/Program Files/nodejs/node.exe" scripts/g025-verify.mjs --target live --mode smoke --origin http://192.168.0.195:3116
"C:/Program Files/nodejs/node.exe" scripts/g025-verify.mjs --target live --mode full --origin http://192.168.0.195:3116
```

라이브 실행기도 manifest의 물리 root/source/output과 비교합니다. 다른 worktree에서 빌드한 manifest를 현재 root의 검증본인 것처럼 재사용하지 않습니다. 최종 main 병합/런타임 ZIP/단일 PM2 앱 전환/실제 LAN 수용/작업일지·보드 게시는 PM의 별도 승인 절차입니다.
