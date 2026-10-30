# G018-05-CODY · 한 판 블록 공방 구현 인수

- worker: cody-01, thread `01a16eb2-eae8-78d2-b41a-380d98e6673d`, 현재 모델/세션 유지.
- status: 구현 및 worker 자기검증 완료, 독립 QA·PM 통합 수용 대기. 전체 게임 수용/배포 완료가 아닙니다.
- 기준: G018 공통 계약, 05 GDD v1.0/수용24개, IMPLEMENTATION_NOTES의 S02 원자 상한 정책, PM HTML/kit.svg, 지정05 원안과 공통 사양. 신규 폴더 부재를 실제 확인한 뒤 한 번의 지정 ACK를 남기고 구현했습니다.
- changed_files: `public/games/05-falling-blocks/{index.html,styles.css,engine.mjs,save.mjs,controls.mjs,main.mjs,assets/kit.svg}`, `tests/games/05-falling-blocks.test.mjs`, 본 문서, `artifacts/g018-05-builder/**`의 자체 증거만입니다. 다른 게임/홈/공통파일/서버/설정/Git을 수정하지 않았습니다. 공통 HANDOFF·작업일지·보드 게시·빌드는 계약상 PM의 후속 범위입니다.

## 실행과 구조

페이지 경로: `/games/05-falling-blocks/index.html`. PM이 기존 정적 서버에 통합할 독립 ES module 페이지입니다. worker는 운영3102/3116이나 새 서버를 시작/재시작하지 않았습니다.

순수 규칙은 engine, 결과/설정은 save, 입력 반복 시계는 controls, DOM/SVG/입력/음향 연결은 main으로 분리했습니다. 준비 화면은 점수0/줄0/빈 보드/활동블록 없음/다음 없음이며 RNG·판 수를 소비하지 않습니다. 시작 버튼이 첫 블록·다음 하나를 확정합니다. 샘플 점수·시안 상태 툴바·상태 setter·강제 승리·숨은 치트를 출하하지 않습니다.

## engine.mjs exports/API

모든 상태 전이 API는 전달한 상태를 동기적으로 갱신하고 이벤트 배열을 반환합니다. `createGame`/조회 도우미는 아래와 같습니다. UI 상태의 소유자는 main이며 엔진 단위시험만 독립 엔진 객체를 구성합니다.

| export | 계약 |
|---|---|
| `TYPES` | 동결 배열 I/J/L/O/S/T/Z |
| `RULES` | columns10, rows20, hiddenRows2, goal20, lockMs300, repeatDelayMs160, repeatMs60, softDropMs50 |
| `emptyBoard()` | 새22×10 null 배열. index=y+2 |
| `matrixFor(type)` | GDD의 새4×4 행렬 복사본 |
| `cells(piece)` | 점유4칸 `{x,y,type}`의 논리 좌표 배열 |
| `canPlace(state,piece)` | 점유칸 x0..9/y-2..19/고정칸 충돌 검사 |
| `gravityMs(lines)` | 0..4→900, 5..9→750, 10..14→600, 15이상→450ms |
| `createGame(rng=Math.random)` | ready 상태 생성, RNG 소비0. rng는 [0,1)의 유한 수 반환 함수 |
| `startGame(state)` | ready에서 playing·첫 스폰·다음1개 확정 |
| `move(state,-1\|1)` | 한 칸 좌/우, 충돌 시 완전 no-op |
| `rotate(state)` | 전체4×4 CW, offset0,-1,+1 순서. O/no space는 no-op |
| `softDrop(state)` | 아래 한 칸, 점수0. 막히면 RNG/점수 소비0 |
| `hardDrop(state)` | 최하 위치로 내려 즉시 고정. 거리0이어도1회 고정 |
| `grounded(state)` | 현재 활동블록 아래 한 칸이 막혔는지 |
| `advance(state,dtMs)` | 유한 양수 playing 시간만, 중간 낙하/접촉/고정/스폰을 기한순 처리 |
| `pauseGame(state,reason='manual')` | playing→paused, 타이머 보존 |
| `resumeGame(state)` | paused→playing, 명시적 재개 |
| `finishGame(state,reason='quit',detail=reason)` | playing/paused에서만 finished. won/lost/quit 한 번 확정 |

