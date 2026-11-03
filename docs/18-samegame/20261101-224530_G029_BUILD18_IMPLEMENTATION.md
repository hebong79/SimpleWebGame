# G029 BUILD18 · 젤리 한입 구현 인수

- 상태: 제작 자체 검증 완료, 소스 동결. 독립 QA·공통 후보 빌드·홈 통합·운영 반영은 PM 후속 작업입니다.
- 담당/범위: BUILD18, `public/games/18-samegame/**`, `tests/games/18-samegame.test.mjs`, 본 IMPLEMENTATION 문서와 `artifacts/g029-builder18/**`만 작성했습니다. Git/PM2/서버 공통코드/홈/게시/과거증거를 변경하지 않았습니다.
- 기준: `.game-team/TEAM.md`, project.json, AGENTS.md, 필수 초기 설계·BACKLOG·DECISIONS·HANDOFF와 `docs/20261101-224000_G029_PM_CONTRACT.md`, 게임별 설계를 읽었습니다. 초기 기본 sandbox와 node_repl은 같은 lock/ACL 오류5로 실패했고 PM에게 즉시 보고, 자동 심사된 scoped escalated exec로 구현했습니다.

## 구현과 상태

- 준비에서만 새 판 생성 전 모드를 선택하며 명시적 시작으로 난수를 사용합니다. 입문 8×8/3종, 기본 10×10/3종, 확장 10×10/4종입니다. 진행 중 모드 변경은 새 판 포기 확인이며 취소 후 정지 상태입니다.
- 상하좌우 연결성분을 미리 선택하고 같은 성분의 어느 칸이든 재입력하면 원자적으로 제거·점수·낙하·열 압축을 확정합니다. 2개0점, `(n−2)²`, 전부 비우기500점1회입니다. 선택 교체·취소는 보드와 점수를 바꾸지 않습니다.
- 원래 행/열 크기의 `number|null` 격자를 유지하고 각 열 색 순서를 보존해 아래로 압축한 뒤 완전 빈 열을 오른쪽으로 보냅니다. 결과 판정은 200ms 논리 collapse lock 종료 후입니다. 잠금 중 제거 입력을 무시합니다. 결과 자체는 재진입하지 않고 UI가 round별 정산1회를 보장합니다.
- phase `ready|playing|paused|result`, subphase `idle|input|collapse|finished`; pauseCause `null|manual|dialog|protection`. 도움말/테마/새판/홈 확인이 플레이를 먼저 정지합니다. 수동정지의 재개만 `이어서하기`, 보호/모달정지는 `게임 재개`입니다. 모달 닫기·취소는 자동 재개하지 않습니다.
- collapse 중에만 RAF를 예약합니다. 250ms 초과 지연은 보호정지합니다. 남은 논리 잠금은 RAF에서 상태만 갱신하며 DOM은 잠금 종료 등 의미 있는 전이에만 씁니다. pause/모달/hidden 중 동결합니다. 상태 전이에 키와 포인터 잔상을 취소합니다.
- 문서 전체 pointer ID를 추적합니다. 같은 셀 down/up·8px 이내만 활성화, 이동/scroll/cancel/lostcapture/보드 밖 두 번째 포인터로 취소합니다. 후속 pointer click은 따로 실행하지 않습니다. Enter/Space는 release당1회, 방향키는 실제 유효 칸을 탐색하며 초점 칸을 내부 스크롤합니다. 외부 입력칸의 방향키는 소비하지 않습니다.
- 기호●/▲/◆/★와 색·aria-label을 함께 제공합니다. 모든 셀44px, 10열 grid476px+내부padding16px+border4px의 내부 스크롤이며320px 문서 가로 넘침을 막습니다. 모달 Tab/ShiftTab 순환과 외부 초점 유입 차단, 내부 스크롤, reduced-motion CSS를 지원합니다.

## 읽기 전용 관찰 API

`window.__g029Snapshot()`은 실제 상태의 structuredClone을 재귀 freeze해서 반환합니다. window 속성도 nonwritable/nonconfigurable입니다. 제품 setter·자동승리·테스트 전용 분기는 없습니다.

반환 필드: `phase, subphase, round, revision, mode, board, selection, remaining, score, moves, bonus, lockRemaining, pauseCause, result, notice, records, settings, modal, cursor, warnings`.

