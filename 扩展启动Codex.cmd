@echo off
cd /d "%~dp0"
if exist "dist\windows\CodexStartup.exe" (
  start "" "%~dp0dist\windows\CodexStartup.exe" %*
  goto :eof
)
node "%~dp0windows\run.mjs" %*
if errorlevel 1 pause
