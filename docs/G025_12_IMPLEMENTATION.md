# G025-12 숫자 우체통 — 구현 인계

- 역할: 제작자 자체 구현/검증입니다. **독립 QA 수용·통합·운영 완료 보고가 아닙니다.**
- 물리 root: `E:/Work2/Project/SimpleGames/worktrees/g025-12-fifteen`
- branch: `feature/g025-12-fifteen`
- 착수 HEAD 확인값: `7d72954896845e7cf2152e4a4857a6f00a6c14b7`
- 입력: G025 PM 계약/12 설계/디자인 보드/추가 결정 v1.1, 읽기 전용 원안과 공통 사양. 최신 원본 AGENTS의 실제 작업명 KST 규칙을 적용합니다.
- PM 소유 `G025_DESIGN_DECISIONS.md`, `G025_QA12_PLAN.md`와 QA 증거는 수정/커밋하지 않습니다. 상태문서/홈/공유 서버/package/lockfile/PM2/3116도 변경하지 않았습니다.

## 구현 범위

독립 폴더 `public/games/12-fifteen/` 안에 순수 불변 엔진, 결정적 콘텐츠, 버전 저장, DOM 입력/렌더, CSS 엽서 3테마, 직접 제작 SVG를 구현했습니다. 인접 한 타일만 이동하며 방향키는 **빈칸의 방향**입니다. 자동 줄 이동/힌트/해법/완료 setter는 없습니다.

첫 유효 이동부터 monotonic active-time을 측정합니다. 무효 이동/정지/목표 미리보기/모달/보호 정지는 시간을 소비하지 않습니다. 완료 시간은 floor된 양의 정수 ms로 고정되고 한 판 한 번 정산합니다. Undo는 판/빈칸만 복구하며 이동 수와 시간을 줄이지 않고 별도 undoCount를 올립니다. 결과에서는 이동/undo/goal을 차단합니다.

목표는 pointer/Space/Enter를 누르는 동안만 표시합니다. document-capture release/outside release/cancel/lostcapture, Tab 이탈, blur/visibility/pagehide에서 해제합니다. 정상 release만 이전 playing으로 복귀합니다. 보호 정지는 명시 재개가 필요합니다. 다중 포인터는 보드 밖 두 번째 손가락까지 관찰하고, drag >8px/cancel은 이동을 취소합니다.

모달은 native dialog + 현재 보이는 enabled 버튼 기준 Tab 순환이며 실제 트리거로 초점을 돌려줍니다. playing에서 모달 취소는 배열/이력/카운터/확정 elapsed를 보존하는 modal 보호 정지, 기존 paused에서는 원래 이유를 유지합니다. 모드/재시작 확정만 판을 초기화합니다. 테마 미리보기 취소는 원래 외형으로 돌아갑니다.

RAF는 시간 output만 실제 문구가 달라질 때 갱신합니다. 버튼/자식 텍스트를 프레임마다 교체하지 않습니다. native select/외부 런타임/외부 통신은 없습니다. 합성음은 기본 음소거, 지원 실패 시 무음입니다.

## 고정 콘텐츠 / 실제 route

| modeID | size | 합법 shuffle | 최종 seed | 시작 배열 |
|---|---:|---:|---:|---|
| practice-v1 | 3 | 8 | 24011 | `[1,2,3,5,0,7,4,8,6]` |
| post-20-v1 | 4 | 20 | 24012 | `[1,2,0,4,5,10,3,6,9,14,12,11,13,8,15,7]` |
| post-60-v1 | 4 | 60 | 24013 | `[1,3,4,12,2,15,6,0,7,8,13,10,5,11,14,9]` |
| post-120-v1 | 4 | 120 | 24014 | `[0,5,1,7,10,15,2,9,14,12,11,3,13,4,6,8]` |

