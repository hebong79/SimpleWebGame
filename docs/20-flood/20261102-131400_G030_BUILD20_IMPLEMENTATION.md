# G030-BUILD20 구현 보고 · 20 물감 번지기 (paint-spread)

- task_id: G030-BUILD20
- status: 구현·자체 검증 완료 (PM 인수, 독립 QA, 홈 통합 대기. 운영 미반영)
- 작성: 2026-11-02 13:14 KST (시스템 시계 기준)
- 근거: `docs/20-flood/20261102-214000_G030_20_DESIGN.md`, `docs/20261102-211000_G030_PM_CONTRACT.md`, G029 공통 계약. 설계서 전 항목 구현.

## PM 결정 반영과 설계서 대비 변경 (명시)
- 선형 해금, 패배 미저장, 누적 총점 없음, 칸 클릭 미지원(색 버튼·숫자 1~4만), 사라진 색 선택도 1회, 번짐=CSS 전이, 읽기 예외 세션 쓰기 금지, 팔레트 `paint`/`pastel`: 설계 안대로.
- **유일한 변경**: 저장 검증 `bestUsed >= pathLength` 하한을 `bestUsed >= 1`로 완화, 상한은 단계 `limit` 유지. `settleRecord`의 `used` 허용 범위도 같은 이유로 `1..limit`(설계는 `pathLength..limit`). UI에 "최적/최소 횟수" 문구 없음(단위 시험이 소스 전체를 검사). 단위 시험도 이 규칙으로 작성(`AC23 bestUsed lower bound relaxed...`).
- `path`는 색 번호(0 기준) 배열로 저장하고 화면 번호 문자열은 `keys`로 함께 보관.
- 레이아웃: 설계 배치 그대로(준비/정지/결과 패널은 보드 위). 상태 문구(`#status`)는 3줄 높이 `min-height`, 통계의 "마지막 한 번" 줄과 색 버튼의 "지금 색" 줄은 항상 자리를 차지(글자만 비움/`visibility`)하므로 플레이 중 어떤 상태 전이에서도 하단 색 버튼·조작 줄 위치가 변하지 않음(아래 검증).
- 초점 가드: 색 버튼 click 핸들러는 `e.detail === 0 && activeElement !== 버튼`일 때만 무시(WebKit 교훈). 포인터 click은 capture 단계 제스처 검증만 통과하면 처리. 모든 억제 상태(`tap`, `cancelUntil`)는 `performance.now()` 비교(타이머 없음), 다음 `pointerdown`/상태 전이/모달/보호정지/pagehide에서 초기화. 끊긴 포인터 기록은 5초 후 정리.
- `detail 0` 초점 가드는 색 버튼에만 적용(17번 칸 선례와 같음). 다른 버튼의 `detail 0` click은 취소 제스처 직후 300ms 억제만 받음.
- 보호정지는 "플레이 중"에만 걸림. 수동정지 중 blur는 `manual` 유지(설계 8.2 문장 그대로).
- 시험 하네스가 `blocked` 키 집합을 추가: 결과 진입 순간 눌려 있던 키는 keyup 전까지 새 주 버튼 활성화를 막음(R5).

## 파일 (허용 경로만)
`public/games/20-flood/{index.html, styles.css, main.mjs, engine.mjs, save.mjs, audio.mjs, ASSETS.md}`, `tests/games/20-flood.test.mjs`, 이 문서, `artifacts/g030-builder20/**`. 다른 파일·Git·PM2·운영 서버 접근 없음.

## SHA256 manifest (동결, 최종 실행 전후 동일: `artifacts/g030-builder20/run-20261102-130758-final/sha-start.txt` = `sha-end.txt`)
```
18ff4d25eabe1a55c928e66f6e84c733480f1b0ba425e4c9cf7f36d1fcea730d  public/games/20-flood/ASSETS.md
71e50dd8faac88816a2e9b942457c3efcde3d43181a0af5bd12c30bf3c0d97ce  public/games/20-flood/audio.mjs
5cc9a23422af6fe9f9583c93fc8d6b6fd03670e54faadfeaba3fe3434961ef07  public/games/20-flood/engine.mjs
01bd2f0fe23418102639eec50ffe63036581e630836e5c844a28dd754dac4110  public/games/20-flood/index.html
515ac2d1de2042301d322bb2ea727150053caa23db4abc6f0723f20c14b58efa  public/games/20-flood/main.mjs
02e8e7ce7474511467e48320ecf73a30438ec6272c514ad998e8ee7d70a835d2  public/games/20-flood/save.mjs
2970af4a8b0d0edab93d9e333faaef4d3123370ea03f68e1e4abb993a77ad934  public/games/20-flood/styles.css
55622c2b0b250c94522dca298729b1bbc2369c8ba83b4adf6ff2cdbfab58e87d  tests/games/20-flood.test.mjs
```

