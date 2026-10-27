# G022 7·8번 제작 중간결과 — 7번 승인 대기 / 8번 독립수용 / 3116 미반영

- 작성 시각: 2026-10-27T02:46:13.890713+09:00
- **전체 요청 상태: 부분 진행·차단. 게임 두 개 제작/병합/재기동/3116 동작시험 완료가 아닙니다.**
- PM: 대현자. 설계·디자인·작업계약·검수·상태/승인된Git·운영 담당. 제품·공통 소스/시험/배포설정 구현은 워커 담당.

## 요청과 승인 범위
7·8번을 PM이 설계·디자인하고 게임별 브랜치로 제작, 완료 후 main 병합·게임 서버 재기동, 반드시 기존 3116에서 실제 동작시험. 다른 서비스/방화벽/자격증명·전역 권한 변경·이전 승인중단 Git 정리/푸시는 범위 밖입니다.

## 결과 요약
| 항목 | 확인한 상태 |
|---|---|
| PM 설계·디자인 | 사막 우체부/구름 토끼 상세 규칙·저장·해금·입력·수용 계약, 자체 SVG82/53심벌·13자세 시안. Chromium PC/375/320폭 오류·넘침0/버튼44px 확인. 시안은 실제 게임이 아닙니다. |
| 07 사막 우체부 | feature/g022-07-dino, 공통기준563f2ac. 첫폴더생성/PM SVG복사 승인시간초과로 중단. 게임 파일·신규 커밋 없음. 재개 질문도 무응답 시간초과, 명시재승인 전 재시도/다른 도구·워커 우회 없음. |
| 08 구름 토끼 | feature/g022-08-doodle. 초기75112d5, 수정source a04b1d04e4e67e3ed239f730b6b6267081eeac0c, 최종HEAD18afb7533ca515224056774523b126834114bda7. 독립08 코드·delta수용 완료, 통합/운영수용은 별도입니다. |
| 공통 통합 코드 | feature/g022-eight-game-release에서 초안 인수·워커 보완/08 수용E2E26사례·구성/보호launcher 작성. PM자기입력22/기존증거483개 SHA확인 및엄격E2E/config타입검사exit0. 아직미커밋. |
| 통합 실행 | 전제미충족 BLOCKED. 후보144/실서버102는 목록수집 개수, 실제통합브라우저실행0. 07실제라이프사이클시험도후속필수입니다. |
| main/재기동 | 신규게임 런타임의 main 병합·PM2 재기동·원격push 미수행. main은설계기준563f2ac. |
| 실제3116 | 2026-10-27T02:41:16.760087+09:00 읽기확인: 기존홈35/플레이6/준비29. 기존6게임+홈HTTP200, 신규07·08주소각404. **새게임의3116동작시험미완료.** |

## 08 구현과 독립 검증
- 360×640 자동반동·좌우조작·정확한하강접촉/이동발판·카메라상승·최고높이점수·기록·옷장·정지/재개·입력보호. 기본무음·엄격CSP 유지,외부게임엔진/의존/원작아트추가0.
- 최초구현 자체단위38/38에도 독립QA가 불가능한 최고/누적저장 통계 수용과 모바일WebKit 도움말Escape 초점복귀 두 결함을 발견해 FAIL 처리했습니다. 원본FAIL은보존했습니다.
- 수정워커만save/main/전용unit과새fixdoc를수정했습니다. 최고판을분리한 정확한BigInt 이력가능성검사와 실제모달트리거/유효외부복귀대상을구현했습니다. PM은직접제품코드를고치지않았습니다.
- PM수정본재실행단위42/42 exit0. fresh독립검토도42/42·기존독립15/15,가능성후보118010개불일치0,실제HTTP수용69/69. 154개입력/증거SHA와현재HEAD/Gitblob을PM이직접확인했습니다.
- fresh수용69는최초60+깨끗한native-close9입니다. 보조WebKit PNG의도구스타일삽입이일으킨CSP실패1회는원본보존·구분하고PASS에포함하지않았습니다. 제품/보안정책/진단단언을완화하지않았습니다.
- 불변엔진/HTML/CSS/원본아트·원본QA/기존builder·수정증거해시를보존했습니다. 같은입력을반복재실행해실패를숨기지않았습니다. 임시테스트서버는각워커가정상종료,PM시안3128서버도별도종료/포트거부확인했습니다.

## 브랜치와 산출물
- 공통설계/main:563f2ac97a93bf0ef6a99d11630384d86f41790d.
- 07 worktree:E:/Work2/Project/SimpleGames/worktrees/g022-07-dino (명시승인대기).
- 08 worktree:E:/Work2/Project/SimpleGames/worktrees/g022-08-doodle, branch feature/g022-08-doodle/HEAD18afb7533ca515224056774523b126834114bda7.
- 통합branch:feature/g022-eight-game-release,공통변경/문서는미커밋보존. 관련없는기존untracked·과거증거는선별대상에서제외했습니다.
- 설계:docs/G022_COMMON_CONTRACT.md,G022_07_DESIGN.md,G022_08_DESIGN.md,docs/g022-design/.
- 08 인수:자기worktree/docs/G022_08_IMPLEMENTATION.md,G022_08_FIX.md.
- 원본FAIL:자기worktree/artifacts/g022-review08/review.json;수정:artifacts/g022-fix08/handoff.json;fresh PASS:artifacts/g022-fresh08/review.json.
- 통합:root/artifacts/g022-integration/{handoff.json,README.md}. 검사명령은README에기록되어있으며수집전용을실행PASS로오인하지않습니다.
- PM검증:root/artifacts/g022-pm/{intake-08.json,review08-intake.json,fix08-intake.json,integration-intake.json,fresh08-acceptance-and-production-status.json}.

## 남은 작업 / 재개 조건
1. **사용자의07지정worktree 내 파일작성·PM아트복사·시험·개별브랜치커밋 재개 명시승인.** 전역승인해제나다른게임/이전Git차단의승인이아닙니다.
2. 07개발워커 재배정→구현/자체시험→실제DOM/API기반07라이프사이클E2E→독립검토.
3. 통합워커가각인수본의공통연결/시험을완성하고루트후보/새g022-build를준비. 실제HTTP조기80ms·CSP/PC·모바일/기존6회귀와전체단위·독립공통검토.
4. 검증된각게임branch를포함한변경을main에정상병합,구g019-build/다른앱보존후number-garden-2048 한앱만3116 전환/재기동.
5. actual script/PID/LISTEN/loopback·LAN응답바이트→사용자주소8카드→새두게임정상입력/득점/정지·재개/기록/홈복귀 확인후전체완료보고.
현재실행중인개발·QA워커는없으며,승인대기작업을자동재시도하는데몬/감시서비스는설치하지않았습니다.

## 한계
브라우저는PC/모바일에뮬레이션입니다. 실물Android/iPhone·실청취·사람의실제플레이시간/수동완주·WebKit진짜손가락스크롤은미검증입니다. 독립08 PASS를전체게임컬렉션수용또는3116운영성공으로확대하지않습니다.

## 첨부 안내와 게시 검증
설계ZIP은설계용원본과시안,08 ZIP은소스/시험/인수·검증자료묶음입니다. **07구현이나완성된8게임서버배포패키지가아닙니다.** 파일만열어3116운영검증을대체할수없습니다.
실제보드게시ID·본문readback·첨부다운로드해시는별도 root/artifacts/g022-pm/board-publication.json에저장합니다. 게시실패시기본Doc/board_pending에미게시초안을보존합니다.
