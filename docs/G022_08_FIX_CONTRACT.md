# G022-08 수정 계약 — PM 수용 설계

## 현재 판정
독립 QA artifacts/g022-review08/review.json은 **FAIL**이며 PM이23입력의 실제SHA256/동결HEAD75112d5/clean상태를확인했습니다. 기존38단위PASS는독립검토의두결함을덮지않습니다. 원본FAIL·하네스전제교정·동결commit보존.

## G022-QA08-001 · 완료판 이력과 저장 통계
정상입력통계는각완료판의비음수안전정수metric m_i와score floor(m_i/10)의집계로실제로구성가능해야합니다. p=plays개판이있고max(m_i)=bestMetric,sum(m_i)=totalMetric,max(score_i)=bestScore,sum(score_i)=totalScore이어야합니다. losses+quits=plays/최초0판/소유·장착·상한원자성의기존계약유지.
- 불가능최소예:최고109px/10점·누적11점·2판이면남은1점에최소10px가필요하므로총metric최소119px.110px입력은recovered=true/안전복구·경고.
- 불가능최대예:최고10px/1점·누적2점·3판이면최대metrics10+10+9=29px. 총30px입력은세판각10px여야해서점수3이되므로누적2점과불가능. 이입력도복구.
- 최고판하나를명시적으로제외한나머지점수/metric의최소·최대feasibility를정확히검사하세요. 나머지최고점수와같은몫의판은나머지가bestMetric%10보다클수없습니다. 모든합/곱/범위BigInt,plays크기에비례하는루프/배열할당금지. 정상정산으로생성되는이력을과잉거부하지마세요. 소규모m_i열의모든실제집계를대조하는정적/속성시험과MAX_SAFE/0점·0판·단일판경계를포함하세요.

## G022-QA08-002 · 실제 트리거로 모달 초점 복귀
모바일WebKit의pointerclick은button을자동focus하지않을수있으므로document.activeElement만저장해서는실제열기트리거가아닙니다. 외부트리거를명시적으로전달·유효성검사하고닫힘/취소후보이는enabledfocus대상으로복귀해야합니다. 메뉴→도움말/옷장/확인전환은닫힌부모모달의숨겨진버튼으로초점복귀하지말고유효한외부트리거를유지/선택하세요. body/숨긴close-help로이탈금지. close직후와후속RAF/250ms뒤에도정상. 사용자확인재개전paused유지·Tab순환·Escape취소·반복키/80ms 누름정책유지. 실제HTTP/엄격CSP/WebKit trusted80ms 도움말→Tab/ShiftTab→Escape 동일재현으로확인.

## 소유권/게이트
수정워커만08 worktree의save.mjs/main.mjs/전용unit·새fixdoc/새fixartifact를수정. 엔진/아트/HTML/CSS/기존QA증거/공통파일/07/운영은동결. 좁은수정후단위·구문·동일실패재현·동작회귀를새출력에수행,자기allowlist만commit([verified]금지),PM인수→fresh독립delta검토필수. 이두결함의첫수정사이클이며같은수정2회후에도해결안되면중단보고.
07은새명시승인없음/재시도금지,실제3116/main/PM2/원격push모두변경금지. 공통코드는별도통합워커소유,PM은설계·상태·검증을담당하고직접제품코드를쓰지않습니다.
