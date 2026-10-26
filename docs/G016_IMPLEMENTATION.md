# G-016-CODY 우주 청소부 구현 인수

- 담당: cody-01 (`01a16eb2-eae8-78d2-b41a-380d98e6673d`), 구현 소스 완료·PM/독립 QA 인수 대기.
- 기준: `G016_IMPLEMENTATION_CONTRACT.md`, `G016_GAME_DESIGN.md` v1.1, `G016_ACCEPTANCE.md`, `G016_DESIGN_HANDOFF.md`, PM HTML/SVG 및 desktop-v11/mobile-v11 시안. 기존 구현을 초기화하지 않고 이어서 완성했습니다.
- 수정 범위: 아래 신규 게임 5파일, 지정 단위 테스트, 본 문서. 사용자 추가 허용으로 smoke JSON 2파일만 별도 작성했습니다. 홈/공통 소스·설정·기존 게임·서버·dist·Git은 수정하지 않았습니다. 공통 HANDOFF/작업일지/보드 등록은 계약에 따라 PM이 통합합니다.

## 산출물과 실행

| 파일 | 내용 |
|---|---|
| `public/games/04-breakout/index.html` | 코트·HUD·준비/정지/결과·기록·장비·가이드·종료 확인창 |
| `public/games/04-breakout/styles.css` | PC 2열/모바일 1열, 3:4 코트, 44px 버튼, safe-area, 포커스/저감모션 |
| `public/games/04-breakout/engine.mjs` | DOM 없는 결정적 순수 규칙·연속 충돌·상태/이벤트 |
| `public/games/04-breakout/save.mjs` | 버전1 로컬 저장·검증·결과 중복 방지·메모리 fallback |
| `public/games/04-breakout/main.mjs` | 실제 Canvas 벡터 렌더·마우스/키보드/터치·합성음·UI 연결 |
| `tests/games/04-breakout.test.mjs` | 엔진/저장 단위 시험 41개 |

PM 통합 서버에서 페이지 경로는 `/games/04-breakout/index.html`입니다. worker는 새 서버·빌드·배포를 실행하지 않았습니다.

실제로 통과한 재현 명령:

```powershell
node --test tests/games/04-breakout.test.mjs
node --check public/games/04-breakout/main.mjs
node --check public/games/04-breakout/engine.mjs
node --check public/games/04-breakout/save.mjs
```

## 엔진 공개 API

ES modules named exports입니다. 생성 함수 외 상태 전이 함수는 전달한 상태 객체를 갱신하고 이벤트 배열을 반환합니다. 비허용 상태의 호출은 `[]`입니다.

| export | 정확한 동작 |
|---|---|
| `RULES` | 동결 상수: width720/height960/paddleWidth120/paddleHeight18/paddleY884/ballRadius9/lives3/columns8/rows4/speeds[300,350,400]/keyboardSpeed540/brickPoints10/lifeBonus50 |
| `createBricks(stage=1)` | 해당 단계의 32개 새 벽돌 배열 |
| `createGame()` | ready/attached, 1단계·3목숨·0점·32벽돌의 새 상태 |
| `startGame(state)` | ready → playing/attached, 발사하지 않음 |
| `launchBall(state)` | playing/attached/목숨>0에서만 flight로 발사 |
| `pauseGame(state)` | playing → paused |
| `resumeGame(state)` | paused → playing, 공 위치/속도 보존 |
| `step(state, seconds, input={})` | playing과 유한한 양수 dt에서만 이동/충돌; 나머지는 입력까지 no-op |
| `finishGame(state, reason='quit')` | playing/paused → finished, reason은 quit/won/lost만 허용. ready/이미finished는 no-op |

상태 필드는 `status: ready|playing|paused|finished`, `phase: attached|flight`, `stage`, `lives`, `score`, `totalBricks`(현재 판의 실제 제거 수), `endReason: null|quit|won|lost`, `paddle:{x,y,width,height}`, `ball:{x,y,vx,vy,r}`, `bricks:[{id,row,col,x,y,width,height,alive}]`입니다. 패들의 x는 중심, y는 위쪽입니다. 벽돌의 내구도1은 `alive`로 표현합니다.

