# G022 공통 제작·분기·수용 계약 — PM 대현자

## 목표/승인/역할
사용자 요청:7·8번을 PM이 설계·디자인하고 제작, **게임별 독립 브랜치**, 완료 후 main 병합/해당3116 재기동 및 실제운영 동작검사. 기존 Node24/TS/독립 ES modules·원본 직접제작 SVG·외부 의존성0 유지. 원안폴더 읽기전용.
PM은 설계/아트/공통홈/운영/마감을 소유합니다. 각 builder는 자기 worktree의 자기 게임폴더·전용단위1개·인수문서1개·새증거만 씁니다. 기존게임/공통/서버/기타문서 변경금지. 독립 QA는 구현자가 아닙니다. 과거승인중단된Git프로세스정리/원격push는 이번 작업으로 재개하지 않습니다.

## 두 구현 브랜치와 파일
- feature/g022-07-dino: public/games/07-dino/**, tests/games/07-dino.test.mjs, docs/G022_07_IMPLEMENTATION.md, artifacts/g022-07-builder/**.
- feature/g022-08-doodle: public/games/08-doodle/**, tests/games/08-doodle.test.mjs, docs/G022_08_IMPLEMENTATION.md, artifacts/g022-08-builder/**.
- worktree마다 Node builtin 단위시험을 실행. 설치·네트워크·재위임·다른프로세스중단·main병합/push/PM2변경 금지. 설치된 Git은 C:/Program Files/Git/cmd/git.exe 를 명시하며, 자기 allowlist만 stage/check/commit 허용. commit 직전 staged목록/EOF확인, 결과 SHA/브랜치/작업폴더/명령exit를 인수.
- PM은 기존35ID를 보존하고 desert-post→/games/07-dino/index.html, cloud-bunny→/games/08-doodle/index.html를 새카드로 추가해37/플레이8/준비29로 통합합니다. 기존유사placeholder를바꾸지않습니다.

## 공통 런타임/UI
각폴더 index.html/styles.css/engine.mjs/save.mjs/main.mjs/assets/kit.svg. 다른게임 runtime import 금지. SVG DOM scene 권장(외부kit symbol의 same-origin use), Canvas선택시원본SVG의정상렌더검사필수. 실제물리engine은Node에서독립실행, snapshot은복사본. main의선택적getSnapshot()은깊은읽기복사본만, setter/강제승리/가짜route/숨은치트 금지.
준비→명시시작→playing→paused/result. 초기 ready는RNG/기록소비0. 메뉴/도움말/옷장/종료확인은정지하고닫아도명시재개. 재시작/홈은진행판정지→확인취소는paused유지→확인은quit정산1회후ready/같은origin홈. 자연결과의재도전은ready로돌아가명시시작해도되고즉시명시시작해도되나새누름1회만허용.
HTML 버튼/링크44px이상·초점표시·native dialog의visible/enabled Tab순환·Escape취소·초점복귀. native select 대신 button groups. 입력은game-area초점에서만방향/Space/P/Esc, Ctrl/Alt/Meta·OSrepeat무시. 버튼 Enter/Space 반복keydown의기본합성click을막고최초입력만반영. pointerdown/up/cancel/move로hold관리, 페이지전역추가손가락은보호정지·상태정리,보드밖스크롤은허용. blur/hidden/pagehide 및RAF간격250ms초과는보호정지,자동재개금지. 보이는상태·점수버튼문구는변경시에만textContent갱신(매RAF재대입금지).
고정1/120초 accumulator, 실제활성시간만소비, pause/ready/result는시간/RNG/입력효과0. engine의advance는분할시간과장시간동치. 남은dt는정확히처리/충돌시점에끝내며 UI지연프레임보호와순수engine시간분할을구분.
기본mute=true, 제스처후WebAudio합성음시도/실패시무음지속,정지/숨김때stop. reduced-motion은장식만정지,physics불변.

## 저장/코스튬
07 key simplegames.dino.v1,08 key simplegames.doodle.v1.
스키마 version1,bestScore,totalScore,bestMetric,totalMetric,plays,losses,quits,unlockedSets,equipped,muted. metric은07=한판이동거리floor(px),08=한판최고상승높이floor(px),score=floor(metric/10). bestScore=floor(bestMetric/10),bestMetric≤totalMetric,bestScore≤totalScore,plays=losses+quits,0판은통계0. 종료합/곱과상한은필요시BigInt로검사하고모든수치는유한비음수안전정수.
결과확정만정산:충돌/낙하loss 또는quit, round당한번. 준비/시작/중간점수/메뉴/음소거/옷장/결과재표시에서는누적하지않습니다. 한필드라도MAX_SAFE를 넘으면 전체통계/소유를 이전값으로 보존하고 그결과 재시도0·그세션 추가누적 중단,설정변경은기존유효통계로가능. 실제판결과는그대로표시하고'누적기록 상한에 도달해 이번 기록은 합산되지 않았습니다'지속경고.
정상null은경고/자동쓰기0,손상JSON/구버전/잘못된통계는안전복구경고. getter/getItem/setItem각예외때메모리플레이/지속저장차단안내. 전용키만get/set, clear/removeItem/다른키쓰기금지. 진행판reload복원제외.
해금은완료된best/totalScore에서재계산,부위/소유/타입검증,잠긴항목은미리보기만·apply거부. 부위별none+3세트(07postal기본소유),전체세트/부위조합·동작미리보기·취소미저장·적용1회저장. 의상은physics/score/충돌불변.

## PM 디자인 시스템/레이아웃
기존작은쉼표의크림 #f6f3e9/잉크 #284d3b,Segoe UI/Malgun Gothic(한국어가독성을위한의도적기존타입),본문14px/부가12px,PC제목32/모바일24. 1100px폭·PC game+280px사이드바·모바일단일열. navigation←작은쉼표/mute,제목·짧은부제,HUD(score/best/state),중앙scene+overlay,하단조작,기록·옷장·도움말. primary녹색/07황토 #b95d3c·08하늘 #527e9a. 강한그라데이션/유리효과/장식hero없음. 실제0점출발/시안툴바출하금지. 320/375/가로667과1366px,44px모든버튼/links,넘침0·모달스크롤/safe-area.
PM자산 docs/g022-design/07-kit.svg 및08-kit.svg는본프로젝트직접제작. 자기폴더assets/kit.svg로복사하고논리발기준/레이어 bag→base→body→head→face정렬. 외부원작이미지/GIF/Google/LimaSky브랜드는출하하지않습니다.

## 공통 수용(각게임 적용)
AC01 준비/시작/자연결과/재도전. AC02 엔진핵심규칙. AC03 30/60/120FPS동치. AC04 pause/blur/longframe시간0·hold정리. AC05 PC입력/초점/OSrepeat. AC06 실제80ms버튼누름/모바일hold. AC07 다중터치/cancel/보드밖스크롤. AC08 메뉴/확인/취소/홈quit1회. AC09 결과당저장1회/reload지속. AC10 각Storage예외/손상/상한. AC11 해금정확경계/조합/잠김차단/취소. AC12 동작별원본아트/외형불변. AC13 PC·320/375/667레이아웃/44px/초점/모달. AC14 mute/API실패/reducedmotion. AC15 로컬자산/엄격CSP/무필터console/페이지/자산실패0. AC16 전용key분리/기존6회귀. AC17 게임별브랜치독립커밋/main정상병합. AC18 실제3116의신규8카드/정상조작·HTTP바이트/script/PID/LISTEN검증.
자체unit/소스fulfill검사는실제HTTP·운영·실물수용과구분. 설치/권한우회/보안완화/시험skip로PASS금지. 동일결함수정2회실패시멈춰PM보고. PM은새후보디렉터리/과거증거보호·정확service만재기동·실제3116검사후마감/게시합니다.
