# G-017 · SimpleGames 네 게임 연결과 실행 주소 정리

- PM: 대현자. 구현/독립 QA/독립 코드 검토를 분리했습니다.
- 상태: **연결 수정 완료·기능/실제 브라우저 검증 및 독립 재검토 통과**.
- 기준 시각: 2026-10-25 20:16:30 KST.

## 현재 사용할 주소

**실사용 주소는 `http://192.168.0.195:3116/`** 입니다. 이 PC에서는 `http://127.0.0.1:3116/`도 가능합니다. 사용자께서 네 게임 정상 동작을 확인한 기존 PM2/LAN 서버이며, 이번 작업은 그 설정·프로세스·방화벽을 변경하지 않았습니다. 확인 PID31880, 0.0.0.0:3116 LISTEN입니다.

3102는 별도 로컬 개발 서버 `http://127.0.0.1:3102/`입니다. 기존 시안 프로세스 PID4080만 실제 커맨드/포트 소유를 재확인하여 종료하고 현재 소스를 매번 빌드하는 실행기로 교체했습니다. 3116 실사용 주소와 혼용하지 마세요. 이미 열어 둔3102 화면은 새로고침해야 합니다.

## 원인과 수정

사용자 이미지와 실제3102 브라우저에서 전체30개·체험시안1개·“시안 보기”를 확인했습니다. node scripts/preview_prototype.mjs가 docs/prototype만 제공하여 /games/02-snake/index.html·03-pong·04-breakout 및 /scripts/library.js가404였습니다. 소스의 네 게임 href와 실제 페이지는 이미 정상이라 **게임규칙·카탈로그·저장키·CSP는 수정하지 않았습니다.**

- scripts/serve_local.mjs: 현재 소스를 artifacts/local-server-build에 빌드한 뒤 검증된 createGameServer/public만 제공합니다. 기본127.0.0.1:3102, 엄격한 --port만허용, HOST/PORT환경 무시. 빌드실패·포트충돌은비정상종료하고옛dist/임의포트fallback·다른프로세스자동종료를하지않습니다.
- npm start / npm run preview / npm run dev와 Windows start-local.bat·start-game.cmd, VS Code “SimpleGames: 4개 게임 서버 시작 (3102)”를 같은 개발용 실행기로 통일했습니다. 기존 VS Code3작업/inputs는 보존했습니다.
- 기존 시안은 삭제하지 않고 npm run preview:design -- --port 3112로만 명시 실행합니다.
- README에서 **실사용PM2/LAN3116 / 개발용3102**를 명확히 분리했습니다. 원래독립검토의README주소충돌FAIL을보존하고정정후독립재검토PASS를확인했습니다. 검토입력12개SHA256도PM이다시확인했습니다.

## 실제 검증

| 구분 | 실제 결과 |
|---|---|
| 새 실행기 node:test |29/29 통과, 실패·제외0, exit0(PM 재실행)|
| 구현자 자체 HTTP |3120 임시포트18검사, EADDRINUSE exit1·빌드실패fixture exit23·배치잘못된포트 exit1 확인. 본인서버종료|
| 실사용3116 브라우저 |9/9 통과·실패/제외/flaky0|
| 개발용3102 브라우저 |9/9 통과·실패/제외/flaky0|
| 브라우저별 |각주소 PC Chromium·모바일 Chromium·모바일 WebKit 각3사례|
| 실제 기능 |홈33/플레이4/준비29·각카드 클릭→시작→정상방향입력→일시정지→게임내홈복귀·즐겨찾기 reload/왕복보존|
| HTTP/레이아웃 |공개HTML/ES모듈/CSS/SVG GET/HEAD200·MIME/nosniff/CSP원문, 별도API의 사설docs/package404,375/320px가로넘침없음|
| 무필터 진단 |두주소 모두 console오류/경고·pageerror·외부요청·CSP·실제자산HTTP/요청실패0|
| 빌드/코드형식 |TypeScript --noEmit / git diff --check 최종exit0|
| 보호 |게임src/public·원본시안·과거G013/G016지정증거981파일의내용/SHA256/mtime 변경0|

