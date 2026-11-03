# G029 BUILD17 · 별빛 스위치 구현 인계

- 작업 시각: 2026-11-01 22:47 KST. 역할 BUILD17. 상태: 구현·자체검증 완료, 제품 소스 동결. 독립 QA/PM 통합/운영 반영은 후속입니다.
- 경로: `/games/17-flip/index.html`, ID `starlight-switch`.
- 제품 파일: `public/games/17-flip/{index.html,styles.css,main.mjs,engine.mjs,save.mjs,audio.mjs}`. 단위 `tests/games/17-flip.test.mjs`.
- 1~5단계3×3/6~15단계4×4,15개 직접 제작 고정 판. 모든 시작판은 켜진/꺼진 별을 모두 포함하며 중복 없습니다. 각 target은 고정 수치로 저장하고 별도 subset-DP 전수 oracle과 비교했습니다. 목표: `1,2,3,4,5,2,3,4,5,6,5,4,5,4,7`.
- 십자 XOR, 120ms 잠금, undo, 동일 단계 재시작 확인, 해금된 단계 준비 선택, 최초 완료 정산, 재도전/다음 단계/마지막 단계 UI, night/paper, 기본 무음 WebAudio 합성을 제공합니다.

## 실제 검증

| 분류 | 결과 | 증거 |
|---|---|---|
| 모듈 구문 | engine/save/main/audio `node --check` 4개 exit0 | `artifacts/g029-builder17/run-20261101-final/syntax.log` |
| 자동 순수 로직 | `node --test tests/games/17-flip.test.mjs` 58/58 PASS, fail/skip0, exit0 | 동일 폴더 `tests.log` |
| 실제 HTTP 브라우저 | PC Chromium1366, mobile Chromium320, mobile WebKit320, 각각32단언=96/96 PASS, exit0 | `artifacts/g029-builder17/run-20261101-browser6/{smoke.log,results.json}` |
| 브라우저 범위 | trusted90ms 시작/칸 클릭, undo/no-write, 방향키/Enter 반복, 새판취소/확정, 도움/모달 Tab·외부초점 차단/Esc, atomic result/정산1회, 다음단계, idle DOM mutation0, scroll/보드밖2번째pointer 취소, 수동/보호정지, 테마/홈취소/재로드/부분복구 | 동일 `results.json` |
| 오류/레이아웃 | 세 환경 console/page error0·외부요청0·CSP0,320px document overflow0, 초기 표시된 버튼44px 이상 | 동일 `results.json` |
| 시각검토 | PC 결과, mobile Chromium320 준비·종이별 정지 캡처를 실제 이미지로 열어 검토 | browser6 PNG6개. 종이별 캡처는 테마 전환120ms 중간 프레임일 수 있음 |
| 공통빌드/운영 | 미실행 | PM 소유 후속 |

자체 HTTP는 `artifacts/g029-builder17/serve.mjs`의 loopback3177만 사용했습니다. 실행별 PID를 기록했고 각 실행 finally에서 본인 PID만 종료했습니다. 실제 운영3116·PM2·홈·공통파일·Git은 변경하지 않았습니다. 자체서버 CSP를 적용한 검사이며 운영 서버 CSP 검증으로 주장하지 않습니다.

원실패 보존:

- browser1/2: mobile WebKit next 이후 합성 mouse hover가 늦게 도착해 실제 preview class3개 변경. 동일값 RAF 쓰기는 아니었습니다. 실제 `(hover: hover)` 지원일 때만 hover preview하도록 최소 수정했고 browser6 idle0 확인. 초점 기반 미리보기와 첫 클릭 반전 유지.
- browser3/5: WebKit screenshot마다 style-src CSP 오류1개씩(각3개). `caret:initial, animations:allow`도 해결하지 못했습니다. 제품 inline style/CSP 변경이나 오류 필터는 없습니다. browser6은 PM 승인으로 **WebKit screenshot 단계를 실행하지 않고** 실제 기능+CSP 전체를 검사했습니다. WebKit 이미지 생성은 도구 한계로 실패/미검증입니다.
- browser4: 제품 로드 전 Chromium `ERR_NO_BUFFER_SPACE`, 원로그 보존. 새실행에서 재발 없음. 타프로세스 종료 없음.

## 계약 수용 범위

1. 모서리3/변4/중앙5, 줄넘김 방지, double toggle: 단위 PASS.
2.15개 크기·해결·중복·미완성/비어있지않음·target최적·별경계: 단위 PASS.
3. undo/재시작/최종단계·저장정산: 단위 PASS, 실제UI는1단계 완료→2단계 시작과 취소/재시작 검증.15개 전체 UI 완주는 독립 QA 범위.
4. 90ms trusted click/keyboard repeat/scroll/multi-pointer/protect/modal focus:3환경 PASS. blur는 browser dispatch 검증이며 OS실제 숨김은 미검증.
5. 저장손상/getter/getItem/setItem/부분복구/타키/cap:단위 PASS, 설정손상·유효기록 보존은 실제UI3환경 PASS.
6.320px/44px/기호/console/CSP/외부요청:자체HTTP3환경 PASS.4×4 모바일 전체 화면/모달 전체모드·물리폰은 독립 QA/실물 미검증.
7. 실제UI ready/start/result/next/pause/resume/home취소 PASS. 홈 실제이동·홈카드통합은 PM후속.

