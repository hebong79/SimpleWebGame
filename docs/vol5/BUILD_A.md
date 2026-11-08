# G035-A · 81~85 구현 인계

- 작성: 2026-11-08 21:05 KST. 역할 builder, 최종 PM 수용/운영 완료 선언이 아닙니다.
- 상태: 제품 동결, 독립 QA 대기. 지정 5폴더의 제품 20파일, 자체 테스트 1파일 작성. 공유 셸/홈/상태/운영/Git/보드/설치는 변경하지 않았습니다.
- 원안 81~85 전체, 공통 제작 사양, gallery-3 실제 이미지와 AGENTS/TEAM/project·필수 설계/백로그/결정/인계·PLAN을 확인했습니다.

## 구현

| 게임 | 구현 및 수량 |
|---|---|
|81 오름내림 기록실|2~39 전체38장, 손패6, 시작1/1/40/40, ↑−10/↓+10만 역방향 특례, 덱 있을 때 최소2/없을 때1, 상한6 보충, 실제 최소 충족 가능성 탐색, 배치/턴 종료 undo, 잔여장 수 결과, 전체38장 승리|
|82 꽃인가 가시인가|로컬3인 꽃3/가시1, 전달 가림, 추가·입찰·영구 패스, 자기 더미 우선 공개, 꽃2회 성공/마지막 생존, 미사용 포함 소유카드 중 결정적 무작위 소실·탈락|
|83 칩 하나 아끼기|로컬3인 각8칩, 3~22 중4 비공개 제외/16장 사용, 받으면 칩도 획득·현재인 유지, 0칩 패스 금지, 연속 최소합−칩·동률|
|84 여섯째 짐칸|로컬3인 각6장, 고유1~40 중22장 배치, 네 시작줄, 비밀 동시 선택 후 오름차순 해결, 가장 가까운 작은 줄, 여섯째 회수, 최저 카드의 줄 선택, 6턴·동률|
|85 움직이는 박물관|5×5 고정판3, 9고정칸/홀수 인덱스1·3의 가로세로만 밀기, 회전 가능한 L형 남는 타일, 양 포트 BFS, 직전 역밀기 금지, 말 래핑/보물 이동, 두 사람 각2개 순서 수집·귀환, 제자리 이동, 모자·가방|

81~84 테마 문턱은 원안 미지정으로 PM이 확정한 자체 2/5회 완료입니다. 85는 원안 그대로 3판 완료 야간 탐험·6판 완료 지도 조사입니다. 85 진영은 색과 ▲/●/1P·2P로 유지하며 모자·가방만 바뀝니다. 각 게임은 mount id=폴더명, `simplegames.vol5.<폴더명>.v1` 저장키를 사용합니다.

## 엔진 계약과 비공개 경계

- 모든 engine.mjs는 DOM/저장/타이머 의존성이 없는 상태 생성·유효 행동 검증 모듈입니다. 행동은 성공 시 상태를 원자적으로 바꾸고 true, 불법이면 false를 반환합니다. 단,84의 resolve는 이미 공개된 큐를 자동 해결하는 내부 단계입니다.
- 81: create/place/endTurn/legal/minimum/canMeetMinimum/snapshot. total은 실제 배치 장 수이며 결과 점수도 이를 사용합니다. 남은 장 수는 38−배치 장 수입니다.
- 82: create/place/bid/pass/reveal/nextRound/available/snapshot. cards는 소유 패 전체, stack은 이번 라운드 비공개 적층입니다. 공개 snapshot에는 장수·공개된 카드만 포함합니다.
- 83: create/take/pass/penalty/snapshot. 공개 상태는 공개 카드·칩·각인 회수카드·남은 장수만 포함하고 deck/removed를 제외합니다.
- 84: create/choose/chooseRow/nextTurn/target/value/snapshot. phase=choose 동안 choices는 선택 여부만 공개하며 hand/미공개 카드 값은 snapshot에 넣지 않습니다. 셋 모두 선택한 뒤 공개한 카드만 순서 해결합니다.
- 85: create/rotate/push/reachable/move/validateBoards/snapshot. BOARDS에는 불변 포트/보물 위치 3세트, FIXED에는 고정9칸이 있습니다. push→move 한 번씩만 허용하고 서로 마주 보는 포트만 통과합니다.
- UI는 필요할 때만 렌더합니다. RAF tick으로 DOM을 재할당하지 않습니다. 82/84는 turn/pause/blur 때 앞면 DOM을 제거하고 다음 사람의 명시적 전달 확인을 기다립니다. 쌓인 패/덱/제외/미확정 선택을 aria/data/debug에 넣지 않습니다.
- 버튼은44px 이상,320px 문서 가로 넘침 없음, native select/인라인 스크립트 없음. Tab·Enter·Esc,85 방향키 초점 이동을 지원합니다. 재시작/고정판 변경은 공유 셸 확인을 거칩니다.