- `selection`: 정렬된 `[row,col][]`, `cursor`: `[row,col]`, `board`: 원래 크기의 `(0|1|2|3|null)[][]`.
- `result`: null 또는 `{reason:'all-clear'|'no-moves',score,remaining,moves,bonus}`.
- `modal`: null 또는 `help|theme|restart|home`. 테마 미리보기·대기 모드는 실제 적용 설정과 구분하며 snapshot.settings는 적용된 값만 반환합니다.
- round는 명시적 새 판마다 증가하고 revision은 제거 확정마다 증가합니다. lockRemaining은 실제 논리 ms입니다.

## 순수 함수 exports

- engine.mjs: `MODES, COLLAPSE_MS, modeOf, createBoard(mode,random), countRemaining(board), groupScore(size), floodGroup(board,row,col), hasMoves(board), collapseBoard(board), createGame(mode), startGame(game,mode,random), clearSelection(game), selectCell(game,row,col), advanceGame(game,elapsed), pauseGame(game,cause), resumeGame(game)`.
- 저장 순수 함수: `CAP, STORAGE_KEY, emptyModeRecord, defaultRecord, validateRecord(value), settleRecord(record,mode,result)`. settleRecord는 완료 결과 1회를 전달하는 caller 계약입니다. UI의 settledRound가 중복 전달을 막습니다.
- 저장 I/O: `loadRecord(getStorage?), saveRecord(record,getStorage?)`. getter/getItem/JSON/setItem 실패를 모두 warning으로 반환하고 플레이를 계속합니다. audio.mjs는 `createSound()`→`play(kind,muted),stop()`입니다.

## 저장 스키마

전용키 `simplegames.jelly-bite.v1`:

```json
{"version":1,"settings":{"theme":"sugar","muted":true,"lastMode":"normal"},"records":{"easy":{"bestScore":0,"bestRemaining":null,"finished":0,"allClears":0,"totalScore":0},"normal":{"bestScore":0,"bestRemaining":null,"finished":0,"allClears":0,"totalScore":0},"extra":{"bestScore":0,"bestRemaining":null,"finished":0,"allClears":0,"totalScore":0}}}
```

테마 sugar/night, muted boolean, lastMode easy/normal/extra입니다. 설정은 필드별 복구하고 기록은 모드별로 관계까지 검증해 나머지 유효 기록을 보존합니다. safe integer/범위/finite/배열·primitive/버전/완료수·전부정리수·점수·최소잔여 관계를 검증합니다. 자연 시작 no-moves의0점·원래크기잔여도 유효합니다. finished/allClears/totalScore 누적한도1,000,000에서 관련 mode bundle은 원자적으로 증가를 중단합니다. 진행 판/선택/타이머는 저장하지 않습니다. 읽기·준비·시작·선택·취소·정지·no-op에는 쓰지 않고 완료 최초1회/명시적 설정 변경만 씁니다. 오류 경고는 세션 동안 유지됩니다.

## DOM 선택자

- 상태: `#score,#remaining,#best-score,#state-message,#detail,#storage-warning,#record-title,#record-detail`.
- 보드: `#board-scroll`, `#board`, `.cell[data-row][data-col][data-color]`, `#cell-R-C`(0기반), `.selected,.empty`, `#board.locked`. 빈 칸은 disabled+visibility hidden, 유효 칸은 roving tabindex와 aria-disabled를 사용합니다.
- 조작: `#start,#cancel-selection,#restart,#pause,#resume,#retry,#home,#result-home`, 모드 `#mode-easy,#mode-normal,#mode-extra` 및 `[data-mode]`.
- 모달: `#help,#theme,#mute,#modal,#modal-title,#modal-content,#modal-apply,#modal-close,#theme-sugar,#theme-night`.
- 결과: `#result,#result-title,#result-detail`; 테마 `body[data-theme=sugar|night]`.

## 실제 자체 검증