## 순수 API와 상태

- `engine.mjs`: `LOCK_MS`, `STAGES`, `affected(size,index)`, `toggle(board,size,index)`, `makeBoard(size,scramble)`, `solve(board,size)`, `starsFor(moves,target)`, `createGame(stage=1)`, `startGame(game,stage)`, `pressCell(game,index)`, `undo(game)`, `pauseGame(game,cause)`, `resumeGame(game)`, `tick(game,delta,token)`.
- `save.mjs`: `STORAGE_KEY`, `CAP`, `THEMES`, `emptyStage()`, `defaultRecord()`, `validStage(value,index)`, `recoverRecord(value)`, `loadRecord(getStorage)`, `saveRecord(record,getStorage)`, `settleRecord(record,result)`.
- `window.__g029Snapshot()`는 configurable:false/writable:false. 반환은 매번 structuredClone이며 setter/규칙우회 없음. `phase,subphase,round,stage,size,board,moves,history,remaining,pauseCause,result,token,selected,hovered,modal,records,settings,warnings` 실제 필드.
- 잠금 중에만 RAF를 사용합니다. remaining 숫자 tick은 DOM을 렌더하지 않으며 subphase/phase 전환만 렌더합니다. 모든 text/attr/class/disabled/tabindex/hidden 쓰기는 변경 비교 후 수행합니다. held target DOM은 유지하며3↔4 크기 변경시에만 board 자식을 새로 만듭니다.
- pause/모달/hidden은 RAF취소 및 잔여잠금 보존, delta>250은 보호정지, 시작token으로 오래된 callback 차단. 모달닫기 자동재개 없음. 보호는 `게임 재개`, 수동은 `이어서하기`.

## 저장 스키마

키 `simplegames.starlight-switch.v1`:

```json
{"version":1,"settings":{"theme":"night","muted":true},"records":{"completed":0,"unlocked":1,"stages":[{"bestMoves":null,"bestStars":0,"clearCount":0}]}}
```

실제 stages는15개입니다. `completed`는 모든 stage.clearCount 합, `unlocked`는 유효한 완료 단계에서 파생(1..15). clearCount/completed cap1,000,000. 정산 포화 시 count/best/unlock 모두 함께 증가하지 않습니다. bestMoves는 안전정수≥target, bestStars는 해당 bestMoves 별등급과 일치, clearCount0이면 null/0만 허용합니다. 손상 단계만 기본복구하고 유효 다른단계 유지, 설정은 필드별복구합니다. 기본읽기/복구만으로 쓰지 않습니다. 최초 round 완료1회 및 실제 설정변경에만 setItem. getter/read/write예외는 지속경고와 메모리플레이로 처리합니다.

## DOM 선택자

- 준비: `#ready-panel,#start,#stage-select,.stage-option[data-stage="1".."15"]`.
- 보드: `#board,.star[data-cell="0".."8"/"15"]`, `aria-label` 행/열/켜짐·꺼짐, `aria-pressed`, `aria-disabled`; 한칸 roving tabindex0.
- 상태: `#stage-label,#moves,#target,#status,#stage-best,#lifetime,#warning`.
- 조작: `#undo,#restart,#pause,#resume,#help,#settings,#mute,#home`.
- 결과: `#result-panel,#result-title,#result-detail,#next,#retry,#choose`.
- 모달: `#modal,#modal-title,#modal-body,#modal-actions,#modal-close,#modal-confirm,#settings-apply,.theme-option[data-theme="night"/"paper"]`.

## 출처·라이선스와 후속

원본 CSS/별기호/판 콘텐츠/합성음은 이번 프로젝트에서 직접 제작했습니다. 외부 이미지·폰트·음원·CDN·자산 다운로드 없음. 기호는 시스템 글꼴의 Unicode ★/☆입니다. 기존 프로젝트 `public/games/15-connect-four/{main.mjs,styles.css,save.mjs,audio.mjs}`의 조건부 DOM helper/네이티브 버튼 gesture 검증/모달 trap/저장 예외·합성음 패턴을 읽고 이 게임에 맞게 재작성·재사용했습니다. 외부 원작 코드/이미지 복제 없음.

재실행: `node --test tests/games/17-flip.test.mjs`, 자체HTTP `node artifacts/g029-builder17/serve.mjs`, 다른 셸 `node artifacts/g029-builder17/smoke.mjs artifacts/g029-builder17/<새실행경로>`.

다음 작업은 PM 실제 파일 인수→홈 통합/후보빌드→독립QA입니다. 물리폰·실청취·사람 체감시간·OS보호정지·운영3116·전체15단계 UI완주·reduced-motion UI검증은 미실행입니다. 게시판/공통HANDOFF/작업일지는 PM 소유로 넘깁니다. source SHA는 `artifacts/g029-builder17/run-20261101-final/source-sha256.json`입니다.
