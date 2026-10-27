# G022-LONGFRAME-DIAG-FIX — 두 게임 한정 시간보호 진단/수정

## 역할과 승인
PM 대현자, 사용자 마스터. 한국어 존댓말. 사용자 원요청은 07/08 각각 브랜치 제작→검증→main 정상 병합→3116 재기동/실주소 확인입니다. 최신사용자는 문제가 있으면 기존 임시 워커 방식을 허용했습니다. native 두 워커는 자기 계약을 마치고 idle/완료이며 07 별도 독립 브라우저 검증은 root 동결본에서 다른 임시 QA가 수행 중입니다. 이번 워커는 원인을 분리하고 입증된 문제에 한해 아래 개인 게임 worktree만 수정합니다. 재위임하지 않습니다.

## 물리 root/HEAD/쓰기 소유권
- 통합 후보 READ-ONLY: E:/Work2/Project/SimpleGames/01-2048, branch feature/g022-eight-game-release HEAD e0f37454220560b3bf8340e53a9b3c177adb1d14. PM 소유 후보 http://127.0.0.1:3130 및 artifacts/g022-build는 구버전 비교용으로 그대로 유지합니다.
- 07 FIX ROOT: E:/Work2/Project/SimpleGames/worktrees/g022-07-dino, branch feature/g022-07-dino HEAD56ad2e6fb12f7be4c7182a470658726ffd9c30b7. 허용쓰기 public/games/07-dino/main.mjs, docs/G022_07_LONGFRAME_FIX.md, 새 artifacts/g022-longframe-fix07/**만.
- 08 FIX ROOT: E:/Work2/Project/SimpleGames/worktrees/g022-08-doodle, branch feature/g022-08-doodle HEAD18afb7533ca515224056774523b126834114bda7. 허용쓰기 public/games/08-doodle/main.mjs, docs/G022_08_LONGFRAME_FIX.md, 새 artifacts/g022-longframe-fix08/**만.
- 제품 외 진단/최종 handoff 쓰기는 root의 새 artifacts/g022-longframe-fix/**만 추가 허용. root/public, root/tests, 모든 engine/save/HTML/CSS/kit/단위원본/공통 launcher/config/build/server는 읽기전용입니다. 최종결과 artifacts/g022-longframe-fix/handoff.json.
- 시작할 때각 worktree branch/HEAD와 tracked clean·원본 main SHA를 확인. main/doc 두 허용파일만 자체branch에한정커밋할 수 있습니다. 루트/index/다른branch/원격 push/강제reset/stash/병합/운영/PM2/3116 변경 금지. 게임별 새 문서 이름은 서로 다르므로 통합충돌을 만들지 마세요. 07 root 동결8파일을 다른 QA가 읽으므로 root에 복사/병합/빌드반영하지 않습니다.

## 필수 최소 입력
AGENTS.md/.game-team/TEAM.md 및 docs/G022_COMMON_CONTRACT.md/G022_07_DESIGN.md/G022_08_DESIGN.md의 longframe/pause 계약. 두 실제 main.mjs, tests/e2e/runner-jumper.spec.ts의 G022-08-04(lines280–311)와 G022-07-04(lines646–663), artifacts/g022-pm/{native-cody01-intake.json,longframe-fix-preflight.json}, docs/G022_NATIVE_INTEGRATION_IMPLEMENTATION.md의 최종 BLOCKED 결과. 원본실패 artifacts/g022-integration/runs/20261027T121305826Z-8832ed5d/candidate/playwright-results.json 및 trace/진단은 읽기전용. 기존 역사 전체/다른 대화/비밀/auth/env는 읽거나 출력하지 않습니다.

## 정확한 관측 결과
정식 smoke12/12. Full204개 실제실행 중200PASS/4FAIL/skip0/flaky0. Chromium PC/모바일 각각 07·08 한 사례씩이며 WebKit 같은단언은PASS. 08 게임time 0.175→0.19166666666666665. 07 PC0.016666666666666666→0.03333333333333333, 모바일0.025→0.041666666666666664. pauseReason=longframe은 확인되나 300ms UI busy loop 직전 snapshot보다 1/60초 증가. 그 후 cancel/restart 일부 단언은 미도달. 다른07/08/선정기존66회귀와 무필터진단은원본실행범위의실제PASS로구분합니다.
기존 테스트는 **동일 page.evaluate(async...)에서 import→snapshot 읽기→동기300ms busy loop→snapshot 반환**합니다. 따라서 단순한 별도CDP 호출 사이 gap으로 단정하지 마세요. 현재 main 두곳 pump(now=performance.now())는 elapsed=max(0,(now-last)/1000);last=now;elapsed>.25이면 pause('longframe')/release를하고advance없이 return합니다. frame의 RAF timestamp와 input/default performance.now 사이 clock/실제 callback도착시각 차이, 이미 예약된 stale RAF timestamp를 우선 조사할 수 있으나 이것은 가설입니다.

## 수행 순서/수용 계약
1. 소스·원본실패/trace·동결된root 12제품파일과 기존증거SHA를 고정하고 원래 엄격한 exact time/body no-advance 단언을 작은 실제HTTP에서 재현하세요. 먼저 실제명령한번·3브라우저 최소스모크로환경을확인합니다. Node 반드시 C:/Program Files/nodejs/node.exe v24.16.0, 기존 Playwright1.64.1/TS7.0.2만. Python kernel PATH의node26 금지.
2. RAF native timestamp와 실제callback entry performance.now, 이전clock, before/after snapshot을 관측하여 **제품 버그와 하네스 관측 오류를 분리**하세요. 진단 wrapper는 원래native RAF의callback/ID/순서/인자를 그대로전달하는 읽기 관측만 가능. game setter/RNG교체/시계가상화/인위 dt 주입으로 통과시키지 않습니다. 원래 비계측조건과 함께원시로그를남기세요.
3. 하네스 오류만 입증되면 제품수정 없이 정확한 원인/교정제안과 검출력을 보고하고 종료하세요. root E2E 직접수정금지. 제품문제가 입증되면 개인 worktree 두 main.mjs에서만 가장 작은 올바른 clock/pause 수정을 하세요. 고정1/60 허용오차, 물리박스/정산/타임스텝/입력의미 변경, 에러필터/CSP완화/skip은 금지합니다.
4. 고친 worktree/public을 기존 **실제** createGameServer/public-root 지원 API(소스를 확인)를 사용해 각자 소유 임시 loopback/ephemeral 포트에서 serve할 수 있습니다. stub/fake routes/합성 서버응답은금지. root3130의불변 구본과 수정본을 동일 입력·동일300ms 실제 지연·동일 exact equality로 비교하세요. 구본이 실제 FAIL하고 수정본은 PC/모바일Chromium 및 모바일WebKit 모두 PASS하는 음성/양성대조가 필요합니다. 구본을 과거 source로 덮거나 PM서버를 재시작하지 않습니다.
5. longframe 후 time/body/점수/생성/저장 불변과 입력release, 명시재개까지계속paused, 재개첫frame 음수/시간되감기/과잉advance없음, 정상80ms 시작/점프 또는 이동/정지·재개·음소거·quit1회를 검사하세요. ordinary RAF와 input pump가 섞이는순서를검토하세요. 기존07순수31/08순수42단위와 구문검사재실행, engine/save/다른 모든파일불변을증명하세요. private public홈에 compile된library.js가 없으면 그한계를기록하고가짜경로로만들지 않습니다(홈 통합은 PM후보fresh build후full회귀).
6. 무필터 console warning/error/pageerror/CSP/실패asset/외부요청 0을 요구합니다. WebKit은screenshot없이고유 DOM/layout JSON만 사용하되 기능/보안단언유지. 자기가시작한브라우저/context/임시서버는finally정상닫고최종포트거부를확인합니다. 실물/실청취는미검증입니다.
7. 변경이필요했다면 각각 native Git C:/Program Files/Git/cmd/git.exe로 자기main+고유doc만한정stage/whitespace검사/commit, 정확최종HEAD·변경allowlist·blob/hash·시험실행/exit/과거FAIL·패치작은diff를 인수합니다. 본인시험은독립수용이아니므로 [verified] 마커를쓰지마세요. PM이별도fresh deltaQA와root병합/build/full204/실제3116을마칩니다.

## 비용/중단/보고
20분 정도 최소완전범위로 제한. 같은실패2회면원인과자료를보고하고반복실행/조건완화금지. 승인거절/timeout/인간승인/auth콜백/ownership충돌은즉시중단, 다른명령/도구로우회하지마세요. 일반fallback허가는보안해제가아닙니다. 다른앱/프로세스/전역설정/ACL/방화벽/인증/설치/네트워크공개 금지.
최종 handoff.json은 task_id,status,root_cause,changed_files_by_root,commits,source_sha256,preserved_root_hashes,tests(실제명령/exit/프로젝트/구본negative와수정positive분리),evidence_paths,blockers,limitations를작게기록합니다. root/운영에수정됐다고말하지말고 두개개인branch후보수정과 최종릴리스미완료를 명확히구분하세요.