- `node --check public/games/18-samegame/{engine,save,audio,main}.mjs`와 테스트파일 개별 구문검사 전부 exit0. 원시 `artifacts/g029-builder18/syntax-20261101-224446.log`.
- `node --test tests/games/18-samegame.test.mjs`: **57 Node test cases PASS,0 FAIL,exit0**. 원시 `artifacts/g029-builder18/unit-20261101-224302.log`. 독립 큐 탐색/열 구축 oracle24개 랜덤판, 경계/대각/단독칸, 안정낙하·연속빈열, 점수/전부정리1회/시작no-moves/모드/정지/부분복구/저장예외/한도를 포함합니다.
- `node artifacts/g029-builder18/browser-smoke.mjs`: **3환경×24 Boolean 검사=72 PASS,0 FAIL,exit0**. 이것은 Playwright test-runner assertion 수가 아닌 자체 smoke 검사 수입니다. Chromium1366×900, Chromium모바일320×800, WebKit모바일320×800입니다.
- 원시 로그 `artifacts/g029-builder18/browser-20261101-224337.log`, 상세 `artifacts/g029-builder18/browser-2026-11-01T13-43-37-969Z/results.json`. 초반 전달의75는 잘못 센 수치이며 이72가 원시값입니다.
- 실제시계 trusted mouse down→100ms→up 선택·교체·취소, Enter100ms와반복, 잠금 원자확정·정지동결, 모달 초점·Tab·Esc, 테마규칙불변, 자연 greedy 완결/재조회기록1회, deep clone/freeze,320px 문서폭/44px셀/내부scroll, pointer hold120ms DOM mutation0을 검사했습니다. 보드 밖 두 번째 포인터 취소는 synthetic 보조검사로 별도 구분합니다.
- 자체 HTTP 서버는 PM 승인된 loopback3188을 신규 listen하고 기존 CSP와 동일한 엄격헤더를 제공했습니다. 본인 서버와3브라우저를 종료했습니다. 각 환경 pageerror/CSP위반/외부요청0. 공통빌드는 하지 않았습니다.
- 생성 결과 PNG를 직접 보아 PC/320px WebKit 밤테마 결과 레이아웃을 확인했습니다. 파일은 위 브라우저 실행 폴더의 `desktop-result.png`, `mobile-chromium-result.png`, `mobile-webkit-result.png`입니다. 준비/playing 초기화면 PNG는 미생성으로 PM/독립QA 후속 시각검토가 필요합니다.

## 출처·라이선스·한계

- 엔진·저장·화면HTML/CSS·기호 구성은 이 프로젝트용 직접 작성입니다. 외부 이미지/폰트/음원/라이브러리/네트워크 자산을 추가하지 않았습니다. CSS·유니코드 기호에 별도 제3자 게임 자산 라이선스는 없습니다.
- `audio.mjs`는 기존 `public/games/16-simon/audio.mjs`의 프로젝트 직접 제작 WebAudio 합성음 유틸리티를 바이트 동일 복사 재사용했습니다. main 입력/모달 패턴도 같은 기존 파일을 읽어 참고한 뒤 독립 게임 상태에 맞춰 작성했습니다. 기존 원본을 변경하지 않았습니다.
- 독립QA·공통 빌드·홈 등록·기존게임회귀·실제3116/LAN 실행은 미수행입니다. 실제폰/물리손가락·실제Safari·터치 멀티포인터trusted 입력·네이티브OS 숨김·스피커 청취·사람의1~2분 체감은 미검증입니다. 자동검증을 실물 수용으로 표현하지 않습니다.
- PM이 HANDOFF/작업일지/게시판과 통합 상태를 소유하므로 이 worker는 해당 문서를 수정·게시하지 않습니다. 차단사항 없음. 다음: PM 소스SHA 인수→새 후보빌드→독립QA→발견결함 배정→승인된 통합·릴리스입니다.

## 동결 소스 SHA256

| 파일 | SHA256 |
|---|---|
| audio.mjs | B563134908427151FBD6779EADC13F5256B6AC32B740F7EE7D76B11CBD1FD72F |
| engine.mjs | 9C3969A8DFCEC6399D8E666514397ED55852ACE6F690485087057C6D65FE2035 |
| index.html | 9969EDEF5AA906D30F1CD160CC9EF1E8D2F177E555180C4EEF61ADE11E59AE73 |
| main.mjs | AA543C71D45A932CE0AFFF7C4A2E40107C27E00AF9F50D0B6436C44BD4AFCD5D |
| save.mjs | AC1D322EA744A47EC2418A9EA135C0A7BC90CA8B69F836F046CBE1C1E8BD51FE |
| styles.css | 69D814AC1CA9EEC28CB4B2D2CD057E17F404844E35CF560378DB11B1140759E4 |
| tests/games/18-samegame.test.mjs | F64F22A6DF1ED6BF2AD49134DA4508F021C0222A4DCAA3EEFA6430E3E010E9D4 |

제품6파일은 이 보고 시점부터 동결하며 PM의 결함 배정 없이 수정하지 않습니다.
