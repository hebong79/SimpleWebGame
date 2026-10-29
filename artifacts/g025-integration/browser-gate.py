"""Hold the exact G025 Win32 mutex over discovery + execution.
No lifecycle or networking actions; child profiles are passed explicitly.
"""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import uuid

NAME = r"Local\SimpleGamesG025BrowserGate"
ROOT = Path(__file__).resolve().parents[2]
NODE = Path('C:/Program Files/nodejs/node.exe')


def main():
    if os.name != 'nt':
        raise RuntimeError('G025 browser execution requires the Windows named mutex')
    if len(sys.argv) != 4:
        raise RuntimeError('Usage: browser-gate.py ABSOLUTE_NODE ABSOLUTE_PW_CLI ABSOLUTE_CONFIG')
    node, cli, config = map(Path, sys.argv[1:])
    if node.resolve() != NODE.resolve() or cli.resolve() != (ROOT / 'node_modules/@playwright/test/cli.js').resolve() or config.resolve() != (ROOT / 'tests/g025-playwright.config.ts').resolve():
        raise RuntimeError('Browser executable/CLI/config path is not authorized')
    reports = os.environ.get('GAME_TEST_ARTIFACT_DIR', '')
    if not re.fullmatch(r'artifacts/g025-integration/runs/[A-Za-z0-9_-]+/children/[A-Za-z0-9_-]+', reports):
        raise RuntimeError('A fresh task-owned parent report directory is required')
    out = ROOT / reports
    if not out.is_dir() or out.resolve() != out.absolute() or (out / 'browser-session.json').exists():
        raise RuntimeError('Unsafe/existing browser session output')
    session = {'gate': NAME, 'parentReports': reports, 'discovery': None, 'execution': None, 'commands': [], 'acquired': False, 'released': False}

    def save():
        (out / 'browser-session.json').write_text(json.dumps(session, indent=2) + '\n', encoding='utf-8')

    def child(discovery):
        label = 'discovery' if discovery else 'execution'
        rel = f'{reports}/{label}-{uuid.uuid4()}'
        dest = ROOT / rel
        dest.mkdir(exist_ok=False)
        session[label] = rel
        args = [str(node), str(cli), 'test', '--config', str(config)] + (['--list'] if discovery else [])
        env = dict(os.environ, GAME_G025_BROWSER_GATE=NAME, GAME_G025_LIST='1' if discovery else '0', GAME_TEST_ARTIFACT_DIR=rel, GAME_TEST_BUILD_DIR='artifacts/g025-build')
        record = {'phase': label, 'argv': args, 'cwd': str(ROOT), 'reports': rel, 'exitCode': None}
        session['commands'].append(record)
        save()
        print(f'G025 {label}: {rel}', flush=True)
        process = subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        def pump(source, path, target):
            with path.open('xb') as log:
                while True:
                    data = source.read1(65536)
                    if not data:
                        break
                    log.write(data)
                    log.flush()
                    target.buffer.write(data)
                    target.buffer.flush()

        threads = [threading.Thread(target=pump, args=(process.stdout, dest / 'stdout.log', sys.stdout)), threading.Thread(target=pump, args=(process.stderr, dest / 'stderr.log', sys.stderr))]
        for thread in threads:
            thread.start()
        record['exitCode'] = process.wait()
        for thread in threads:
            thread.join()
        save()
        return record['exitCode']

    k = ctypes.WinDLL('kernel32', use_last_error=True)
    k.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    k.CreateMutexW.restype = wintypes.HANDLE
    k.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    k.WaitForSingleObject.restype = wintypes.DWORD
    k.ReleaseMutex.argtypes = [wintypes.HANDLE]
    k.ReleaseMutex.restype = wintypes.BOOL
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    k.CloseHandle.restype = wintypes.BOOL
    handle = k.CreateMutexW(None, False, NAME)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    acquired = False
    try:
        print(f'G025 waiting on {NAME}', flush=True)
        status = k.WaitForSingleObject(handle, 0xFFFFFFFF)
        if status not in (0, 0x80):
            raise ctypes.WinError(ctypes.get_last_error())
        acquired = True
        session.update(acquired=True, waitStatus=status)
        save()
        print(f'G025 acquired {NAME} (wait={status})', flush=True)
        code = child(True)
        if code or os.environ.get('GAME_G025_LIST') == '1':
            return code
        return child(False)
    finally:
        try:
            if acquired:
                if not k.ReleaseMutex(handle):
                    raise ctypes.WinError(ctypes.get_last_error())
                session['released'] = True
        finally:
            closed = bool(k.CloseHandle(handle))
            session['handleClosed'] = closed
            save()
            print('G025 mutex released/handle closed', flush=True)
            if not closed:
                raise ctypes.WinError(ctypes.get_last_error())


if __name__ == '__main__':
    sys.exit(main())
