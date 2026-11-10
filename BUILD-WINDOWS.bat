@echo off
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org
  pause
  exit /b 1
)
call npm install
if errorlevel 1 (echo Installation failed. & pause & exit /b 1)
call npm run dist:win
if errorlevel 1 (echo Build failed. & pause & exit /b 1)
echo Installer created in the release folder.
pause
