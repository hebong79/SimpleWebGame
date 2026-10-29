# G025-12 숫자 우체통 — 제작용 GDD·기술·수용 v1

`G025_PM_CONTRACT.md`가 공통·운영·디자인 기준입니다. 이것은 게임 완성/QA PASS 보고가 아닙니다.

## 핵심과 콘텐츠
- 원안12_fifteen: 4×4, tile1..15와blank0, 바로상하좌우인접한1타일만교환. 대각/멀리/행넘김/빈칸클릭no-op. 목표 `[1,2,...,15,0]`와모든위치정확일치만성공, 시간제한/실패없음. 자동줄이동/자동해법/힌트/캐릭터없음.
- 3×3입문8퍼즐1개(합법shuffle8),4×4고정3개(20/60/120shuffle). modeID `practice-v1`,`post-20-v1`,`post-60-v1`,`post-120-v1`. 기록은ID별분리;3×3결과를4×4best로혼합하지않음. 4×4기본은20. selector는버튼, native select없음.
- 고정version·seed로모든기기동일배열. 권장seed24011/24012/24013/24014, builder가실제배열/경로를검증한후manifest에확정. goal에서합법blank이동N회, 직전blank위치로즉시복귀하는방향제외. 중간사이클은허용하지만끝goal이면다음seed로한정32회이내다시생성하여비goal만제공(실패는명확오류,불법랜덤fallback금지). 같은mode는항상동일seed/시작배열, retry는그시작배열로복귀. 재시작마다다른퍼즐을같은ID에기록하지않음.
- 실제route·최종seed·배열·size·N을immutable fixture/콘텐츠데이터로명시. 역경로로합법복구됨을검증. UI ‘섞기20/60/120회’·‘최단해 길이가 아닙니다’. 모든shuffle가능배열의최단거리/실제인간시간은주장하지않음.

## 엔진·이력·시간
- board는size²길이의0..size²-1서로다른정수. 유효이동은blank를요청방향으로1칸옮김(원안방향키의뜻). 방향primitive/own-key+index정수범위검사, 무효입력동일state no-op·카운트/시간/이력불변. 순수엔진에DOM/storage/実시간없음.
- START는playing, 첫유효이동부터timer. `moveCount`는지금까지확정된모든forward이동수, undo로감소하지않음. undo는정확한board/blank를복귀시키고undoCount만+1, active시간유지. 따라서되돌려도적은이동기록으로줄이는속임수없음; UI ‘이동(되돌린수도포함)’과undo별도안내. historyLen=moveCount-undoCount, exhaustedundo/noop카운트없음.
- 성공한이동에서board확정→moves+1→elapsed정수ms확정→won→단1회record정산. 결과에서undo/방향/타일차단. 완료직전틀린blank를성공으로보지않음. 타일animation(최대100ms)은뷰만, 경계입력은일관적무시/단일commit·고정무한큐없음. pause/blur는animation/gesture취소하되이미원자확정된board유지.
- 도움말/모드변경/테마/재시작모달·목표preview는timer/게임입력정지. 모드변경은미완료판이면확인·취소원상/확정시준비상태새mode. 결과의retry는같은mode의원본배열, 새세션/reload도record는유지·판은준비새배열.

## 조작·목표보기
- PC 인접타일click, focusedboard방향키=blank방향, U/undo버튼. repeat/키해제전중복·외부focus·수정키는게임이동무시. 타일은keyboard로도button활성가능하나focus상태와방향키정의충돌없음. 모바일인접타일tap만, swipe행이동없음. 다중포인터/drag/cancel은이동없음.
- **목표보기는누르는동안만**: pointerdown/Space또는Enterkeydown에서goaloverlay, pointerup/keyup/documentcapture/outsideup/cancel/lostcapture/blur/숨김/모달때즉시해제. 클릭토글/키repeat토글금지. release는타일에전달안됨. preview동안board·moves·history불변/timer정지. 정상release는이전playing복귀(자동재개금지의보호정지와다름); blur중release는protectpause유지. 화면캡처로성공판처럼오인하지않게 `목표 미리보기 — 진행은 유지됩니다`표시.
- keyboard goalhold→탭이탈·pointeroutside·release후초점확인. 모달실제trigger복귀/Tab경계·축소화면 접근성·reducedmotion·44px버튼공통기준.

## 기록·테마·아트
- 키 `simplegames.number-postbox.v1`, version1/muted=true/theme=cream. `records[modeID]={wins,bestMoves,bestMs}`; 모든4키는별도검증. win0이면best둘다null, win>0이면양의유한안전정수, bestMoves1..상한/bestMs1..상한. wins는완료판정1회만증가. lowerMoves가우선, 같으면lowerMs교체, 이동많지만빠른판은기록갱신아님. bestMs는선택된bestMoves판의소요시간이지독립최단시간아님.
- 올바른기록을알수없는theme만으로통째로지우지않고theme기본복구. 잘못된modeID/버전/이상수치/관계는명확정의. 완성배열·이력·timer진행을localStorage에저장하지않음. 저장차단시메모리상태·경고·완료정산은유지, 타키불변.
- cream/meadow/evening3엽서전부기본제공; pattern과작은소인은中央번호를가리지않음. 숫자는DOM실제큰텍스트, 아이콘/3엽서배경은직접CSS/SVG, 외부이미지·폰트·원작코드없음. 이동/완성합성음, mute전환後기록저장, AudioContextfallback.
- 권장 파일 index.html/styles.css/engine.mjs/save.mjs/main.mjs/assets/kit.svg + 필요작은정적콘텐츠모듈. 별도프로젝트package나lockfile생성없음.

## 독립테스트 수용
- [12-R]4mode배열합법/유일/비goal/정확N/즉시역이동0/다기동결정성/역경로완주; 여러seed legalshuffle/올바른숫자분포. 독립goal/parity검사, 인접/대각/멀리/행wrap/이상index/상속명령/부작용객체no-op.
- [12-U]이동·undo전체경로역복원/카운터비감소/이력빈undo no-op/분기경로/결과undo불가/이전게임상태불변. 동일최終board라도불필요undo가record유리하지않음.
- [12-F]START/first-valid/timer/no-op/pause/blur/goalhold/release/outside/cancel/multitouch/restartcancel/확정/모드변경/홈/공개입력완주/성공중복정산0/레이스검사.
- [12-D]mode별완료→reload·best이동우선/동이동시간우선·동점비갱신·구버전/손상/불가능wins/best·Storage getter/read/write예외·타게임키보존·테마불변.
- [12-V]PC/mobileChromium/mobileWebKit 실제HTTP·비동결80ms누름·320px/44px/초점/goaloverlay/모달·외부통신0·CSP/console0. 최소4×4고정20퍼즐은실제공개키/타일입력으로끝까지완료하고mode별엔진완료/역경로는별도검사. 고정shuffle경로를읽어역으로누르는자동play는인간최적해/시간수용이아님.
- 원시명령/exitCode/TAP/JSON·전체입력SHA를독립증거폴더저장. 테스트준비만·수집만·미실행은PASS합산없음.
