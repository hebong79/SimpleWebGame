# G022-B08 · 구름 토끼 구현 인수서

## 상태와 경계
- task_id: **G022-B08**, builder 구현/자체 검증 완료. **독립 QA·PM 통합·운영 수용 완료는 아닙니다.**
- 작업 폴더: `E:/Work2/Project/SimpleGames/worktrees/g022-08-doodle`
- 브랜치: `feature/g022-08-doodle`, 시작 HEAD: `563f2ac97a93bf0ef6a99d11630384d86f41790d`.
- 실제 실행 Node **v24.16.0**. 24.15.0 표기는 PM 정정에 따라 적용하지 않았으며 설치·버전 변경하지 않았습니다.
- 소스 6개와 전용 단위시험·본 문서, `artifacts/g022-08-builder/**`만 작성했습니다. 원본 main/기존 게임/공통 홈/설계 원본/서버/설정/PM2/다른 증거는 수정하지 않았습니다. 원격 push·main 병합·운영 변경도 하지 않았습니다.
- 커밋 SHA와 실제 staged 경로 대조 결과는 작업자의 최종 응답 및 `artifacts/g022-08-builder/final-handoff.json`을 확인해 주세요. 독립 QA 전이므로 커밋에 `[verified]`를 붙이지 않습니다.

## 산출물
| 파일 | 역할 |
|---|---|
| `public/games/08-doodle/index.html` | 독립 게임 페이지, SVG 경기장, 메뉴/도움말/옷장/종료 확인 native dialog |
| `public/games/08-doodle/styles.css` | 작은쉼표 크림/잉크/하늘 디자인, 320px 단일열, 44px 제어, 모달 스크롤 |
| `public/games/08-doodle/engine.mjs` | DOM/저장과 분리된 고정 tick 물리·접촉·생성·상태 전이 |
| `public/games/08-doodle/save.mjs` | 전용 저장/검증/원자 정산/해금/옷장 초안 |
| `public/games/08-doodle/main.mjs` | DOM 렌더, 입력, 보호 정지, 모달, WebAudio 실패 폴백 |
| `public/games/08-doodle/assets/kit.svg` | PM 직접 제작 원본 키트의 바이트 그대로 복사 |
| `tests/games/08-doodle.test.mjs` | Node builtin 자체 단위 38개 |
| `artifacts/g022-08-builder/**` | 실제 로그·HTTP/입력 하네스·실패 보존·화면·검증 근거 |

## 실행과 물리
- 페이지 경로: `/games/08-doodle/index.html`. 다른 게임의 런타임을 import하지 않습니다. 외부 엔진·패키지·폰트·이미지·네트워크 API를 추가하지 않았습니다.
- 360×640, 본체 28×36, 중심 x/발 y, 시작 (180,560), g=1200, 초기/반동 vy=-600, 좌우 180, x=[14,346] clamp입니다. 방향 DOWN의 순서와 키별 토큰으로 마지막 누름 우선/해제 후 남은 방향 복귀를 구현했습니다.
- 1/120 고정 tick accumulator입니다. 각 tick 안에서 하강 포물선의 정확한 근, 그 시각의 본체 x와 발판 반사 위치로 접촉을 구하고 반동 뒤 남은 시간을 처리합니다. 프레임 끝 AABB가 아니며 상승 관통·접촉 포함 모서리·다중 반사를 처리합니다.
- cameraTop은 최고 발 높이-274(발에서 중심 18, 화면 40%=256)의 단조 최솟값입니다. 월드 좌표를 카메라로 바꾸지 않습니다. 최고 상승 높이만 metric으로 기록하며 metric=floor(560-minEverFoot), score=floor(metric/10)입니다. 본체 전체가 아래로 나가는 경계에서 낙하를 확정합니다.
- 초기 발판만 ready에 표시하고 start에서 스파인을 생성합니다. ready/pause/result는 시간·RNG를 소비하지 않습니다. 간격 60..100, 명목 중심 차 ≤80, 위끝 cameraTop-120까지/최소 5개입니다.
- 현재 판 500점부터 신규 적격 후보의 매 5번째만 이동 후보입니다. ±30/속도30의 반사, activeMoving≤floor(activeTotal/5)를 유지하며 제거로 비율 초과 시 가장 오래된 이동 발판을 그 시각 x에 고정합니다.
- UI는 RAF 간격 250ms 초과, blur/hidden/pagehide, 다중 포인터에서 진행 시간을 먼저 소비하지 않고 보호 정지합니다. 자동 재개하지 않습니다. 순수 엔진의 긴 dt 처리와 UI 보호 정지를 구별했습니다.
- reduced-motion에서 별도 장식 애니메이션은 없고 물리·동작 자세는 그대로입니다.