상태: `status:ready|playing|paused|finished`, `endReason:null|won|lost|quit`, `resultDetail:null|twenty-lines|spawn-blocked|quit`, `board`, `active:null|{type,matrix,x,y,rotation}`, `next:null|type`, `bag`, `score`, `lines`(실제값0..23), `gravityElapsed`, `contactElapsed:null|0..300`, `elapsed`(playing ms), `locked`, paused 중 `pauseReason`.

RNG 함수는 WeakMap에 연결되므로 스냅샷 복사본을 엔진으로 재주입하는 API는 아닙니다. 7bag은 Fisher–Yates, 리필당6회 RNG 호출, 다음 스폰이 막히면 추가 추첨하지 않으며 승리 뒤에는 스폰/추첨이 없습니다.

이벤트 객체의 `type`: `start`, `spawn:{piece}`, `move:{direction}`, `rotate:{offset}`, `softDrop`, `hardDrop:{distance}`, `lock:{piece}`, `clear:{rows,count,points}`, `pause:{reason}`, `resume`, `finish:{reason,detail,score,lines}`.

### 시간·고정·줄 제거

최초 지면 접촉에300ms 예산이 시작됩니다. 좌우/회전으로 재설정하지 않으며 접촉 후 공중에서도 소진하고, 공중에서 만료하면 다음 접촉까지 고정하지 않습니다. 정지 중 예산/중력은 변하지 않습니다. `advance`는 다음 중력/고정 기한까지 시간을 보내고 이벤트를 처리합니다. 기존 접촉의 고정이 중력 동시 기한보다 우선하며 새 스폰에는 남은 시간만 적용합니다. 부동소수 시간 비교 허용 오차는1e-7ms입니다.

고정4칸 반영→가시 완성행 동시 검출→숨김행 포함 위 행 이동/맨 위 빈 행 추가→100/300/500/800점과 실제 줄수 반영→20줄 이상 승리→그 외 다음 스폰 검사 순서입니다. 별도 숨김 lock-out은 없습니다. HUD/진행만20으로 제한하고 결과와 저장은23줄 같은 실제값을 유지합니다. 줄 제거 표시는 이미 확정된 상태의120ms 테두리 피드백이며 지연 콜백이 규칙을 바꾸지 않습니다.

## controls.mjs / 입력

`createControls(perform,elapse)` exports. 반환 API는 `press(action)`, `release(action)`, `advance(ms)`, `reset()`, `snapshot()`입니다. action은 left/right/down/rotate/drop입니다. 좌우는 즉시1회·160ms 뒤60ms 반복, 아래는 즉시1회·50ms 반복입니다. 마지막 좌우가 우선하며 해제 후 남은 방향은160ms부터 재대기합니다. rotate/drop은 해제 전1회만 처리합니다. 입력 기한까지 물리 시간을 먼저 진행하여 분할 프레임에도 반복/물리 순서를 유지합니다.

키보드는 `#game-area`에 초점이 있을 때 방향키/Space/P/Escape만 처리합니다. Ctrl/Alt/Meta·OS repeat을 중복 처리하지 않습니다. 모바일5버튼은 pointerdown에서1회 실행하고 좌우/아래만 유지 반복합니다. 합성 pointer click은 실행하지 않고 키보드 button click(detail0)은1회 처리합니다. 영역 이탈은 hold 해제, pointercancel/다중 터치(코트 밖 추가 손가락 포함)/blur/hidden/pagehide는 보호정지와 입력/음향 정리입니다. RAF 간격250ms 초과도 보호정지하고 자동 재개하지 않습니다.

