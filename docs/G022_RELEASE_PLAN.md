# G022 07/08 릴리스 계획 — 현재 진행 중

## 승인·기준
사용자: 7·8번 PM설계/디자인/제작,각게임branch,완료후main병합·재기동,반드시3116실제동작시험. 3116 외타서비스/방화벽/기존증거/원격push/이전승인중단Git정리는제외.
출발main90f93db,공통설계563f2ac. feature/g022-07-dino,feature/g022-08-doodle의worktree는프로젝트부모worktrees/아래이며프로세스/권한샌드박스가아닌파일소유권분리입니다. 통합/전체검증은feature/g022-eight-game-release에서만,수용전main으로런타임변경병합금지.

## 실행 게이트
1. PM설계/원본SVG/3폭디자인검사 완료. 시안은실제게임이아님.
2. 두builder:자기game/전용unit/인수doc/새artifact만변경·순수unit/syntax·allowlistcommit.
3. PM이변경목록/실제명령결과/원안수용/PMkit SHA를읽고통합branch로병합. 공통홈새desert-post/cloud-bunny 추가,기존35ID/상태/즐겨찾기키보존→37/8/29.
4. 별도artifacts/g022-build에빌드. 새증거경로child env를시작전지정. **조기실제HTTP/CSP/외부요청0/준비·시작·정지·옷장·비동결80ms누름**을3브라우저에검사. 원본FAIL/trace보존.
5. staged whitespace/security→후보해시동결→구현자와다른QA의독립엔진/저장/입력검토→전체단위/타입/PC·모바일Chromium/WebKit 실제HTTP·기존6회귀. 작은수정은새해시의집중fresh검토와해당재시험,스킵/보안완화금지.
6. 승인된검증커밋을main no-ff병합,ancestor/tree확인. 원격push는이번요청아님.
7. 구g019-build/PM2설정/타앱safe PID정보보존. number-garden-2048 한앱만새g022-build script로전환/재기동. restart0여도actual경로가구버전이면실패로기록하고,사용자승인범위의해당등록만재생성. PM2전체restart/save·다른앱/방화벽변경없음.
8. actual pm_exec_path→PID→0.0.0.0:3116 LISTEN→loopback/LAN GET/바이트빌드일치→**실제192.168.0.195:3116 홈8카드→각새게임시작/입력/득점/자연종료또는quit/정지·재개/홈** 순서로확인. 기존6회귀/엄격CSP/무필터진단은유지.
9. docs/worklogs/실제한국시각_아름.md,최종HANDOFF/기본Doc/보드실제본문·첨부다운로드검증후보고. 물리휴대폰·실청취·사람수동완주는자동브라우저와구분해미검증표시.

## 관련 근거
artifacts/g022-pm/before.json,protected-before.json,branches.json,design-math.json,design-browser.json. docs/g022-design/asset-manifest.json에직접제작아트출처/심벌/발기준/해시. 신규빌드/QA실제증거는후속작성하며미리PASS로채우지않습니다.
