# G-008 최종 독립 QA — G-007 수정 코드 검토

## PM 후속 해결 확인 — G-009

아래 판정은 G-007에 대한 **수정 전 정적 검토 기록**입니다. PM이 `hybrid-input.spec.ts`로 세 브라우저에서 추가 이동(2회)을 실제 재현한 뒤 G-009이 전역 capture pointerdown의 enabled 조기반환 한 줄만 제거했습니다. PM은 추가 포인터 관찰과 보드 새제스처 허용 검사가 분리된 코드를 직접 재검토했으며 추가적인 구조 변경이 없음을 확인했습니다.

이후 실제 타입/빌드/단위44개, 기존54개+추가회귀3개=브라우저57개 전체가 통과했습니다. G008-001은 해결 처리합니다. 이는 원래 독립 worker가 통과로 판정했다고 바꾸는 것이 아니라, 발견→재현→최소수정→PM회귀의 후속 기록입니다. 증거: `docs/FIX_REPORT_2.md`, `artifacts/pm/hybrid-before.log`, `artifacts/pm/e2e-final.log`, `artifacts/pm/final-verification.json`.

## 원래 독립 판정 (수정 전)

**수용 보류입니다.** QA-001의 기본 재현 경로와 QA-002의 Tab 경계 처리는 코드상 해결되었으나, 입력 잠금 중 추가 포인터를 누락하는 정적 논리 결함 1건이 남습니다. 이번 작업은 코드 검토만 수행했습니다. 실제 런타임 테스트는 **PM 검증 대기**이며, 기존 단위테스트나 54건 브라우저 전체 회귀의 통과를 이 보고서에서 주장하지 않습니다.

## 검토 범위 및 근거

- 제품 검토: `src/client/input.ts`, `src/client/main.ts`의 G-007 포인터 감시/모달 Tab 수정 및 인접 호출 경로입니다.
- 요구사항: `docs/GAME_DESIGN.md:59-70,111-112`, `docs/TECHNICAL_DESIGN.md:87-111`입니다.
- 원래 결함/수정 설명: `docs/QA_REPORT.md:44-64`, `docs/FIX_REPORT.md:10-22`입니다.
- 기존 회귀 소스: `tests/e2e/independent-qa.spec.ts:72-85,186-204,243-268,277-290`을 읽었습니다. 실행하지 않았습니다.
- 모달 DOM 맥락만 `public/index.html:48`에서 추가 확인했습니다. 제품/테스트/설계는 수정하지 않았습니다.
- 저장소에 `.git`이 없어 `git status`가 실패했습니다. Git diff/원본 대비 변경 이력을 검증했다고 주장하지 않습니다. 제공된 G-007 보고서와 현재 소스의 해당 구간을 대조했습니다.

## 차단 결함 G008-001 — 잠금 중 추가 포인터 감시 누락

- **분류/심각도:** 입력 논리 / 중간. QA-001의 불완전한 수정이며, AC-I04 단일 포인터·다중 터치 무효 계약에 어긋납니다.
- **위치:** `src/client/input.ts:31-34`의 전역 pointerdown이 `options.enabled()`가 false이면 포인터 등록과 제스처 무효화를 모두 생략합니다. 연결 근거는 `src/client/main.ts:32-34,171-185`입니다. 활성 터치가 있어도 방향키 유효 이동을 막지 않으며, 이동 피드백의 `locked=true`는 `enabled=false`를 만듭니다.
- **정적 재현 절차(브라우저 미실행):** 감소된 모션이 꺼진 터치+키보드 환경에서 새 판을 시작합니다. 첫 손가락 A를 보드에 누른 채 유지합니다. 보드에 초점이 있으므로 방향키로 유효 이동을 1회 만듭니다. 120ms 피드백 잠금 중 두 번째 손가락 B를 보드 밖에 누르고 계속 유지합니다. 잠금이 끝난 뒤 A를 오른쪽으로 24px 이상 움직여 놓습니다. B는 아직 누른 상태입니다. 처음 보드의 첫 행이 `[2,2,0,0]`인 상황이라면 방향키 아래 이동 후 오른쪽 스와이프도 유효 이동을 만들 수 있습니다.
- **기대:** B의 pointerdown에서 진행 제스처가 무효화되어 A의 pointerup은 이동을 발생시키지 않아야 합니다. 방향키로 이미 확정한 이동만 남아야 합니다.
- **코드상 실제:** B는 `input.ts:32`에서 반환되어 `pointers`에 추가되지 않고 `gesture/rejected`도 그대로입니다. 잠금이 풀린 뒤 A의 pointerup에서는 `current.id` 일치·`!rejected`·`enabled=true`가 모두 성립하므로 `input.ts:47-50`에서 스와이프 이동을 호출할 수 있습니다. 이 판정은 소스 경로 분석이며 실제 기기 재현을 주장하지 않습니다.
- **요청:** 제작자께서 게임 입력 허용 여부와 활성 제스처의 추가 포인터 감시를 분리하거나, 입력 잠금 진입 시 진행 제스처를 폐기하는 방식을 검토해 주십시오. 본 QA는 코드를 수정하지 않았습니다. PM 회귀에 이 혼합 입력 경로를 추가하는 것을 권장합니다.

