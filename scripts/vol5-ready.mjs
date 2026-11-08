import{readFile,writeFile,readdir}from'node:fs/promises';import{existsSync}from'node:fs';import{createHash}from'node:crypto';
async function latest(root,file,ok){for(const d of(await readdir(root)).sort().reverse()){try{const path=`${root}/${d}/${file}`,data=JSON.parse(await readFile(path,'utf8'));if(ok(data))return{path,data};}catch{}}throw Error('Missing gate '+root);}
const validation=await latest('artifacts/g035-validation','results.json',x=>x.pass),candidate=await latest('artifacts/g035-smoke','results.json',x=>x.passed===60&&x.failed===0&&x.origin.startsWith('http://127.0.0.1:')),regression=await latest('artifacts/g035-regression','playwright-results.json',x=>x.stats?.expected===36&&x.stats?.unexpected===0);for(const f of['QA_A.md','QA_PM_GAMES.md','QA_PM.md','QA_C.md'])if(!(await readFile('docs/vol5/'+f,'utf8')).includes('PASS'))throw Error('Missing independent '+f);
const proof=JSON.parse(await readFile('artifacts/g035-pm/final-source-public.json','utf8')),hash=b=>createHash('sha256').update(b).digest('hex');for(const f of proof.files){if(hash(await readFile('public/'+f.path))!==f.sha256||hash(await readFile('artifacts/g035-release-build/public/'+f.path))!==f.sha256)throw Error('Changed runtime '+f.path);}const audit=JSON.parse(await readFile('artifacts/g035-pm/legacy-evidence-audit/audit.json','utf8'));for(const f of audit.files.filter(f=>f.classification==='previously_existing_fixed_file_regenerated'))if(hash(await readFile(f.path))!==f.currentSHA256)throw Error('Historical output not isolated '+f.path);
await writeFile('artifacts/g035-pm/scoped-rerun-guard.json',JSON.stringify({verifiedAt:new Date().toISOString(),historicalFixedFilesUnchanged:audit.affectedLegacyFiles,validation:validation.path,scope:'All artifact writes redirected into the fresh full-test run directory; tested named ESM/sync reads/writes and actual screenshot outputs.'},null,2));
const counts=Object.fromEntries(validation.data.results.map(x=>[x.name,x.passed])),total=counts['unit-server']+counts['all-games']+counts.launcher,packFile=(await readdir('releases')).filter(n=>n.startsWith('simple-games-vol5-100games-')&&n.endsWith('.manifest.json')).sort().at(-1),pack=JSON.parse(await readFile('releases/'+packFile,'utf8'));if(hash(await readFile(pack.zip))!==pack.sha256||!JSON.parse(await readFile('artifacts/g035-pm/package-smoke.json','utf8')).pass)throw Error('ZIP proof missing');
const record='artifacts/g035-pm/readiness.json';if(existsSync(record)){console.log(await readFile(record,'utf8'));process.exit(0);}const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value])),stamp=`${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`,worklog=`docs/worklogs/${stamp}_G035_81번부터100번_제작_검증완료_운영승인대기.md`;
const body=`# G035 · 81~100번 제작·검증 완료, 운영 승인 대기

- 기록: ${stamp} KST(Asia/Seoul). 사용자 지정 기획서·디자인 중81~100번 20종을 제작했습니다. 기존80게임·109 ID와 게임 저장키·즐겨찾기를 보존한 후보는 **129카드 / 실행100 / 준비29**입니다.
- [게임 목록·실행·콘텐츠·제한](../vol5/README.md), [기획](../vol5/PLAN.md), [자산](../vol5/ASSETS.md).

## 실제 검증

- 타입 검사·새 후보 빌드·구문 PASS. 서버/단위 ${counts['unit-server']}, 게임 ${counts['all-games']}, 실행기 ${counts.launcher}: **${total}/${total} PASS**. ${validation.path}.
- 기존 홈·2048·Snake·Pong 회귀 **36/36 PASS**: ${regression.path}. 홈 소스/대표 게임이 최종과 동일한 조기 후보로 실행했고99 개선은 해당 범위와 분리했습니다.
- 신규20게임 × PC Chromium·모바일 Chromium·모바일 WebKit 후보 **60/60 PASS**: ${candidate.path}. 실제80ms trusted 전용입력·정지/재개/blur·재시작확인취소·모달초점·320px·홈복귀·오류0.
- 비작성자 독립 QA4묶음 PASS_WITH_LIMITATIONS: [81~85](../vol5/QA_A.md), [86~90](../vol5/QA_PM_GAMES.md), [91~95](../vol5/QA_PM.md), [96~100](../vol5/QA_C.md). 자동 풀이와 실제 입력열 완주를 사람 플레이와 구분합니다.
- 20게임 실제PC 이미지 검토: artifacts/g035-visual/2026-11-08T12-16-15-340Z/contact-1.png, contact-2.png.
- 기존 공개파일 ${proof.oldFilesPreserved}개 보존, 정적 소스 ${proof.publicFiles}파일=후보 바이트 일치. ZIP 실행 ${pack.files}파일 CRC/개별SHA256·전체ZIP SHA256 일치.
- [실행 ZIP](../../${pack.zip}): 별도 압축 해제 → Node CLI → 홈100 →87번 포대 실제80ms 이동 PASS. artifacts/g035-pm/package-smoke.json. Node24이상에서 start-local.cmd 또는 node src/server/index.js --host 127.0.0.1 --port 3101.

## 수정·제한

- 첫 dt=0 프레임의89 단발입력 소실,95 유지/놓기 중 정지 후 성공불가,99 RAF 버튼 자식 갱신을 수정하고 실제 브라우저로 재검증했습니다. 초기99 후보/소스 불일치 실패도 보존했습니다.
- 실물 휴대폰·실제 Safari·물리 멀티터치·음향 청취·스크린리더·사람 다인 플레이·난이도/목표시간은 미검증입니다. 일부 판은 구조 변형/입문형이며 자체 도형 외형은 시안 세부와 차이가 있습니다. 읽기 전용 상태 문구 반복 갱신 LOW QAC-L01은 입력 손실 없이 후속 정리로 남겼습니다.
- 최초 전체회귀에서 레거시 테스트의 고정 경로 때문에 과거 상세 QA 파일18개가 재기록됐습니다. 이전 상세 바이트는 복원하지 못했습니다. 원래 집계 로그·운영 manifest·일지는 별도 유지하며, 재생성 사본/해시/시각과 새 증거82개 구분은 artifacts/g035-pm/legacy-evidence-audit/audit.json에 보존했습니다. 실행을 중단하고 모든 artifact 쓰기를 새 실행으로 격리해 전체 재검증했으며 과거18개 추가 변경0도 확인했습니다.

## 운영 상태와 다음 단계

- **실사용15010은 기존 G034의80게임을 유지합니다. 신규20종은 아직 운영 미반영입니다.** AGENTS.md 운영 변경 사전 승인에 따라 새 G035 단일 앱 전환 승인이 필요합니다. G034 운영·과거Git 승인을 확대하지 않았습니다.
- 승인 후 number-garden-2048 하나만 전환 → 실제 PM2 script/PID/LISTEN·HTTP 바이트 → 실제15010 신규20×3환경 검증 → 최종 작업일지·한국어 게시판 완료요약 readback.
- 다른 서비스·전역PM2 save·방화벽·설치는 변경하지 않았습니다. G035 Git 커밋/병합/push도 별도 요청되지 않아 미수행입니다. 기존 dump 구버전 복귀/과거G013 제한은 유지합니다.
- 확인 명령: node scripts/vol5-runtime.mjs, node scripts/vol5-smoke.mjs, npm run test:games. 전체 게임 검사는 새 증거를 격리하는 npm 명령을 사용합니다. 현재 구현/후보 실행 차단 결함은 없으며 신규 운영 승인 대기입니다.
`;
await writeFile(worklog,body,{flag:'wx'});async function prepend(path,text){const old=await readFile(path),e=old.includes(Buffer.from('\r\n'))?'\r\n':'\n';await writeFile(path,Buffer.concat([Buffer.from(text.replaceAll('\n',e)),old]));}
await prepend('docs/20261024-231330_HANDOFF.md',`## G035 · 81~100 제작·후보 검증 완료, 운영 승인 대기 (${stamp} KST)\n\n- 신규20종·후보129/100/29, 자동${total}/${total}·기존회귀36·후보60 PASS. 독립 QA4묶음 인수, 실행 ZIP ${pack.files}파일 별도CLI/홈100/포대 입력 PASS.\n- 일지 ${worklog}; docs/vol5/README.md. 실사용15010은G034/80게임 유지, 새G035 운영 승인 필요.\n- 과거QA 고정파일18개 재기록(이전상세바이트미복원)·원래집계/운영manifest 유지, audit.json에보존. 전체검사출력격리후과거18개추가변경0.\n- 다음: 새승인→단일앱→실제경로/PID/LISTEN/HTTP→운영60사례→최종KST일지/게시판readback. 확인 node scripts/vol5-runtime.mjs, node scripts/vol5-smoke.mjs, npm run test:games. 실물/사람/청취·LOW·기존dump제한유지,Git미수행.\n\n`);
await prepend('docs/20261024-231330_BACKLOG.md',`## G035 · 후보 검증 완료\n\n- [x] 20게임 구현·홈129/100/29·교차독립QA·수정재검증·자동${total}·회귀36·후보60·ZIP PASS.\n- [ ] 신규 운영 승인·단일앱전환·실제PM2/HTTP/사용자주소60검사·완료게시 readback.\n- 기록 ${worklog}. 과거 상세증거18개 재기록 제한은 audit.json, 이후 전체검사 출력격리.\n\n`);
const path='.game-team/project.json',old=await readFile(path,'utf8'),project=JSON.parse(old);project.status='hundred_games_candidate_verified_awaiting_operating_approval';project.vol5_candidate={verified_at:new Date().toISOString(),catalog_total:129,playable:100,upcoming:29,automated:total,existing_browser:36,candidate_browser:60,build:'artifacts/g035-release-build',operating:'not_deployed_awaiting_new_approval',git:'not_requested_for_G035',worklog};project.historical_evidence_G035={affected_legacy_fixed_files:18,new_timestamp_files:82,exact_previous_bytes_restored:false,audit:'artifacts/g035-pm/legacy-evidence-audit/audit.json',future_full_game_runs_scoped:true};await writeFile(path,(JSON.stringify(project,null,2)+'\n').replaceAll('\n',old.includes('\r\n')?'\r\n':'\n'));const summary={worklog,approvalPending:true,status:project.status,automated:total,candidate:60,regression:36,package:pack.zip,validation:validation.path};await writeFile(record,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