`input`은 `{paddleX:number}`(논리 중심 좌표) 또는 `{axis:number}`(-1..1 키보드 이동)입니다. 둘 다 있으면 paddleX가 우선하며 x60..660으로 제한합니다. attached 공은 패들 중심, y874에 붙습니다.

이벤트는 `start`, `launch`, `pause`, `resume`, `brick:{id,points}`, `paddle`, `lifeLost:{lives}`, `stageClear:{stage,bonus}`, `stage:{stage}`, `finish:{reason,score,stage,totalBricks,lives}`이며 각 객체에 `type`을 포함합니다. 결과 이벤트는 한 번만 발생합니다.

### 충돌 경계와 처리 정책

- 최초 발사는 위쪽 수직에서 오른쪽 15도, 크기는 단계별300/350/400입니다. 패들 맞은 위치는 수직 기준 ±60도로 반사하며 최솟값 수직 성분은 단계 속도의 절반입니다. 벽/벽돌 반사 후 거의 수평이면 수직 성분을 속도의15% 이상으로 보정하고 벡터 크기를 보존합니다.
- 원과 사각형 네 면의 충돌 시점, 꼭짓점 원의 이차방정식을 함께 풀어 가장 이른 접촉을 처리합니다. 같은 시점(EPS 1e-7 이내)의 생존 벽돌은 각각 한 번 제거하며 법선 합을 정규화해 반사합니다. 패들과 동시 접촉하면 패들 반사 정책이 우선합니다.
- 벽돌 제거 → 스테이지 완료/보너스 → 바닥 실점 순서입니다. 마지막 벽돌과 바닥이 동시에 접촉해도 통과가 먼저입니다. 단계 전환/실점 후 남은 dt는 새 공에 적용하지 않습니다.
- 공 중심 y가 `height+r = 969`에 도달하는 하향 접촉을 바닥 이탈로 처리합니다. 한 번에 목숨1만 소모하고 남으면 attached, 0이면 finished/lost입니다. 자동 재발사는 없습니다.
- 면/모서리 반사 뒤 epsilon 분리·아주 작은 시간 전진으로 재접촉 루프를 방지합니다. 한 step의 충돌 반복 상한은20,000입니다. 극단적으로 큰 인위적 dt의 시간 전체 재생은 보장하지 않습니다. 실제 UI는 한 RAF dt를50ms로 제한하고 이탈 시 리셋합니다.
- 모든 렌더/스킨/음소거 정보는 엔진과 분리됐습니다. 게임 규칙에 난수를 사용하지 않습니다.

## 저장 API와 v1.1 집계

`save.mjs` exports: `STORAGE_KEY='simplegames.breakout.v1'`, `THEMES=['mint','solar','mono']`, `defaultSave()`, `validateSave(value)`, `createStore(getStorage=()=>globalThis.localStorage)`.

store는 `snapshot()`(복사본), 읽기 `warning`, `save()`, `settings({muted?,paddleTheme?})`, `record(state)`를 제공합니다. `record`의 반환은 `{recorded:boolean,newBest:boolean}`이며 finished 상태 객체를 WeakSet으로 중복 집계하지 않습니다. 저장 실패도 탭 메모리에 먼저 반영됩니다.

기본값은 version1/bestScore0/plays0/wins0/totalBricks0/bestStage0/mutedfalse/paddleTheme mint입니다. 유한 안전정수·bestScore≤1410·wins≤plays·bestStage0..3·정확한 boolean/theme을 검사합니다. 누적값은 MAX_SAFE_INTEGER로 포화합니다.

- plays는 결과 확정 때만1 증가, wins는 won만1 증가합니다. bestStage는 확정 결과에서 진입한 최고 단계이며 totalBricks는 score와 별개인 실제 제거 수를 누적합니다.
- newBest는 기존 점수보다 엄격히 클 때만 true입니다. 0점과 동점은 새 기록이 아닙니다.
- 진행/정지 중 새 임무·홈 확인: `finishGame('quit')` → `store.record`/저장 시도 → 새 ready 또는 홈 이동. 확인 취소/blur/준비 표시/시작만으로는 집계하지 않습니다.
- 저장값 부재 null은 경고가 없습니다. 문자열 null/손상 JSON/구버전은 복구 안내, getter/getItem/setItem 예외는 지속 경고와 탭 메모리 기록으로 처리합니다. 다른 게임 키는 사용하지 않습니다. 탭 간 동시 갱신 병합은 범위 밖입니다.

