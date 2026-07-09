# bili-download installer (Windows PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = "Stop"
Write-Host "Installing bili-download..." -ForegroundColor Cyan

# 1. yt-dlp.exe
if (!(Test-Path "yt-dlp.exe")) {
    Write-Host "Downloading yt-dlp.exe..."
    try {
        Invoke-WebRequest "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "yt-dlp.exe"
        Write-Host "yt-dlp.exe OK" -ForegroundColor Green
    } catch {
        Write-Host "yt-dlp download failed (network/GFW?). Get it manually: https://github.com/yt-dlp/yt-dlp/releases" -ForegroundColor Yellow
    }
} else { Write-Host "yt-dlp.exe exists, skip" }

# 2. ffmpeg.exe / ffprobe.exe
$needFfmpeg = !(Test-Path "ffmpeg.exe")
if ($needFfmpeg) {
    Write-Host "ffmpeg.exe NOT found." -ForegroundColor Yellow
    Write-Host "  Download ffmpeg essentials: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -ForegroundColor Yellow
    Write-Host "  Extract and put bin/ffmpeg.exe + bin/ffprobe.exe in this folder" -ForegroundColor Yellow
}

# 3. Register Claude skill
$skillDir = Join-Path $env:USERPROFILE ".claude\skills\bili-download"
New-Item -ItemType Directory -Force -Path $skillDir | Out-Null
foreach ($f in @("SKILL.md","bili_download.js","login.js","package.json")) {
    if (Test-Path $f) { Copy-Item $f $skillDir -Force }
}
Write-Host "Skill registered to: $skillDir" -ForegroundColor Green

Write-Host ""
Write-Host "=== Next steps ===" -ForegroundColor Cyan
Write-Host "  1. node login.js        (scan QR with phone Bilibili app -> cookies.txt)"
Write-Host "  2. node bili_download.js <UID>   (download collections)"
Write-Host ""
Write-Host "In Claude Code, just say: download collections of space.bilibili.com/<UID>" -ForegroundColor Cyan
