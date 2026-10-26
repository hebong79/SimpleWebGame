@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 (
  echo ERROR: Cannot open the SimpleGames project directory. 1>&2
  exit /b 1
)
node scripts/serve_local.mjs %*
set "launcherExitCode=%errorlevel%"
if not "%launcherExitCode%"=="0" echo ERROR: SimpleGames local launcher failed with exit code %launcherExitCode%. Check the message above. 1>&2
exit /b %launcherExitCode%
