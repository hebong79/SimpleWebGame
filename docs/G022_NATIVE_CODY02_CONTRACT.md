# G022-NATIVE-QA07 — cody-02 독립수용검토
정확대상 cody-02 / 01a17391-f01f-7ce0-821c-79e3fc3cde2f. ACK:G022-NATIVE-QA07.
## 목표/소유권
불변07후보8파일을독립코드검토·독립edge/property검증·실제HTTP검사하여차단결함유무를작은review.json으로판정하세요. 제품이나전용원본시험을수정하지않으며쓰기허용은새 artifacts/g022-native-qa07/** 뿐입니다. 다른worker cody-01은 runner-jumper.spec.ts를작성중이니이번검토입력에그변하는spec/공통상태문서를포함하지마세요. 최종통합spec의delta독립검토는후속별도턴입니다.
## 정확입력/후보동결
public/games/07-dino/{index.html,styles.css,engine.mjs,save.mjs,main.mjs,assets/kit.svg},tests/games/07-dino.test.mjs,docs/G022_07_IMPLEMENTATION.md는56ad2e6fb12f7be4c7182a470658726ffd9c30b7와바이트동일합니다. PM인수artifacts/g022-pm/intake07-d7652e97/receipt.json,merge07-into-integration.json. builder원본증거는 E:/Work2/Project/SimpleGames/worktrees/g022-07-dino/artifacts/g022-07-resume/{handoff.json,browser-full-03.json,followup-01.json,unit-02.log}만필요시읽을수있고과거FAIL을지우지마세요. PM키트docs/g022-design/07-kit.svg·docs/G022_07_DESIGN.md/G022_COMMON_CONTRACT.md에대한독립수용입니다. 기존08의save/modal해결보고는패턴참고일뿐07검증을대체하지않습니다.
## 필수검토/검증
- 입력hash를먼저고정하고끝에도같음을증명. 07단위31/31을실제명시Node24로재실행(--test-reporter=tap)하고자기artifact에별도독립검증을추가하세요.
- 연속충돌/포물선·x접촉시점/착지경계/긴dt/FPS·속도20초/새30초/공정생성간격·난수비소모no-op/숙임해제즉시충돌/거리4ULP정수경계교정을실제코드로검토. 독립oracle는같은제품함수를정답으로다시호출하는순환검증을피하세요.
- 순수저장은distance정수/score=floor(distance/10)·최고/누적/판수조합실현가능성/포화원자적갱신/설정과판정산분리·Storage별실패/중복정산을양방향검증. 작은실현가능완료이력집합과거부대상후보를독립생성해불가능집계허용/유효집계과잉복구를찾으세요.
- 실제PM후보3130의07페이지·6자산바이트/CSP·정상80ms클릭·정상점프회피/득점/자연충돌·quit1회와reload,320px결과버튼/44px/3프로젝트,모달즉시/RAF/250ms/native-close초점/반복키/혼합부위/Storage오류회복을샘플독립검증하세요. 원래builder실행31단위/HTTP11/스모크3/후속3과자기새실행을구분하세요.
- 무필터게임console warning/error/pageerror/CSP/실패자산/외부요청0을유지. 가짜route/게임setter/키삭제/Math.random고정/시계동결로입력우회금지. WebKit DOM/layout JSON만;기능단언제외없음. 홈복귀는정식compile후보를사용하므로이제실제library.js도200입니다.
- 서버/build수명·3116은건드리지않습니다. 제품코드요구결함이면정확file/line/재현/기대와실제·원시FAIL을보존하고passed=false. 본인은고치지마세요. 관측하네스문제면원본을보존하고근거와올바른검사를분리,단언완화로성공을만들지마세요.
최종 artifacts/g022-native-qa07/review.json은{passed,security_concerns,logic_errors,suggestions,inputs_sha256,tests,evidence_paths,limitations,summary}형식으로작게저장하세요. 보안/논리차단이있으면passed=false. PASS여도07동결소스에대한독립수용만이며main/배포/전체통합수용승인이아닙니다.

# 공통 실행 경계
PM은대현자,사용자는마스터입니다. 한국어존댓말로작업/보고하세요. 사용자요청은07/08별도브랜치구현→main정상병합/3116재기동/실제운영시험이며,이번native배정은아래한정후속만입니다. 현재임시builder/리뷰어계약은마감됐고사용자가후속nativeCody사용을선택했습니다. 연결/모델실행문제시PM은임시워커로전환할수있지만,본인은새worker를만들거나위임하지마세요.
Root: E:/Work2/Project/SimpleGames/01-2048. Branch feature/g022-eight-game-release, HEAD e0f37454220560b3bf8340e53a9b3c177adb1d14. 07 source56ad2e6fb12f7be4c7182a470658726ffd9c30b7,08 accepted18afb7533ca515224056774523b126834114bda7가후보에병합됐습니다. main563f2ac와운영3116의g019는그대로입니다.
Node는반드시 C:/Program Files/nodejs/node.exe(v24.16.0)를명시하세요. 별도HermesPython PATH의node는26일수있어사용하지않습니다. TS7.0.2/Playwright1.64.1은기존설치만사용. PM이정식build --out-dir artifacts/g022-build를생성했고 127.0.0.1:3130에서직접실행중입니다. root/scripts/library.js와07/08페이지·main6HTTP200/정확바이트/CSP/nosniff확인. 이서버수명과build는PM소유이며바꾸지마세요.
필수규칙AGENTS.md/.game-team/TEAM.md와이계약을우선읽고자기실제branch/HEAD/모델·파일도구읽기성공을확인하세요. 현재선택model/provider를유지하며대체/전역설정/인증/설치/프로세스강제종료없음. 비밀/auth/env/패스워드/다른대화/SQLite/다른프로젝트읽기·출력금지. PM2/main/push/Git stage/commit/브랜치변경·서비스/LAN3116·방화벽·ACL조작금지. 기존증거/원본FAIL/타워커파일덮지마세요. 게임상태setter/Math.random교체/가짜route/저장키삭제/skip/오류필터/CSP완화금지.
기존 on-request/auto_review/workspace-write/network=false 유지. Windows 기본runner기술초기화문제에는해당한정명령의공식on-request자동위험검토경로만허용합니다. 이미공식검토로성공한명령을실패로반복하지말고원본실패를남기세요. 자동거절/인간승인/auth콜백/검토재실패/ownership충돌시즉시blocked보고하고우회/ACL/보안약화금지. 동일실패2회또는20분을넘기면현재자료/정확차단을남기고보고하세요.
증거작성전출력경로와TMP/TEMP를자기새artifact폴더로명시하고최초짧은파일읽기/한정검증파일쓰기/명령실행이성공했는지증명하세요. 권한제한은역할계약이지새OS readonly샌드박스라고주장하지않습니다. 처음 ACK:G022-자기TASK 를남긴후실제작업하세요. 끝에작은handoff.json:task_id,status,source_sha256,changed_files,tests(명령/exit/수집vs실행),evidence_paths,blockers,limitations를자기폴더에작성하세요. 사용자실물기기/음향실청취/사람완주와자동브라우저를혼동하지마세요. WebKit은screenshot없이DOM/layout JSON을쓰되기능·무필터console/CSP단언을유지하세요.
