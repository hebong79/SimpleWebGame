@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required.
  pause
  exit /b 1
)
if not exist "dist\src\server\index.js" (
  echo Build files not found. Run npm ci and npm run build first.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3101 in your browser.
node "dist\src\server\index.js" %*
if errorlevel 1 pause
