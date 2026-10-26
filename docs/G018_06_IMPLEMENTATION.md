# G018-06-CODY · 풍선 참새 구현 인수

- 구현자: cody-02 / thread `01a17391-f01f-7ce0-821c-79e3fc3cde2f` / design v1.0.
- 상태: **구현 및 자체 단위검증 완료, PM 통합·독립 QA 대기**. PM 최종 task 상태와 수용표는 변경하지 않았습니다.
- 배정 네 경로가 모두 없는 것을 확인한 뒤 신규 작성했습니다. 다른 worker, 원안, 기존 게임, 공통 코드·문서·package·lockfile, 서버/PM2/Git은 변경하지 않았습니다.

## changed_files

| 파일 | 내용 |
|---|---|
| `public/games/06-flappy/engine.mjs` | 순수 1/120초 물리·아치 스트리밍·연속 원형 충돌·득점·상태·재도전 토큰 |
| `public/games/06-flappy/save.mjs` | 전용 저장 검증·원자 정산·안전정수 상한·소유권·옷장 draft |
| `public/games/06-flappy/main.mjs` | DOM/SVG 렌더, RAF, 입력·보호정지·메뉴·확인·결과·음향·옷장 연결 |
| `public/games/06-flappy/index.html` | 실제 게임 및 대화상자, PM 키트의 로컬 inline symbol |
| `public/games/06-flappy/styles.css` | 시안 색·배치, 320px/모바일·safe-area·모달 스크롤·focus·reduced-motion |
| `public/games/06-flappy/assets/kit.svg` | PM 자체 제작 키트 사본, 외부 자산 없음 |
| `tests/games/06-flappy.test.mjs` | 45개 단위시험 |
| `docs/G018_06_IMPLEMENTATION.md` | 이 인수 문서 |
| `artifacts/g018-06-builder/**` | 자체 검증 스크립트·실제 stdout/exit·실패 보존·목록·PM 전달 요약 |

## exports / API

브라우저용 상대 ES modules이며 engine/save를 Node에서 직접 import합니다. DOM main은 export 또는 window 디버그 API를 노출하지 않습니다. mutable 상태 setter·강제 승리·치트가 없습니다.

| engine export | 계약 |
|---|---|
| `RULES` | frozen 물리 상수 |
| `seededRandom(seed)` | 재현 가능한 [0,1) RNG closure |
| `gapFor(index, previousCenter, random)` | 첫 5개 RNG 0, 이후 1회 소비; 틈 높이/여백/인접 제약 |
| `circleRect(point, radius, rect)` | 접촉 포함 최근접점 거리 판정 |
| `sweepCircleRect(start, end, radius, rect, curve=0)` | 직선/포물선 연속 원형 sweep, 최초 `{fraction, point}` 또는 null |
| `sweepBounds(y, vy, seconds, radius=12, height=640)` | 천장/바닥 연속 접촉 `{fraction, reason}` 또는 null |
| `flightStep(bird, arches, seconds=1/120)` | 순수 다음 물리/아치/통과목록/최초 충돌 계산. 주어진 값을 변경하지 않음 |
| `createEngine({random})` | private 상태 인스턴스, 아래 public methods만 제공 |
| `createRetryGate()` | `end(nowMs)`, `press(nowMs)`, `allows(token, nowMs)`, `remaining(nowMs)`; 종료 세대와 500ms 후 새 DOWN 검사 |

`createEngine` methods: `snapshot()`은 완전 복사본입니다. `start()`는 ready/result에서 새 판·초기 flap 1회와 이벤트 목록을 반환합니다. `flap(activeTimeSeconds?)`는 다음 tick 입력을 예약합니다. `pause(reason)`·`resume()`는 명시 전이만 수행합니다. `quit()`는 playing/paused에서 quit 결과 1회입니다. `ready()`는 결과에서 준비로 돌아갑니다. `advance(elapsedSeconds)`는 나머지를 보존하고 이벤트 목록을 반환합니다. 준비/정지/결과에서는 시간/RNG를 소비하지 않습니다. `start/flap`은 물리 API이고 UI의 재도전 제한은 retry gate로 적용합니다.

입력 시각은 판의 active seconds입니다. tick 경계와 정확히 같은 시각의 입력은 이미 완료된 tick을 바꾸지 않고 다음 tick에 적용합니다. 같은 시각은 호출 순서를 유지합니다. 미리 예약한 재생과 실제 시각의 advance→press가 경계에서 일치하는 추가 시험을 포함했습니다.

