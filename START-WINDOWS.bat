@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS release from https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
  echo Installing Poster Studio dependencies for the first launch...
  call npm install
  if errorlevel 1 goto install_failed
)
echo Starting Poster Studio...
call npm start
if errorlevel 1 goto launch_failed
exit /b 0

:install_failed
echo Installation failed. See the error above.
pause
exit /b 1

:launch_failed
echo Poster Studio could not launch. See the error above.
pause
exit /b 1
