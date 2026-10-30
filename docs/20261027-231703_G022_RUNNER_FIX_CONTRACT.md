# G022-RUNNER-FIX — 독립QA DELTA-01 및 좁은 수용 단언 보완

PM 대현자, 사용자 마스터, 한국어존댓말. 사용자문제시임시worker사용승인. root E:/Work2/Project/SimpleGames/01-2048, branch feature/g022-eight-game-release HEADe0f37454220560b3bf8340e53a9b3c177adb1d14. 실제 root public12제품과 PM3130/artifacts/g022-build는불변구후보입니다. 두PRIVATE게임worktree의다른worker는시간보호4FAIL을진단/조건부수정하며root/spec은쓰지않습니다. native두worker는완료/idle,독립spec검토도마감됐으므로지금부터본인이root/spec의유일한writer입니다.

## 입력/실측
AGENTS.md/.game-team/TEAM.md, docs/20261027-005550_G022_COMMON_CONTRACT.md/G022_07_DESIGN.md, artifacts/g022-runner-delta-review/{review.json,fixture-oracle-check.json}, artifacts/g022-pm/runner-delta-fail-intake.json을읽으세요. 수정전 tests/e2e/runner-jumper.spec.ts SHA256 00170207d1338d095cbcc5406366ced6407bf0c219c747f1f47275b4ef18e0d6,741행입니다. PM이37입력/oldQA11파일SHA를검증해보존했습니다. 실제runtime204중200PASS/4FAIL·smoke12/12는과거실행이며제품clock수정후full재실행필수입니다.

## 허용쓰기/금지
허용: tests/e2e/runner-jumper.spec.ts 하나, docs/20261027-231703_G022_RUNNER_ORACLE_FIX.md, 새 artifacts/g022-runner-fix/**, 새 artifacts/g022-integration/runs/<본인고유ID>/candidate/** 뿐입니다. ROOT제품12·PRIVATE worktrees·다른spec·기존단위/문서/증거/guard/config/launcher/build/server/PM2/3116/Git/index/branch/commit/push/모델·provider/설치/권한/인증/전역설정/다른대화읽기는금지. 다른worker실행제어/재위임금지. 단,정확API/DOM판정용root07의main/save/index/styles/kit 및원본server보안정의는읽기만가능합니다. source/.env/auth/비밀값출력금지.

## 반드시수정: DELTA-01
현재713–716에서실제API로생성한fixture의 r.unlockedSets.includes(set)를UI canApply기대값으로사용하여제품문턱오류를놓칩니다. 실제정산API를사용한실현가능이력생성은유지하되 **계약의독립기대표**로fixture/API와UI둘다단언하세요.

| metric 이력 | sport | space |
|---|---|---|
| [4999] | false | false |
| [5000] | true | false |
| [4990,5000,20000] | true | false |
| [4990,5000,20000,10] | true | true |

원본save API는현재이표와일치합니다. 원래review의메모리내순수API변이(>=500/3000을>500/3000으로변경)는제품파일/브라우저변조없이기존비교식의검출력부족을입증했습니다. 새단언이두정확문턱반례를거부함을별도새negative-control/표대조로증명하세요. 제품을잘못바꾸어test통과시키는것아닙니다. 네개기존논리case제목과개수를유지합니다.

## 같은1파일의한정권고보완
- DELTA-S01: 07-10의8pose에서base/space-hat뿐아니라선택한sport-body/postal-bag의정확각pose href와실제표시를단언하세요. 혼합조합·취소0쓰기·적용1쓰기·중간판정산0은그대로.
- DELTA-S02: 07-06의직접/중첩modal기능단언을유지하고,열린help/menu/wardrobe/confirm의320x667 및667x375 가로화면에서하드한수평overflow/최소44px/viewport안dialog기하/내부scroll과필수버튼도달가능을검사하세요. 모달내스크롤로아직클립된정상콘텐츠를viewport밖버튼결함으로오인하지말고scrollIntoView후실제도달/노출을검증. 결과320px검사를대체하지마세요. 실제UI결함이면보고만하고제품수정/허용오차확대/skip금지.
- DELTA-S03: 07-05의실제duck hold중일치pointerID의cancel을관측해height24→48/paused/입력해제·명시재개전진행0을검사하세요. 실제누름과syntheticcancel은구분. 기존외부release/모바일CDP/보드밖추가터치검사는유지합니다.

## 변경하지않을것
**G022-08-* 원본17literal test callsite/26논리 및 G022-07-04/G022-08-04 longframe 두test호출의내용은바이트그대로보존**하세요. clockworker가이두엄격정확동등사례를원인진단중이며본인은고치지않습니다. time/body tolerance/skip/대기시계동결/가짜route/게임setter/RNG교체/저장키삭제/진단필터/CSP완화금지. 기대fixture의잘못된값을제품API로부터다시파생하지마세요. 상단provenance/기존07정상회피·득점/정산/전용키/부모env실행guard/무필터진단을유지합니다.

## 실제검증
Node명시 C:/Program Files/nodejs/node.exe v24.16.0,기존TS7.0.2/Playwright1.64.1만. 자기새artifact로TMP/cache/log를설정. 문서화된strictTS는 --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --lib ES2022,DOM,DOM.Iterable 및spec/config 명시입니다.
현재PM3130의불변runtime에서변경된07-05/06/09/10만실제3프로젝트target실행하세요. 원본config사용시parent에 GAME_TEST_BUILD_DIR=artifacts/g022-build, GAME_TEST_ARTIFACT_DIR=artifacts/g022-integration/runs/<새ID>/candidate, GAME_G022_MODE=candidate, GAME_G022_PHASE=full을child시작전에명시하고 GAME_LIVE_ORIGIN을상속하지않습니다. 원본config그대로PlaywrightCLI의--grep ^G022-07-(05|06|09|10)을사용해실제결과를새JSON으로집계할수있습니다. 이는기존full에서runtime4FAIL을skip으로숨기는것이아니라testfix의좁은target검증이며full204는PM이별도재실행합니다. 새검사의actual수집/실행/PASS/FAIL와3프로젝트를JSON으로집계. 콘솔/CSP/자산·외부요청0,WebKit은DOM/layout만·기능단언유지. 알려진longframe4FAIL/full은지금재실행/완화하지마세요.

실패/반례/수정전spec/oldQA11파일은모두보존. 같은실패2회또는약15분내마치고해결못하면정확위치/원시진단으로보고. 승인거절/인간승인/auth콜백/소유권충돌은즉시중단·우회금지. 자기가시작한브라우저만finally정상닫고서버/타프로세스는안건드립니다.

최종 artifacts/g022-runner-fix/handoff.json: status,changed_files,before_after_sha256,small_diff_path,independent_expected_table,negative_controls,tests(명령/exit/수집vs실행),source/evidence_preservation,blockers,limitations. 본인시험은독립QA아니며PM이새delta검토와clockfix후full/실제3116을수행합니다. Gitstage/commit은하지말고source파일수정과새인수자료만반환하세요.
