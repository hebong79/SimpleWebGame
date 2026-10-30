# G024-09 · 병아리의 소풍 구현 및 인계

- 작업: `G024-09` / 임시 builder09 (native cody 세션 아님).
- 기록 시각: **2026-10-29 00:11 KST**. 작업 시작일 10월 28일에서 자정을 지났습니다.
- 실제 작업 루트: `E:/Work2/Project/SimpleGames/worktrees/g024-09-crossy`.
- 브랜치: `feature/g024-09-crossy`, 시작 HEAD `1e40850c41b46bd6190f10d1407d731fac4ddbf4` 확인.
- 상태: **실행 가능한 게임 및 자체 검증 완료, 소스 동결/독립 QA 인계 대상**. builder 자체 검증은 독립 수용이 아닙니다.
- 게임 ID/경로: `chick-picnic`, `/games/09-crossy/index.html`.
- 공통 카탈로그·기존 게임·서버·설정·의존성·main·LAN3116·PM2·원격 Git은 변경하지 않았습니다.

## 구현 경계

| 파일 | 책임 |
|---|---|
| `public/games/09-crossy/engine.js` | 주입 RNG, 길 생성, 단일 예약, 고정 tick, 연속 충돌, 점수/정체/상태 전이 |
| `public/games/09-crossy/save.js` | 버전1 개인 기록, 완료판 집계 검증, 해금/혼합 의상, 저장 실패 메모리 대체 |
| `public/games/09-crossy/art.js` | 직접 작성 Canvas 벡터 병아리·의상·차량·도로·풀밭 및 미리보기 |
| `public/games/09-crossy/main.js` | DOM, 입력, 보호정지/모달/초점, 합성음, 읽기전용 관측 |
| `public/games/09-crossy/index.html`, `style.css`, `icon.svg` | 독립 페이지, 반응형 UI, 직접 작성 아이콘 |
| `tests/games/09-crossy.test.mjs` | 결정적 순수 엔진/저장 시험 32개 |
| `artifacts/g024-09-builder/*.mjs` | 실제 기존 서버/설치된 Playwright로 실행하는 자체 검증 도구 |

## 규칙과 충돌 기하

- 9칸 × 40 논리 px, 폭 360. 첫 0·1행은 안전한 풀밭입니다. 0행 중앙에서 준비합니다. 도로가 연속 3행이면 다음 행은 풀밭입니다.
- 방향키의 새 nonmodifier keydown만 사용하며 repeat/Shift/Ctrl/Alt/Meta를 무시합니다. 경기장 포커스에서만 방향키를 소비합니다. 버튼은 44px 이상입니다.
- 한 hop의 내부 길이는 0.12초입니다. 이동 중 다음 **유효** 입력 1개만 예약하며, 예약 목적지는 현재 hop의 도착 칸을 기준으로 검사합니다. 범위 밖/no-op은 RNG·점수·hop 횟수를 소비하지 않습니다.
- 몸체는 중심 기준 **28×28** 고정 AABB입니다. 모자·상의·배낭·점프의 시각적 높이는 판정에 들어가지 않습니다. 차량 AABB는 폭 **56 또는 68**, 높이 **26**입니다. 그림은 높이 28 및 그림자를 가지므로 판정 기하와 분리되어 있습니다.
- `advance`는 1/120초 이하의 tick으로 나눕니다. hop이 tick 중간에 끝나면 정확히 그 경계에서 다시 나눕니다. 각 구간에서 플레이어와 차량의 상대운동을 2축 closed slab 구간 교집합으로 계산합니다. 양 끝에서 비충돌이어도 구간 도중 겹치면 충돌하며 경계 접촉도 충돌입니다. 모든 관련 도로·차량 복제본을 검사하고 충돌을 착지 점수보다 먼저 확정합니다.
- 차량은 행별 단방향, 초기 속도 80..140. 최고 전진 20행마다 +10, 최대 180입니다. 행의 주기는 `차량 폭 + 빈 간격`이고 빈 간격은 **140..220px**로, wrap/seam 및 최고속에서도 최소 120을 넘습니다. 가장 작은 빈틈에서 몸체를 제외한 통과 가능 시간도 120ms hop보다 큽니다. 전체 행을 차량으로 막는 형태는 생성하지 않습니다.
- 점수는 착지한 새 최고 행만 증가합니다. 뒤로 왕복해도 다시 증가하지 않습니다. 카메라 뒤쪽 2행까지 되돌아갈 수 있고 그 아래 화면 밖 이동은 no-op입니다. 지나간 길은 제한된 버퍼만 남겨 장시간 메모리 증가를 막습니다.
- 새 최고 착지 때만 idle age가 초기화됩니다. 8초에 남은 2초 경고, 10초에 idle loss 1회입니다.
- pause는 hop의 정확한 중간 위치/잔여 시간까지 보존하되 예약 입력과 pointer gesture를 취소합니다. 대화상자/blur/hidden/250ms 이상 지연은 정지하며, 사용자가 직접 재개해야 합니다. RAF와 입력이 모두 `performance.now()`의 실제 콜백 도착 시각을 씁니다. stale RAF timestamp를 사용하지 않습니다.
- 활성 새 소풍/홈은 확인을 먼저 엽니다. 취소 시 기존 물리 상태와 기존 paused 원인을 보존합니다. playing에서 메뉴를 열었다면 취소 후에도 명시 재개가 필요합니다. 확인하면 quit로 한 번 정산하고 결과를 먼저 보여줍니다. 결과의 다음 소풍은 ready, 결과의 목록 버튼은 `/`로 갑니다.