## 공개 API와 읽기 관측
`engine.mjs`의 `createEngine({rng?})`는 다음 메서드를 가진 고정 객체를 반환합니다.
- `start(): boolean`: ready/result에서 명시 새 판 시작. round 증가/초기 반동/스파인 생성.
- `ready(): boolean`: 진행 판은 거부하고 결과에서 준비 화면으로만 복귀.
- `pause(reason='manual')`, `resume()`: 상태 전이 성공 여부, 입력 정리.
- `directionDown(side, token=String(side))`: side=-1/+1, 같은 토큰 재DOWN은 무효.
- `directionUp(token)`, `release()`: 해당 입력/전체 입력 해제.
- `advance(seconds)`: `bounce`와 `result` 이벤트 배열. 결과 `{type:'result',round,reason:'fall'|'quit',score,metric}`.
- `quit()`: playing/paused에서 결과 이벤트를 한 번만 반환.
- `snapshot()`: state/round/time/body/cameraTop/minEverFoot/metric/score/bounces/lastLandingTime/pauseReason/result/direction/remainder/platforms/spine의 **깊은 복사본**.
- `platformX`, `bodyX`, `descendingContact`, `flyInterval`, `initialSpine`, `generateSpine`, `seededRandom`, `RULES`는 순수 규칙/생성 시험용 export입니다. main에 상태 setter나 치트 경로는 없습니다.

브라우저에서 관측은 다음과 같습니다. 반환값을 변경해도 live 상태는 바뀌지 않습니다.
```js
const { getSnapshot } = await import('/games/08-doodle/main.mjs');
const { engine, storage, ui } = getSnapshot();
// engine.state, engine.body.x/foot/vy, engine.platforms, engine.bounces
// storage.record / blocked / recovered / firstVisit / saturated
// ui.activeDialog / previewPose / draft / multi / held
```

## DOM ID 계약
- 탐색/상태: `home`, `mute`, `score`, `best-score`, `state-label`.
- 경기장/입력: `game-area`(초점/경기장 좌우 hold), `scene`, `platforms`, `bunny`, `left`, `right`, `controls-note`, `pause`, `restart`, `menu-open`.
- overlay: `overlay`, `overlay-title`, `overlay-copy`, `primary`(시작/재개/재도전), `result-actions`, `result-unlocks`, `result-wardrobe`, `result-home`.
- 기록/공지: `total-score`, `best-metric`, `total-metric`, `plays`, `ending-counts`, `announcement`, `storage-notice`.
- 현재 차림: `outfit`, `equipped-label`, `wardrobe-open`, `help`.
- 메뉴: `menu`, `menu-title`, `menu-resume`, `menu-restart`, `menu-wardrobe`, `menu-help`, `menu-home`, `menu-close`.
- 도움말: `help-dialog`, `help-title`, `close-help`.
- 옷장: `wardrobe`, `wardrobe-title`, `preview`, `preview-label`, `pose-options`, `progress-basic`, `progress-star`, `progress-explorer`, `progress-carrot`, `part-ears`, `part-body`, `part-bag`, `wardrobe-notice`, `wardrobe-apply`, `wardrobe-cancel`.
- 확인: `confirm`, `confirm-title`, `confirm-copy`, `confirm-cancel`, `confirm-ok`.
- bunny/outfit/preview SVG 레이어 ID: 각 접두사 뒤 `-bag`, `-base`, `-body`, `-ears`.
- 옷장 선택자: `[data-set="basic|star|explorer|carrot"]`, `[data-pose="idle|rise|fall|land|hit"]`, `#part-{part} button[data-item="none|{set}-{part}"]`.

