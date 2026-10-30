# G-016 구현 인수 계약 — cody-01 전용

## 소유권
- 역할: 구현 worker cody-01. PM/설계/디자인 책임자는 대현자입니다. 마스터의 승인 범위는 기존 프로젝트에 네 번째 게임을 추가하는 것입니다.
- 절대 루트: E:/Work2/Project/SimpleGames/01-2048. native UUID 01a16eb2-eae8-78d2-b41a-380d98e6673d. 현재 모델/공유 서버를 유지합니다. 이전 연결검사의 도구금지/JSON응답만 지시는 그 검사에만 한정됐으며 이번 실제 구현에는 아래 범위의 코드 도구 사용을 허용합니다.
- 필수 입력(먼저 전부 읽기): AGENTS.md, .game-team/TEAM.md, .game-team/project.json, docs/01-2048/init-design/20261024-231330_GAME_DESIGN.md, docs/20261024-231330_BACKLOG.md, docs/20261024-231330_DECISIONS.md, docs/20261024-231330_HANDOFF.md, docs/04-breakout/20261026-230956_G016_GAME_DESIGN.md, docs/04-breakout/20261026-230956_G016_ACCEPTANCE.md, docs/04-breakout/g016-breakout-design/index.html, docs/04-breakout/g016-breakout-design/cosmic-kit.svg. D:/Work/Game/Game-001/simple-games-20/games/04_breakout.md 및 공통_제작사양과_코스튬.md는 마스터가 명시 허용한 읽기전용 원안입니다.
- 디자인/규칙의 원본은 PM 문서와 시안입니다. 시안은 물리엔진이 없는 샘플값으로, 실제 구현에서는 새판0점/3목숨/32벽돌의 진짜 상태로 교체합니다. 시안의 디자인 toolbar/샘플기록/스타일 데모용 모드 전환은 출하하지 않습니다.

## 허용 수정 경로(이 외는 금지)
1. public/games/04-breakout/** (신규 index.html, styles.css, engine.mjs, save.mjs, main.mjs, 필요시 자체 SVG)
2. tests/games/04-breakout.test.mjs
3. docs/04-breakout/20261026-230956_G016_IMPLEMENTATION.md

홈 통합은 PM이 src/client/library.ts/public/home.css에서 따로 진행합니다. QA가 tests/e2e/breakout.spec.ts를 별도 소유합니다. 공유 파일을 수정하거나 자신이 docs/20261024-231330_HANDOFF.md/BACKLOG.md/project.json/README/package를 갱신하지 않습니다. 프로젝트 규칙의 공통 인수인계/보드 요약은 PM이 최종 통합으로 수행합니다.

## v1.1 보완 우선 적용
- 독립 설계 QA G016-DQ-01을 해결한 docs/04-breakout/20261026-230956_G016_GAME_DESIGN.md의 5.1을 반드시 읽고 plays/bestStage/totalBricks/quit 집계순서와8개 기대사례를 구현·테스트에 반영하세요. 초기 v1.0 해석보다 v1.1 확정 정의가 우선합니다.
- 정상 첫 방문 null은 저장 불가가 아니며, paused 등에서 명시적인 상태 전이 버튼은 사용할 수 있습니다. safe-area 및 실제 버튼 가로세로44px도 확인하세요.

## 수행
- 원안/PM 설계대로 완성된 우주 청소부를 구현하세요. 외부 코드/아트 복사나 원작 사이트 탐색이 필요하지 않습니다. 기존 03-pong의 프로젝트 스타일/API 관행을 읽어 참고할 수 있지만 기존 파일을 수정하지 마세요.
- 순수 엔진·저장·UI/입력/음향을 분리하고 핵심 경계·고속관통·결과중복·저장실패·스킨불변을 재현하는 단위 테스트를 작성하여 `node --test tests/games/04-breakout.test.mjs`를 실제 통과시키세요. 단순 화면 스텁이나 강제승리 버튼은 불가합니다.
- 실제 Canvas/입력/저장/결과/확인모달/음소거를 완성하세요. UI에서 결과/기록을 엔진의 진짜 이벤트로 갱신하세요. 편의상 프로덕션에 mutable test-global/치트 상태setter를 노출하지 마세요. 필요한 경우 읽기전용 snapshot export는 가능하며 문서에 명시하세요.
- 패들3종과원본스타일을 구현하며 규칙과 UI의 정확한 exported API/DOM ID, 검증명령/결과, 자체리소스 출처, 제한을 docs/04-breakout/20261026-230956_G016_IMPLEMENTATION.md에 기록하세요.
- 설치/결제/전역 설정/인증 변경/외부 네트워크/상주서비스/기존서버종료/Git커밋·머지·푸시는 하지 마세요. dist/기존 artifacts는 빌드하지 마세요. PM이 artifacts/g016-build를 통합 빌드합니다.
- 동일실패2회·승인필요·사용량한도·소유권충돌·원안누락은 원인을 보고하고 멈추세요. 실패를 감추거나 다른 세션으로 우회하지 마세요. 전체 구현 목표 약20분, 작업 중 사용자확인필요하면 명확히 보고하세요.
- 마지막 응답은 한국어 존댓말로 task_id G-016-CODY, status, changed_files, tests(실제명령/통과수), evidence_paths, blockers를 포함하세요. PM은 별도 QA/실행으로 수용합니다. 본인은 통합완료/배포완료를 선언하지 않습니다.
