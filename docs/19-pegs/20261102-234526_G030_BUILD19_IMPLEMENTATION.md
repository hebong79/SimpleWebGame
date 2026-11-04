# G030-BUILD19 구현 기록: 조약돌 하나 (pebble-solo)

- task_id: G030-BUILD19 / status: 구현 완료, 자체 검증 PASS (독립 QA, 홈 통합, 운영 반영은 미수행)
- 작성: 2026-11-02 23:45 KST (builder). 설계: `20261102-123200_G030_19_DESIGN.md`(10절 16개 가정은 전부 설계 안대로 적용).
- 경로 `/games/19-pegs/index.html` / 저장키 `simplegames.pebble-solo.v1` / 스냅샷 `window.__g030Snapshot()`.

## 변경 파일 (SHA256, 동결)
| 파일 | SHA256 |
|---|---|
| public/games/19-pegs/index.html | e3a57b1cedd1362aa9cb74a504da13aa4c086c9f69a8ce19a41040d43d3b370f |
| public/games/19-pegs/styles.css | a5d3580f8b1b3ca7051b3e1c4ee2779a1998c3950e4537ff1b9a96e15c9aa2ff |
| public/games/19-pegs/main.mjs | d834b450ebd9035871a725f13daa64c0611449a4761e9d33f10d0ac405dea0cf |
| public/games/19-pegs/engine.mjs | 30823a7689165e8e40b287bc93c9b4656628ca57f269da1910642ec745e8f733 |
| public/games/19-pegs/save.mjs | 29418648094d2581887a5164971867b02c2dfe4332c2e094d61189a3abac1398 |
| public/games/19-pegs/audio.mjs | 51bfaf8588fea8325b510af1d0f05b4e228f6351ef09d69ee7e069226b09b1c6 |
| public/games/19-pegs/ASSETS.md | 3fa0fce906d6368dcf6d6162cea8f7c7ce34f50839a164331b17b55f6c0ce3bc |
| tests/games/19-pegs.test.mjs | 8f5a0c75f34769184a549722ca6ae6d16d4be54cd8facd58c3ceecddcba3d0c4 |

검증 도구(제품 아님): `artifacts/g030-builder19/suite.mjs`(483a76f3...), `server.mjs`(1c83aecb...). 전체 목록은 `artifacts/g030-builder19/run-20261102-214726/final2/sha256-manifest.txt`. 아래 검증은 이 SHA의 소스에서 실행했다(최종 실행 후 소스 변경 없음).