- 알고리즘: `xorshift32-legal-blank-walk-v1`. goal에서 합법 blank 이동 N회, 즉시 역이동 제외, 끝이 goal이면 제한된 다음 seed 재시도, 32회 실패 시 명시 오류. 실제 네 seed는 변경되지 않았습니다.
- **모든 실제 route 배열**: `public/games/12-fifteen/puzzles-manifest.json`의 `puzzles[modeID].route`; 같은 값을 HTTP 모듈 `puzzles.mjs`의 frozen `PUZZLES[modeID].route`로 제공합니다.
- source fixture SHA256: `d40d68cec58f277658f42d8821d1154c9290f3d21f37ba7442e100ec5102eb24`.
- 역복구 입력: `[...PUZZLES[id].route].reverse().map(d => OPPOSITE[d])`. route의 의미는 타일 방향이 아닌 blank 방향입니다.
- `artifacts/g025-12-builder/handoff-manifest.json`에도 전체 배열/route/API/locator/HTTP manifest를 담습니다. fixture JSON은 출하 서버의 기존 MIME allowlist상 HTTP 404인 **소스 검증 자료**이고, 런타임은 JSON fetch 없이 `puzzles.mjs`만 사용합니다.
- 셔플 횟수는 최단해 길이가 아니며, 인간 최적 해법/인간 플레이 시간은 주장하지 않습니다.

## 순수 API / 읽기 전용 관찰

모듈 base: `public/games/12-fifteen/` (ES modules, 별도 package 없음).

- `puzzles.mjs`: `PUZZLES`, `MODE_IDS`, `DEFAULT_MODE`, `DIRECTIONS`, `OPPOSITE`, `validMode(value)`, `validDirection(value)`, `goalBoard(size)`, `isGoal(board)`, `targetIndex(blank,size,direction)`, `shuffle(size,steps,seed)`.
- `engine.mjs`: `createGame(modeId='post-20-v1')`, `start(state)`, `pause(state,now,reason='manual')`, `resume(state,now)`, `beginPreview(state,now)`, `endPreview(state,now)`, `moveTile(state,index,now)`, `moveDirection(state,direction,now)`, `undo(state)`, `elapsed(state,now)`, `command(state,name,now)`.
- `now`는 주입된 유한 비음수 ms입니다. 엔진은 DOM/storage/실제 시계에 접근하지 않습니다. 상태/board/history는 frozen이며 무효 이동/명령은 동일 state 객체입니다. 잘못된 mode로 createGame 호출 시 RangeError, 잘못된 shuffle 인수도 RangeError입니다.
- `command` 허용 문자열: `up/down/left/right/start/pause/resume/undo`. 상속 이름/Symbol/객체/숫자는 강제변환 없이 no-op입니다.
- state: `modeId,size,board,blank,status(ready|playing|paused|won),pauseReason,preview,started,elapsedMs,activeSince,moveCount,undoCount,history`.
- `save.mjs`: `STORAGE_KEY`, `THEMES`, `MAX_WINS`, `defaults()`, `sanitize(value) -> {save,recovered}`, `loadSave(getStorage) -> {save,blocked,recovered}`, `writeSave(getStorage,save) -> boolean`, `settleRecord(save,modeId,moves,milliseconds) -> {save,improved}`.
- 저장 키: `simplegames.number-postbox.v1`, version=1. best는 양의 안전정수, 이동 우선/동이동 시간 우선이며 두 best 값은 같은 판의 쌍입니다. wins cap=1e9에서 wins만 포화하고 정상 best 개선은 허용합니다. 부정확한 정산 인수는 no-op, 임의 clamp 없음. 손상 mode만 복구하고 유효 다른 mode/설정은 보존합니다. root/version 무효는 전체 기본값입니다.
- `window.__g025Snapshot()`은 writable/configurable=false 함수이며 clone만 반환합니다. `{game,save,storageBlocked,recovered,settled,improved,modal}`; `game.elapsedMs`는 관찰 시점의 active elapsed입니다. setter/자동완료 분기/테스트 전용 상태 전이는 없습니다.

## DOM locator / HTTP 인계

