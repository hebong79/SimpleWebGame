# G022-07 · 사막 우체부 — PM 설계 v1

## 경험과 디자인
07_dino.md의신규제작안을따릅니다. 도마뱀이소포를배달하는기록형러너. 황토우편경로·올리브도마뱀·카키지면,직접그린달리기4/점프1/숙임2/실패1. 화면은조작중심(Operate),오른쪽점프/왼쪽숙이기. 제목'사막 우체부',부제'소포를 안고, 모래길을 가볍게.' 원작Chrome아트/로고는사용하지않습니다.

## 확정 물리·장애물
논리960×360,지면발y300,본체left120,width36,stand48/duck24,초기foot300/vy0. g1600px/s²,점프vy-560,공중재점프0,누르고있어도자동재점프0. Space/ArrowUp 또는점프버튼의새DOWN1회만. 지상duckHeld동안점프거절(숙임해제후점프),공중duck요청은높이를바꾸지않고착지때반영. 숙임해제/착지직후현재장애물겹침도즉시판정.
활성시간20초마다속도+20,초기240,max400. 경계20/40…를dt중간에도정확히분할. 모든장애물은현재속도로좌측이동,지면아래는없습니다. score=floor(distancePx/10),충돌시점까지의실제이동만확정. 현재속도/달린거리HUD·결과마지막충돌좌표표시. 자동승리없음.
선인장width정수24..52,height44..64,ground-bottom300.30초전선인장만,이후새spawn에서약1/3확률비행장애물(width52,top256,bottom272),나머지선인장. 새종류는이미나온장애물을소급변경하지않음. ducktop276이면비행물bottom272와4px안전간격,standtop252이면충돌.점프로넘어도가능하면허용.
첫장애물x1040. 뒤추가도항상x1040(그보다멀리사전큐생성금지). last.right와새left의빈간격이 `1.2*min(400,currentSpeed+20)+extra` 이상일때spawn. extra는이전spawn후1회정한0..120이며매tick재추첨하지않습니다. 현재속도+20은화면까지약4초안에올수있는다음한번의속도상승까지보수반영해,실제max속도에서도최소1.2초간격을지키는PM공정성정책입니다. offscreen.right<0은제거. RNG주입및no-op소비0.
접촉은충돌(포함경계). 고정tick내에서도상대x의겹침시간구간과포물선foot y(t)의[obstacle.top,obstacle.bottom+bodyHeight]구간을교차해최초접촉을계산하거나동등한연속판정구현. landing/speed경계를분할하며tunneling/임의팽창오탐금지. 충돌후입력/점수/정산추가0.
도구계산:점프총0.7초,최고98px. 최고장애물64px를넘을수있으며1.2초최소간격은재점프회복여유를둡니다.

## 코스튬/완료
부위hat/body/bag; sets basic/postal/space/sport. basic=none3,postal 기본보유·초기장착postal3부위,space는완료누적3000점,sport는완료한판최고500점. 원안표3세트중postal이기본지급인정의유지. 각8동작원본asset존재/모자·가방발아래배치금지. 의상돌출판정제외.
기록공통계약준수. 결과reason collision/quit,losses/quits분리. 자신만의roundID/dedup. engine tests용명시적RNG/순수함수노출은가능하지만UIlive상태setter없음.
필수단위추가:doublejump0·duck높이/공중무효·release under bird즉시충돌·240/400간격·20/30/40s문턱·긴dt연속충돌·스코어반올림·pauseno-op·외형동일seed·정산/해금2999+1/499→500·Storage각예외. 실제HTTP에서는정상점프로선인장1회이상회피와자연실패·quit재도전확인.
구현/분기/경로는G022_COMMON_CONTRACT를따릅니다. 인수API/DOM ID/명령exit/commit SHA를 G022_07_IMPLEMENTATION.md에기록합니다.