## 검증 (실제 실행, 증거 `artifacts/g030-builder19/run-20261102-214726/final2/`)
- `node --check` engine/save/audio/main/test: 전부 exit0 (`syntax.log`).
- `node --test tests/games/19-pegs.test.mjs`: 50 tests, 50 pass, 0 fail, 0 skip, exit0 (`unit-test.log`). 내용: cross5 21칸/cross7 33칸·모서리 2x2, cross7 표준 시작 첫 점프 정확히 4개, 판 밖 칸 불가, 독립 2차원 oracle 대조(무작위 cross5 3000·cross7 1500, 1~3개 소규모 전수), 625쌍 tryJump 전수와 거부 reason 5종 + 명명된 불법 18종, 10단계 데이터(말 수 구간, count==pegs.length, 중복·판 밖 없음, 8대칭 중복 없음, 시작 합법 점프 >= 1, witness 엔진 재생, 독립 solver 풀이 가능·solver 자기검증, 단계별 도달 가능한 막힘·승리 상태 존재), 선택표, 되돌리기(N회 복원·no-op·cap·승리 후 불가), 막힘->되돌리기->막힘 반복, 상태기계(pause/protect 승격/resume), 기준 모델과 매 스텝 비교하는 무작위 플레이 10단계x25판x60스텝, 저장 스키마(필드별 불량 24종·관계 위반·길이 불일치·파생값 교정·getItem/getter/setItem 예외·타 키 보존·읽기 시 쓰기 0), 정산(첫 승리·재승리 bestUndos min·10단계·막힘 개선만·포화 all-or-nothing), 소스 가드(RAF/타이머/영구 억제 플래그/activeElement 가드 없음).
- 실제 브라우저(자체 loopback 서버 `127.0.0.1:3290`, CSP `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'`, 시험 후 본인 PID 26196만 종료하고 3290 LISTEN 해제 확인), 각 환경 console error / pageerror / 외부 요청 / 요청 실패 / CSP 위반 = 0:
  | 환경 | 단언 | 통과 | 실패 |
  |---|---|---|---|
  | Chromium PC 1366 (마우스, 실시계 90ms 누름) | 465 | 465 | 0 |
  | Chromium mobile 320 (CDP touchStart/touchEnd 90ms, 실제 2손가락 CDP 포함) | 468 | 468 | 0 |
  | WebKit mobile 320 (마우스 90ms + touchscreen.tap) | 469 | 469 | 0 |
  포함 범위: AC1/4/5/6/7/8 실플레이(1단계 완주, 막힘 후 이어서 승리, 되돌리기, 처음부터 확인), AC9/10 저장(손상·부분 불량·setItem/getItem/getter 예외·포화·타 키·재개 시 경고 해제), AC11 상태기계(수동 정지, blur/pagehide/visibilitychange 보호정지, 모달 중 blur 승격), AC12 입력 취소 8종(8px 초과, 다른 칸, 보드 밖, 실제 scroll, scroll 이벤트, 두 번째 포인터, pointercancel, 실제 2손가락)과 직후 정상 탭, AC13 WebKit 초점 가드(프로그램 초점 칸 첫 탭·키보드 이동 칸·같은 칸 연속·다른 버튼 초점·이어서하기 직후·초점 없음·mousedown 초점 억제 시뮬레이션·touchscreen.tap, 탭 후 900ms 뒤 중복 없음), AC14 취소 100회 반복 후 탭, 300ms 창 안/밖 `.click()`, 키보드, 새 pointerdown, AC15 키보드(roving tab 1개, clamp, Enter/Space, 1.5초 Enter 홀드가 결과 버튼을 누르지 않음, 시작/재개 홀드, Esc 우선순위, 외부 키 비소비), AC16 모달 4종(정지 선행, Tab/Shift+Tab, 외부 초점 차단, Esc, 초점 복귀, 홈 확인 취소는 정지 유지, 테마 미리보기 미저장·적용 1회), AC17 8개 상태에서 overflow 0·모든 button/a >= 44px(`#home` 포함)·칸 >= 44, 상태 전이 전후 하단 버튼 `getBoundingClientRect` 불변(레이아웃 시프트 0), AC18 3테마 x 5상태 기호/aria-label/점선·실선 링 구별과 대비 측정(`*-contrast.json`: 텍스트 >= 11.46:1/6.64:1, 기호·링·초점 >= 3.31:1 모두 기준 이상), AC19/23 설정·소리(기본 꺼짐, 켜기 1회 저장, AudioContext는 제스처 후만, 생성 실패 시 무음 플레이, 정지 시 소리 stop), AC20 유휴 DOM 변경 0(대기/플레이/선택/정지/결과 각 2~2.5초)·RAF 호출 0·snapshot 호출은 mutation 0, AC21 스냅샷(필드, deep clone, 재정의·삭제·대입 불가), AC24 reduced-motion, 호버 미리보기는 `(hover:hover)` 환경만, AC25/27 10단계 전부 witness를 실제 입력으로 완주(단계마다 정산 setItem 1회, 최종 completed 10 / unlocked 10, 10단계 `다음 단계` 없음과 전체 완료 문구, 다시 도전 clearCount 2·bestUndos min).
- 시각 검토: Chromium PC/mobile 스크린샷(ready, 선택+후보, 일시정지, 도움말 모달, 막힘, 승리, 5단계 승리, 3테마 선택/제거 예정)을 `final2/shots/`에 저장. 개발 중 `try4/try5` 스크린샷을 열어 확인했고, 그 결과로 탭 하이라이트 색 번짐과 제거 예정 ✕의 크기를 고쳤다. 최종 소스의 PC 나무 테마 스크린샷을 열어 확인했다.
- WebKit 스크린샷은 찍지 않았다(CSP 소음 회피, 기능 검사만).