엔진 이벤트는 `start`, `flap`, `pass`, `result`입니다. 결과는 `round, score, reason, time, contact`이며 충돌 contact에 최초 접촉의 실제 물리 시각·중심 좌표·fraction·아치 번호(해당 시)를 포함합니다. 충돌 결과를 같은 tick에서 먼저 확정한 후 그 tick의 새 통과를 전부 억제합니다.

| save export | 계약 |
|---|---|
| `STORAGE_KEY`, `PARTS`, `SETS` | 전용 키와 허용 ID 목록 |
| `SATURATION_MESSAGE`, `BLOCKED_MESSAGE` | 실제 표시 경고 |
| `defaultRecord()` | 새 복사본 |
| `ownedSets(best,total)` | 완료 기록 기준 소유 재계산 |
| `validEquipment(equipped,unlockedSets)` | 부위·소유 모두 검사 |
| `validateRecord(input)` | `{record,recovered}`. 숫자 손상은 전체 기본, 외형 손상은 유효 숫자 유지 |
| `settleRecord(record,result)` | 순수 전체 다음 기록 검증. `{record,saturated,newSets,comparison}` |
| `createRecords(storageProvider?)` | `snapshot`, `settle`, `mute`, `equip`. private 기록과 결과 round별 1회 정산 시도 |
| `createWardrobe(getRecord,apply)` | `open`, `snapshot`, `previewSet`, `previewPart`, `canApply`, `apply`, `cancel`. preview/cancel 쓰기 0 |

## 충돌 구현 / S01

각 tick의 x 상대속도는 110이며 y는 `y0 + vy*t + 450*t²`입니다. 이동하는 아치를 tick 시작 위치에 고정하고 참새의 상대 경로로 계산합니다. 네 offset 변과 네 원형 코너를 각각 검사해 가장 이른 접촉을 선택합니다. 코너는 거리 제곱 방정식의 최대 4차 다항식이며, 도함수의 실근으로 단조 구간을 분리한 뒤 이분법을 사용합니다. 중근(정확 접선)도 후보에 포함하고 코너 사분면/각 변의 범위를 확인합니다. 팽창 AABB만으로 충돌을 확정하지 않습니다.

동일 알고리즘이 정적 최근접점, 각 변, 코너 tangent, dx=dy=11 비충돌, 빠른 대각 이동, 뒤면 통과, tick 중 포물선 회귀와 충돌 우선 시험을 통과했습니다. contact는 충돌 fraction에 해당하는 위치에서 멈춥니다. 본체 r24 SVG를 48/96 배율로 렌더하므로 논리 r12이며 날개·부리·풍선·옷은 판정에 포함하지 않습니다.

## storage schema / 검증 / 정산

전용 키: `simplegames.flappy.v1`.

```json
{"version":1,"bestScore":0,"totalPassed":0,"plays":0,"collisions":0,"quits":0,"unlockedSets":["basic"],"equipped":{"head":"none","body":"none","ankle":"none"},"muted":true}
```

카운터 범위 0..Number.MAX_SAFE_INTEGER, 정수·유한값만 허용합니다. `plays=collisions+quits`, 종료 합계도 안전정수, `bestScore<=totalPassed<=bestScore*plays`를 검사합니다. 마지막 곱 비교는 BigInt로 중간 오버플로를 피합니다. 0판에서 양수 기록도 손상입니다. 해금은 숫자 기록에서 재계산하며 잘못된 소유목록/부위/없는 ID/잠긴 장착은 기본으로 복구합니다. 잘못된 음소거는 true입니다.

정상 null은 첫 방문이며 경고/자동 쓰기 없음입니다. JSON/버전/통계 손상은 기본 복구 안내를 보여 줍니다. storage getter/getItem/setItem 각각의 예외는 메모리 플레이를 유지하고 계속 보이는 `이 환경에서는 기록이 저장되지 않습니다`를 표시합니다. 전용 키만 getItem/setItem하며 clear/removeItem은 사용하지 않습니다.

| 사례 | 실제 처리 및 단위 근거 |
|---|---|
| 준비/시작/정지/취소/옷장 재개방 | 완료 횟수·누적 추가 없음 |
| 0점 충돌 / quit | plays 각각 +1, collisions/quits 분리 |
| 실제 첫 아치 1점 뒤 quit | score 1을 한 번 합산, pilot 3부위 소유 |
| 완료 판 10점 | pilot/rain 동시 1회 해금 |
| 누적 99에서 완료 +1 | bee 3부위 해금 |
| 진행 중 해금 문턱 | UI에 '이번 비행 종료 후 해금', 적용 차단; 음소거/기존 옷 저장에 현재 점수 포함 안 함 |
| 같은 round 결과 재처리 | 두 번째 정산 시도 추가 0, 재시작 round ID 증가 |
| 최고점 동점 | comparison=tie, 새 최고 표시 아님 |

