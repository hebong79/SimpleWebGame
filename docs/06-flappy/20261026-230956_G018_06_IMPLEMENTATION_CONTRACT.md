# G018-06 · cody-02 개발 지시서 v1.0

## 확정 배정
- 역할: native 구현자 cody-02. PM/설계/디자인은 대현자. task_id G018-06-CODY.
- 정확 세션 UUID: `01a17391-f01f-7ce0-821c-79e3fc3cde2f`. 다른 과거 exec/다른 세션으로 대체하거나 기존 writer를 끊지 않습니다.
- 절대 프로젝트: E:/Work2/Project/SimpleGames/01-2048. 한국어 존댓말. 모델/provider는 현재선택 유지. 원안은 D:/Work/Game/Game-001/simple-games-20/games/06_flappy.md와공통사양읽기전용입니다.
- 필수 읽기: AGENTS.md/.game-team/TEAM.md/.game-team/project.json, docs/01-2048/init-design/20261024-231330_GAME_DESIGN.md/BACKLOG.md/DECISIONS.md/HANDOFF.md, docs/20261026-230956_G018_COMMON_CONTRACT.md, docs/06-flappy/20261026-230956_G018_06_GAME_DESIGN.md, docs/06-flappy/20261026-230956_G018_06_ACCEPTANCE.md, docs/g018-design/06/index.html 및 kit.svg. 이개발지시서와공통계약이과거연결검사'도구금지/JSON응답만'범위를대체합니다. 원안/기존4게임은수정금지입니다.

## 허용 쓰기(정확히 이 경로만)
1. public/games/06-flappy/**
2. tests/games/06-flappy.test.mjs
3. docs/06-flappy/20261026-230956_G018_06_IMPLEMENTATION.md
4. artifacts/g018-06-builder/**

같은프로젝트의다른worker는다른게임폴더를소유합니다. 홈/공통src/package/lockfile/기존tests/다른게임/docs공통/기존artifacts/서버/PM2설정은절대수정하지마세요. 자신의신규폴더가예상외로이미존재하면충돌로보고하고중단합니다. 공통빌드/서버시작/재시작은PM만수행합니다. 출하게임은 ES모듈을사용하여 기존 Node/TypeScript 정적서버에서독립페이지로플레이합니다.

## 실행 지시
1. 필수 문서를읽고 `G018-06-ACK worker=cody-02 thread=01a17391-f01f-7ce0-821c-79e3fc3cde2f design=v1.0`를한번답한뒤, 허용범위의실제구현을이어가세요. 이것은수신확인문구이지작업완료가아닙니다.
2. PM시안의레이아웃/색/직접제작키트를따라준비/플레이/정지/메뉴/확인/실제결과/재시작/홈/저장/음소거/옷장·9부위해금·혼합장착을완성하세요. 시안의샘플기록/데모툴바는제거하고진짜엔진상태를표시합니다. mutable 상태setter/강제승리/숨은치트/외부의존추가금지.
3. engine.mjs/save.mjs/main.mjs/index.html/styles.css/필요자산과완전한단위시험을만듭니다. 수용표의unit항목과GDD경계8사례를실제로검증하세요. 실제명령 `node --test tests/games/06-flappy.test.mjs`, 필요한 `node --check public/games/06-flappy/main.mjs` 등을자기증거경로에보존합니다. 실기기/실청취/전체수용을자체선언하지않습니다.
4. 인수문서에changed_files, exports/API, DOM IDs, storage schema/검증/정산사례,아트출처,실제시험명령/exit/count,미검증/차단을기록하고 마지막응답에도task_id/status/changed_files/tests/evidence_paths/blockers를주세요.

기존공식auto_review/workspace-write·기본네트워크제한을유지하며일반작업은자동진행합니다. 승인거부/사용량한도/샌드박스실패/동일실패2회/소유권충돌이면원문과함께멈춰보고합니다. 전역보안·인증·모델·ACL/다른프로세스·동일세션두writer/설치/외부네트워크/결제/재위임/Git조작/삭제/운영배포금지입니다. 작업목표약25분,단순스텁/계획만반환하지마세요. 독립QA·통합·배포는PM후속입니다.
