# SimpleGames 01 — 숫자 정원 · 2048 제작 완료 보고

## 요청과 범위
- 원안: E:/Work2/Codex/Games/게임제작-001/simple-games-20/games/01_2048.md 및 공통 제작 사양.
- 대상: E:/Work2/Project/SimpleGames/01-2048. 원안은 수정하지 않았으며 01번 게임만 별도폴더에 제작했습니다.
- 사용자 요구: PC/모바일 모두 웹 동작, NodeJS(TypeScript), 직접 이미지 제작, 게임별 독립 실행, 필요 시만 SQLite, 실제 제작용 설계부터 작성.

## 수행 내용과 팀
대현자 PM이 요구사항·파일계약·빌드/서버·통합·수용을 맡았습니다. 기획 worker가 제작설계/기술설계/38개수용기준을 작성한 뒤 게임 구현과 아트 worker를 분리했고, 다른 QA worker가 독립 규칙대조·코드검토·브라우저 검증을 실행했습니다. 수정worker와 추가독립검토로 발견한 세 결함을 해결했습니다. worker의 완료보고만 믿지 않고 PM이 실제파일과 전체명령을 재검증했습니다.

## 구현 결과
- 4×4 2048: 한 턴 타일당 한 번만 합치기, 정확한 점수, 2/4 생성90:10, no-op의 생성/난수/기록 불변.
- PC 초점제한 방향키·Esc, 모바일24 CSS px 단일스와이프, 다중터치/취소/반복키/입력잠금 처리.
- 준비→플레이→일시정지→성공/막힘결과→재도전, 재시작확인, 도움말, 탭/창이탈 정지.
- 2048 이후계속/4096숫자표시, 성공+막힘동시시 축하우선/계속불가/결과보기.
- 최고점/최고타일/누적기록, 목표128~2048, 정원3종(기본씨앗뜰/256초록숲/1024꽃정원) 해금·선택.
- 크림·숲색 반응형 화면, 320px부터 보드정사각형/기본44px터치버튼, 모달초점순환·reduced-motion.
- 기본음소거, 사용자활성화뒤 WebAudio 직접합성 합치기음.
- 버전검증 localStorage, 손상값복구/저장차단 경고·메모리플레이. 진행중보드는미저장/재접속준비화면.

## 직접 제작 이미지
타일 장식SVG11종(2~2048), 정원장면SVG3종, favicon1종 총15개를 Python표준라이브러리 생성기로 직접 작성했습니다. 정원은 새싹마당/관목과벤치숲/꽃아치정원으로 구분됩니다. 외부이미지/폰트/원작코드/CDN을 가져오지 않았습니다. 생성기·SVG원본·연락시트PNG·XML/투명중앙픽셀검사가 있습니다. 숫자는실제DOM텍스트입니다. 효과음도외부음원이아닙니다.

## 기술·독립성·DB
- 설치확인/실행환경: Node 2026-10-22 검증 시 v24.16.0, TypeScript7.0.2, Playwright1.64.1.
- src/client 및 src/server는TypeScript, Node내장HTTP정적서버, HTML/CSS. 런타임외부npm패키지0, 계정/광고/추적/온라인API 없음.
- SQLite는이번게임에필요하지않아사용하지않았습니다. 개인기록을게임전용localStorage키에저장하여DB서버없이플레이합니다.
- 빌드된게임은Node24+와로컬서버만있으면외부인터넷없이플레이가능합니다. 개발용npm최초설치는인터넷필요, file://직접실행/PWA/서버를끈첫접속은범위밖입니다.
- 기본loopback127.0.0.1, LAN공개는사용자가명시적으로선택할때만가능합니다. 이번에공개배포/방화벽변경/포트포워딩하지않았습니다.

