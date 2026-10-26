# 숫자 정원 · 2048: project rules

- Project ID: 01-2048
- Read `.game-team/TEAM.md` and `.game-team/project.json` first.
- PM is 대현자. Use on-demand planner, builder and qa workers; no persistent Bot is required.
- Before work, read docs/GAME_DESIGN.md, BACKLOG.md, DECISIONS.md and HANDOFF.md.
- Work only in this project and assigned paths. This is a workflow boundary, not an OS sandbox.
- Workers receive an explicit goal, project root, allowed write paths, artifacts and acceptance criteria.
- PM alone integrates results and changes final task status. Never edit the same file concurrently.
- Keep engine scenes/settings/metadata under a single owner per task.
- Verify actual files and test outputs. A worker saying "done" is not completion evidence.
- Distinguish automated tests, engine builds, visual inspection and manual playtests.
- Ask before deletion, payment, publishing/deployment, installation requiring elevation, or production changes.
- Do not choose/install an engine or buy assets merely because the project scaffold exists.
- Record asset licenses. Do not record secrets in documents or logs.
- Finish sessions with tested run commands, blockers and next steps in docs/HANDOFF.md.
- 작업 완료 시 한국 시간(Asia/Seoul)을 기준으로 `docs/worklogs/yyyyMMdd-HHmmSS_아름.md` 형식의 Markdown 요약 파일을 저장합니다. 날짜·시각 부분은 실제 숫자로 치환하고 끝의 `아름`은 사용자 지정 문자열 그대로 사용합니다. 작업 내용, 실제 검증 결과, 산출물, 제한 사항과 다음 작업을 짧게 기록하고 최종 답변에 파일 링크를 제공합니다. 기존 기록은 덮어쓰지 않습니다. 게시판 완료 요약 등록도 함께 유지합니다.
- When work is complete, publish a concise Korean work summary to http://localhost:18787/ as requested by the user on 2026-10-23. Include changes, actual verification, limitations and next steps. Read back the created post and record its ID/link in docs/HANDOFF.md. Avoid duplicate posts; do not include secrets. This authorizes completion summaries, not game deployment.
- Shared team updates are NOT silently applied: compare and explicitly update the local TEAM snapshot.
- Engine: Node.js 24.16.0 + TypeScript, HTML DOM/CSS; target: PC browser + mobile touch browser. Unknown values must be resolved before engine-specific implementation.

## 운영 반영 완료 기준 (G020)

- 일반적인 게임 제작/추가의 최종 목표는 기존 실사용 `http://192.168.0.195:3116/`에서 새 게임이 즉시 선택·실행되는 상태입니다. 설계/개발 지시만 요청한 작업은 그 단계 완료와 운영 미반영을 구분합니다.
- 구현자 ACK/자체 단위 PASS에서 전체 작업을 닫지 않습니다. PM은 배정 때 구현 인수→홈 등록→새 빌드/독립QA→승인된 Git/운영 반영→실제3116 실행 확인을 후속 일감과 의존성으로 함께 등록합니다.
- CLI exit0/PM2 online/후보 빌드 검사는 운영 반영 증거가 아닙니다. 실제 PM2 script/PID/LISTEN·HTTP 바이트·사용자 주소의 카드 클릭/시작/입력/정지/홈 복귀를 확인한 뒤에만 운영 완료로 보고합니다.
- 실제 시계의80ms trusted 누름과 모바일 WebKit/CSP 검사를 초기 smoke에 넣습니다. 가상시계/순간 클릭만으로 실제 입력을 대신하지 않습니다.
- 구체 절차는 `docs/G020_RELEASE_COMPLETION_CHECKLIST.md`를 따릅니다. 기존 운영 변경 승인·단일 앱 범위·과거 증거/기록 보존 규칙은 그대로 유지하며, 상주 감시/자동 배포가 설치됐다고 주장하지 않습니다.
