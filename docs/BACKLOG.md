# 작업 목록 — 최종 PM 수용

| ID | 목표 | 담당 | 의존성 | 최종 상태 | 실제 검증 근거 |
|---|---|---|---|---|---|
| G-001 | 원안→제작 설계·수용 기준 | planner | 없음 | done | PM 설계3문서/38 AC 검토 |
| G-002 | 게임 규칙·UI·입력·저장·합성음 | builder | G-001 | done | 타입/단위44·브라우저57 통과 |
| G-003 | 직접 제작 이미지 | art builder | G-001 | done | SVG15개 --check·실제렌더·PM시각확인 |
| G-004 | Node/TS 서버·빌드 | PM | G-001 | done | 빌드성공/서버20개포함44통과·런타임분리검증 |
| G-005 | 독립 전체 QA | qa | G-002~004 | done | 초기48/54→결함보고, 수정후PM57/57재실행 |
| G-007 | 다중터치·모달초점 수정 | fix-builder | G-005 | done | 기존02/14세프로젝트통과 |
| G-008 | 수정코드 독립검토 | qa-review | G-007 | done | G008-001추가발견, PM3브라우저재현 |
| G-009 | 잠금중 포인터관찰 누락 최소수정 | fix-builder | G-008 | done | 한줄삭제검토+추가17회귀3개포함57통과 |
| G-006 | PM 통합·ZIP·인수인계·보드 | PM | 위 전체 | done | 최종ZIP정상실행·보드 mvibhlbz-9-blgw 전체본문 재조회 확인 |
| G-010 | 다중 게임 홈·별도 게임 페이지·정지/결과 UI 시안 | PM / planner / builder / qa | 기존 MVP | done (시안) | PM 최종 브라우저 재실행 15/15, PC·모바일 화면 검토. docs/prototype/verification.json. 실제 게임 통합은 후속 작업 |
| G-011 | 30개 이상 게임용 탐색 홈 시안 | PM / planner / builder / qa | G-010 | done (시안) | PM 홈 16/16 + 게임 시안 회귀 15/15, 30개 전체 및 31번째 추가 검증, PC·모바일 시각검토. verification-library.json |
| G-012 | 새 시안 브라우저 주소 제공·열기 | PM / builder / qa | G-011 | done | 127.0.0.1:3102 서버 실행, HTTP 8경로200·루트4경로404·POST405, 독립 Chromium 흐름 통과 |
| G-013 | 승인 시안의 홈·실제 2048 통합 구현 | PM / home-builder / game-builder / qa | G-010~012 | done | 격리 빌드·단위47/47·브라우저75/75, 실제 득점→결과→홈 및 PC/모바일 시각확인. final-verification.json·QA_G013.md |

## 수용 경계
- 개발용 MVP 납품 수용입니다. 자동증거32 AC통과, 실패0, 실기기/환경6 AC미검증을 명시합니다.
- 실물Android/iPhone/음향청취/실저장권한/모든화면상태/Firefox 및 운영·공개배포 수용은 별도입니다.
- 원안은 읽기전용으로 보존했습니다. 설계서01만 별도폴더에서 제작했고 런타임에 원안/다른게임 경로를 참조하지 않습니다.
- PM만 이 상태를 갱신했습니다. 파일 소유권은 각위임계약과 GAME_DESIGN/TECHNICAL_DESIGN/QA문서에 기록했습니다.
