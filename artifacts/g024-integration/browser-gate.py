"""Serialize G024 browser children across all QA roles (Windows)."""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import subprocess
import sys

NAME = r"Local\HermesG024BrowserGate"

def main():
    if os.name != 'nt':
        raise RuntimeError('G024 requires the Windows named browser mutex')
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
        print(f'G024 blocking on {NAME}', flush=True)
        status = k.WaitForSingleObject(handle, 0xFFFFFFFF)
        if status not in (0, 0x80):
            raise ctypes.WinError(ctypes.get_last_error())
        acquired = True
        print(f'G024 browser gate acquired (wait={status})', flush=True)
        if len(sys.argv) < 3:
            raise RuntimeError('Usage: browser-gate.py NODE ABSOLUTE_SCRIPT [args]')
        env = dict(os.environ, GAME_G024_BROWSER_GATE=NAME)
        return subprocess.run(sys.argv[1:], env=env, cwd=Path(__file__).resolve().parents[2], check=False).returncode
    finally:
        try:
            if acquired and not k.ReleaseMutex(handle):
                raise ctypes.WinError(ctypes.get_last_error())
        finally:
            k.CloseHandle(handle)
            print('G024 browser gate released/handle closed', flush=True)

if __name__ == '__main__':
    sys.exit(main())