## 실제 검증 결과
- 검증시각: 2026-10-22T01:13:50.852313+09:00.
- npm run typecheck: 종료0. npm test: 실제빌드와 단위/서버 **44/44 통과**.
- npm run test:e2e: **57/57 통과**, PCChromium19/모바일Chromium19/모바일WebKit19, 실패·건너뜀·flaky0.
- 원래QA독립알고리즘과프로젝트별2,500개방향벡터대조, 정확한판정·손상저장·악성테마·CSP/정적경로보안을검증했습니다.
- python assets/generate_assets.py --check: 런타임SVG15개통과. 연락시트렌더/시각확인완료.
- 320/375/768/1366및가로viewport의플레이정사각보드/가로넘침없음/기본버튼44px검사를통과했습니다.
- 보안증거54개에서외부요청0/앱console·page오류0입니다. PlaywrightWebKit스크린샷도구의inline-style CSP오류11개는원시증거에분리보존했고CSP를완화하지않았습니다. 추가혼합입력3개는별도회귀입니다.
- 다른scratch폴더에서node_modules없이서버를실행해정적자산23개HTTP200/바이트일치를확인했습니다. 실행ZIP도별도압축해제폴더에서PC/모바일Chromium으로시작·합치기·모달·기록보존을검증했습니다(최종결과 artifacts/pm/runtime-zip-verification.json).

## 결함과 수정 이력
1. QA-001: 보드밖두번째손가락감지누락 → 전역capture관찰로수정.
2. QA-002: 모달Tab초점브라우저UI이탈 → visible/enabled tabbable 경계순환.
3. G008-001: 첫터치유지+방향키피드백잠금중추가포인터누락 → 관찰enabled조기반환한줄제거, 새제스처허용검사유지.
실패테스트를삭제하거나기대실패로숨기지않았습니다. 초기48/54와추가혼합입력3실패증거를보존하고최종57/57을확인했습니다.

## 산출물
- 게임폴더: E:/Work2/Project/SimpleGames/01-2048
- 실행ZIP: releases/number-garden-2048-runtime.zip
- TypeScript소스ZIP: releases/number-garden-2048-source.zip
- ZIP검증/체크섬: releases/manifest.json
- 설계: docs/GAME_DESIGN.md, TECHNICAL_DESIGN.md, ACCEPTANCE.md
- 검증: docs/QA_REPORT.md, QA_FIX_REVIEW.md, FIX_REPORT*.md, TEST_PLAN.md, artifacts/pm/final-verification.json
- 자산: public/assets/, assets/generate_assets.py, assets/contact-sheet.png, docs/ASSETS.md
- 실행법/인수인계: README.md, start-game.cmd, docs/HANDOFF.md
- 별도완료보고서: E:/Work3/Hermes/Dev/Doc/simplegames_01_2048_completion.md

## 실행 방법
게임폴더에서:
```sh
node dist/src/server/index.js
```
브라우저 http://127.0.0.1:3101. Windows start-game.cmd도가능합니다. 종료Ctrl+C. 소스에서처음시작할때는 npm ci → npm run build → npm start입니다.
휴대폰은사용자가LAN공개를선택해 --host 0.0.0.0 으로실행한경우에만 같은WiFi에서 http://<PC내부IPv4>:3101 로접속합니다. 휴대폰127.0.0.1은PC가아닙니다.

## 수용과 남은 한계
개발용MVP납품수용입니다. 38개AC는자동증거기준32 PASS/0 FAIL/6 UNVERIFIED로유지했습니다. 실제Android/iPhone/물리터치·회전·노치안전여백,스피커청취,실제브라우저저장권한/물리용량소진,모든해상도×모든상태및Firefox는미검증입니다. WindowsPlaywrightWebKit은AudioContext가없어무음fallback만검증했습니다. 에뮬레이션을실기기나사람청취로표현하지않습니다. 운영/공개배포·실기기최종승인은별도입니다.

## 게시 검증 완료
- 실제 게시 ID: mvibhlbz-9-blgw
- 게시물 Markdown: http://192.168.0.195:18787/api/posts/mvibhlbz-9-blgw.md
- 보고서와 제작설계 전체 본문을 재조회하여 내용 일치 확인. 서버가 바깥 공백만 trim하는 것을 확인했으며, 중복 게시하지 않았습니다.

## 보드와 자료 접근
작업보고와아래제작설계본문을보드에기록합니다. 보드의files필드는로컬경로메타데이터이며ZIP실제업로드가아닙니다. 다운로드용ZIP은Hermes대화의파일첨부와로컬releases폴더로제공합니다. 게시후실제ID/본문readback결과는 docs/BOARD_PUBLICATION.json 및완료보고서에기록합니다.