## 실제 검증

| 구분 | 실제 결과 | 증거 |
|---|---:|---|
|엔진 자동 테스트|35/35 PASS|artifacts/g035-a/engine-tests.txt|
|PC Chromium·320px mobile Chromium·320px mobile WebKit 최종 smoke|237/237 단언,15/15 세션 PASS|artifacts/g035-a/browser-results.json|
|PC5게임 실제 입력 완주·재대결, Chromium/WebKit 손상·변조·해금 복원|65/65 PASS|artifacts/g035-a/storage-play-results.json|
|320px 키보드 입력·저장 쓰기 차단 fallback|31/31 PASS|artifacts/g035-a/keyboard-storage-results.json|
|최종 엔진/UI 10모듈 문법 검사|모두 exit0|아래 명령|
|고정 덱/판 실제 승리 입력열|81 전체38장,85 판3개 모두2보물+귀환 replay PASS|tests/games/vol5-a.test.mjs 안에 자체 포함, artifacts/g035-a/solutions.json|

합계: 엔진35 + 브라우저333 = **368 검사 PASS**. 브라우저는 가상 시계를 사용하지 않고 trusted click/key 80ms 누름을 사용했습니다. 최종15세션에서 콘솔·pageerror·실패 요청·CSP 오류0이며 오류 필터는 사용하지 않았습니다. WebKit 기능/CSP 실행 중 screenshot은 호출하지 않았습니다.

초기 추가 완주 검사에서는82 다음 라운드의 입찰 UI가 이전 제안값2를 유지하여 `1장 입찰`을 찾는 검사가 실패했습니다. 새 라운드 제안값을 최소1로 초기화해 수정했고 전체 추가 검사65개와 최종3브라우저237개를 재실행했습니다. 최초 결과는 storage-play-results-first.json으로 보존했습니다.

실제 명령(프로젝트 루트):

```powershell
node --test tests/games/vol5-a.test.mjs
node artifacts/g035-a/solve.mjs
node artifacts/g035-a/smoke.mjs
node artifacts/g035-a/storage-play.mjs
node artifacts/g035-a/keyboard-storage.mjs
node artifacts/g035-a/manifest.mjs
```

각 smoke는 기존 G034 createGameServer를 읽기 전용으로 가져와 현재 public을 임시 loopback 포트에서 제공합니다. 종료 시 브라우저와 임시 서버를 닫습니다. 운영15010/PM2는 접근·변경하지 않았습니다. 각 폴더 engine.mjs/main.mjs에 `node --check`를 실행했습니다.

## 산출물·자산·한계

- 제품: `public/games/{81-the-game,82-skull,83-no-thanks,84-six-nimmt,85-labyrinth}/{index.html,style.css,engine.mjs,main.mjs}`.
- 회귀: tests/games/vol5-a.test.mjs. 승리 replay는 테스트 본문에 포함되어 artifacts 파일 없이 실행할 수 있습니다.
- 고정 데이터/제품 SHA256과 실제 시각: artifacts/g035-a/manifest.json (제품20+테스트1).
- 화면: artifacts/g035-a/*-active.png. Chromium의 진행 중 화면을 실제 열어82 가리개·85 통로/말/보물/모자·가방을 시각 확인했습니다. 초기 *-pc.png는 정지 화면입니다.
- 자산: 직접 작성한 CSS 도형·문양·플레이어 표식과 시스템 글꼴 기호입니다. 원안 이미지는 관찰만 했으며 외부 그림·원작 소스·음원·원격 폰트·패키지를 제품에 복제/도입하지 않았습니다. 별도 외부 자산 라이선스 대상은 없습니다.
- 구분: 자동화 브라우저 플레이와 시각 확인 완료. 실제 사람3인 심리전/플레이 시간·난이도·물리 모바일/실청취·전체 프로젝트 빌드·기존게임 회귀·독립QA·홈 통합·운영은 미검증/PM 후속입니다. 예상3~8분 체감 시간을 검증했다고 주장하지 않습니다.
- 다음: 비작성자 독립QA → PM 인수/홈등록 → 새 후보 빌드·회귀 → 사용자 승인 범위 내 운영 절차. 작업일지/공유HANDOFF/게시판 요약은 PM 소유권으로 넘깁니다.