## 저장·의상·음향

- 개인 저장 키 리터럴: **`simple-games:chick-picnic:v1`**.
- 형식: `{version:1,plays,bestRows,totalRows,muted,equipped:{hat,top,backpack}}`.
- 모든 카운터는 비음수 safe integer입니다. `plays=0`이면 최고·누적이 모두 0입니다. 명시적으로 허용된 0점 완료판 때문에 `plays>0,bestRows=0,totalRows=0`도 유효합니다.
- `plays>0`에서는 BigInt로 `bestRows <= totalRows <= plays*bestRows`를 검사합니다. 최고 한 판을 예약한 뒤 남은 합이 `[0,(plays-1)*bestRows]`에 있으므로 최고를 실제 한 판에서 달성 가능한 집계만 수용합니다. 475개 작은 후보를 모든 가능한 완료판 이력과 양방향 대조했습니다.
- load/손상 복구/진행중 프레임은 자동 저장하지 않습니다. 완료 결과와 명시 설정·의상 적용만 자기 키에 씁니다. getter/getItem/setItem 각각 실패해도 메모리 플레이와 지속 경고가 유지됩니다. 키 삭제 함수는 없습니다. 안전 정수 한도 초과 시 잘못된 저장 대신 경고를 남깁니다.
- 기본 몸체, 무료 밀짚 세트, 누적 300행 소방관, 최고 50행 개구리 비옷입니다. 모자·상의·배낭 각각 혼합/전체 세트/잠금 미리보기/취소/한 번 적용을 구현했습니다. 잠긴 부위를 포함하면 적용 불가입니다.
- 같은 Canvas actor를 게임과 옷장에 사용합니다. 4방향 및 서기·점프·착지·실패 pose를 고를 수 있습니다. 점프 미리보기는 반복하며 reduced motion에서는 정지 pose를 보입니다. 64개 부위 조합의 순수 엔진 결과 동일성을 검사했습니다.
- 기본 음소거입니다. move/collision을 WebAudio로 합성하고 실패하면 보이는 경고와 무음 플레이로 대체합니다. pause/menu/blur에서 기존 voice와 지연된 resume 음향을 취소합니다. 결과 충돌 피드백은 1회 짧은 합성음입니다. 실제 청취 수용은 하지 않았습니다.

## 브라우저 관측 계약

유일한 hook은 **`window.__simpleGames09Snapshot()`** 입니다. 함수 프로퍼티는 writable/configurable이 아니며 호출마다 `structuredClone`을 반환합니다. 상태를 바꾸는 browser setter, debug 버튼, import된 engine instance는 노출하지 않습니다.