## 개발 중 발견해 고친 결함 (원 FAIL 로그 보존: `try1`~`try5`, `final`)
1. 하단 버튼 줄에서 320px일 때 `이어서하기`가 두 줄로 줄바꿈되어 정지->재개 전이에서 버튼 높이가 44->55.5px로 변함(레이아웃 시프트). `.bar button`을 nowrap + 320 폭에서 14px로, 열 정렬 start로 수정. 상태 문구 영역은 2줄 고정 높이(min-height 3.2em).
2. Chromium mobile에서 큰 이동의 취소 제스처(팬) 직후 탭은 브라우저가 fling 정지로 소비해 click이 오지 않았다. 검증된 탭은 pointerup에서 바로 칸을 활성화하고(`handledTap`), 뒤따르는 네이티브 click은 300ms 창 안에서 차단하도록 변경. 터치 호환 mousedown이 초점을 칸으로 되돌리는 문제는 같은 창에서 `mousedown.preventDefault()`로 해결. pointer 이벤트 없이 오는 click(키보드, `.click()`, 일부 도구)은 기존 click 경로로 계속 동작한다.
3. 마우스가 칸 위에 머문 채 방향키로 이동하면 hover가 우선해 제거 예정 표시가 어긋남: 방향키 이동 시 hover를 해제.
4. 제거 예정 ✕를 더 크게(19px, 윤곽 광륜).
시험 스크립트 쪽 오류(기대값 오기, Playwright 팬 후 즉시 탭 타이밍, 스크롤 최대치 도달, WebKit에서 버튼 탭 후 초점 소실 가정, 모달 위 클릭이 모달 버튼에 맞음 등)는 제품 결함이 아니며 스크립트를 수정해 재실행했다. 해당 FAIL 로그는 `try1`~`try5`에 그대로 있다.

## 공개 API
- `engine.mjs` (순수, DOM·타이머·난수 없음, 모든 함수는 새 객체를 돌려주고 무변동이면 같은 참조):
  `BOARDS`(`cross5` 5x5 holes [0,4,20,24], `cross7` 7x7 holes 16개), `STAGES`(동결 10개: id, board, tier, count, pegs, witness), `COUNT_CAP`, `emptyCells`, `cellsFromPegs`, `countPegs`, `checkJump(board,cells,from,to)->{ok,reason,over}`, `jumpsFrom(board,cells,from)`, `legalJumps(board,cells)->[{from,over,to}]`, `isWon(cells)`, `isStuck(board,cells)`, `createGame(stageId,round,token)`, `selectStage`, `startGame(game,stageId)`, `restart`, `targetsOf(game)->[{to,over}]`, `tryJump(game,from,to)->{ok,reason,game}`(reason: `phase|no-peg|bad-geometry|off-board|no-middle|occupied`), `select(game,cell)->{kind,noTargets?,game}`(kind: `ignored|pick-first|select|replace|deselect|jump|not-target`), `deselect`, `undo`, `pauseGame(game,'manual'|'protect')`, `resumeGame`.
  game = `{phase,pauseCause,stage,tier,boardId,width,height,cells,remaining,selected,history:[{from,over,to}],jumps,undoCount,round,token,result}`. `jumps`는 이번 round에서 실행한 점프 누계(되돌려도 줄지 않음), 현재 판의 점프 수는 `history.length`. `round`는 시작/다시 도전/처음부터/다음 단계마다 +1, `token`은 그에 더해 준비 단계에서 단계를 바꿀 때도 +1. `result = {outcome:'win'|'stuck', remaining, undoCount, stage}`.
