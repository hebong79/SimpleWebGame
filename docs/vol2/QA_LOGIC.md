# G032-QAA · 21~27 독립 QA

## PM 최종 중앙 실행 (20261107-235703 KST)
- 최신 동결 제품에서 29/29 PASS. 독립 순수 규칙과 선택 브라우저 수정회귀 포함. 실제 출력 artifacts/g032-independent-browser/2026-11-07T14-47-49-904Z/results.json.
- 후보60/60 및 실제15010 운영60/60도 확인했습니다. 최초 FAIL/좌표 진단은 기존 문서를 보존하며 최종 근거·제한·과거증거 사고는 docs/worklogs/20261107-235703_G032_신규20게임_제작_15010운영검증.md를 따릅니다.


- 검사자: build_action (자신의 구현35~40을 제외하고, 별도 builder의21~27을 읽기 전용 검사).
- 제품 변경: 없음. 독립 테스트: `tests/games/vol2-logic-qa.test.mjs`.
- 검사 범위: 고정 문제 수 8/12/8/8/8/8/8과 입력 다양성,21 노노그램·22 스도쿠·27 슬랜트의 별도 풀이기로 유일 해 확인,23 포트/트리·24 차수/연결/교차·25 광선/벽/숫자·26 완전 매칭/대각선·27 고리/별 그래프 반례.
- 독립 실행: PM이 `node --test tests/games/vol2-logic-qa.test.mjs tests/games/vol2-strategy-qa.test.mjs`를 중앙 실행해 본 검사27개와 전략31개, 합계58/58 PASS를 전달했습니다. 본 검사는 별도 풀이기와 반례를 사용하며 builder 자체73개 시험과 구분합니다.
- 확정 규칙 결함: 엔진0건. UI LOW3건을 찾아 원 builder에게 수정을 전달했습니다. 21 전행 단서 일치/열 불일치에서 줄 힌트가 0행을 안내하던 문제는 열 fallback과 실제 열 강조로 수정됐고,21/24 보조 손가락 pointercancel이 주 입력을 취소하던 문제는 pointerId 일치 검사로 수정됐습니다. 수정된8개 UI파일을 다시 읽어 세 수정 모두 확인했습니다.
- 수정 후 동적 회귀: `node tests/games/vol2-logic-qa.test.mjs --browser`는 PC Chromium·모바일 WebKit에서 행만 맞춘 노노그램의 열 힌트,21 드래그 중 secondary cancel,24 섬 드래그 중 secondary cancel의6가지 UI 사례를 검사합니다. primary 입력은 Playwright 실제 mouse, 보조 cancel은 명시적인 합성 이벤트이며 실제 두 손가락 기기 시험과 구분합니다. 기본 검사 주소는127.0.0.1:3103이며 `VOL2_LOGIC_QA_URL`로 fresh 후보 주소를 지정합니다. 실행 결과는 PM 로그가 최종 증거입니다.
- 현재 판정: 엔진 독립 자동검사 PASS, UI 수정 소스 재검토 PASS. 수정 UI 동적 회귀와 전체 통합·운영 수용은 PM의 별도 검증 결과를 따릅니다.
- 추가 UI 회귀 최초 실행:29개 중28 PASS/1 FAIL. PC 세 사례는 통과했고 WebKit에서는 실패했습니다. 처음에는24 드래그 실패로 추정했으나,추가 로그에서 WebKit의24 trace 이전에 멈춘 것을 확인해21 두 번째 드래그의 좌표 문제 가능성으로 정정했습니다. 원본 로그는 `artifacts/g032-independent-browser/2026-11-07T14-33-00-513Z/logic.log`, 첫 재실행은 `artifacts/g032-independent-browser/2026-11-07T14-45-38-240Z/logic.log`에 보존합니다.21 격자와24 지도 양쪽을 입력 전에 scrollIntoViewIfNeeded하고 bbox를 다시 읽으며 좌표 viewport 단언,실제 trusted down과 보조 cancel의 pointer 경로 로그를 추가했습니다. 이 진단 변경은 테스트뿐이며 제품은 수정하지 않았습니다. 원인 확정은 재실행 bbox/pointer 로그를 확인한 뒤 기록합니다.
- 제한: 이 파일은 엔진 정독·독립 자동검사의 범위이며, 실제 사람 플레이·물리 휴대폰·모든 기획 항목의 수동 수용 또는15010 운영 반영 증거가 아닙니다.