## save.mjs / 원자 정산

exports: `STORAGE_KEY='simplegames.fallingblocks.v1'`, `THEMES=['clay','porcelain','ink']`, `CAP_WARNING`, `defaultSave()`, `validateSave(value)`, `createStore(getStorage=()=>globalThis.localStorage)`.

스키마: `{version:1,bestScore:0,bestLines:0,totalScore:0,totalLines:0,plays:0,wins:0,losses:0,quits:0,theme:'clay',muted:true}`. 통계는0..MAX_SAFE_INTEGER의 안전정수, bestLines≤23, bestScore≤totalScore, bestLines≤totalLines, plays=wins+losses+quits를 검사합니다. 종료 합은 BigInt로 비교하여 숫자 합산 반올림을 허용하지 않습니다. 정확한 theme/boolean도 검사합니다.

store: `snapshot()`은 복사본, 읽기 `warning`/`capped`, `settings({theme?,muted?})`, `record(state)`입니다. record 반환은 `{attempted,applied,newBest,capped}`. finished만 WeakSet으로1회 정산 시도하며 준비/시작/일시정지/취소/결과 재표시는 누적하지 않습니다. 새 최고는 엄격한 초과만 인정합니다.

결과 전체 다음 레코드를 먼저 계산·검증합니다. 어떤 필드든 상한을 넘거나 종료 합이 유효하지 않으면 통계 전체를 이전 값으로 유지하고 그 결과는 재시도하지 않습니다. 해당 store의 capped 상태에서는 후속 판도 합산하지 않습니다. 경고는 **“누적기록 상한에 도달해 이번 기록은 합산되지 않았습니다”**, 현재 결과 점수/줄은 실제값을 그대로 표시합니다. 설정은 동일한 유효 통계와 함께 저장할 수 있습니다. 통계 필드별 clamp는 사용하지 않습니다. 진행판/중복 정산 대상은 저장하지 않으며 capped 시도 목록도 진행판 복원 데이터가 아닙니다.

정상 getItem null은 경고 없이 기본값, 손상 JSON/구버전/범위·교차관계 오류는 기본복구 안내입니다. getter/getItem/setItem 예외는 계속 보이는 “이 환경에서는 기록이 저장되지 않습니다”와 메모리 플레이로 처리합니다. 쓰기 실패에도 메모리에는 먼저1회 정산됩니다. 전용 키만 읽고 쓰며 타키 삭제/clear는 없습니다.

새 작업/홈의 확인은 pause→quit확정→record/저장 시도→새 ready 또는 `/` 이동 순서입니다. 취소는 기존 판을 paused로 보존합니다. 메뉴·도움말·재질 창을 닫아도 명시적 재개를 요구합니다. 새로고침은 진행판을 복원하지 않습니다.

## DOM / 검사 API

| ID 또는 selector | 용도 |
|---|---|
| `#home`, `#result-home` | 홈 확인 요청 / finished 목록 링크 |
| `#mute` | aria-pressed=true가 음소거, 기본true |
| `#score`, `#lines`, `#state-label`, `#progress` | 실제 점수/최대20 진행/실제 상태 |
| `#next-preview`, `#next-label` | 실제 다음1개의0회전 행렬, 준비 중 없음 |
| `#game-area`, `#board`, `.cell` | 초점 가능한 입력 영역, 가시20×10 SVG 타일 |
| `#overlay`, `#overlay-kicker`, `#overlay-title`, `#overlay-copy`, `#primary` | 준비/정지/실제 결과와 상태별 명시 버튼 |
| `[data-action=left|rotate|right|down|drop]` | 모바일5조작 |
| `#pause`, `#restart`, `#menu`, `#help` | 정지·재개/새 작업/메뉴/도움말 |
| `#announcement`, `#save-warning` | 상태와 지속 저장/상한 경고 |
| `#best-score`, `#best-lines`, `#plays`, `#wins`, `#total-score`, `#total-lines` | 결과에서 확정된 통계 |
| `[data-theme=clay|porcelain|ink]` | 재질 창 열기, 현재 적용 aria-pressed |
| `#menu-dialog`, `#dialog-title`, `#dialog-copy` | native modal와 초점 순환 |
| `#menu-content`, `#menu-resume`, `#menu-help`, `#menu-theme`, `#menu-restart`, `#menu-home` | 실제 작업 메뉴 |
| `#help-content`, `#theme-content`, `#theme-preview`, `[data-choice]` | 도움말/재질 임시 미리보기 |
| `#dialog-close`, `#dialog-apply`, `#dialog-confirm` | 닫기·취소/설정 적용/quit 정산 확정 |

