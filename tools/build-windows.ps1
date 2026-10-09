#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw 'csc.exe not found' }

$out = Join-Path (Get-Location) 'dist\windows'
New-Item -ItemType Directory -Force -Path $out | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out 'windows'), (Join-Path $out 'extension'), (Join-Path $out 'assets'), (Join-Path $out 'tools') | Out-Null

Copy-Item index.html, style.css, animation.js, image-settings.js, locale.js $out
Copy-Item assets\artwork.jpg, assets\avatar.jpg, assets\contours.js (Join-Path $out 'assets')
Copy-Item extension\*.mjs, extension\wallpaper.css (Join-Path $out 'extension')
Copy-Item windows\*.mjs (Join-Path $out 'windows')
Copy-Item README.md $out -ErrorAction SilentlyContinue

$startupExe = Join-Path $out 'CodexStartup.exe'
$previewExe = Join-Path $out 'AemeathPreview.exe'
& $csc /nologo /optimize+ /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/out:$startupExe" windows\Launcher.cs
if ($LASTEXITCODE -ne 0) { throw 'failed to compile CodexStartup.exe' }
& $csc /nologo /optimize+ /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/out:$previewExe" windows\Preview.cs
if ($LASTEXITCODE -ne 0) { throw 'failed to compile AemeathPreview.exe' }

@'
@echo off
cd /d "%~dp0"
if exist CodexStartup.exe (
  start "" "%~dp0CodexStartup.exe" %*
) else (
  node "%~dp0windows\run.mjs" %*
)
'@ | Set-Content -Encoding ASCII (Join-Path $out 'launch-codex.cmd')

@'
@echo off
cd /d "%~dp0"
if exist AemeathPreview.exe (
  start "" "%~dp0AemeathPreview.exe" %*
) else (
  node "%~dp0windows\preview.mjs" %*
)
'@ | Set-Content -Encoding ASCII (Join-Path $out 'preview-animation.cmd')

Write-Host "Built: $out"
Write-Host "  CodexStartup.exe     launch Codex with animation"
Write-Host "  AemeathPreview.exe   standalone preview"
