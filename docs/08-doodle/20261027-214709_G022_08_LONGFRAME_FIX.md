# G022-08 긴 프레임 보호 수정 인수

## 결론과 소유권
제품 결함을 실제 HTTP에서 입증한 뒤 `feature/g022-08-doodle`의 `public/games/08-doodle/main.mjs`만 최소 수정했습니다. 통합 root `e0f37454220560b3bf8340e53a9b3c177adb1d14`, PM 3130/빌드, 원본 full204 FAIL/trace, engine/save/HTML/CSS/kit 및 시험 원본은 수정하지 않았습니다. 자체 검증 후보이며 독립 수용/릴리스 완료가 아닙니다.

## 관측된 원인
원본 full204의 08 Chromium PC/모바일 exact time/body 단언 실패를 재현했습니다. 동일 evaluate에서 import → 읽기 snapshot → 실제 300ms busy loop → 반환하므로 busy loop 직후 snapshot도 직전과 완전히 같습니다.

읽기 RAF wrapper는 원래 native callback의 ID/순서/this/인자를 그대로 전달했습니다. PC 계측 사례: 직전 frame timestamp 1031.2ms, busy loop 1032.300000011921–1332.300000011921ms. 다음 callback은 실제 1333.300000011921ms에 들어왔지만 timestamp 1047.8ms를 전달했습니다. 원래 pump는 16.6ms로 판단하여 time 0.14166666666666666 → 0.15833333333333333 및 실제 body를 진행했고, 그 다음 timestamp 1331.1ms에서야 longframe으로 정지했습니다. WebKit에서는 첫 callback timestamp가 실제 도착시각과 같아 즉시 정지했습니다. 비계측 조건도 두 Chromium에서 동일 실패하여 wrapper/observer만의 문제는 아닙니다.

## 최소 수정과 검토
`frame(now){pump(now);...}`를 `frame(){pump();...}`로 바꾸고 이유 주석 한 줄을 추가했습니다. RAF와 입력 모두 기존 pump 기본값 `performance.now()`를 사용합니다. 단일 monotonic clock이므로 입력 pump 후 뒤늦은 RAF timestamp가 last를 과거로 돌리지 않습니다. 기존 250ms 기준/고정 1/120 tick/엔진/입력 의미/정산/물리 마진은 변경하지 않았습니다. 추가 네트워크/API/저장 경로가 없는 한 줄 동작 변경을 자체 검토했습니다. 재위임 금지 계약에 따라 새 독립 reviewer는 실행하지 않았습니다.

## 실제 자체 검증
Node `C:/Program Files/nodejs/node.exe` v24.16.0, 기존 Playwright 1.64.1/TS 7.0.2. 아래 명령은 통합 root에서 실행했습니다.

- `C:/Program Files/nodejs/node.exe artifacts/g022-longframe-fix/probe.mjs smoke` exit0: 2게임 × 3프로젝트 실제 HTTP 시작/정지 6사례.
- `C:/Program Files/nodejs/node.exe artifacts/g022-longframe-fix/probe.mjs diagnose` exit0: 구본 음성대조 12관측. 두 게임의 PC/모바일 Chromium 비계측·계측 8관측 exact time FAIL, WebKit 4관측 exact PASS. 음성대조 결함 검출을 성공으로 보고한 명령이지 구본 제품 PASS가 아닙니다.
- `C:/Program Files/nodejs/node.exe artifacts/g022-longframe-fix/probe.mjs positive` exit0: 각 개인 public을 실제 createGameServer API/임시 loopback 포트로 serve, 같은 300ms·exact equality·동일 입력으로 12/12 PASS. time/body/전체 engine(state·pauseReason 제외)/생성/점수/저장 완전 동일. 계속 paused, 명시재개, 정상80ms 점프·방향입력, 정지/재개/음소거, restart/home 취소, restart quit 정산·쓰기1회 포함.
- `C:/Program Files/nodejs/node.exe artifacts/g022-longframe-fix/held-mixed-probe.mjs` exit0: 6/6 PASS. 실제 키/포인터 hold 중 300ms 지연, hold 해제, 재개 때 잔류입력0, 실제 RAF/입력 pump 혼합 순서에서 시간역행/과잉advance0, 첫 재개 frame 검사.
- 본 worktree `C:/Program Files/nodejs/node.exe --check public/games/08-doodle/main.mjs` exit0.
- 본 worktree `C:/Program Files/nodejs/node.exe --test --test-reporter=tap tests/games/08-doodle.test.mjs` exit0: 42/42, skip0. 07 순수31개도 별도 자기 worktree에서 PASS.

모든 새 브라우저 사례에서 무필터 console warning/error·pageerror·CSP·실패 HTTP/asset/request·외부요청 0. WebKit은 screenshot 없이 DOM/layout JSON만 남겼습니다. 브라우저/context/개인 서버를 finally 정상 닫고 포트 연결 거부를 확인했습니다.

## 증거와 후속
증거 공통 절대경로: `E:/Work2/Project/SimpleGames/01-2048/artifacts/g022-longframe-fix/`의 before-manifest.json, original-failures.json, original-trace-inspection.json, diagnose-results.json, clock-diagnosis.json, positive-results.json, positive-first-frame.json, full-engine-equality.json, held-mixed-results.json, pure-tests.json, handoff.json.

수정 main SHA256: `6695a98824403d0ac995f9ae7e877923029db925bbbebd6ceb98a23cdf49d6b5`.

두 개인 public에는 컴파일된 library.js가 없어 홈 복귀 후 통합 카드/실행 검증은 하지 않았습니다. 가짜 파일/route로 보충하지 않았습니다. 원본 spec 전체를 수정본 통합 build에서 실행한 것은 아니며 PM의 별도 fresh deltaQA → root 정상 병합/build → full204 → 승인된 실제3116 검사가 남았습니다. 실물 휴대폰/실음향 청취 미검증. 공통 HANDOFF/작업일지/게시판 작성은 이번 허용 경로 밖이므로 PM에게 인계합니다.