main의 유일한 export `getSnapshot()`은 `{game,save,warning,settlement,dialog,controls}`의 깊게 복사·동결된 읽기 자료입니다. 브라우저에서 해당 module을 import하여 읽을 수 있으며 live 상태나 변경 setter를 노출하지 않습니다. 메뉴는 native dialog/Tab trap/Escape 취소/원래 초점 복귀를 구현합니다.

## 실제 시험과 증거

| 검증 | 명령/결과 | 증거 |
|---|---|---|
| 최초 엔진/저장 단위 | `node --test tests/games/05-falling-blocks.test.mjs`, exit0,38/38 | `artifacts/g018-05-builder/unit-first.log` |
| 입력 시계 포함 최종 단위 | 같은 명령, exit0, **42/42**, fail/cancel/skip0 | `unit-final.log`, `test-exits.json` |
| 모듈 구문 | `node --check public/games/05-falling-blocks/{main,engine,save,controls}.mjs` 각각exit0 | `test-exits.json`, `syntax-main.log` 및 최종 syntax 증거 |
| Chromium source smoke | `node artifacts/g018-05-builder/ui-smoke.mjs v2`, exit0,7묶음 검사 | `ui-smoke-v2.log`, `ui-verification-v2.json`, `ui-smoke.mjs` |
| 시각 확인 | 실제 PC 플레이/모바일 자연실패 결과 캡처를 worker가 이미지로 열어 확인 | `pc-playing.png`, `mobile-result.png`, 수정 후 `pc-playing-v2.png`, `mobile-result-v2.png` |

원본 실패를 보존했습니다. 첫 UI 실행은 테스트 스크립트의 source 상대경로 `../../../`가 프로젝트 한 단계 밖으로 계산되어 ENOENT(exit1)였습니다(`ui-smoke-first.log`). 실제 파일을 읽거나 수정하기 전에 실패했으며 올바른 `../../`로 수정한 뒤 재실행 exit0(`ui-smoke-second.log`)입니다. 기존 증거를 삭제하거나 오류를 필터링하지 않았습니다.

브라우저 검사는 기존 설치 Playwright/headless Chromium으로 모든 요청을 허용 게임의 실제 로컬 소스로 fulfill한 **소스 기반 자기검사**입니다. `http://g018.local`은 테스트 내부 가상 origin이며 서버/실제 HTTP 접속 주소가 아닙니다. 외부 요청/console error/pageerror는 필터 없이 수집하여 각각0을 확인했습니다. 이 harness는 builder 증거에만 있으며 출하 런타임에 가짜 route가 없습니다.

7묶음: (1) 실제 시작/방향키 DAS/회전/Space1회 고정 (2) 정지 시간 불변/도움말 닫기/재질 적용 (3) 확인 취소 보존·quit1회 정산 후 ready (4) 실제 드롭 버튼 반복으로 자연 spawn-blocked 결과 (5)375/320/가로667에서 가로넘침0·표시 버튼/링크44px (6)reload 후 기록·재질 보존·진행판 복원0 (7)실제 CDP touchStart/Move가 아닌 **touchStart 유지**로 반복·코트 밖 두 번째 손가락 추가에 보호정지·재개 후 stale 반복0·tap drop1회입니다.