## 검증 (실제 실행, 모두 최종 동결 소스)
| 구분 | 명령 | 결과 | 증거 |
|---|---|---|---|
| 문법 | `node --check` main/engine/save/audio/test | 모두 exit 0 | 본 세션 |
| 단위(자동) | `node --test tests/games/20-flood.test.mjs` | tests 40, pass 40, fail 0, exit 0 (약 1.4초) | `run-20261102-130758-final/unit-test.log` |
| 브라우저 Chromium PC 1366 (마우스 실제 누름) | `node artifacts/g030-builder20/verify.mjs <run> chromium-pc` | 310 checks, FAIL 0, exit 0 | `.../chromium-pc.log`, `results-chromium-pc-all.json` |
| 브라우저 Chromium mobile 320 (CDP 터치, 두 손가락 포함) | 같은 스크립트 `chromium-mobile320` | 310 checks, FAIL 0, exit 0 | `.../chromium-mobile320.log` |
| 브라우저 WebKit mobile 320 (마우스 경로, 터치 CDP 불가) | 같은 스크립트 `webkit-mobile320` | 300 checks, FAIL 0, exit 0 | `.../webkit-mobile320.log` |
- 서버: 자체 loopback `127.0.0.1:3291`, CSP `default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'`, 스크립트가 띄운 본인 PID만 종료, 종료 후 LISTEN 0 확인. 3116/3101·PM2·Git·설치·삭제·외부 네트워크 미사용. 외부 요청 0.
- 단위 시험 내용: V1/V2 벡터, 4방향·대각선·행 줄넘김 없음, 같은 색 무료, 영역 불변 다른 색 1회, 사라진 색 1회, 마지막 수 승리 우선·미완성 패배, 결과 후 입력 무시, 독립 oracle 대비 무작위 2,000판, 15개 맵(크기·색·모든 색 존재·시작영역≤4·중복/전치 중복 없음·표 3.1과 문자열 동일), `path` 재생 첫 완성, 독립 solver 2종(BigInt BFS, 반복심화 DFS)이 단계별 `pathLength`와 일치, `limit==pathLength+3`, 15단계 엔진 완주 점수 300, 단계별 패배 경로, 저장 복구(손상 JSON, primitive, 배열, version, NaN/Infinity/음수/소수/문자열/unsafe/CAP+1, 관계 위반, 길이 14/16, 설정 독립), settle 판정·불변·거부·포화(CAP, CAP-1), 읽기/쓰기 예외, 소스 가드(타이머/RAF/외부 URL 없음, 포커스 가드, 스냅샷 비쓰기, 44px, 3px 포커스, reduced-motion, "최적" 문구 없음).
- 브라우저 시나리오 (환경마다 동일 스크립트): S1 흐름(trusted 실제 누름 ≥80ms 이벤트 기록, 색 버튼·숫자키, 정산 1회, 저장 JSON, reload, 단계 선택, 처음부터), S1b 결과 직전 Enter 반복 차단(R5), S2 15단계 전체를 설계 경로로 UI 입력만(버튼/숫자키 교대) 완주·점수 300·정산 15회·최종 completed 15/unlocked 15, S3 규칙(absorbed 0도 1회, 같은 색 무료, 마지막 수 승리 점수 0, 마지막 수 패배·쓰기 0, 다시 도전, 홈 확인·Esc), S4 키보드(수정자·4번 무시·keydown preventDefault 없음, 반복, 입력 필드, ←/→/Home/End, Enter/Space, Esc), S5 제스처(80/100/300ms, 8px 초과 후 복귀 취소, 스크롤, 두 번째 포인터, pointercancel, 취소 직후 detail 0 click 억제, ≥400ms 뒤 처리, 억제 해제, detail 1 합성 click 억제, 초점 body 첫 탭 1회, 정지·모달 후 첫 탭), S6 정지·모달(보호정지 3종, 재개 문구, 모달 중 blur/Tab 순환/외부 초점, Esc, 테마 미리보기·적용·취소 쓰기 수, 소리 토글), S7 저장(손상, 부분 손상, version, getItem·getter 예외 메모리 모드·쓰기 0, setItem 예외·복구·경고 해제, 포화, 다른 키 보존, reload), S8 레이아웃(모든 버튼·링크 `a#home` 포함 ≥44px, overflow 0, 보드 전체 표시, 모달 맞춤, 3px 포커스), S9 DOM(3초 유휴 변경 0, 선택 때 바뀐 칸만 갱신, 전이 120ms+지연 ring×10ms≤200ms, 번짐 중 입력 수용, reduced-motion), S10 소리(기본 꺼짐, 스텁, 정지 시 stop, 예외/미지원 무음), S11 Chromium 스크린샷(`run-*-final/shots/`, 두 테마 × ready/playing/paused/win/lose/help).
- 하단 색 버튼 위치 불변: 15단계 전체의 모든 플레이 중 수와 같은 색·absorbed 0·"마지막 한 번" 상태에서 색 버튼·상태 문구 높이·조작 줄 좌표가 한 번도 변하지 않음(S1, S2, S3 내 sig 비교). 정지/결과 전환에서는 패널이 나타나 위치가 바뀌지만 그때 색 버튼은 비활성입니다(설계 배치 유지).
- 테스트 민감도 확인(변형 실험): 캡처 게이트의 억제를 제거하면 S5의 취소 관련 6건이 FAIL, 색 버튼 클릭에 무조건 초점 가드를 넣으면 WebKit 계열 첫 탭 4건이 FAIL(`artifacts/g030-builder20/run-mutation-M1`, `-M2`). 확인 후 원본으로 복원(SHA 동일).
- 개발 중 발견·수정(원 기록 보존): 첫 실행의 하네스 기대값 오류 3건(reload 후 round/sets 기준, Shift+Tab 순서, 테마 적용 후 동결 비교 방향)과 S9의 시나리오 순서 오류, WebKit S6의 404 페이지(`/`) CSP 소음. 모두 제품이 아니라 시험 스크립트 문제였고 `run-20261102-125909-dev1`~`dev6`(특히 `dev6-webkit.log`의 FAIL 1건)에 원본이 남아 있습니다. `dev6`는 수정 전 스크립트 기준의 중간 실행이며 인수 근거는 `run-20261102-130758-final`입니다.