두 주소의 동일9사례를 별도실행한 합계18이며 반복실행을 추가합산하지 않습니다. 물리기기가 아닌 브라우저/모바일 에뮬레이션과 가상시계를 사용했습니다. 게임상태setter·RNG/저장소조작·가짜HTTP응답은 사용하지 않았습니다. WebKit는PNG캡처대신DOM/기하JSON으로 기능단언을 유지했습니다.

첫회귀는 양주소 각각6통과/3실패였습니다. QA의 작은 흰눈 픽셀 기준과 반복getImageData 관측이 원인이었고, 실패보고서·trace·원시진단은 first-browser-failures-preserved.json과ZIP으로 보존했습니다. 게임코드가 아니라 관측helper만 실제canvas PNG의Node디코드·실제색눈동자 관측으로 고쳤습니다. 모든 console오류/경고·CSP·기능단언을 그대로 유지해 최종9/9를 확인했습니다. 설치된Playwright내부PNG디코더에테스트만결합되며, 향후버전갱신시재검증이필요합니다. 런타임패키지 추가는 없습니다.

## 재실행과 산출물

실사용3116은 기존 ecosystem.config.cjs·PM2실행을 유지합니다. 이번 작업은 PM2명령·LAN바인딩·방화벽을 바꾸지 않았습니다. 재부팅 자동실행도 추가하지 않았습니다.

```sh
# 별도 개발용3102 실행: 현재소스빌드 후 loopback 서비스
npm start
# 종료: 해당 개발용 실행 콘솔에서 Ctrl+C
```

실사용3116 검증 재현은 기존증거와 다른새출력config를복제하여 다음처럼실행합니다. 서버를시작/중지하지않는readonly브라우저검사입니다.

```sh
GAME_LIVE_ORIGIN=http://192.168.0.195:3116 GAME_TEST_ARTIFACT_DIR=artifacts/g017-live3116-verified/legacy-artifacts node node_modules/@playwright/test/cli.js test --config artifacts/g017-live3116-verified/playwright.config.ts
```

- 소스: scripts/serve_local.mjs, start-local.bat, start-game.cmd, package.json, .vscode/tasks.json, README.md.
- 시험: tests/launch-local.test.mjs, tests/e2e/live-server.spec.ts.
- 증거: artifacts/g017-pm/verification.json, g017-qa-verified, g017-live3116-verified, g017-builder/FINAL_RESULT.json.
- 검토: docs/G017_CODE_REVIEW.json(원본FAIL), docs/G017_CODE_REVIEW_V2.json(재검토).
- 작업일지: docs/worklogs/20261025-201630_아름.md.

## 독립 최종 검토

`docs/G017_CODE_REVIEW_V2.json`의 제한 정적/증거 재검토는 passed=true, 보안지적0·논리오류0입니다. 두주소의 기존 실제실행결과/첨부18건을 독립 파싱한 것이며 독립검토자가 브라우저를 재실행한 것으로 주장하지 않습니다. 원본FAIL 보고서와 첫실패증거는 그대로입니다. 테스트PNG디코더의설치내부경로결합 및 고정출력의삭제/이름변경파일잔존검증은 비차단 후속제안으로 남깁니다. G017연결수정범위만수용하며 G016전체수용과구별합니다.

실제 보드 본문/첨부 다운로드 검증은 `artifacts/g017-pm/board-publication.json`에 별도로 기록합니다.

## 제한

이번 수용은 **주소/실행기/4게임 실제연결** 범위입니다. 실물 Android/iPhone, 네이티브WebKit 복합터치, 실제음향청취, 사람의플레이시간목표, 물리Windows Ctrl+C·재부팅자동시작은 검증하지 않았습니다. 종료 자체검사는 IPC로SIGINT/SIGTERM이벤트를발생시킨fixture이며실콘솔검사와다릅니다.

G-016 전체수용 보류와 과거G013 QA96파일이전바이트미복구 문제는 이번작업으로해소됐다고주장하지않습니다. 기존 실패/작업이력·게임저장소를삭제하지않았습니다. 공개배포/특권설치/결제/원격저장소커밋도 수행하지않았습니다.
