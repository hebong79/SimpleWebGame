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