- origin: 자체 시험용 `http://127.0.0.1:3152` (**인계 시 종료**). 게임: `/games/12-fifteen/index.html`.
- controls: `#start`, `#pause`(일시정지/재개), `#goal`, `#undo`, `#restart`, `#retry`, `#mode`, `#theme`, `#help`, `#mute`, `#home`.
- board: `#board`, `#board .tile[data-index="0..size²-1"]`; 타일 실제 숫자는 textContent, 빈칸은 `빈칸`. 비인접/정지/결과는 aria-disabled=true이며 제품 입력 경로도 no-op입니다. 그 경계는 locator의 actionability를 강제 해제하지 않고 trusted mouse 좌표 누름으로 시험했습니다.
- outputs: `#moves`, `#timer`, `#blank-position`, `#undo-count`, `#state-message`, `#goal-overlay`, `#result`, `#result-detail`, `#record`, `#storage-warning`.
- modal: `#modal`, `#modal-title`, `#modal-content`, `#modal-apply`, `#modal-close`; mode/theme는 `[data-id="practice-v1|post-20-v1|post-60-v1|post-120-v1"]` / `[data-id="cream|meadow|evening"]` 버튼입니다. `body[data-theme]`는 theme preview를 포함합니다.
- HTTP 200/source SHA 동일을 검증한 7개: `index.html`, `styles.css`, `main.mjs`, `engine.mjs`, `puzzles.mjs`, `save.mjs`, `assets/kit.svg`. 전체 URL/MIME/바이트/SHA/CSP: `artifacts/g025-12-builder/supplemental-final/results.json`의 `http`.
- CSP 그대로: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.

## 실제 실행 결과 / 증거

절대 Node: `C:/Program Files/nodejs/node.exe` v24.16.0, TS7.0.2, Playwright1.64.1. node_modules junction은 읽기만 했습니다.

1. **초기 실제 HTTP smoke 3/3**: PC Chromium/mobile Chromium/mobile WebKit. 가상시계 없이 trusted 80ms 시작/정지/재개/모드/테마/음소거. CSP/console/pageerror/외부 요청 0. `initial-smoke/results.json`, `smoke-initial.{json,stdout.txt,stderr.txt}`. 이 초기 증거와 최종 바이트의 후속 검증을 구분합니다.
2. **최종 단위 42 실행/42 PASS, fail/skip/cancel/todo 0**: 합법 shuffle/독립 parity/256 seed 조합/결정성/역완주/정확 goal/명령·index 악성값/undo 분기/시간/goal 경계/저장 getter-get-set/부분복구/best/cap. `units-final.stdout.txt`는 원시 TAP, `units-final.json`은 명령/exit=0/소스 SHA입니다. discovery만으로 PASS를 셈하지 않았습니다.
3. **최종 실제 브라우저 30 실행/30 PASS**: 3프로젝트×10case. 모든 4mode를 각 프로젝트에서 첫 시작부터 공개 키/타일 입력으로 완주(12개 고정퍼즐 완주), 완료 중복정산 차단/reload/320px·44px/첫 유효 시간/undo/goalhold/outside release/blur 보호/keyboard repeat·수정키·focus/gesture/모달/3테마/저장 차단까지. `deep-final/results.json`, 각 project JSON, `deep-final.{json,stdout.txt,stderr.txt,invoked-script.txt}`.
4. **보충 3 실행/3 PASS**: home 확인 취소의 elapsed/판 보존, undo가 포함된 실제 21이동 공개 완주, cap1e9 유지+유효 best 개선, reload, 홈 이동을 3프로젝트에서 실행. HTTP 자산 7개 바이트 검증도 수행했습니다. `supplemental-final/results.json`, `supplemental-final.{json,stdout.txt,stderr.txt,invoked-script.txt}`.
5. **실제 build**: 요청한 `node scripts/build.mjs --out-dir artifacts/g025-12-builder/build` 실행 exit0. 최초 빌드는 그대로 보존하고, v1.1/목표판 방어 반영 후 각각 fresh `build-v11`, `build-final`로 동일 빌드를 실행했습니다. 최종 서버는 `build-final` 바이트입니다. `build-final.{json,stdout.txt,stderr.txt}`.
6. 모든 브라우저 구간은 `Local\SimpleGamesG025BrowserGate` named Win32 mutex를 정확한 ctypes HANDLE/DWORD signatures로 획득한 뒤 직렬화했습니다. helper: `artifacts/g025-12-builder/browser-gate.py`. 매 실행 finally에서 자기3152 서버를 close/closeAllConnections하고 실제 connect 거부를 확인했습니다. final/supplemental 결과의 `cleanup.ownServerClosed=true`가 근거입니다. 3116/PM2/타 서버는 조작하지 않았습니다.