반환값은 engine state(`mode,pauseReason,col,row,x,y,facing,hop,queued,highest,idleAge,elapsed,accumulator,lanes,nextLane,reason,hops`)와 다음 값입니다.

- `record`: 저장의 복제본.
- `storageWarning`: 지속 경고 문자열.
- `dialog`: 가장 위 dialog ID 또는 null.
- `preview`: 열린 옷장의 `{equipped,direction,pose}` 또는 null.
- `input`: `{gesture:boolean,pointerCount:number}`.

자연 점수/차량 충돌/idle loss 검사는 공개 방향키·버튼만 사용했습니다. 별도의 해금 UI fixture는 순수 `settleRecord`로 완료 이력을 만든 뒤 **별도 새 context의 최초 저장**으로만 seed했으며 자연 달성 증거와 구분합니다. 실제 경기 state는 주입하지 않았습니다.

## 실제 자체 검증

절대 Node 실행 파일은 모든 실행에서 `C:/Program Files/nodejs/node.exe` **v24.16.0**을 사용했습니다. 설치/의존성 쓰기는 없습니다. 기존 `createGameServer`와 변경 없는 strict CSP에서 비동결 clock, trusted 약 80ms 누름으로 초기 smoke를 먼저 수행했습니다. 3141 loopback free 확인 후 자기 서버만 열고 각 도구 finally에서 닫았습니다.

최종 명령(프로젝트 루트에서):

```bash
GAME_TEST_ARTIFACT_DIR=artifacts/g024-09-builder GAME_TEST_BUILD_DIR=artifacts/g024-09-builder/build "C:/Program Files/nodejs/node.exe" artifacts/g024-09-builder/verify-all.mjs
```

실제로 실행한 자식 명령:

```text
C:/Program Files/nodejs/node.exe scripts/build.mjs --out-dir artifacts/g024-09-builder/build
C:/Program Files/nodejs/node.exe artifacts/g024-09-builder/early-smoke.mjs
C:/Program Files/nodejs/node.exe --check public/games/09-crossy/art.js
C:/Program Files/nodejs/node.exe --check public/games/09-crossy/engine.js
C:/Program Files/nodejs/node.exe --check public/games/09-crossy/main.js
C:/Program Files/nodejs/node.exe --check public/games/09-crossy/save.js
C:/Program Files/nodejs/node.exe --check tests/games/09-crossy.test.mjs
C:/Program Files/nodejs/node.exe --test --test-reporter=tap tests/games/09-crossy.test.mjs
C:/Program Files/nodejs/node.exe artifacts/g024-09-builder/browser-smoke.mjs
```

| 실행 구분 | 실제 실행 | PASS | FAIL | SKIP |
|---|---:|---:|---:|---:|
| 순수 엔진/저장 Node 시험 | 32 | 32 | 0 | 0 |
| 초기 실제 HTTP/CSP/80ms smoke | 7 | 7 | 0 | 0 |
| 심화 실제 HTTP 브라우저 case | 33 | 33 | 0 | 0 |
| 구문 검사 명령 | 5 | 5 | 0 | 0 |
| 기존 공통 build 명령 | 1 | 1 | 0 | 0 |

초기 smoke: HTTP 자산 7개의 소스/응답 SHA 일치와 CSP, Chromium desktop/WebKit mobile의 start/pause/resume/mute/옷장/부위취소/세트적용 및 snapshot 복제 독립성입니다.

심화 33 case: Chromium desktop·320px touch·WebKit mobile 각각 9개(레이아웃/667×375 dialog scroll, 자연득점/왕복/repeat/modifier, Tab/Escape/focus, 4방향×4pose/잠금/혼합, restart 취소/정산/reload/중첩모달, 실제 300ms 지연 zero-tick 보호, 자연 차량충돌, **실제 시계** 8초 경고/10초 정산, CSP/console/network 무오류)와 별도 fixture 해금·storage getter 대체·CDP tap/cancel/보드 밖 두 번째 손가락·CSS px swipe 임계/방향/tie·경기장 밖 일반 스크롤·AudioContext 생성실패 6개입니다. 가상 시계는 사용하지 않았습니다.

