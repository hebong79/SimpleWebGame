# 코디 02 · 대현자 PM 전용 워커

- 관리용 ID: **cody-02** / 이름: **코디 02** / PM: **대현자**
- 이 폴더는 현재 VS Code가 연 프로젝트 `E:/Work2/Project/SimpleGames/01-2048` 안에 있습니다.
- 모델: `gpt-6.1-sol`. 기존 Codex CLI 인증을 사용하며, 인증정보를 이 폴더로 복사하지 않습니다.
- 기존 코디 대화와는 **다른 새 Codex 세션**을 사용합니다. 기존 코디 세션에 접속하거나 잠금을 해제하지 않습니다.

## VS Code에서 확인

탐색기에서 `workers → cody-02`를 펼칩니다.

| 파일 | 내용 |
|---|---|
| `STATUS.md` | 실제 상태, 최근 작업, 세션 ID, 결과 위치. 실행기가 갱신합니다. |
| `LATEST.log` | 최근 작업의 실행 이벤트. 실제 실행 시 생성됩니다. |
| `state.json` | 실행기가 관리하는 세션 연결·작업 상태. 수동 변경하지 않습니다. |
| `runs/` | 작업별 요청, 실제 출력, 오류 로그, 최종 응답·결과 |
| `requests/next-task.md` | PM이 다음 작업 지시를 기록하는 입력 파일 |
| `verification/` | PM의 실제 연결·회귀 검증 증거 |

메뉴 **터미널 → 작업 실행…**에서 다음 항목을 선택할 수 있습니다.
- **cody-02: 상태 보기**: 모델 호출 없이 상태 확인.
- **cody-02: 연결 시험 (모델 사용량 발생)**: 실제 모델 호출로 확인.
- **cody-02: PM 작업 실행 (읽기 전용)**: 지정한 프로젝트 내 Markdown을 작업 지시로 전달.

이는 프로젝트 실행기와 VS Code Tasks 연동입니다. Codex 확장의 채팅 목록에 직원을 자동 추가하는 확장 기능이 아닙니다. 관찰할 때는 위 상태·로그 파일을 사용합니다. 같은 실행 세션을 다른 앱에서 동시에 열어 writer를 점유하면 다음 PM 작업이 막힐 수 있습니다.

## 대현자가 사용하는 명령

프로젝트 루트에서:
```sh
node workers/cody-02/worker.mjs status
node workers/cody-02/worker.mjs smoke
node workers/cody-02/worker.mjs run --task workers/cody-02/requests/next-task.md
```

기본은 읽기 전용입니다. PM이 작업 범위와 변경 파일을 승인한 구현 작업에만 다음처럼 쓰기 권한을 명시합니다.
```sh
node workers/cody-02/worker.mjs run --task workers/cody-02/requests/next-task.md --allow-write
```

`--allow-write`는 `workspace-write` 선택이며 모든 제한을 해제하는 옵션이 아닙니다. 허용 파일 목록은 작업 지시에도 적어야 하며, 파일별 허용 목록은 운영 규칙이지 OS 강제 보안 격리가 아닙니다. 같은 파일을 기존 코디와 동시에 수정하지 않습니다.

## 운영 범위

- 워커는 **요청할 때만 실행**되고, 작업을 마치면 종료합니다. 부팅 자동 실행·무한 대기·자동 재시도·웹 서버는 설치하지 않습니다.
- CLI 실행기 자체는 상태와 로그를 이 폴더에 씁니다. Codex의 기본 파일 작업 권한은 read-only입니다.
- 실제 모델 작업은 ChatGPT/Codex 사용량을 소비하며 무료·무제한을 보장하지 않습니다.
- 상태가 `설정만 완료`/`미연결`이면 실제 모델 연결 성공이 아닙니다. 연결 완료 여부는 `STATUS.md`와 `verification/`의 실제 결과를 기준으로 확인합니다.
- 비밀번호·토큰·인증 파일을 요청문이나 로그에 넣지 않습니다. 프로젝트 밖 파일이나 개인 계정 자료를 읽으라고 지시하지 않습니다.
- 사용자의 새 작업은 대현자에게 요청하는 방식을 권장합니다. VS Code에서 수동으로 실행할 수도 있지만 PM이 동시에 작업을 보낸 상태라면 중복 실행하지 않습니다.

## 설치 검증 완료 — 2026-10-24

- 실제 새 세션 생성과 정확한 UUID 재개를 검증했습니다. 로그 처리 수정 후에도 연결 시험과 후속 요청을 다시 실행했고, 직전 challenge를 기억한 응답을 받았습니다.
- 단위·회귀 테스트 **31/31**, 독립 최종 QA **PASS**입니다. 최초 QA 실패 보고서는 덮어쓰지 않고 보존했습니다.
- 실제 연결 증거: `verification/live-connection.json`, `verification/after-fix-live-connection.json`.
- 독립 QA: `verification/QA_REVIEW_FINAL.json`. PM 테스트 출력: `verification/final-unit-tests.log`.
- 현재 `succeeded`는 **마지막 요청이 성공했다는 뜻**입니다. 상시 실행 프로세스가 아니며, 다음 PM 요청이 오면 같은 전용 세션을 재개합니다.
- 실제 게임 파일을 수정하는 업무는 아직 배정하지 않았습니다. GUI 작업 메뉴 클릭과 네이티브 프로세스 트리 종료는 별도 실측하지 않았습니다.

## 공식 참고

- Codex 비대화형 실행: https://developers.openai.com/codex/noninteractive/
- VS Code Tasks: https://code.visualstudio.com/docs/debugtest/tasks