재현 명령(기존 증거 경로를 덮지 않도록 새 출력 라벨/빌드경로를 사용하십시오):

```text
"C:/Program Files/nodejs/node.exe" --test --test-reporter=tap tests/games/12-fifteen.test.mjs
"C:/Program Files/nodejs/node.exe" scripts/build.mjs --out-dir artifacts/g025-12-builder/build
python artifacts/g025-12-builder/browser-gate.py "C:/Program Files/nodejs/node.exe" artifacts/g025-12-builder/deep-browser.mjs <새-라벨>
```

## 보존한 실패 / 자체 리뷰 / 한계

- 최초 build 디렉터리 rename 시 WinError5가 한 번 발생했습니다. 권한 변경/삭제/우회 재시도를 하지 않고 원본을 그대로 보존한 채 새 출력 이름으로 후속 빌드를 작성했습니다.
- `deep-v1`은 첫 완료 후 aria-disabled 결과 타일에 locator.click을 요청해 actionability timeout으로 중단된 **시험 관측기 오류 1건**입니다. 원시 FAIL/exit1/스냅샷은 보존했습니다. 같은 제품 바이트에서 경계 입력을 실제 mouse 좌표로 바꾸고 정상 인접 입력의 양성 대조도 유지하여 `deep-v2` 30/30을 얻었습니다. 이후 정확 goal의 sparse-array 방어를 추가한 최종 소스도 다시 단위42/브라우저30/보충3 실행했습니다.
- 별도 WebKit screenshot diagnostic: 캡처 전 CSP/console 0, 캡처 후 tool이 삽입한 inline `body {}` 때문에 CSP style-src-elem 1건/console error 1건을 원문 그대로 보존했습니다. 설치 coreBundle.js 경로/SHA/소스 excerpt가 `supplemental-final/results.json`과 `webkit-screenshot-source.txt`에 있습니다. **WebKit 이미지 수용은 미검증**이며, 오류 필터/CSP 완화/기능시험 제외는 하지 않았습니다. 별도 clean context의 WebKit 기능 10case+보충은 CSP/console 0입니다.
- Chromium PC/320px 실제 PNG를 직접 관찰했고 3×3/4×4 숫자·버튼 줄바꿈/작업대 디자인을 확인했습니다. 3테마 PNG는 `supplemental-final/{cream,meadow,evening}.png`입니다. WebKit 레이아웃은 DOM 기하정보로만 수용 근거를 남깁니다.
- browser 시간은 동결하지 않은 실제 monotonic 측정이지만 **역shuffle 자동 controller 시간**입니다. 인간의 1~6분/최단해/실물 휴대폰 손가락/실청취/스크린리더는 미검증입니다. blur 보호 입력은 synthetic event이고 실사용 OS/tab 비활성화는 독립 QA 후속입니다. Chromium만 CDP trusted outside-board multi-touch와 touchscreen tap을 추가 실행했고 WebKit multi-touch 경계는 synthetic PointerEvent입니다.
- 자체 리뷰에서 DOM/state/storage/정산 경계를 분리하고 상속명령·Symbol·부작용 객체 no-op, zero-win/best 관계, cap/부분복구, sparse goal 반례를 확인했습니다. 별도 자체리뷰/권리/소스 manifest는 자기 artifacts에 저장합니다. **독립 QA는 별도 워커가 후속 수행**합니다.
- 홈 catalog/공통 통합/main merge/운영3116/보드 게시/상태문서·공통 작업일지는 PM 후속입니다. 쓰기 제한을 지키기 위해 KST 실제 작업명 요약은 자기 artifacts에 저장하고 PM이 최종 공통 기록을 작성하도록 인계합니다.
