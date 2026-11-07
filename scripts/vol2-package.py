"""Package the verified, dependency-free browser runtime. Never include source secrets or logs."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'artifacts' / 'g032-build'
stamp = datetime.now(timezone(timedelta(hours=9))).strftime('%Y%m%d-%H%M%S')
output = ROOT / 'releases' / f'simple-games-vol2-40games-{stamp}.zip'
output.parent.mkdir(exist_ok=True)
public = BUILD / 'public'
entries = [(p, p.relative_to(BUILD).as_posix()) for p in sorted(public.rglob('*')) if p.is_file()]
entries.append((BUILD / 'src' / 'server' / 'index.js', 'src/server/index.js'))
assert len(list(public.glob('games/[234][0-9]-*/index.html'))) >= 21
manifest = []
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for source, name in entries:
        data = source.read_bytes()
        archive.writestr(name, data)
        manifest.append({'path': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    archive.writestr('package.json', '{"type":"module","engines":{"node":">=24"}}\n')
    archive.writestr('README.txt', '작은 쉼표 · 40개 게임 실행본\n\nNode.js 24 이상에서 압축을 푼 폴더를 열고 실행:\nnode src/server/index.js --host 127.0.0.1 --port 3182\n\n브라우저: http://127.0.0.1:3182/\n홈의 새 게임 모음 버튼으로 21~40번을 선택합니다.\n진행 중인 판은 저장하지 않으며 기록/외형은 브라우저별로 저장합니다.\n외부 패키지 설치나 인터넷 연결은 필요하지 않습니다.\n15010 운영 배포와 실물 기기 수용은 별도입니다.\n')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for entry in manifest:
        assert hashlib.sha256(archive.read(entry['path'])).hexdigest() == entry['sha256']
receipt = {'zip': str(output.relative_to(ROOT)).replace('\\', '/'), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size, 'verified_entries': len(manifest), 'manifest': manifest}
receipt_path = output.with_suffix('.manifest.json')
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in receipt.items() if key != 'manifest'}, ensure_ascii=False))
