#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw 'csc.exe not found' }

$out = Join-Path (Get-Location) 'dist\windows'
New-Item -ItemType Directory -Force -Path $out | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out 'windows'), (Join-Path $out 'extension'), (Join-Path $out 'assets'), (Join-Path $out 'tools') | Out-Null

Copy-Item index.html, style.css, animation.js, image-settings.js, locale.js, accent.js, audio.js $out
Copy-Item assets\artwork.jpg, assets\avatar.jpg, assets\contours.js (Join-Path $out 'assets')
Copy-Item extension\*.mjs, extension\wallpaper.css (Join-Path $out 'extension')
Copy-Item windows\*.mjs (Join-Path $out 'windows')
Copy-Item README.md $out -ErrorAction SilentlyContinue
Copy-Item 扩展启动Codex.vbs, 预览动画.vbs $out -ErrorAction SilentlyContinue

$startupExe = Join-Path $out 'CodexStartup.exe'
$previewExe = Join-Path $out 'AemeathPreview.exe'
& $csc /nologo /optimize+ /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/out:$startupExe" windows\Launcher.cs
if ($LASTEXITCODE -ne 0) { throw 'failed to compile CodexStartup.exe' }
& $csc /nologo /optimize+ /target:winexe /platform:x64 /reference:System.Windows.Forms.dll "/out:$previewExe" windows\Preview.cs
if ($LASTEXITCODE -ne 0) { throw 'failed to compile AemeathPreview.exe' }

@'
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
exe = root & "\CodexStartup.exe"
If fso.FileExists(exe) Then
  sh.Run """" & exe & """", 0, False
Else
  sh.CurrentDirectory = root
  sh.Run "node windows\run.mjs", 0, False
End If
'@ | Set-Content -Encoding ASCII (Join-Path $out 'launch-codex.vbs')

@'
@echo off
start /b "" wscript.exe //nologo "%~dp0launch-codex.vbs" %*
exit /b 0
'@ | Set-Content -Encoding ASCII (Join-Path $out 'launch-codex.cmd')

@'
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
exe = root & "\AemeathPreview.exe"
If fso.FileExists(exe) Then
  sh.Run """" & exe & """", 0, False
Else
  sh.CurrentDirectory = root
  sh.Run "node windows\preview.mjs", 0, False
End If
'@ | Set-Content -Encoding ASCII (Join-Path $out 'preview-animation.vbs')

@'
@echo off
start /b "" wscript.exe //nologo "%~dp0preview-animation.vbs" %*
exit /b 0
'@ | Set-Content -Encoding ASCII (Join-Path $out 'preview-animation.cmd')

$shortcutPath = Join-Path $out 'Codex Startup.lnk'
try {
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($shortcutPath)
  $link.TargetPath = $startupExe
  $link.WorkingDirectory = $out
  $link.WindowStyle = 7
  $link.Description = 'Launch Codex with startup animation'
  $link.Save()
  $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
  New-Item -ItemType Directory -Force -Path $programs | Out-Null
  Copy-Item $shortcutPath (Join-Path $programs 'Codex Startup.lnk') -Force
} catch {
  Write-Host "Shortcut skipped: $($_.Exception.Message)"
}

Write-Host "Built: $out"
Write-Host "  CodexStartup.exe     launch Codex with animation"
Write-Host "  Codex Startup.lnk    pin this, not the Codex window"
Write-Host "  AemeathPreview.exe   standalone preview"