S02: 먼저 전체 다음 레코드를 계산하고 각 필드·종료 합계를 검사합니다. 어느 필드라도 상한 초과면 **모든 이전 유효 통계와 소유를 그대로 유지**합니다. 그 결과의 정산 시도는 완료로 기록하며 같은 결과를 다시 합산하지 않습니다. 이 세션의 포화 후 새 결과도 합산하지 않습니다. 이미 상한에 도달한 유효 레코드도 다음 통계 정산을 막습니다. 현재 판 실제 점수/결과는 그대로 표시하고 `누적기록 상한에 도달해 이번 기록은 합산되지 않았습니다`를 안내합니다. 음소거와 기존 소유 외형 변경은 같은 통계로 저장할 수 있습니다. 상한 직전 1회 성공, total만 초과/plays·종료 합계 초과, 전체 보존, 중복 0, 설정 변경·정상 reload, 손상 데이터 복구를 각각 시험했습니다. 미완료 판과 세션 round/정산 토큰은 저장하지 않으며 reload 시 준비입니다.

## UI / DOM IDs

- 화면: `home`, `mute`, `score`, `best-score`, `state-label`, `flight-field`, `arches`, `bird`, `bird-base`, `bird-body`, `bird-head`, `bird-ankle`, `bird-face`.
- overlay: `overlay`, `overlay-eyebrow`, `overlay-title`, `overlay-copy`, `result-unlocks`, `retry-lock`, `primary`, `result-actions`, `result-home`, `result-wardrobe`.
- 조작/상태: `flap`, `pause`, `menu-open`, `restart`, `announcement`, `storage-notice`, `total-passed`, `plays`, `ending-counts`, `equipped-label`, `wardrobe-open`, `help`.
- 현재 외형: `outfit-base`, `outfit-body`, `outfit-head`, `outfit-ankle`, `outfit-face`.
- 메뉴: `menu`, `menu-title`, `pause-copy`, `menu-resume`, `menu-wardrobe`, `menu-help`, `menu-restart`, `menu-home`, `menu-close`.
- 확인: `confirm`, `confirm-title`, `confirm-copy`, `confirm-cancel`, `confirm-ok`.
- 옷장: `wardrobe`, `wardrobe-title`, `w-base`, `w-body`, `w-head`, `w-ankle`, `w-face`, `progress-basic`, `progress-pilot`, `progress-rain`, `progress-bee`, `part-head`, `part-body`, `part-ankle`, `wardrobe-notice`, `wardrobe-cancel`, `wardrobe-apply`.
- 도움말/자산: `info-dialog`, `info-title`, `close-info`, `svg-definitions`; `empty`, `face-fly0/1/2/hit`, `sparrow-fly0/1/2/hit`, `{pilot,rain,bee}-{head,body,ankle}-{fly0,fly1,fly2,hit}`, `garden-arch`.

경기장 primary pointerdown만 게임 탭으로 처리하고 합성 click을 중복 처리하지 않습니다. 날갯짓 버튼은 pointerdown과 키보드 click을 분리합니다. 모든 페이지 contact를 capture 단계에서 관찰하며 다중 접촉/cancel/30px drag는 보호정지합니다. Space는 경기장 초점·새 keydown에서만 처리하고 repeat/단축키는 제외합니다. 결과 재도전은 DOWN 시각의 토큰을 검사해 499ms 전 눌렀다가 늦게 놓은 동작을 거부합니다. 시작/재개 시 경기장에 초점을 반환합니다.

모달 열기는 정지, 닫기는 정지 유지이며 이벤트를 게임으로 전달하지 않습니다. dialog의 Escape 취소와 Tab 순환을 구현했습니다. blur/hidden에서 정지·입력·오실레이터를 정리하고 자동 재개하지 않습니다. reduced-motion이면 플레이/미리보기 날갯짓을 정적으로 표시합니다. CSS는 시안 배치·44px 이상 버튼·320px부터 단일열·safe-area·낮은 화면 모달 스크롤을 구현했으나 실제 레이아웃 측정은 PM 브라우저 QA 대상입니다.

기본 mute=true입니다. 사용자 제스처 이후 WebAudio 생성/resume을 시도하고 실패하면 무음 진행합니다. 통과 620Hz/충돌 160Hz의 짧은 oscillator+gain 음을 자체 합성하고 정지/모달/숨김/음소거 시 stop합니다. 실청취/API 브라우저 관측은 아직 하지 않았습니다.

## 아트 출처 / 권리

