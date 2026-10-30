# G017-BUILDER — 로컬 실행기 구현·시험

- 상태: BUILDER_SELF_CHECK_PASS / PM 독립 검토·3102 교체는 별도입니다.
- 환경: Windows / Node v24.16.0. 실제 시험 시각: 2026-10-25T10:55:35.905Z (한국 시간 2026-10-25 19:55:35).
- 루트: `E:/Work2/Project/SimpleGames/01-2048`.

## 구현

1. `scripts/serve_local.mjs`: 매 실행마다 기존 `scripts/build.mjs --out-dir artifacts/local-server-build`를 현재 Node로 동기 실행합니다. 성공한 경우에만 해당 빌드의 `createGameServer`를 import하고 `artifacts/local-server-build/public`을 제공합니다. 기존 dist/시안 fallback은 없습니다.
2. 기본 `127.0.0.1:3102`, 인자는 `--port <1-65535>` 한 쌍만 허용합니다. HOST/PORT 환경은 읽지 않고 --host/중복 인자/미지정 값/잘못된 숫자를 거부합니다.
3. 빌드 실패 종료코드 보존, EADDRINUSE 명확한 비정상 종료, 다른 PID 종료·임의 포트 fallback 없음. SIGINT/SIGTERM에서 본인 server.close 및 closeAllConnections 호출. main guard 및 순수 `parsePort` export로 import는 빌드/리스닝하지 않습니다.
4. `start-local.bat`: `cd /d "%~dp0"` 후 Node 실행, 인자 전달, 종료코드 보존, 읽을 수 있는 오류 출력. 설치·자동 브라우저·특권 실행·새 데몬은 없습니다.
5. 게임 소스/원래 href/저장/CSP/기존 서버 코드는 수정하지 않았습니다.

## 실제 검증

| 검증 | 실제 결과 | exit code |
|---|---|---|
| `node --check scripts/serve_local.mjs` | 통과 | 0 |
| `node --test --test-reporter=tap tests/launch-local.test.mjs` | 29 tests / 29 pass / 0 fail / 0 skipped | 0 |
| `node artifacts/g017-builder/smoke.mjs` 최종 실행 | 18 checks 통과 | 0 |
| 다른 작업 디렉터리에서 `cmd.exe /d /c <절대경로>/start-local.bat --port 0` | 올바른 오류, 실행기 코드 1 보존 | 1 (의도한 거부) |
| `git diff --check -- scripts/serve_local.mjs start-local.bat tests/launch-local.test.mjs` | 통과 | 0 |

- 단위/자식 fixture는 기본값/경계/잘못된 옵션, import 무동작, 빌드 실패 23 보존 및 이전 서버 import 차단, EADDRINUSE 1, HOST/PORT 무시, 두 종료 신호의 close 호출을 검증했습니다. fixture는 모두 `artifacts/g017-builder/fixtures/` 안에 있습니다. 실제 빌드의 실패를 만들려고 원본을 손상시키지 않았습니다.
- 3120이 비어 있음을 본인 임시 리스너로 확인한 뒤, 먼저 그 리스너를 둔 상태에서 실제 실행기를 실행했습니다: PID 30608, EADDRINUSE, exit 1. 기존 리스너는 유지됐습니다. 이를 닫은 후에만 다음 실행기를 시작했습니다. 고정 빌드를 동시에 실행하지 않았습니다.
- 실제 성공 실행 PID 13836. `C:/Users/hebon`에서 `HOST=0.0.0.0`, `PORT=65535`를 주어도 127.0.0.1:3120에서 시작했습니다. 현재 소스 빌드 성공 후 HTTP를 검사했습니다.
- `/`, `/game.html`, `/games/02-snake/index.html`, `/games/03-pong/index.html`, `/games/04-breakout/index.html`, `/scripts/library.js`: 6경로 모두 HTTP200, 정확한 MIME/nosniff/기존 CSP 전체문자열, 빌드 원본 바이트 일치.
- 내려받은 library.js 카탈로그를 코드로 집계하여 33개/available 4개/원래 4개 href를 확인했습니다.
- `/package.json`, `/src/client/library.ts`, `/src/server/index.js`, `/docs/20261024-231330_HANDOFF.md`, `/scripts/build.mjs`, `/artifacts/local-server-build/public/index.html`: 6경로 모두 HTTP404.
- Windows의 child.kill은 정상 POSIX 신호 전달 검증이 아니므로, 테스트용 `--import file://.../signal-hook.mjs`와 IPC로 process.emit('SIGTERM')을 호출했습니다. 실제 실행기 종료 핸들러가 서버를 닫고 exit0, 3120 재바인딩 성공을 확인했습니다. SIGINT/SIGTERM 각각의 close/closeAllConnections 호출은 별도 fixture에서 확인했습니다. 물리 콘솔 Ctrl+C 입력 자체는 미검증입니다.
- 실제 3102/3116 및 다른 프로세스는 중단하거나 교체하지 않았습니다. package/README/VSCode 및 3102 전환은 PM 소유입니다.

