@echo off
cd /d "%~dp0"
if exist "dist\windows\AemeathPreview.exe" (
  start "" "%~dp0dist\windows\AemeathPreview.exe" %*
  goto :eof
)
node "%~dp0windows\preview.mjs" %*
if errorlevel 1 pause