## 저장·옷장·입력
- 저장 키는 **`simplegames.doodle.v1` 하나**이며 getItem/setItem만 사용합니다. null 최초 방문은 경고/자동 쓰기 0입니다. getter/get/set 예외는 독립 처리하고 그 세션의 지속 저장을 차단해 메모리 플레이를 유지합니다.
- version1 및 공통의 7개 통계/plays=losses+quits/score-metric 관계/안전정수/0판 0통계를 검사합니다. 곱과 합은 BigInt 검증합니다. 손상·구버전은 경고와 안전 복구입니다. 해금은 통계로 재계산하고 부위·타입·소유를 복구합니다.
- 결과 이벤트에서 round당 한 번만 정산합니다. 누적 초과는 모든 통계/소유를 보존하고 재시도하지 않으며 세션 추가 합산을 중단합니다. 기존 통계로 mute/equip은 가능하고 경고는 지속됩니다.
- 별빛=완료 최고100, 당근=완료 최고500, 탐험가=완료 누적2000. ears/body/bag 조합, none/전체 세트, 5동작을 미리보기할 수 있고 잠김 적용은 거부합니다. 취소는 저장하지 않고 적용만 한 번 저장합니다.
- 경기장 초점에서만 ← →/A D/Space/P/Esc를 받습니다. modifier/OS repeat를 무시하고 버튼 Enter/Space 반복의 기본 합성 클릭도 차단합니다.
- 좌우 버튼 및 경기장 절반 pointer hold, 절반 이동 갱신, 영역 밖 이동/해제/cancel/lostcapture 정리, 페이지 전체 두 번째 접촉 보호 정지를 구현했습니다. 보드 밖 스크롤 기본 동작은 막지 않습니다.
- native dialog의 실제 visible/enabled 요소로 Tab 순환/Escape 취소/초점 복귀를 처리합니다. 메뉴·도움말·옷장·확인 취소는 paused를 유지하고 재개만 명시 동작입니다.
- 모든 반복 텍스트 대입은 `setText` 변경 검사 한 곳으로 제한했습니다. WebKit의 실제 80ms 누름에서 텍스트 노드 교체로 클릭이 누락되지 않게 합니다.
- 기본 mute=true, 사용자 제스처 후 WebAudio 시도, 생성/재개 실패는 무음 폴백입니다. 정지·숨김에서 활성 톤을 정리합니다.

## 아트 출처
PM `docs/g022-design/08-kit.svg`는 본 프로젝트 직접 제작 아트이며 파일을 바이트 그대로 복사했습니다. 15,661bytes / symbol 53개 / SHA256 `a42be682300bdc085c1caa11a100f46657dff9e5814f4ee8377539bc0a3199cb`입니다. 원본 미수정, 원작 이미지/브랜드/외부 아트 미포함입니다. same-origin SVG use, 발 anchor(48,84), scale0.8, bag→base→body→ears 순서이며 얼굴은 PM base 심벌 내부 원본을 유지합니다.

## 실제 자체 검증
1. `node --test tests/games/08-doodle.test.mjs` → **exit0, 38/38, fail/skip/cancel0** (`run-03`).
   - 접촉/관통/모서리/이동 발판/잔여 시간/반사/카메라/중복 높이/자연 낙하/입력/round1회.
   - 30/60/120FPS 및 긴 dt, 500점 이후 움직이는 발판까지 60초 동일 결과.
   - **60 seeds ×180 생성 단계**, 간격/명목 차/경계/최소 수/위끝/active20% 검사.
   - Storage getter/get/set 각 예외, 손상/교차관계/상한 원자성/세션 중단, 99/100/499/500/1999+1, 64 의상 조합의 동일 물리.