소스 동결 후 최종 원시 증거:

- `artifacts/g024-09-builder/final-2026-10-28T15-08-51-056Z/commands.json` 및 `command-1.log`..`command-4.log`.
- `artifacts/g024-09-builder/final-2026-10-28T15-08-51-056Z/source-sha256.json` — 제품 7파일+전용 단위시험의 SHA256.
- `artifacts/g024-09-builder/checks-2026-10-28T15-08-57-418Z/` — 5 구문 검사+TAP 32/32 원문.
- `artifacts/g024-09-builder/early-2026-10-28T15-08-51-767Z/report.json` — 7/7.
- `artifacts/g024-09-builder/browser-2026-10-28T15-08-58-186Z/report.json` — 33/33 및 실제 collision/idle/stall snapshot.
- 초기/이전 성공 근거도 그대로 보존했습니다. 집계 명령에서 파일을 디렉터리로 잘못 고른 **ENOENT 진단 1회**는 게임 시험 실패가 아니며 디렉터리 필터를 수정했습니다. 원문은 `diagnostic-aggregation-failure.txt`에 보존했습니다.

## 출처와 보안 자체 검토

- `art.js`, `icon.svg`, CSS는 이 작업에서 좌표·도형·색상으로 직접 작성했습니다. 원안의 제3자 스크린샷·참고 이미지를 복제하지 않았고 외부 이미지/폰트/코드/음원 다운로드는 없습니다. 별도 제3자 자산 라이선스는 없습니다. 프로젝트 정책에 따른 신규 원본 소스입니다.
- 읽기전용 원안 SHA256: `09_crossy.md` = `81803996911bab54b4f8af65720bf460c057a87d0f478b9e4af710b0754f21c1`, 공통 사양 = `2d38b6ff110ffcbc0a81c748e3c1fdf4f001ce0d558ca32144fb010607fc7965`.
- 적용 PM 계약 SHA256: `2b39ddf53b5689e97c92e313487b887af09603da447d514cc5776d585985454a`.
- 정적 검색의 후보는 SVG namespace URI(네트워크 요청 아님)와 `save.js`의 localStorage getter/자기 키 setItem뿐이었습니다. eval/new Function/innerHTML/인라인 style/script 주입/외부 요청/credential/프로세스 실행은 제품 코드에 없습니다.
- 모달은 actual trigger를 저장하고 Tab/Shift+Tab을 내부 순환합니다. WebKit result→옷장→Escape의 초점 복귀를 닫힘 300ms 이후 검사했습니다. 버튼 텍스트는 변경될 때만 수정하며 매 RAF 동일 textContent 교체가 없습니다.
- `requesting-code-review` 절차에 따라 명시 allowlist stage, staged diff check, 보안/자체 검토, 실제 시험을 수행합니다. **재위임 금지이므로 독립 reviewer를 생성하지 않았습니다. PM이 소스 고정 후 별도 tester를 배정해야 합니다.**

## 다음 인계

1. PM이 이 feature의 정확 커밋과 위 SHA를 읽고 별도 QA09를 배정해 독립 수용하십시오.
2. 게임 ID/URL만 준비되어 있고 홈 등록은 하지 않았습니다. 공통통합은 이 게임 인계가 끝난 후 **별도 명시 배정**을 받아 integration worktree에서만 진행할 수 있습니다.
3. 통합 담당자가 기존 37개 레코드 보존/신규2개, 전체 회귀/새 빌드/독립 QA를 수행한 후 PM이 승인 범위의 main 병합 및 해당 단일 앱 운영 전환을 진행합니다.
4. LAN3116 실제 사용자 실행, 물리 모바일 손가락·기기, 실제 음향 청취, 원안 20초~2분 인간 플레이 시간은 **미검증**입니다. 320px/모바일 WebKit/CDP는 에뮬레이션 증거입니다. 독립 QA·공통통합·배포 완료로 해석하지 마십시오.
5. 공통 HANDOFF/상태/작업일지/게시판은 이 builder의 허용 경로 밖이므로 수정·게시하지 않았습니다. PM 최종 릴리스 기록에 이 인계를 포함해 주십시오.
