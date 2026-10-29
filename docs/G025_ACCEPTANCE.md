# G025 — 동결 후보 수용 기록

## 승인 범위와 구현
- 요청: 11/12를 개발설계·디자인 후 제작, 적절한 워커 배정, 게임마다 별도 동작·버그 테스터 실행.
- 사용자 추가 승인: **main 머지 후 기존3116 게임 서비스 반영·재기동**. 원격push·전체PM2 save/dump/시작항목·타서비스·방화벽·설치·결제·외부공개는 제외.
- 원안11 Mines → 보석 탐사 지도(`gem-survey`, `/games/11-mines/index.html`), 원안12 Fifteen → 숫자 우체통(`number-postbox`, `/games/12-fifteen/index.html`). 기존39 record·상대순서·즐겨찾기/10게임키를 보존하고41/12/29 구성, 신규두카드는 기본첫12에 노출.
- 설계: G025_PM_CONTRACT.md / G025_11_DESIGN.md / G025_12_DESIGN.md / G025_DESIGN_DECISIONS.md / G025_DESIGN_BOARD.html. 원안은 읽기전용이며 외부게임소스·이미지·폰트·런타임의존을 추가하지 않았습니다.
- PM은 설계·인수·검증·Git·승인운영 담당. 제작2명, 게임별 별도 QA 준비/실행 워커, 단일공통 통합owner 및 별도독립검토를 분리했습니다.

## 동결 소스와 독립 수용
- 11 제작 `e06bf91598860116e4516c5ffa01bec6a2d660fa`; 12 제작 `45455878f15010c54ee2cb808212ccdfb2d18882`.
- 마지막 공통·실행기 후보 `d268c96ec0b372d6c1de143b1930accfb123b46a`. 이후 수용보고서 commit은 문서만이며 manifest149 입력을 바꾸지 않습니다.
- QA11 자동화범위 PASS: 원본23단위·독립14단위·실제331 fixture에 독립oracle27797검사. 유효브라우저113/113. 계획100개는89수용/11환경부분검증. 최초하네스6FAIL과 관측전용3그룹을 숨기지 않았습니다.
- QA12 자동화범위 PASS: 원본42단위·독립15검사·66/66브라우저, 공개입력39완주. 계획100개는92수용/8부분검증. Node실행파일SHA의후반실측 한계와 캡처도구의CSP진단을 구분했습니다.
- 공통 core PASS(`G025_SHARED_CORE_REVIEW.json`)·3소스 delta PASS(`G025_SHARED_DELTA_REVIEW.json`)·snapshot1행수정의 독립 PASS(`G025_LAUNCHER_REVIEW.json`). PM이 보고서와 입력SHA482/42/71/19/1058을 각 인수시점에서 실제 대조했습니다. 변하지 않은 게임/코어의 이전 근거는 그 범위에서만 재사용합니다.

## 실제 후보 검증과 정직한 결과 결합
- 새 후보 비동결80ms trusted smoke **36/36**, 공개자산 **93/93** 바이트·CSP·nosniff 일치. 최초33/36은 기존memory-pieces가13번째가 된 테스트 전제 문제였으며 공개더보기 최소보완 후3프로젝트 모두 해결, 원본FAIL 보존.
- 전체 후보 브라우저 **228/228**(PC Chromium76/모바일Chromium76/모바일WebKit76), 실패/skip/flaky/retry0. 신규 두게임의 기존10프로필·sentinel·즐겨찾기보존3/3 포함. 원시 run `artifacts/g025-integration/runs/20261029T134017546Z-2ff524ea-6a20-410d-81c4-054013cd0aba/`.
- **이 첫 full 프로세스 자체는 exit1/FAILED_PRESERVATION_OR_CLEANUP으로 보존**합니다. 원인은 launcher fixture cwd283~285자의 Windows spawn ENOENT4건과 병렬리뷰 허용신규39파일의 역사집합추가였습니다. 기존615개에는변경/삭제0임을 실제 대조했습니다. 이를 단일 full PASS로 재명명하지 않습니다.
- runner snapshot경로1행만 줄여 fixture cwd230~232자. 같은존재Node/명령의짧은cwd exit0/긴cwd ENOENT를 수정자·독립검토자가 각각재현했습니다. 원본launcher/test/guard/단언은 그대로입니다.
- 새 빌드 뒤 **전체단위545/545**(공통48+게임468+launcher29), fail/skip/todo/cancelled0. 원시 units-only run `artifacts/g025-integration/runs/20261029T135732279Z-ca402131-b0ca-4946-9e99-ea66ae65eaf9/`. 이 실행에서브라우저를다시실행했다고주장하지않습니다.
- source149중 runner외148·browser config/spec16 불변, 실제output127 전부동일. 따라서 독립검토가 확인한 **불변228브라우저+신규545단위**의 결합으로 현재 후보를 수용합니다. 새 units 실행은 역사886개도 그대로 보존했습니다. 마지막 독립검토는 원본launcher29도 별도짧은snapshot에서 재실행PASS했습니다.
- runtime ZIP은 fresh scratch에서 Node만으로93공개자산바이트가일치했고 node_modules/tests 없이실행·종료/접속거부를확인했습니다. ZIP104항목 SHA256 `27f7e4f3e881e48357b8310495e7d6e7ed278f9fee4dc72b97046416c41fea00`.

## 아직 별도인 게이트·한계
- 이 기록 시점의 main merge·현재실행경로/PID/LISTEN·실제LAN3116 수용은 **후속실행대상**입니다. 후보수용을운영성공으로바꾸지않습니다.
- 실물Android/iPhone·native OS/탭숨김·WebKit native long-hold/drag/pinch·실청취·스크린리더·인간풀이시간·전상태대비전수·WebKit이미지수용은 미검증/부분검증에 그대로 남깁니다. 합성event/에뮬레이션/오디오API검사/역경로or mineoracle 자동완주와구분합니다.
- 기존 PM2 saved dump의g016재복귀위험은승인제외라유지. S01/S02(nonempty unit list/log pump error전파)는비차단하드닝후속입니다.
- 후속검증에서는 다른artifact writer가같은보호집합에파일을추가하지않도록리뷰종료후실행순서를분리합니다. 보존guard를완화하거나기존자료를삭제하지않습니다.
