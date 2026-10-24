"""Create source and dependency-free runtime ZIPs for the verified game."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'releases'


def archive(name: str, files: dict[str, bytes]) -> dict[str, object]:
    target = OUTPUT / name
    with ZipFile(target, 'w', ZIP_DEFLATED) as zipped:
        for relative, data in sorted(files.items()):
            entry = ZipInfo('01-2048/' + relative, date_time=(2020, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            zipped.writestr(entry, data)
    with ZipFile(target) as zipped:
        corrupt = zipped.testzip()
        if corrupt is not None:
            raise RuntimeError('Invalid archive entry: ' + corrupt)
        entries = zipped.namelist()
        assert len(entries) == len(files)
        assert not any('/node_modules/' in p or p.startswith('../') for p in entries)
    return {'file': target.name, 'bytes': target.stat().st_size, 'entries': len(entries),
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}


def main() -> None:
    required = ['dist/src/server/index.js', 'dist/public/index.html', 'dist/public/scripts/main.js',
                'dist/public/style.css', 'docs/GAME_DESIGN.md', 'docs/QA_REPORT.md']
    for name in required:
        if not (ROOT / name).is_file():
            raise SystemExit('Build / QA artifact missing: ' + name)
    OUTPUT.mkdir(exist_ok=True)
    runtime: dict[str, bytes] = {}
    for directory in ['dist/public', 'dist/src/server']:
        for path in (ROOT / directory).rglob('*'):
            if path.is_file() and path.suffix != '.map':
                runtime[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    runtime['package.json'] = b'{"name":"number-garden-2048-runtime","private":true,"type":"module","engines":{"node":">=24"}}\n'
    runtime['start-game.cmd'] = (ROOT / 'start-game.cmd').read_bytes()
    runtime['README.md'] = '''# 숫자 정원 · 2048 — 실행 패키지

Node.js 24 이상이 필요합니다. npm 설치, TypeScript, Python, DB는 실행에 필요하지 않습니다.

1. ZIP을 압축 해제합니다.
2. `01-2048` 폴더에서 `start-game.cmd`를 실행하거나 아래 명령을 실행합니다.

```sh
node dist/src/server/index.js
```

3. 브라우저에서 http://127.0.0.1:3101 을 여세요. 종료는 Ctrl+C입니다.

PC: 시작 후 보드에 초점을 두고 방향키, Esc 일시정지.
모바일: 보드에서 한 손가락 24px 이상 상하좌우 스와이프.

같은 Wi-Fi 휴대폰 접속은 사용자가 LAN 공개를 선택할 때만 다음 명령으로 실행합니다.
```sh
node dist/src/server/index.js --host 0.0.0.0
```
휴대폰에서 http://<PC 내부 IPv4>:3101 으로 접속합니다. 방화벽/공유기 설정은 자동 변경하지 않습니다. 인터넷 공개/포트포워딩은 하지 마세요.

로컬 서버가 켜져 있으면 외부 인터넷 없이 플레이할 수 있습니다. file:// 직접 열기/PWA는 지원 범위가 아닙니다.
기록·정원은 해당 브라우저 localStorage에 저장합니다. 진행판은 저장하지 않습니다.
아트는 직접 제작 SVG15개, 효과음은 WebAudio 합성입니다. 기본 음소거입니다.
실제 휴대폰·실제 음향 청취·Firefox 검증은 수행하지 않았습니다. 자세한 구현/검증/자산 원본은 별도 소스 ZIP과 docs/QA_REPORT.md에 있습니다.
'''.encode('utf-8')
    source: dict[str, bytes] = {}
    for directory in ['src', 'public', 'assets', 'docs', 'scripts', 'tests', '.game-team']:
        for path in (ROOT / directory).rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                source[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    for name in ['README.md', 'AGENTS.md', '.gitignore', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts', 'start-game.cmd']:
        source[name] = (ROOT / name).read_bytes()
    result = {'runtime': archive('number-garden-2048-runtime.zip', runtime),
              'source': archive('number-garden-2048-source.zip', source),
              'note': 'Checksums describe these ZIP bytes. Runtime still requires Node.js >=24.'}
    (OUTPUT / 'manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