## 범위 보호와 이슈

- `protected-before.json`으로 소스/public/dist/시안/빌드스크립트/기존 artifacts 등을 포함한 1,898개 파일 SHA256을 기록했습니다. 본인 산출물 폴더와 인수받은 고정 빌드 폴더는 비교 대상에서 제외했습니다.
- `protected-after.json`: 비교 대상 중 변화는 `package.json`, `docs/20261024-231330_HANDOFF.md` 2개뿐입니다. 본 worker는 이 두 파일에 쓰지 않았습니다. 동시 PM 작업의 package 통합과 HANDOFF 갱신이 관찰되어 이를 전체 불변으로 보고하지 않습니다. PM께서 변경 주체를 확인하셔야 합니다. 나머지 비교 대상과 기존 artifacts 바이트는 일치했습니다.
- 최초 smoke는 시험 보조 --import에 Windows 절대경로를 직접 넣어 ERR_UNSUPPORTED_ESM_URL_SCHEME/exit1이 발생했습니다. 실행기 결함이 아니라 시험 진입점의 경로 오류였습니다. file:// URL로 한 번 수정한 뒤 최종 smoke가 통과했습니다. 최초 실패 결과/로그는 `smoke-results-initial.json`, `smoke-initial.log`로 보존했습니다.
- 미실행: 독립 QA, 실제 브라우저 게임 플레이·전체 게임 회귀·물리 신호 입력·실기기. 이 구현 검증을 전체 게임 수용으로 확대하지 않습니다.
- 허용 범위에 따라 기존 HANDOFF/worklogs/보드 게시 및 skill 파일은 쓰지 않았습니다. 별도 설치/외부망/재위임/Git 상태 변경·커밋/파일 삭제는 없었습니다.

## 변경·생성 파일 및 실행

- 코드: `E:/Work2/Project/SimpleGames/01-2048/scripts/serve_local.mjs`
- 배치: `E:/Work2/Project/SimpleGames/01-2048/start-local.bat`
- 테스트: `E:/Work2/Project/SimpleGames/01-2048/tests/launch-local.test.mjs`
- 보고서: `E:/Work2/Project/SimpleGames/01-2048/docs/20261026-230956_G017_LAUNCHER_IMPLEMENTATION.md`
- 증거: `E:/Work2/Project/SimpleGames/01-2048/artifacts/g017-builder/` (`unit.log`, `syntax.log`, `smoke-final.log`, `smoke-results.json`, 최초 실패, `bat-invalid.log`, 전후 해시, fixture, smoke 코드)
- 빌드: `E:/Work2/Project/SimpleGames/01-2048/artifacts/local-server-build/` — 본인 빌드·smoke 단독 소유 작업을 종료했으며 PM께 인계합니다.

PM의 기존 3102 처리 이후 실행: `node scripts/serve_local.mjs` 또는 `start-local.bat`. 명시적 다른 포트: `node scripts/serve_local.mjs --port 3120`. 본 worker의 3120 실행 프로세스는 모두 종료되어 있습니다.
