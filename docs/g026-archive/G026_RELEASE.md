# G026 — 13·14번 게임 개발·독립 QA 결과

## 현재 판정
- **개발·게임별 독립 QA·최종 회귀·로컬 실행 수용 완료.** 마지막 G024-STORE 하네스9줄도 별도 독립검토 PASS를 실제 source/patch/full보고서 SHA에 결합해 인수했습니다. 보안·논리 결함 발견0입니다.
- 로컬 실행: `http://127.0.0.1:3168/`. 이 PC에서만 접속하는 loopback 서버입니다. 기존 실사용 `http://192.168.0.195:3116/`에는 반영하지 않았습니다.

## 제작 내용
| 원안 번호 | 게임 | 주요 기능 |
|---|---|---|
| 13 | 간식 짝꿍 · `snack-pairs` | 쉬움6쌍/기본8쌍, 800ms 비교, 활성 시간·시도 기록, 카드 테마3종, 정지·보호정지·저장 복구 |
| 14 | 별과 달3목 · `star-moon` | 한 기기 로컬2인, 8승리줄·9번째 승리 우선, 완료판 선공 교대, 세션/누적 전적 분리, 테마2종 |

PM이 원안 번호 매핑, 제작용 규칙·기술·입력·저장·경계 설계와 PC/320px 시각 디자인을 먼저 작성했습니다. 게임별 개발 워커2명과 단일 공통 통합 워커가 구현했으며, 별도 독립 게임 테스트 워커2명을 생성해 실제 실행했습니다. 결함 수정과 독립 재검증도 역할을 분리했습니다. PM은 출하 게임·시험 코드를 직접 수정하지 않았습니다.

홈은 기존41개 레코드와 원래12개 게임을 보존하며 **43개 / 플레이14 / 준비29**입니다. 새 두 카드는 공개 검색·더보기로 찾을 수 있습니다. 기존 `memory-pieces`·`leisure-line` 준비 카드를 임의로 대체하지 않았습니다.

## 실제 검증
| 구분 | 실제 결과 |
|---|---|
| 최종 단위 | **626/626 PASS** — 공통48·게임549·실행기29 |
| 최종 브라우저 | **246/246 PASS** — 데스크톱Chromium82·모바일Chromium82·모바일WebKit82 |
| 최종 회귀 실패/skip/flaky/retry | **0 / 0 / 0 / 0** |
| 초기 smoke(최종 r3) | **18/18 PASS** |
| HTTP | 후보 검증119개 및 실제 로컬3168의119개 자산 응답200·빌드 바이트/엄격CSP/nosniff 일치 |
| 실행 ZIP | 125항목, 별도 scratch에서 Node만으로 실행·HTTP119개 바이트 일치 |
| 독립13 | 원QA 결함001·002를 원본 negative control로 보존한 뒤 수정본17/17 checkpoint·35/35단위로 종결, 불변16런타임은 원QA SHA 결합 재사용 |
| 독립14 | 원본46단위·독립12기능/경계·고유67수용항목, 도구 미지원/원FAIL/후속 targeted 검증은 별도 보존 |

PM은 원시 Playwright JSON을 재집계하고 source177개/output155개 manifest, 독립QA의 현재 source30개와 실제 로컬 응답을 대조했습니다. 브라우저 도구로 실제3168 홈 검색→게임 선택→시작→카드 열기/착수→수동 정지도 확인했습니다. PM의 초기 작은 화면 조작 및 selector quoting 진단 시도는 수용 증거에 넣지 않았고, 최종1366×1000 정상 조작 결과와 구분했습니다.