## 시각 검토 (사람이 이미지로 직접 확인, Chromium)
PC 1366과 모바일 320, paint 팔레트: ready/playing/win, pastel lose를 열어 확인. 4색 문양(원·사각·삼각·마름모)과 숫자, 영역의 이중선 테두리, 결과 패널, 320px에서 8×8 보드 전체와 색 버튼 4개가 보이고 가로 잘림 없음. 모바일 8×8 칸은 약 31px(조작 대상 아님). 나머지 캡처(paused/help/pastel 일부, pc pastel)는 생성만 하고 모두 열어 보지는 않았습니다. 색약 시뮬레이션 눈검사는 하지 않았습니다.

## 공개 API
- `engine.mjs`: `STAGES`(frozen 15개: `{id,tier,size,colors,cells,keys,path,pathLength,limit}`), `STAGE_COUNT`, `LIMIT_EXTRA`, `SCORE_UNIT`, `toCells`, `neighborsOf(size,i)`, `expandRegion(cells,size,region,color)`, `initialRegion(cells,size)`, `scoreFor(limit,used)`, `boardColors(cells,region,current)`, `regionEdges(size,region)`(1위 2오른 4아래 8왼 비트), `absorbRings(size,before,after)`, `createGame(stageId=1,round=0,token=0)`, `startGame(game,stageId?)`, `pickColor(game,color)`(무시 시 같은 객체 반환), `pauseGame(game,cause)`, `resumeGame(game)`. solver는 제품에 없음(시험 파일 전용).
- `save.mjs`: `STORAGE_KEY='simplegames.paint-spread.v1'`, `CAP=1_000_000`, `THEMES`, `WARN_READ`, `WARN_WRITE`, `emptyStage`, `defaultRecord`, `validStage`, `recoverRecord(value)->{record,warnings}`, `loadRecord(getStorage)->{record,warnings,mode:'persistent'|'memory'}`, `saveRecord(record,getStorage)->{ok,warning}`, `settleRecord(record,{stageId,used,score})->{record,judge}`(judge: `new-best|tie|not-best|capped|rejected`, 거부·포화는 같은 record 참조).
- 저장 스키마: `{version:1, settings:{theme:'paint'|'pastel', muted:boolean}, records:{completed, unlocked, stages:[15 × {clearCount, bestUsed:int|null, bestScore:int|null}]}}`. 기본값 theme paint, muted true. `completed`/`unlocked`는 단계 기록에서 파생.
- 상태: `phase ready|playing|paused|result`, `pauseCause null|manual|protection|modal`, `lastEvent.kind none|move|same-color`(`ignored`는 발생시키지 않음: 무효 입력은 상태 객체를 바꾸지 않음).
- DOM selector: `#home #stage-label #tier-label #remaining #remaining-note #used #limit #region-size #total-cells #status #board [data-cell] (role=grid/row/gridcell, data-color, .in .e-t .e-r .e-b .e-l .ring-N) #color-bar .color-btn[data-color] #start #pause #resume #restart #help #settings #mute #modal(#modal-close #modal-confirm #settings-apply .theme-option[data-theme]) #warning #ready-panel #pause-panel #result-panel (#result-title #result-detail #result-record #result-save #result-final #next #retry #choose #result-home) #stage-select .stage-option[data-stage] #stage-best #lifetime #theme-name`. 3색 단계에서 `.color-btn[data-color="3"]`는 `hidden`.
- `window.__g030Snapshot()`(defineProperty, writable/configurable false, `structuredClone`): `game, version, phase, pauseCause, pendingProtection, round, token, stageId, stageCount, tier, size, colors, cells, board, region, regionSize, totalCells, currentColor, used, limit, remaining, pathLength, history, lastEvent{seq,kind,color,absorbed,regionBefore,regionAfter,counted}, outcome, result{outcome,stageId,used,limit,remaining,score|null,uncovered,judge,save}, settledRound, modal, draftTheme, focusColor, records, settings, storage{mode,writeCount,lastWriteOk}, warnings`. 읽기 전용, setter·자동승리·테스트 분기 없음. 패배도 `settledRound===round`로 표시(쓰기는 없음).