## 나머지 체크 결과 — 정적 판정

| 확인 항목 | 코드 검토 결과 |
|---|---|
| 보드 밖 두 번째 포인터, 기존 QA-001 경로 | 입력이 계속 enabled인 동안 window capture에서 즉시 감지하며 `gesture=null/rejected=true`로 무효화합니다. document 대신 window를 사용하지만 페이지 내 이벤트 경로를 capture로 관찰하는 목적에 부합합니다. |
| 첫 포인터를 추가 포인터로 오인하지 않음 | capture에서 Set에 한 번 등록한 후 board에서 `size===1`을 확인합니다. 같은 ID는 중복 집계되지 않습니다. |
| 정상 단일 스와이프 | pointerup capture에서 판정 후 정리하므로 board 단계 이전 정리 때문에 정상 gesture가 소실되는 구조가 아닙니다. 임계값/우세 축 계산은 유지됩니다. |
| 다중 입력 해제·취소 | 일반 enabled 경로에서 모든 포인터가 끝나기 전 거부 상태가 유지됩니다. cancel/lostcapture는 gesture를 폐기하며 이동을 호출하지 않습니다. 위 잠금 누락은 별도 차단 결함입니다. |
| reset/destroy | reset은 gesture/held/pointers를 비우고 보드 capture를 해제합니다. destroy는 reset 후 AbortController로 window/board 리스너를 해제합니다. |
| 페이지 밖 조작 차단 여부 | 추가 전역 포인터 리스너에는 preventDefault/stopPropagation이 없습니다. 기존 보드 한정 contextmenu 차단 외에 페이지 클릭·스크롤 기본 동작 차단을 추가하지 않았습니다. 실제 스크롤 동작은 PM 검증 대기입니다. |
| visible/enabled tabbables | 매 Tab마다 DOM을 재조회하며 음수 tabindex, :disabled, hidden/inert 조상, 렌더링되지 않은 요소, visibility hidden/collapse를 제외합니다. 현재 모달이 생성하는 버튼 구성에 적합합니다. |
| 경계 wrap/단일 버튼 | 내부 중간 버튼의 기본 Tab 이동을 보존하고 첫/마지막 경계에서만 순환합니다. 버튼 하나면 Tab/Shift+Tab 양방향 모두 같은 버튼으로 돌아옵니다. 활성 요소가 후보 밖이면 내부 후보로 복구합니다. |
| 브라우저 단축키 | ctrl/alt/meta가 포함된 Tab은 즉시 반환하며 다른 키도 가로채지 않습니다. |
| Esc/returnFocus/DOM 교체 | cancel 처리 및 기존 복귀 코드를 변경하지 않았습니다. Tab 후보를 보관하지 않아 content.replaceChildren 이후 detached 버튼을 재사용하지 않습니다. 기존 generation 보호도 유지됩니다. |
| 보안·설계 경계 | 검토한 수정 경로에서 비밀 상수, 외부 전송, 동적 코드 실행, HTML 주입 또는 저장/엔진 경계 변경은 발견하지 못했습니다. 범용 보안 감사 결과는 아닙니다. |

## 구조화 결과

```json
{
  "task_id": "G-008",
  "passed": false,
  "security_concerns": [],
  "logic_errors": [
    {
      "id": "G008-001",
      "severity": "medium",
      "location": "src/client/input.ts:31-34,47-50; src/client/main.ts:32-34,171-185",
      "summary": "첫 터치 유지 중 방향키 유효 이동으로 입력 잠금에 진입하면, 잠금 중 보드 밖 두 번째 pointerdown이 누락되어 잠금 종료 뒤 첫 터치의 스와이프가 실행될 수 있습니다.",
      "verification": "정적 코드 경로 확인, 실제 런타임 테스트는 PM 검증 대기"
    }
  ],
  "suggestions": [
    "PM 전체 회귀와 별도로 터치 유지 + 방향키 이동 + 잠금 중 보드 밖 추가 터치의 혼합 입력 경로를 확인해 주십시오."
  ],
  "changed_files": ["docs/QA_FIX_REVIEW.md"],
  "evidence_paths": [
    "src/client/input.ts",
    "src/client/main.ts",
    "docs/QA_REPORT.md",
    "docs/FIX_REPORT.md",
    "docs/GAME_DESIGN.md",
    "docs/TECHNICAL_DESIGN.md",
    "tests/e2e/independent-qa.spec.ts",
    "public/index.html"
  ],
  "summary": "QA-002와 QA-001 기본 경로는 정적 적합하나 잠금 중 추가 포인터 감시 누락 1건으로 수용 보류입니다. 코드·테스트 수정 및 브라우저/e2e 실행 없이 보고서만 작성했습니다. 실제 런타임 테스트는 PM 검증 대기입니다."
}
```