## 실제 DOM과 읽기 전용 검사 API

| ID/selector | 용도 |
|---|---|
| `#home` | 상단 홈 링크; 진행/정지 중 확인 |
| `#mute` | aria-pressed=true가 음소거 |
| `#stage`, `#status`, `#score`, `#lives`, `#remaining`, `#speed` | 엔진 실제 HUD. lives는 aria-label로 개수 제공 |
| `#court` | tabindex0 게임 초점/포인터 입력 영역 |
| `#canvas` | width720 height960 Canvas |
| `#touch-zone` | 코트 하단35%의 touch-action:none 영역 |
| `#overlay`, `#over-kicker`, `#over-title`, `#over-copy` | 준비/정지/실제 결과 표시 |
| `#primary` | 상태별 임무 시작/계속하기/다시 도전 |
| `#result-home` | finished에서 표시하는 게임 목록 링크 |
| `#launch`, `#pause`, `#restart` | 실제 발사/정지·재개/새 임무 |
| `#announcement` | stage/실점/저장 결과 텍스트 안내 |
| `#best-score`, `#wins`, `#plays`, `#total-bricks`, `#best-stage` | 저장 통계 |
| `[data-skin='mint'|'solar'|'mono']` | 장비 선택. 이름·문양·윤곽·aria-pressed |
| `#input-guide`, `#save-warning` | 도움말과 지속 저장 경고 |
| `#confirm-dialog`, `#confirm-title`, `#confirm-copy`, `#confirm-cancel`, `#confirm-ok` | native modal, 취소 기본 초점/Tab trap/Escape 취소/원래 버튼 초점 복귀 |

`main.mjs`의 유일한 export는 `getSnapshot()`입니다. DOM이 있는 브라우저에서 `await import('/games/04-breakout/main.mjs')` 후 호출하면 `{game,save,warning,dialogOpen}`의 깊게 복사·동결된 스냅샷을 받습니다. window에 테스트 전역이나 live 상태 setter/강제 승리 조작을 노출하지 않습니다. 엔진 단위 테스트만 독립 상태를 구성합니다.

입력은 코트 초점에서 방향키/A D/Space/P/Escape를 처리하고 Ctrl/Alt/Meta·자동 반복은 통과/무시합니다. 모바일 하단 primary pointer만 추적하며 8CSSpx 초과 이동은 드래그, 350ms 이내 짧은 탭만 발사합니다. page capture에서 추가 손가락을 관찰하고 cancel/lost capture/이탈에서 stale 입력을 해제합니다. blur/hidden/pagehide 뒤 자동 재개하지 않습니다.

## 실제 검증 결과

### 자동 진행 smoke (nonce b70092b076879d24)

1. 이 새 턴에서 설계 v1.1·계약·디자인 인수를 실제 읽었습니다.
2. 기존 `artifacts/g016-worker-autonomy-smoke/b70092b076879d24.json`를 재조회하고 Node `assert.deepEqual`로 nonce/worker/read_design/write_ok의 정확한 값을 검증했습니다.
3. 사용자 한정 허용 경로 `artifacts/g016-worker-autonomy-smoke/b70092b076879d24-new-turn.json`에 `{nonce:'b70092b076879d24',reviewer:'auto_review',new_turn:true}`를 실제 작성하고 Node로 재검증했습니다.
4. 성공 출력: `AUTO_REVIEW_NEW_TURN_OK nonce=b70092b076879d24` (exit0). 앞선 원본 검증도 `AUTONOMY_SMOKE_OK nonce=b70092b076879d24 worker=cody-01 read_design=true write_ok=true` (exit0)였습니다.
5. 기본 sandbox 셸은 helper_sandbox_lock_failed/SetNamedSecurityInfoW 오류가 재현됐습니다. 공식 require_escalated 자동 검토 재실행으로 읽기/Node 검증이 성공했습니다. ACL·보안·인증·모델·세션 변경이나 거부 우회는 하지 않았습니다.

### 단위/정적 검사

