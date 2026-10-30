# G022-B07-RESUME 구현 인수서

## 납품과 경계
- 작업폴더: `E:/Work2/Project/SimpleGames/worktrees/g022-07-dino`
- 브랜치: `feature/g022-07-dino`; 단일 부모/base: `563f2ac97a93bf0ef6a99d11630384d86f41790d`. 최종 커밋 SHA와 바이트 manifest는 `artifacts/g022-07-resume/handoff.json`에 기록합니다.
- 새 사용자 재개 승인 범위에서 07 전용 구현/시험/본 문서만 작성했습니다. 공통/08/부모/설계 원본/기존 증거/서비스 변경, 설치, 원격 push는 하지 않았습니다.
- **구현자 자체 검증 완료이며 독립 QA·공통 홈 통합·main 병합·3116 운영 반영 완료가 아닙니다.**

## 구현
- `public/games/07-dino/{index.html,styles.css,engine.mjs,save.mjs,main.mjs,assets/kit.svg}`: 960×360 사막 러너, 별도 07 포물선 연속 충돌 엔진, 1/120 tick, 점프/숙임, 20초 속도/30초 새 비행물/보수 간격, 준비·정지·결과·1회 정산, 안전 입력·모달·기록·3부위/8동작 옷장입니다.
- PM SVG 23,650 bytes, 82 symbols를 정확 복사했습니다. SHA256 `5ee9c18a0fdda88c67cc288ccf36e2cbde2b4882f05afcd6617c39b21cded4ac`; 원본과 바이트 동일. 프로젝트 소유 원본, 외부 아트/폰트/런타임 패키지 없음. bag→base→body→hat 순서이며 얼굴은 base에 포함됩니다.
- 08의 검증된 저장/모달/입력 안전 패턴을 읽고 07 전용 소스로 적용했습니다. 다른 게임/타 worktree runtime import 없음. 저장키 `simplegames.dino.v1`; postal 기본 3부위, 완료 누적 3000 space/완료 최고 500 sport. BigInt 이력 가능성/포화 원자 보존·세션 중단과 설정 변경을 분리했습니다.

## API / DOM
- 엔진 `createEngine({rng?})` → `snapshot,ready,start,advance(dt),jumpDown(token?),jumpUp(token?),duckDown(token?),duckUp(token?),release,pause(reason?),resume,quit`. `advance`/자세 입력/`resume`/`quit`는 이벤트 배열, `start/ready/pause`는 boolean입니다. snapshot은 깊은 복사본이며 live setter 없음.
- 순수 수학 `RULES,speedAt,distanceAt,gapRequirement,makeObstacle,firstCollision`. firstCollision은 x 겹침 구간과 포물선 y 최초 포함 접촉을 교차하며 착지/속도/생성 경계를 분할합니다. distanceAt만 정수 근처 4 ULP 연산 오차를 보정하며 충돌 상자를 팽창시키지 않습니다.
- 저장 `defaultRecord,validateRecord,settleRecord,createRecords,createWardrobe,ownedSets,validEquipment,PARTS,SETS,STORAGE_KEY`. main은 읽기 전용 `getSnapshot()` 하나만 export합니다.
- 주요 ID: `game-area,scene,courier,obstacles,score,best-score,speed,distance,primary,jump,duck,pause,restart,mute,home,menu-open,wardrobe-open,help`.
- native dialog: `menu,help-dialog,wardrobe,confirm`; 닫기 `menu-close,close-help,wardrobe-cancel,confirm-cancel`; 결정 `wardrobe-apply,confirm-ok`. 옷장 `part-hat/part-body/part-bag`, `[data-set]`, `[data-item]`, `[data-pose]`.

## 실제 검증
Windows Node **v24.16.0** (`C:/Program Files/nodejs/node.exe`) / 기존 Playwright를 시험에서만 사용했습니다. Python 도구의 별도 PATH Node는 v26.12.1이지만 아래 시험은 모두 bash terminal의 v24.16.0으로 실행했습니다.

