from pathlib import Path
from datetime import datetime,timezone,timedelta
import zipfile,hashlib,json
r=Path('.');stamp=datetime.now(timezone(timedelta(hours=9))).strftime('%Y%m%d-%H%M%S');build=r/'artifacts/g035-release-build';base=r/'releases'/f'simple-games-vol5-100games-{stamp}';archive=Path(str(base)+'.zip');files=[]
readme='''작은 쉼표 · 총100게임 / 신규81~100

Node.js 24 이상이 필요합니다. 별도 npm 설치는 필요 없습니다.
이 폴더에서 start-local.cmd 또는 node src/server/index.js --host 127.0.0.1 --port 3101 을 실행하세요.
브라우저 http://127.0.0.1:3101/ 의 다섯 번째 게임 모음에서81~100을 고르세요.
브라우저 localStorage에 기록·해금·설정이 저장되며 진행 중 판은 재시작 때 초기화됩니다.
실물 모바일/사람 플레이 시간/실청취는 별도 수용입니다. 포함된 ASSETS.md 및 docs/vol5 보고서를 참고하세요.
'''
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED)as z:
 for folder in ['public','src/server']:
  for p in sorted((build/folder).rglob('*')):
   if p.is_file() and not p.name.endswith('.map'):
    data=p.read_bytes();name=p.relative_to(build).as_posix();z.writestr(name,data);files.append({'path':name,'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 z.writestr('README.txt',readme.encode('utf-8'));z.writestr('ASSETS.md',(r/'docs/vol5/ASSETS.md').read_bytes());z.writestr('start-local.cmd',b'@echo off\r\ncd /d "%~dp0"\r\nnode src/server/index.js --host 127.0.0.1 --port 3101\r\npause\r\n');z.writestr('package.json',b'{"type":"module","private":true}')
with zipfile.ZipFile(archive)as z:
 assert z.testzip()is None
 for f in files:assert hashlib.sha256(z.read(f['path'])).hexdigest()==f['sha256']
meta={'zip':archive.as_posix(),'files':len(files),'size':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':files};Path(str(base)+'.manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in meta.items()if k!='entries'},ensure_ascii=False))
