@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 (
  echo Cannot open the SimpleGames project directory.
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. No installation was attempted.
  pause
  exit /b 1
)
node "scripts/serve_local.mjs" %*
set "serverExitCode=%ERRORLEVEL%"
if not "%serverExitCode%"=="0" (
  echo SimpleGames could not start. Read the error above.
  pause
)
exit /b %serverExitCode%