| 명령/증거 | 실제 결과 |
|---|---|
| `node --test tests/games/07-dino.test.mjs` → `unit-02.log` | 31/31, fail/skip 0, exit 0 |
| `node --check` engine/save/main 및 전용 test 각각 | 4개 exit 0 |
| 초기 `node artifacts/g022-07-resume/smoke.mjs` → `smoke-01.*` | PC Chromium/모바일 Chromium/WebKit 3/3; 초기 비동결 80ms 실제 클릭 |
| `RUN_LABEL=02 node artifacts/g022-07-resume/smoke.mjs` → `smoke-02.*` | 최종 3/3; 실제 점프 버튼 80ms/820ms hold, 자동 재점프 없음 |
| `RUN_LABEL=03 node artifacts/g022-07-resume/browser.mjs` → `browser-full-03.*` | 11/11, exit 0; 실제 HTTP 6파일 동일 바이트/CSP/nosniff |
| `node artifacts/g022-07-resume/followup.mjs` → `followup-01.*` | 3/3, exit 0; 반복키/초점·보드 밖 이동·보호 이벤트·삭제 없음 |

- 세 브라우저 모두 정상 Space로 첫 선인장 회피, 100점 초과 득점 후 다음 선인장 자연 충돌, loss1/quit1, 재로드 기록 유지. 최종 실제 자연 점수는 126/128/131이며 RNG를 고정하거나 live 상태를 주입하지 않았습니다.
- 순수 단위: 정상 입력 185 활성초/속도400 생존, FPS/긴 dt 동치, 실제 생성 bird 아래 숙임 해제 즉시 충돌, 20/30/40 경계/공정 간격, 통계 반례 양방향·소형 이력 완전 대조·1000회 정상 정산/검증 연쇄.
- 320/375/667 가로/1366: 넘침·44px·모달 Tab/Shift+Tab/Esc 및 실제 opener로 즉시/RAF/250ms 복귀, 재개 후 경기장 초점 유지. 매 프레임 동일 버튼 텍스트 childList 변경 0.
- 최종 게임 페이지의 무필터 console warning/error, pageerror, CSP, 실패 자산, 외부 요청 **각 0**. WebAudio 생성/resume 실패, Storage getter/get/set/손상/포화, 혼합 의상 8동작도 실제 HTTP 검사했습니다.
- 모든 자체 임시 loopback 서버를 정상 close하고 해당 포트 `ECONNREFUSED`를 확인했습니다. 3116/타 프로세스 조작 없음.

## 발견·수정 / 보존
- `browser-full-02`는 추가한 결과 오버레이 검사에서 8/11: 320px 결과 버튼이 arena 아래로 4px 잘렸습니다. 원시 FAIL 보존 후 overlay를 grid 흐름에 참여시켜 내용만큼 높이가 늘도록 수정했습니다. 동일 단언의 최종 `browser-full-03` 11/11입니다.
- 초기 HTTP 기록의 1288.9999999999998px 정수 경계 오차를 발견해 위 ULP 한정 보정과 단위 회귀를 추가했습니다. 이전 PASS/FAIL 로그를 덮지 않았습니다.
- 기존 tracked 249개 SHA256 baseline을 보존·최종 대조합니다. 최종 검증/보안 후보 판정/커밋 allowlist는 새 resume 증거 폴더에만 있습니다.

## 미검증 / PM 후속
- 원본 public 홈 HTML은 200이지만 실제 참조 `/scripts/library.js`는 컴파일 전이라 404입니다(`followup-01.json`). 가짜 route/script로 대체하지 않았으며 실제 홈 전체 통합/홈 이동 후 실행은 PM의 정식 빌드·통합 E2E가 필요합니다.
- 독립 QA/기존 6게임 전체 회귀/통합 후보/운영 3116/게시판은 PM 후속입니다. 작업범위상 worker는 게시하지 않았습니다.
- 모바일은 Chromium/WebKit 에뮬레이션입니다. Chromium CDP 다중 터치, 기타 합성 pointercancel/pagehide/hidden/blur는 실제 손가락·OS 숨김 수용과 구분합니다. 실물 Android/iPhone·실음향 청취·사람의 20초~3분 체험 목표는 미검증입니다. 엄격 CSP와 도구의 충돌을 피하려고 WebKit 부가 screenshot만 촬영하지 않았으며 기능/콘솔 검사는 그대로 실행했습니다.