### 독립 경계8사례 대응

| 사례 | 실제 단위 결과 |
|---|---|
| 1 막힌 회전 | 행렬/x/y/타이머/전체상태·RNG 호출 수 그대로 |
| 2 동시2/4행 | 숨김 J/L 표식까지 정확히2/4행 이동, 복제0;1/3행도 별도 통과 |
| 3 19+4 | 실제23줄/+800/won1회/추가 spawn·RNG0 |
| 4 18+1+막힌 다음 | 19줄/+100/lost1회, spawn-blocked |
| 5 접촉299+1 | 이동/성공 회전 뒤에도 잠금1회, paused5000 시간0;공중 만료·재접촉도 통과 |
| 6 blocked soft/hard0 | soft 점수/RNG0, hard 거리0에서 고정1회 |
| 7 0점quit | plays1/quits1, 준비·시작·정지·재개·재표시 추가0 |
| 8 재질 불변 | 동일 RNG/입력/시간에 clay/porcelain/ink 보드·점수·결과 동일 |

추가:30/60/120FPS·긴dt 동일 보드/스폰/타이머(시간 오차1e-5ms 이내), 모든 속도 문턱, 회전 offset순서, O no-op, 숨김만으로 lock-out하지 않음, 상한 직전1회 성공/초과 전체보존/재열기0/이후 합산0/설정 유지, 저장 getter/get/set 각 예외/손상/null/교차검증을 실제 단위로 확인했습니다.

## 아트·음향·한계와 PM 다음 작업

PM 직접 제작 `docs/g018-design/05/kit.svg`를 `assets/kit.svg`에 동일 바이트로 복사했습니다. 7종 I/J/L/O/S/T/Z symbol과 글자·하이라이트를 실제 보드/다음/미리보기에 사용합니다. 새 공방 심볼은 본 프로젝트에서 직접 작성한 로컬 inline SVG입니다. clay/porcelain/ink는 타일의 채도/명도/회색 대비를 바꾸되 글자와 모양을 유지합니다. 외부 이미지/원작 아트/폰트/코드/패키지·네트워크를 추가하지 않았으며 외부 자산 라이선스 의존성은 없습니다.

빠른 낙하/고정/줄 제거는190/310/720Hz 시작의 짧은 Web Audio 합성음입니다. 기본 음소거, 사용자 동작 뒤 생성 시도, 오류 시 무음, 정지/이탈에서 node stop, no-op 무음입니다. 음향 API의 전체 검증·실제 청취는 아직 별도입니다. reduced-motion에서는 줄 테두리 효과를 생략하며 규칙은 유지합니다. safe-area 상하좌우 CSS를 포함하지만 실물 노치 검증은 하지 않았습니다.

차단: 구현 범위의 현재 차단 없음. 최초 기본 실행기 오류 `helper_sandbox_lock_failed / SetNamedSecurityInfoW(.sandbox-bin): Access denied(5)`는 보존하며 최신 추가 지시에 따라 공식 on-request+auto_review 재실행으로 진행했습니다. 권한/ACL/인증/전역설정/모델/운영서버를 변경하지 않았습니다.

PM·독립 QA의 남은 작업: 실제 통합 빌드/HTTP/CSP/MIME/홈 연결/기존4게임 회귀·WebKit 모바일·게임 정상 입력으로20줄 완주·장기프레임/실제 OS 숨김·모달 모든 조합·저장 차단 브라우저 주입·음향 API·실물 터치·실청취·사람2~5분 목표·전체24기준 수용. worker의 소스 smoke와 엔진 승리 시험을 실제 HTTP/브라우저 승리/전체 수용으로 과장하지 않습니다. 통합/운영 반영/배포는 수행하지 않았습니다.
