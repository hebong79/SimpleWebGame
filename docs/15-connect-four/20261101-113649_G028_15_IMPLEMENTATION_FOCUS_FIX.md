# G028-FIX15-F01 · 열린 모달 Tab 경계 보강

- 실제 작업: 2026-11-01 11:36~11:38 KST. 상태: **최소 수정·구문검사 완료 / 제품 재동결 / 독립 실제브라우저 검증 대기**.
- 입력: `artifacts/g028-qa15/focus-diagnostic-20261101-113619-attempt2/execution/results.json`을 읽었습니다. native modal.open=true인데 도움말 마지막 버튼 Tab, 재시작 취소 Tab, 재시작 확인 ShiftTab 후 focus가 BODY로 빠진 원FAIL을 보존했습니다.
- 수정 제품 파일: `public/games/15-connect-four/main.mjs` 하나. 기존 keydown 처리 앞에 모달 Tab 경계 guard 11행만 삽입했습니다. 이를 제거하면 수정 전 main과 바이트가 동일합니다. engine/save/CSS/HTML/오디오·공유 상태·Git·PM2·CSP·단언은 바꾸지 않았습니다.

열린 모달에서 Ctrl/Alt/Meta가 없는 Tab만 검사합니다. 실제 표시되고 enabled이며 tabIndex>=0인 버튼/링크/입력 요소를 골라 first+ShiftTab→last, last+Tab→first, 목록 밖 초점은 방향에 따라 first/last로 보냅니다. 비활성·hidden/inert 조상·렌더 영역 없음·visibility hidden/collapse 요소를 제외합니다. 내부 순서는 native Tab 동작을 유지하고 Ctrl/Alt/Meta+Tab도 처리하지 않습니다. 기존 Enter/Space/repeat/Esc/닫기·실제 트리거 복귀·정지원인 로직은 그대로입니다.

실제 검증:

- `node --check public/games/15-connect-four/main.mjs` — exit 0.
- `node --check artifacts/g028-builder15/fix-focus-20261101-113649/verify-focus.mjs` — exit 0.
- `node artifacts/g028-builder15/fix-focus-20261101-113649/verify-focus.mjs` — **실제 삽입 소스를 사용한 fake DOM 키이벤트 18/18 PASS, exit 0**. 경계 순환·외부 초점·단일 버튼·내부 native 유지·수정키 및 다른 키 무간섭·닫힌 모달·제외 대상·빈 목록을 확인했습니다. 추가 fake DOM 검사는 불필요하다는 PM 후속 메시지 도착 직전에 실행됐으며 이후 추가 시험은 하지 않았습니다.
- 정적 diff 검증: 삽입 블록을 제외한 원래 main 내용 전체 바이트 동일.

수정 전 SHA256: `521cd45dbfdeeaf9e70541e021bbfb7e5ec61df8365e930e35e52d930f9b1e0b`.

수정 후 SHA256: `85265822d376435e1db56aa7a827fb2d299f1a21c33dc840b0142e485c442063`.

증거는 `artifacts/g028-builder15/fix-focus-20261101-113649/`의 `main.before.mjs`, `main.after.mjs`, `diff.txt`, `verify-focus.mjs`, `verification.log`, `results.json`입니다. 원본 main·이전 빌드·QA 원FAIL을 덮어쓰지 않았습니다.

**실제브라우저·서버·새 빌드·전체 단위시험은 실행하지 않았습니다.** fake DOM 결과는 native dialog 실제 포커스 검증을 대체하지 않습니다. 다음 단계는 PM의 새 후보 및 QA15가 실제 trusted Tab/ShiftTab 경계, Enter/Space/repeat/Esc와 실제 트리거 복귀를 재검증하는 것입니다. 제품 소스는 다시 동결했습니다.