- 최종 `node --test tests/games/04-breakout.test.mjs`: **41/41 PASS**, fail0/cancelled0/skipped0, exit0. 이전38개 결과에 기존 최고값/누적 보존·쓰기 실패 중복 방지·바닥 경계/고속 패들3개를 추가했습니다.
- 설계5.1의 독립8사례 전부 일치: ready0 / 발사전quit1판 / 5벽돌quit50점 / 취소0판 / stage2quit470점32벽돌 / stage3quit940점64벽돌 / 승리1410점96벽돌 / 5벽돌실패50점.
- 그 외 배치/속도/면·꼭짓점 충돌/긴프레임/40,000px/s 주입 관통/동시 통과·바닥/목숨 이월·수동발사/0목숨 고정/보너스1회/정지 no-op/저장 getter·get·set 실패/손상·구버전/동점/안전정수/스킨 물리 불변을 실제 시험했습니다.
- `node --check` 엔진/저장/메인3모듈 exit0. 허용 경로 `git diff --check`에서 출력 오류가 없었습니다(신규 untracked 파일의 내용 검증을 대체하지는 않습니다).

### worker 브라우저 smoke

기존 설치 Playwright의 headless Chromium을 실행하고 모든 요청을 로컬 게임 소스 파일로 route.fulfill했습니다. 외부 요청은 차단했고 서버를 띄우거나 추가 파일을 쓰지 않았습니다. 시험 origin `http://127.0.0.1:18786`은 **검사 내부의 가상 URL이며 실제 실행 중 서버 주소가 아닙니다**. self-only script/style CSP로 로드했습니다.

- 성공 출력: `UI_SMOKE_OK ready/start/manual-launch/blur-pause/confirm-cancel/quit-record 320x667 667x375 buttons>=44 CSP-self pageerrors=0; intercepted local files, no server started`.
- 실제 DOM으로 시작/별도 발사/blur 정지·시간 경과 불변/새 임무 확인 취소·기존판 보존/명시적 재개/중도 종료1회 집계·새 ready를 검증했습니다.
- 320×667과667×375에서 문서 가로 넘침 없음, 표시 중 버튼/결과 링크의 실제 폭·높이44CSSpx 이상을 확인했습니다. PC 1366×1050과 모바일 설정375×812에서 수행한 소스 기반 smoke이며 통합 서버 E2E와 구분합니다.
- 모바일 Chromium에서 **실제 CDP Input.dispatchTouchEvent** touchStart/touchMove/touchEnd로 코트30%→70% 하단 드래그를 수행했습니다. 논리 패들 x≈504, attached 유지(드래그가 발사되지 않음)를 확인하고 실제 touchscreen.tap으로 flight 전환을 확인했습니다.
- 성공 출력: `TOUCH_SMOKE_OK real-CDP-touch lower-drag mapped paddle=504 drag-not-launch tap-launch` (exit0). pageerror0입니다. 앞선 턴의 대기 중 중단된 터치 요청은 성공 근거로 쓰지 않고 새 턴에서 재실행했습니다.

## 자산 출처·권리 및 남은 인수

별/궤도/행성/벽돌4색·문양/패들3종/공 궤적은 PM 자체 원본 키트의 색·배치를 기준으로 이 프로젝트에서 새로 작성한 Canvas 벡터 명령입니다. 합성음3종은 Web Audio oscillator/gain이며 외부 음원·이미지·폰트·코드·CDN·신규 패키지를 사용하지 않았습니다. 외부 자산 라이선스 의존성은 없습니다. 장식 궤적은 reduced-motion에서 생략하며 실제 속도는 유지합니다.

worker 범위의 구현 차단은 없습니다. 현재 셸 sandbox 초기화 오류는 공식 자동 검토 재실행으로 진행할 수 있었으며 OS 권한 문제 자체를 수정한 것은 아닙니다.

다음은 PM·독립 QA 소유 검증입니다: 실제 통합 빌드/HTTP/CSP·홈 카드·기존3게임 회귀, 전체 수용28항목, WebKit 모바일/멀티터치 취소·pointercancel·키보드 전체 흐름·실제 승패까지 브라우저 플레이, 완성 화면 캡처 시각 검토, 실물 모바일·실음향 청취. worker는 디자인 캡처를 열어 확인했지만 완성 게임의 시각 최종 수용·실기기 수용은 선언하지 않습니다. 1~4분 플레이 목표도 실측하지 않았습니다. 공개 배포는 수행하지 않았습니다.