## 제한·미검증
- 실제 iOS/macOS Safari·iPhone·물리 터치: 미검증(Playwright WebKit은 마우스 경로만. WebKit의 두 손가락·CDP 터치 불가, 합성 두 번째 포인터로 대체). Chromium의 "초점 없는 첫 탭"은 mousedown 기본 동작 취소로 만든 시뮬레이션이고 실제 WebKit 실측은 WebKit 환경에서 별도 통과.
- 스크린리더/TalkBack(초점 없는 `detail 0` click은 색 버튼에서 무시됨, 설계 가정 9), 스피커 실청취(소리는 스텁 검증만), OS 수준 탭 전환(blur/visibility/pagehide 이벤트 dispatch만), 사람 체감 난이도·1~3분 목표, 색약 시뮬레이션 눈검사, 운영 3116·홈 카드 통합: 미검증. 홈 `/` 이동은 자체 서버가 홈을 서빙하지 않아 404가 되며(WebKit에서는 CSP 소음 포함) 이는 URL로 분리해 집계했습니다.
- 데스크톱 폭에서는 3줄 상태 영역 때문에 상태 문구 아래 여백이 약 72px 있습니다(의도).
- 시계 주의: 이 세션 시스템 시계는 2026-11-02 13시대(KST)로, 설계서 파일명(21시대)과 어긋납니다. 파일명·본문은 실제 시스템 시계를 따랐습니다.

## 다음 작업
PM 인수 → 홈 통합(INTEGRATE, `src/client/library.ts` 등 공통 파일, 카탈로그 49/available 20) → 통합 빌드 독립 QA → 승인된 Git/운영 반영 → 실제 3116 확인. 힌트·경로 자동 재생 UI는 만들지 않았습니다.