`docs/g018-design/06/kit.svg`는 PM 대현자의 프로젝트 직접 제작 자산이며 사본 `assets/kit.svg`와 동일한 symbol을 게임 HTML에서 사용합니다. 3 fly 프레임+hit 본체와 9부위×4프레임, 정원 아치를 포함합니다. 배경은 PM 시안의 자체 SVG 도형을 로컬 HTML에 재사용했고 작은 풍선/최상단 표정 레이어를 도형으로 작성했습니다. 모든 렌더는 로컬이며 외부 원작 화면·이미지·폰트·음원·CDN·런타임 의존성을 추가하지 않았습니다. 별도의 외부 자산 라이선스 의무는 없으며 저작권 양도 등 새 법률 약속을 하지 않습니다. 누락 의상 프레임은 empty 부위로 fallback합니다.

## 실제 검증

환경: Node **v24.16.0**. 다음은 실제 실행 결과이며 브라우저/빌드/실물 수용과 구분합니다.

| 명령 | exit | 실제 결과 / 증거 |
|---|---:|---|
| `node --test tests/games/06-flappy.test.mjs` | 0 | **45 tests / 45 pass / 0 fail / 0 skip**; `artifacts/g018-06-builder/unit-final.log` |
| `node --check public/games/06-flappy/engine.mjs` | 0 | `check-engine.mjs.log` |
| `node --check public/games/06-flappy/save.mjs` | 0 | `check-save.mjs.log` |
| `node --check public/games/06-flappy/main.mjs` | 0 | `check-main.mjs.log` |
| `node artifacts/g018-06-builder/verify.mjs` | 0 | 위 실제 명령 실행·exit를 `verification.json`에 기록 |

GDD 경계 8개는 중복 점수/충돌 우선, tangent, n1..9 생성, FPS 및 정지, 499/500ms fresh token, 10/99+1 해금, 손상/옷장 취소, quit/취소/결과 중복 시험으로 대응합니다. AC01~15의 unit 부분을 검증했습니다. AC08/09/15의 browser 부분과 AC16~24는 **미검증/PM·QA 후속**입니다. 마지막 추가 경계시험은 미리 예약한 입력과 live advance→press의 정확 tick 경계 일치입니다.

첫 시험은 39개 중 36 pass/3 fail이며 `unit-01.log`를 보존했습니다. 실패는 지속 상승하는 .5초 시험 입력, 포물선 부호 기대값, 최초 아치 접촉을 천장으로 기대한 fixture의 오류였습니다. 이후 수정된 39개가 `unit-02.log`에서 통과했습니다. 확장된 최종 45개 결과와 구분합니다. 한 경로가 없는 `rg scripts/start-local.mjs` 읽기 탐색은 exit 1이었으며 실제 파일은 `scripts/serve_local.mjs`로 확인했습니다. 게임 검증 실패로 은폐하지 않습니다.

## 실행·제한·다음 작업

게임 entry는 **`/games/06-flappy/index.html`**입니다. file://는 ES module/CORS/저장 의미가 달라 실행 경로로 주장하지 않습니다. 자체 시험 재현은 위 Node 명령을 사용하세요. 기존 서버는 compiled public만 제공하므로 새 게임을 곧바로 운영 주소에서 플레이 가능하다고 주장하지 않습니다.

공통 빌드/서버 시작·재시작은 PM 소유라 실행하지 않았습니다. PM이 자신의 격리 빌드에 파일을 통합한 후 실제 HTTP에서 PC Chromium·모바일 Chromium/WebKit·320/375/667/1366px·CSP/오류/외부요청·오디오 API·실제 저장·입력 혼합·완주를 검증해야 합니다. 독립 QA, 기존 4게임 회귀, 인간 10초~2분 체험, 실물 iPhone/Android, 실청취, 실제 저장 차단, 전체 수용 및 배포는 미실행입니다.

초기 기본 실행기 오류는 별도 `execution-history.md`에 원문 보존했고, PM의 재개 지시에 따른 공식 require_escalated/auto_review 요청으로 문서 읽기 exit 0 후 같은 경로의 구현·시험을 수행했습니다. 전역 보안/ACL/모델/네트워크 설정을 바꾸지 않았습니다. 이후 승인 거부·writer 충돌·같은 오류 2회는 없었습니다.

공통 `docs/HANDOFF.md`, `docs/worklogs/**`와 게시판은 이번 명시 허용 쓰기 범위 밖이며 worker가 수정·게시하지 않았습니다. 이 문서와 전용 artifacts의 한국어 요약을 PM에게 전달해 HANDOFF·작업일지·완료 요약 게시/readback을 통합 단계에서 수행하도록 남깁니다. 구현 자체를 막는 차단사항은 없고, PM 통합/브라우저 수용은 남아 있습니다.