## 수정한 결함과 보존한 실패
- 13 정상 `pointerup` 뒤의 implicit `lostpointercapture`를 조기 캡처 상실과 구분해 모바일 정상 터치를 복구했습니다. 취소·보드 밖 두 번째 포인터·스크롤·잘못된 입력의 차단은 유지합니다.
- 13 `pagehide`에서 보호정지는 즉시 수행하되 떠나는 문서의 이미지 렌더를 생략했습니다. WebKit unload-time ping/CSP 차단을 plain 제품/계측/라우팅 비교로 귀속하고, pageshow 가림·명시 재개를 유지했습니다.
- 공통 드라이버는100ms로 눌러 실제 최소80ms를 보장하되, 실측`>=80`·trusted/down-up·게임 상태 단언은 유지했습니다.
- G024-STORE는 홈의 native SVG/image 완료를 관측한 뒤 기존 다음 navigation을 진행하도록9줄을 추가했습니다. failedRequests/CSP/저장·입력 단언은 완화하지 않았습니다.
- 최초 full `da9025b4`와 r2 full `22903154`는 **FAILED 그대로** 보존했습니다. 진단 하네스의 실패·부가WebKit screenshot CSP 실패도 성공 결과로 바꾸거나 최종 수용 수에 합산하지 않았습니다. 최종 r3 full `ff404c79`는 별도 한 번 실행의 PASS입니다.

## 실행과 산출물
- 프로젝트/브랜치: `E:/Work2/Project/SimpleGames/worktrees/g026-fourteen-game-release` / `feature/g026-fourteen-game-release`
- 최종 빌드: `artifacts/g026-build-r3`
- 실제 실행 명령: `node artifacts/g026-build-r3/src/server/index.js --host 127.0.0.1 --port 3168`
- 최종 full: `node scripts/g026-verify.mjs --mode full --build artifacts/g026-build-r3 --origin http://127.0.0.1:3160`
- 실행 ZIP: `artifacts/g026-delivery/SimpleGames_G026_14Games_Runtime.zip`
- ZIP SHA256: `1440fef4b3094972acc6c743e14ec610768005a67fa6d4ec0a05f8af1f30b1b9`
- 설계: `docs/G026_PM_CONTRACT.md`, `G026_13_DESIGN.md`, `G026_14_DESIGN.md`, `G026_ACCEPTANCE.md`, `G026_DESIGN_BOARD.html`
- QA: `docs/G026_QA13.json`(원FAIL), `G026_QA13_FIX.json`(수정수용), `G026_QA14.json`, `G026_SHARED_DELTA_REVIEW.json`
- 최종 원시: `artifacts/g026-integration/runs/ff404c79/`; PM검증: `artifacts/g026-pm/final-intake.json`, `runtime-package-verification.json`

## 범위와 한계
- 운영 선택 질문은 응답 없이 시간초과됐습니다. **main 병합·remote push·PM2/3116·방화벽·시작항목·저장dump를 변경하지 않았습니다.** 원래 작업 트리의 기존 dirty5개 파일도 기준 SHA와 같습니다.
- 실물Android/iPhone 손가락, 실제 소리 청취, 사람의1~3분/20~60초 플레이 시간, 실제BFCache·OS-native숨김, WebKit PNG 시각 수용은 미검증입니다. 자동화/에뮬레이션/합성 취소 이벤트를 실기기 수동 테스트로 주장하지 않습니다.
- 브라우저 저장은 host+port별입니다. 3168의 기록이 기존3116 기록으로 자동 전송되지는 않습니다.

## 마감 기록
- 마지막9줄 독립 검토: `docs/G026_HOME_RACE_REVIEW.json` PASS, exact현재source/patchSHA 및 원시full보고서SHA 일치 확인.
- 게시 검증 영수증: `artifacts/g026-pm/board-publication.json`. 실행 ZIP 업로드는 다운로드 SHA와 바이트 일치를 확인했습니다. 실제 게시 ID와 본문/첨부 readback은 영수증으로 별도 기록합니다.
- 기준 확인: 2026-10-30T03:04:40+09:00, 로컬3168 PID26044/r3, 기존3116 PID404/g025 그대로. 원래 dirty5개 파일 SHA 보존, Git index/commit/main/push 미변경.