- `save.mjs`: `STORAGE_KEY`, `CAP`, `THEMES`, `defaultRecord`, `validStage(value,index)`, `derive(stages)`, `recoverRecord(value)->{record,repaired}`(읽기·쓰기 없음), `loadRecord(getStorage)->{record,readOk,repaired}`(예외 시 `readOk:false`), `saveRecord(record,getStorage)->{ok,status:'ok'|'failed'}`, `settleWin(record,result)->{record,changed,status:'settled'|'cap'|'invalid'}`, `settleStuck(record,result)->{record,changed,status:'settled'|'unchanged'|'invalid'}`.
- `audio.mjs`: `createAudio()` -> `{setMuted, unlock, play(kind: select|jump|remove|undo|win|stuck), stop}` (WebAudio 합성, 기본 꺼짐, 제스처 후 생성).
- 스냅샷 `window.__g030Snapshot()` (writable/configurable false, 호출마다 `structuredClone`): `phase, pauseCause, modal, round, token, stage, tier, boardId, width, height, cells, remaining, selected, targets, cursor, jumps, undoCount, historyLength, history, result(+settled), readyStage, records, settings, saveStatus('ok'|'failed'|'unavailable'|'cap'), saveNote, warnings(코드: read-failed|write-failed|cap), status(코드)`. status 코드: `ready|playing|selected|no-targets|pick-first|not-target|jumped|undone|paused-manual|paused-protect|win|stuck`.
- DOM 선택자: `#home`(a), `#remaining` `#stage-label` `#undo-count` `#stage-best` `#status`(aria-live) `#warning`, `#board`(role=group, aria-label `조약돌 판`) 안의 `.cell[data-cell=0..24]`(button, 판 밖은 `.void[aria-hidden]`, 클래스 `peg|hole|sel|cand|rm`), 하단 `#undo` `#restart` `#pause` `#resume`, 준비 `#ready-panel` `#stage-select .stage-option[data-stage=1..10]` `#start`, 결과 `#result-panel` `#result-title` `#result-detail` `#result-save` `#all-clear` `#next` `#undo-continue` `#retry` `#choose` `#result-home`, 보조 `#help` `#settings` `#mute` `#lifetime`, 모달 `#modal` `#modal-title` `#modal-body` `#modal-actions` `#modal-close` `#modal-confirm` `#settings-apply` `.theme-option[data-theme=river|glass|wood]`.
- 저장 스키마: `{"version":1,"settings":{"theme":"river|glass|wood","muted":true},"records":{"completed":0,"unlocked":1,"stages":[{"bestRemaining":null,"clearCount":0,"bestUndos":null} x10]}}`. 설계 7절의 범위·관계·파생값 교정·복구 규칙 그대로. 쓰기: 승리 정산 1회, 막힘 중 bestRemaining 개선 때, 테마 적용, 소리 토글만. 읽기 예외 세션은 쓰기 금지.

## 제한 / 미검증
- 실제 iOS/macOS Safari·실물 터치 기기(Playwright WebKit은 시뮬레이션, 이 WebKit 빌드는 Web Audio 없음), 실제 스피커 청취와 소리 품질, 스크린리더, OS 수준 창 숨김(blur/hidden/pagehide는 이벤트 dispatch), 사람 체감 1~5분·난이도, 홈 카드/통합, 운영 3116, 실제 서버 CSP는 검증하지 않았다.
- 실제 두 손가락 시험은 Chromium mobile(CDP)만. PC와 WebKit의 두 번째 포인터는 합성 PointerEvent이고 WebKit 취소 제스처는 마우스 경로다.
- 제거 예정의 보조 기호 ✕는 가는 글리프라 눈에 약하다(점선 링과 aria-label이 주 구분 수단). 시각 개선 여지로 남긴다.
- 합성 click(detail 0)은 취소 제스처 후 300ms 안에서는 억제되고(설계 4.3), 이후와 키보드·새 pointerdown 뒤에는 항상 동작한다.
- 7x7은 엔진과 시험만 있고 UI는 5x5 전용이다.
- `__g030Snapshot().jumps`는 누계(위 정의)이므로 독립 QA가 `historyLength`와 구분해 읽어야 한다.