2. runtime 3mjs, 전용 test, 증거 harness 2mjs `node --check` → 전부 exit0 (`run-03/unit-exit.json`).
3. `node artifacts/g022-08-builder/http-smoke.mjs` → **exit0, Chromium PC + 모바일 WebKit 2/2** (`http-04/report.json`). 실제 변경 없는 공통 서버 함수를 Node native type stripping으로 읽어 임시 loopback 포트에서 실행하고 종료했습니다. 설치/빌드/서버 파일 수정/PM2는 없습니다.
   - 시계를 동결하지 않은 trusted 80ms 클릭, 실제 시작/입력/정지/명시 재개, 메뉴/도움말/옷장/잠김/취소, quit1회/reload.
   - 읽기 snapshot과 정상 방향키만으로 양쪽 브라우저 재착지 ≥1회/득점/자연 낙하/결과 정산을 확인했습니다. 낙하 유도는 읽은 상태로 회피 방향을 선택하는 테스트 측 controller이며 런타임 setter/가짜 결과는 없습니다.
   - 300ms 실제 UI 지연에서 보호 정지, mute 버튼 childList 변경0, 320/375/667/1366의 가로 넘침0/모달 넘침0/44px 미달0.
   - 엄격 공통 CSP 유지, 무필터 console warning/error·pageerror·실패 HTTP/자산·외부 요청0.
4. `node artifacts/g022-08-builder/input-smoke.mjs` → **exit0, 3/3** (`input-02/report.json`).
   - 양쪽 모바일 에뮬레이션: 반대 방향 누름/해제, modifier/repeat, 모달 초점/Tab/Escape, hold/release/cancel, blur 정리, 음소거와 reduced-motion 설정.
   - Chromium trusted CDP 다중 터치(첫 손가락 보드 안/추가 손가락 페이지 바깥), WebKit synthetic PointerEvent 다중 터치, trusted mouse hold를 구분했습니다.
   - 실제 Chromium wheel 스크롤, WebKit 바깥 기본 동작 비차단/DOM 스크롤 가능성을 확인했습니다.
   - 새 페이지에서 AudioContext 생성 실패를 주입해 무음 플레이가 유지되는 것을 확인했습니다. 게임 상태를 주입한 검사가 아닙니다.
5. Chromium 375px 화면을 읽어 SVG 토끼/구름/발판/차림 렌더와 조작부 잘림 없음을 자체 확인했습니다. WebKit 캡처는 도구/CSP 충돌을 피하기 위해 하지 않았으며 기능/DOM기하/CSP/console 검사는 그대로 실행했습니다.

## 실패 보존과 제한
- `run-01`: 최초 35/36. 실제 물리 상태는 동일했지만 accumulator에 1e-17 수준의 부동소수 잔여 차이가 드러났습니다. tick 경계의 sub-nanosecond dust를 0으로 정규화해 수정했으며 단언을 완화하지 않았습니다. 이후 38/38입니다.
- `http-01`: 테스트의 async waitForFunction 관측이 결과를 기다리지 못한 하네스 오류. 명시 snapshot polling으로 교정했습니다.
- `http-03`: 고정 오른쪽 hold가 임의 가장자리 발판에서 정상적으로 계속 반동하여 낙하를 보장하지 못한 테스트 전제 오류입니다. `http-04`는 정상 방향키로 접촉을 피하게 하고 실제 자연 결과를 기다립니다. 제품 규칙/랜덤/상태/결과를 바꾸지 않았습니다. 이전 실패 보고서는 모두 보존했습니다.
- `input-01`: 모바일 WebKit의 Playwright mouse.wheel 미지원입니다. `input-02`에서 바깥 default-action 정책/DOM 스크롤 가능성을 별도 확인했으며 **WebKit 네이티브 손가락 스크롤은 미검증**으로 유지했습니다. 테스트 전체 제외/console 필터/CSP 완화는 없습니다.
- 독립 QA, PM 후보 빌드/기존 6게임 회귀/홈37카드 통합, main 병합, 실제3116 전환·실행, 실물 Android/iPhone, 실제 소리 청취는 **미수행/PM 후속**입니다. 현재 운영이 8게임으로 전환되었다고 주장하지 않습니다.
- 문서·게시판·HANDOFF 등 PM 소유 경로에는 쓰지 않았습니다. 이 인수서와 자기 증거 폴더로 보고를 전달합니다.
