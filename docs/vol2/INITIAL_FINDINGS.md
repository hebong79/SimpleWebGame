# G032 초기 검사와 수정 기록

이 문서는 실제 도구 실행 출력의 요약·발췌이며 전체 원시 출력 파일을 뜻하지 않습니다. 실패를 최종 PASS로 대체하지 않습니다.

- 첫 후보7종 브라우저: `artifacts/g032-smoke/2026-11-07T13-53-45-431Z/results.json` 18 PASS/3 FAIL. WebKit 홈복귀 직후 다음goto가 아직 로딩중인 홈 자산을 취소한 검사 경합으로 확인, load 및 카드 대기 추가 후 `2026-11-07T13-59-52-171Z`에서21/21 PASS. 초기 소스↔후보 바이트 실패는 검사 도중21 엔진 데이터가 수정된 상태였으며 최종 동결 빌드로 재검사합니다.
- 21 첫 데이터검사: 도안2개의 복수해를 수정하고8개 모두 유일해 재확인. 23 중앙전원이 index8로 가장자리에 놓이는 오류는 sourceIndex(4)=10, sourceIndex(5)=12로 수정.
- 첫13종 순수 검사 실행: `node --test tests/games/vol2-strategy.test.mjs tests/games/vol2-action.test.mjs` **50 tests /49 pass /1 fail**, 실패 `32 capture includes last seed and opposite pit, and game end overrides extra turn`, `actual 6 !== expected 5`, `vol2-strategy.test.mjs:27:210`. 포획 후 판종료로 남은 자기씨앗1알도 집계되는 올바른 엔진 결과를 기대에서 누락한 fixture 오류였습니다. 포획 전용 fixture에서 상대 홈1알을 남겨 종료와 분리하고 별도 종료우선 검사를 유지한 뒤 구현자가50/50 재실행했습니다. PM 최종 전체 재실행은 별도 기록합니다.
- 추가 원안대조/독립 QA: 28 그래프 문제쌍 중복,33 대칭맵 중복,38 표적 채집 후 동시재입력의 부당감점,39/40 다중포인터 선분,39 동시폭탄 우선,36/37 외형선택 저장,37 무적 중 유효착지,40 중복문제를 발견해 소유자에게 수정 배정했습니다. 실제 수정과 독립 재검사 결과는 최종 QA 보고서에 따릅니다.
- 과거 `g013-qa` JSON/HTML 출력 보존 사고는 `QA_SHARED.md`에 별도 기록하며 미복구입니다. 이번 새 게임 기능 검사 PASS가 과거 증거 복구를 의미하지 않습니다.
